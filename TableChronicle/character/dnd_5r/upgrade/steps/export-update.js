import { upgradeState, escapeHtml, calculateModifier } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { getUpgradedSpellIds } from './sheet-update.js';

// ===== upgrade/steps/export-update.js =====
// 升级导出：导出页渲染、JSON/PDF 导出与可打印 HTML 生成。

// ============================================================
// 第3步：保存导出 + 继续升级
// ============================================================
function renderExportStep($content) {
    const newLevel = character.level;
    const oldLevel = newLevel - upgradeState.totalLevelsGained;
    const gains = upgradeState.gainedFeatures;
    const hasMoreLevels = newLevel < upgradeState.maxLevel;
    const cls = character.class;
    const race = character.subrace || character.race;

    $content.html(`
        <div class="upgrade-result" style="justify-content:flex-start;padding-top:10px;">
            <div class="upgrade-header">
                <div style="font-size:2.5rem;margin-bottom:8px;">✅</div>
                <h2>升级完成！</h2>
                <p class="subtitle">角色已达到 <strong>${newLevel} 级</strong></p>
            </div>

            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">📋</span> 升级摘要</div>
                <div class="change-row">
                    <span class="label">角色</span>
                    <span class="value">${character.name || '未命名'}</span>
                </div>
                <div class="change-row">
                    <span class="label">职业</span>
                    <span class="value">${cls ? cls.name : '-'}</span>
                </div>
                <div class="change-row">
                    <span class="label">种族</span>
                    <span class="value">${race ? race.name : '-'}</span>
                </div>
                <div class="change-row">
                    <span class="label">等级</span>
                    <span class="value"><strong style="color:#4caf50;">${newLevel} 级</strong></span>
                </div>
                ${gains.length > 0 ? `
                <hr class="section-divider">
                <div class="change-row">
                    <span class="label">新特性</span>
                    <span class="value diff">${gains.map(f => f.name).join('、')}</span>
                </div>
                ` : ''}
                ${upgradeState.abilityImprovement ? `
                <div class="change-row">
                    <span class="label">属性提升</span>
                    <span class="value diff">获得属性提升/专长机会</span>
                </div>
                ` : ''}
            </div>

            <div class="upgrade-actions" style="margin-top:16px;">
                <div class="upgrade-card" onclick="exportUpgradedCharacter()">
                    <div class="upgrade-card-icon">📄</div>
                    <div class="upgrade-card-title">导出 JSON</div>
                    <div class="upgrade-card-desc">保存升级后的角色存档（可重新导入）</div>
                </div>
                <div class="upgrade-card" onclick="exportUpgradePDF()">
                    <div class="upgrade-card-icon">🖨️</div>
                    <div class="upgrade-card-title">导出 PDF</div>
                    <div class="upgrade-card-desc">生成可打印的角色卡，适合线下跑团</div>
                </div>
                <div class="upgrade-card${hasMoreLevels ? '' : ' disabled'}" onclick="${hasMoreLevels ? 'continueUpgrade()' : ''}">
                    <div class="upgrade-card-icon">⬆️</div>
                    <div class="upgrade-card-title">继续升级</div>
                    <div class="upgrade-card-desc">${hasMoreLevels ? `升到 ${newLevel + 1} 级` : '已达最高等级'}</div>
                </div>
            </div>
        </div>
    `);
}

// 继续升级：回到预览步骤，等级+1

// ============================================================
// 导出功能
// ============================================================
function exportUpgradedCharacter() {
    const saveData = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        raceId: character.race ? character.race.id : null,
        subraceId: character.subrace ? character.subrace.id : null,
        classId: character.class ? character.class.id : null,
        subclassId: character.subclass ? character.subclass.id : null,
        backgroundId: character.background ? character.background.id : null,
        abilities: character.abilities || null,
        classSkills: character.classSkills || [],
        backgroundSkills: character.backgroundSkills || [],
        allSkills: character.allSkills || [],
        featureSelections: character.featureSelections || { tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: [] },
        backgroundBonus: character.backgroundBonus || null,
        selectedFeat: character.selectedFeat,
        selectedSpells: getUpgradedSpellIds(),
        lockedSpells: character.lockedSpells || [],
        classPackage: character.classPackage ? { id: character.classPackage.id } : null,
        bgPackage: character.bgPackage ? { id: character.bgPackage.id } : null,
        shoppingItems: character.shoppingItems || [],
        currency: character.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
        name: character.name || '',
        player: character.player || '',
        alignment: character.alignment || '',
        level: character.level,
        hp_max: character.hp_max,
        personalTraits: character.personalTraits || '',
        ideals: character.ideals || '',
        bonds: character.bonds || '',
        flaws: character.flaws || '',
        backstory: character.backstory || '',
        selectedLanguages: character.selectedLanguages || [],
        classExtraAll: character.classExtraAll || []
    };

    const jsonStr = JSON.stringify(saveData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const filename = `${(character.name || '未命名角色').replace(/\s+/g, '_')}_Lv${character.level}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导出 PDF 角色卡

// 导出 PDF 角色卡
function exportUpgradePDF() {
    var name = character.name || 'dnd_char';

    if (typeof html2canvas === 'undefined') {
        alert('html2canvas 库未加载，请检查网络连接后刷新页面重试');
        return;
    }
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        alert('jsPDF 库未加载，请检查网络连接后刷新页面重试');
        return;
    }

    var html = generateUpgradePrintableHTML();

    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.style.cssText = 'position:absolute;left:0;top:0;width:210mm;height:auto;z-index:9999;background:#fff;';
    document.body.appendChild(wrapper);

    setTimeout(async function() {
        try {
            window.scrollTo(0, 0);

            if (wrapper.scrollHeight === 0) {
                throw new Error('包裹元素内容高度为 0');
            }

            var canvas = await html2canvas(wrapper, {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('Canvas 渲染为空');
            }

            var JSPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
            if (typeof JSPDF !== 'function') {
                throw new Error('jsPDF 构造函数不可用');
            }
            var pdf = new JSPDF({
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            });

            var margin = 8;
            var pageWidth = 210 - margin * 2;
            var pageHeight = 297 - margin * 2;

            var canvasAspect = canvas.width / canvas.height;
            var pageAspect = pageWidth / pageHeight;

            var imgWidth, imgHeight;
            if (canvasAspect > pageAspect) {
                imgWidth = pageWidth;
                imgHeight = imgWidth / canvasAspect;
            } else {
                imgHeight = pageHeight;
                imgWidth = imgHeight * canvasAspect;
            }

            var remainingHeight = canvas.height;
            var srcY = 0;
            var pageIndex = 0;

            while (remainingHeight > 0) {
                if (pageIndex > 0) pdf.addPage();

                var pageCanvasH = (pageHeight / imgHeight) * canvas.height;
                var srcH = Math.min(pageCanvasH, remainingHeight);

                var pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = srcH;
                var ctx = pageCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

                var pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
                var displayH = (srcH / canvas.height) * imgHeight;
                pdf.addImage(pageImgData, 'JPEG', margin, margin, imgWidth, displayH);

                srcY += srcH;
                remainingHeight -= srcH;
                pageIndex++;
            }

            pdf.save(name.replace(/\s+/g, '_') + '_Lv' + character.level + '.pdf');

            document.body.removeChild(wrapper);
        } catch (err) {
            console.error('PDF 导出失败:', err);
            try {
                var printWin = window.open('', '_blank');
                printWin.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>角色卡</title></head><body>' + html + '</body></html>');
                printWin.document.close();
                printWin.focus();
                printWin.print();
                document.body.removeChild(wrapper);
            } catch (e2) {
                alert('PDF 导出失败: ' + (err.message || '未知错误') + '\n请尝试使用"导出 JSON"功能保存数据');
                document.body.removeChild(wrapper);
            }
        }
    }, 500);
}

// 生成可打印的角色卡 HTML（供 PDF 导出使用）

// 生成可打印的角色卡 HTML（供 PDF 导出使用）
function generateUpgradePrintableHTML() {
    function pdfFormatDesc(text) {
        if (!text) return '';
        if (/<[a-z][\s\S]*?>/i.test(text)) return text;
        return text.split('\n').filter(Boolean).join('<br>');
    }

    var name = character.name || '未命名角色';
    var cls = character.class;
    var race = character.subrace || character.race;
    var bg = character.background;
    var level = character.level;
    var profBonus = Math.ceil(level / 4) + 1;
    var abilities = character.abilities || {};

    var ABILITY_IDS = [1, 4, 9, 11, 18, 25];
    var abilityIdToName = {};
    ABILITY_IDS.forEach(function(id) {
        var s = (dataCache.skills || []).find(function(sk) { return sk.id === id; });
        abilityIdToName[id] = s ? s.name : '#' + id;
    });

    var raceBonus = {};
    if (race && race.bonus) {
        try { raceBonus = JSON.parse(race.bonus); } catch(e) { /* JSON解析失败，保留空对象 */ }
    }
    var bgBonus = (character.backgroundBonus && character.backgroundBonus.bonus) || {};

    function getAbility(id) { return (abilities[id] || 8) + (raceBonus[id] || 0) + (bgBonus[id] || 0); }
    const calcMod = calculateModifier;
    const esc = escapeHtml;
    function fmtNum(val) { return val >= 0 ? '+' + val : '' + val; }

    var profSkills = character.allSkills || [];
    var allSkills = (dataCache.skills || []).filter(function(s) { return s.type === 3; });
    var allSaves = (dataCache.skills || []).filter(function(s) { return s.type === 2; });

    var saveIds = cls ? String(cls['saving_throw_prof'] || '').split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); }) : [];
    function isSaveProf(id) { return saveIds.indexOf(id) !== -1; }

    var hd = cls ? parseInt((cls.hit_dice || 'D8').replace('D', '')) : 8;
    var conVal = getAbility(9);
    var conMod = calcMod(conVal);
    var maxHP = character.hp_max || (cls ? (hd + conMod) : 0);
    var dexMod = calcMod(getAbility(4));
    var baseAC = 10 + dexMod;
    var wisMod = calcMod(getAbility(18));
    var perceptionProf = profSkills.indexOf('察觉') !== -1;
    var passivePerception = 10 + wisMod + (perceptionProf ? profBonus : 0);

    var classFeatures = [];
    if (cls && dataCache.classFeatures) {
        classFeatures = (dataCache.classFeatures || []).filter(function(f) { return f.class === cls.id && f.level <= level; })
            .sort(function(a, b) { return a.level - b.level || a.id - b.id; });
    }
    var featByLevel = {};
    classFeatures.forEach(function(f) {
        if (!featByLevel[f.level]) featByLevel[f.level] = [];
        featByLevel[f.level].push(f);
    });

    var equipment = character.shoppingItems || [];
    var selectedSpells = [];
    var upgradedSpellIds = getUpgradedSpellIds();
    if (upgradedSpellIds.length > 0) {
        selectedSpells = (dataCache.spells || []).filter(function(s) { return upgradedSpellIds.indexOf(s.id) !== -1; });
    }

    var raceDisplay = race ? race.name : '—';
    if (character.subrace) raceDisplay = (character.race ? character.race.name : '') + '（' + character.subrace.name + '）';

    var css = '<style>' +
        '*{box-sizing:border-box;margin:0;padding:0}' +
        '.pdf-body{font-family:"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;background:#fff;color:#222;line-height:1.4;width:210mm;font-size:10pt}' +
        '.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:5mm 7mm;background:#fff}' +
        '.pdf-header{text-align:center;padding:0 0 3mm;border-bottom:1.5px solid #222;margin-bottom:3mm}' +
        '.pdf-header h1{font-size:20pt;font-weight:700;margin-bottom:1mm;letter-spacing:1px;color:#000}' +
        '.pdf-header .sub{font-size:9pt;color:#555}' +
        '.pdf-header .player{font-size:7.5pt;color:#999;margin-top:1mm}' +
        '.pdf-section{padding:2.5mm 0;border-bottom:1px solid #ddd}' +
        '.pdf-section:last-child{border-bottom:none}' +
        '.pdf-section-title{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#222;margin-bottom:2mm}' +
        '.pdf-combat{display:flex;flex-wrap:wrap;gap:3mm}' +
        '.pdf-combat-item{min-width:50mm;padding:1.5mm 2mm;background:#f5f5f5;border-radius:2px}' +
        '.pdf-combat-item .lbl{font-size:6.5pt;color:#888;margin-right:3mm}' +
        '.pdf-combat-item .val{font-size:11pt;font-weight:700}' +
        '.pdf-ability-grid{display:flex;flex-wrap:wrap;gap:2mm}' +
        '.pdf-ability-col{flex:1;min-width:65mm;border:1px solid #eee;border-radius:2px;padding:2mm;margin-bottom:2mm}' +
        '.pdf-ability-hd{text-align:center;padding-bottom:1.5mm;border-bottom:1px solid #eee;margin-bottom:1.5mm}' +
        '.pdf-ability-hd .an{font-size:8pt;color:#666}' +
        '.pdf-ability-hd .av{font-size:16pt;font-weight:700}' +
        '.pdf-ability-hd .am{font-size:10pt;color:#888;margin-top:-2px}' +
        '.pdf-skill-row{padding:0.5mm 1mm;display:flex;justify-content:space-between;font-size:8.5pt}' +
        '.pdf-skill-row.on{background:#f0f7ff}' +
        '.pdf-dot{color:#aaa;margin-right:1mm}' +
        '.pdf-skill-row.on .pdf-dot{color:#222}' +
        '.pdf-skill-val{font-weight:600}' +
        '.pdf-feat-lv{margin-bottom:2mm}' +
        '.pdf-feat-lv-title{font-size:8pt;font-weight:700;color:#444;margin-bottom:0.5mm}' +
        '.pdf-feat-item{font-size:8.5pt;padding:0.3mm 0}' +
        '.pdf-feat-desc{font-size:7.5pt;color:#666;padding-left:2mm}' +
        '.pdf-spell-bar{display:flex;gap:3mm;margin-bottom:2mm}' +
        '.pdf-spell-bar-item{padding:1mm 2mm;background:#f5f5f5;border-radius:2px}' +
        '.pdf-spell-bar-item .lbl{font-size:6.5pt;color:#888}' +
        '.pdf-spell-bar-item .val{font-size:10pt;font-weight:700}' +
        '.pdf-spell-lv{margin-bottom:1.5mm}' +
        '.pdf-spell-lv-title{font-size:8pt;font-weight:700;color:#444;margin-bottom:0.5mm}' +
        '.pdf-spell-tag{display:inline-block;font-size:7.5pt;padding:0.3mm 1.5mm;margin:0.3mm;background:#f0f4ff;border-radius:2px;color:#335}' +
        '.pdf-equip-item{font-size:8.5pt;padding:0.3mm 0}' +
        '.pdf-empty{font-size:8pt;color:#aaa;padding:1mm 0}' +
    '</style>';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(name) + '</title>' + css + '</head><body><div class="pdf-body"><div class="sheet">';

    // 头部
    html += '<div class="pdf-header"><h1>' + esc(name) + '</h1>' +
        '<div class="sub">' + esc(raceDisplay) + ' · ' + (bg ? esc(bg.name) : '—') + ' · ' + (cls ? esc(cls.name || cls.class) : '—') + (character.alignment ? ' · ' + esc(character.alignment) : '') + '</div>' +
        (character.player ? '<div class="player">玩家：' + esc(character.player) + '</div>' : '') + '</div>';

    // 战斗
    html += '<div class="pdf-section"><div class="pdf-section-title">⚔ 战斗</div><div class="pdf-combat">' +
        '<div class="pdf-combat-item"><span class="lbl">HP</span><span class="val">' + maxHP + '</span></div>' +
        '<div class="pdf-combat-item"><span class="lbl">AC</span><span class="val">' + baseAC + '</span></div>' +
        '<div class="pdf-combat-item"><span class="lbl">先攻</span><span class="val">' + fmtNum(dexMod) + '</span></div>' +
        '<div class="pdf-combat-item"><span class="lbl">熟练加值</span><span class="val">' + fmtNum(profBonus) + '</span></div>' +
        '<div class="pdf-combat-item"><span class="lbl">被动感知</span><span class="val">' + passivePerception + '</span></div>' +
        '<div class="pdf-combat-item"><span class="lbl">等级</span><span class="val">' + level + '</span></div>' +
        '</div></div>';

    // 属性
    html += '<div class="pdf-section"><div class="pdf-section-title">🎯 属性 · 技能</div>';
    html += '<div class="pdf-ability-grid">';
    ABILITY_IDS.forEach(function(attrId) {
        var final = getAbility(attrId);
        var mod = calcMod(final);
        var label = abilityIdToName[attrId] || '#' + attrId;
        var skills = allSkills.filter(function(s) { return s.attr === abilityIdToName[attrId]; });
        var saveProf = isSaveProf(attrId);
        var saveVal = mod + (saveProf ? profBonus : 0);

        html += '<div class="pdf-ability-col">';
        html += '<div class="pdf-ability-hd"><div class="an">' + label + '</div><div class="av">' + final + '</div><div class="am">' + fmtNum(mod) + '</div></div>';

        // 豁免
        html += '<div class="pdf-skill-row' + (saveProf ? ' on' : '') + '"><span><span class="pdf-dot">' + (saveProf ? '●' : '○') + '</span>豁免</span><span class="pdf-skill-val">' + fmtNum(saveVal) + '</span></div>';

        skills.forEach(function(skill) {
            var prof = profSkills.indexOf(skill.name) !== -1;
            var val = mod + (prof ? profBonus : 0);
            html += '<div class="pdf-skill-row' + (prof ? ' on' : '') + '"><span><span class="pdf-dot">' + (prof ? '●' : '○') + '</span>' + esc(skill.name) + '</span><span class="pdf-skill-val">' + fmtNum(val) + '</span></div>';
        });
        html += '</div>';
    });
    html += '</div></div>';

    // 特性
    html += '<div class="pdf-section"><div class="pdf-section-title">📜 职业特性</div>';
    var lvKeys = Object.keys(featByLevel).sort(function(a, b) { return parseInt(a) - parseInt(b); });
    lvKeys.forEach(function(lv) {
        html += '<div class="pdf-feat-lv"><div class="pdf-feat-lv-title">Lv.' + lv + '</div>';
        featByLevel[lv].forEach(function(f) {
            html += '<div class="pdf-feat-item">· ' + esc(f.name) + '</div>';
            if (f.desc) html += '<div class="pdf-feat-desc">' + pdfFormatDesc(f.desc) + '</div>';
        });
        html += '</div>';
    });
    if (lvKeys.length === 0) html += '<div class="pdf-empty">暂无特性</div>';
    html += '</div>';

    // 装备
    html += '<div class="pdf-section"><div class="pdf-section-title">🎒 装备</div>';
    if (equipment.length > 0) {
        equipment.forEach(function(item) {
            html += '<div class="pdf-equip-item">· ' + esc(item.name || item) + (item.qty ? ' ×' + item.qty : '') + '</div>';
        });
    } else {
        html += '<div class="pdf-empty">无装备</div>';
    }
    html += '</div>';

    // 法术
    if (selectedSpells.length > 0) {
        html += '<div class="pdf-section"><div class="pdf-section-title">🔮 法术</div>';
        var spellInfo = cls && dataCache.spellcasting ? dataCache.spellcasting.find(function(s) { return s.class === cls.id; }) : null;
        if (spellInfo && spellInfo.spellcasting_ability) {
            var spellAbilityMod = calcMod(getAbility(spellInfo.spellcasting_ability));
            var spellDC = 8 + spellAbilityMod + profBonus;
            var spellAtk = spellAbilityMod + profBonus;
            html += '<div class="pdf-spell-bar"><div class="pdf-spell-bar-item"><span class="lbl">法术DC</span><span class="val">' + spellDC + '</span></div><div class="pdf-spell-bar-item"><span class="lbl">法术攻击</span><span class="val">' + fmtNum(spellAtk) + '</span></div><div class="pdf-spell-bar-item"><span class="lbl">施法属性</span><span class="val">' + (abilityIdToName[spellInfo.spellcasting_ability] || '#' + spellInfo.spellcasting_ability) + '</span></div></div>';
        }
        var cantrips = selectedSpells.filter(function(s) { return s.level === 0; });
        if (cantrips.length > 0) {
            html += '<div class="pdf-spell-lv"><div class="pdf-spell-lv-title">戏法</div>';
            cantrips.forEach(function(s) { html += '<span class="pdf-spell-tag">' + esc(s.name) + '</span>'; });
            html += '</div>';
        }
        for (var lv = 1; lv <= 9; lv++) {
            var ls = selectedSpells.filter(function(s) { return s.level === lv; });
            if (ls.length > 0) {
                html += '<div class="pdf-spell-lv"><div class="pdf-spell-lv-title">' + lv + '环</div>';
                ls.forEach(function(s) { html += '<span class="pdf-spell-tag">' + esc(s.name) + '</span>'; });
                html += '</div>';
            }
        }
        html += '</div>';
    }

    html += '</div></div></body></html>';
    return html;
}

export {
    renderExportStep,
    exportUpgradedCharacter,
    exportUpgradePDF,
    generateUpgradePrintableHTML
};