// ===== 步骤17: 保存导出 =====

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { escapeHtml } from '../../utils/html.js';
import { collectChainedRaceFeatures } from '../../handlers/data-query.js';
import { getRaceFeatures } from './01-race.js';
import { collectAllFeatureBonuses, getRaceAbilityBonus } from './08-bonus.js';
import { parseSpellCounts } from './11-spells.js';
import { calculateModifier } from './07-ability.js';
import { translateDamageType, translateProperties } from '../../core/data/dictionary.js';

// 翻译：生成种族显示名，有亚种时显示"种族名（亚种名）"
function getRaceDisplayName() {
    if (!character.race) return '';
    if (character.subrace) return character.race.name + '（' + character.subrace.name + '）';
    return character.race.name;
}

export function renderExportStep(container) {
    const name = character.name || '未命名角色';
    const cls = character.class;
    const race = character.subrace || character.race;

    // 收集语言信息
    let languageNames = [];
    let bonuses = null;
    try {
        bonuses = collectAllFeatureBonuses();
        if (bonuses && bonuses.languages) {
            languageNames = bonuses.languages.map(l => l.name);
        }
    } catch(e) { /* ignore */ }
    // 加上用户额外选择的语言
    if (character.selectedLanguages && character.selectedLanguages.length > 0) {
        const langData = dataCache.languages || [];
        character.selectedLanguages.forEach(id => {
            const lang = langData.find(l => l.id === id);
            if (lang && !languageNames.includes(lang.name)) {
                languageNames.push(lang.name);
            }
        });
    }

    container.innerHTML = `
        <div class="export-step">
            <div class="export-header">
                <h2>完成创建！</h2>
                <p class="export-subtitle">${escapeHtml(name)} · ${cls ? (cls.name || cls.class) : ''} ${getRaceDisplayName()}</p>
            </div>

            <div class="export-summary">
                <div class="export-summary-title">角色摘要</div>
                <div class="export-summary-grid">
                    <div class="export-summary-item">
                        <span class="export-summary-label">种族</span>
                        <span class="export-summary-value">${getRaceDisplayName() || '未选择'}</span>
                    </div>
                    <div class="export-summary-item">
                        <span class="export-summary-label">职业</span>
                        <span class="export-summary-value">${cls ? escapeHtml(cls.name || cls.class) : '未选择'}</span>
                    </div>
                    <div class="export-summary-item">
                        <span class="export-summary-label">背景</span>
                        <span class="export-summary-value">${character.background ? escapeHtml(character.background.name) : '未选择'}</span>
                    </div>
                    <div class="export-summary-item">
                        <span class="export-summary-label">等级</span>
                        <span class="export-summary-value">${character.level || 1}</span>
                    </div>
                    ${languageNames.length > 0 ? `
                    <div class="export-summary-item export-summary-item-wide">
                        <span class="export-summary-label">语言</span>
                        <span class="export-summary-value">${escapeHtml(languageNames.join('、'))}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="export-buttons">
                <div class="export-card" onclick="exportCharacterJSON()">
                    <div class="export-card-icon">📄</div>
                    <div class="export-card-title">导出 JSON</div>
                    <div class="export-card-desc">导出完整角色数据（存档用，可重新导入编辑）</div>
                </div>

                <div class="export-card" onclick="exportCharacterPDF()">
                    <div class="export-card-icon">🖨️</div>
                    <div class="export-card-title">导出 PDF</div>
                    <div class="export-card-desc">生成可打印的角色卡（美观格式，适合打印）</div>
                </div>

                <div class="export-card upgrade-card" onclick="goUpgrade()">
                    <div class="export-card-icon">⭐</div>
                    <div class="export-card-title">升级角色</div>
                    <div class="export-card-desc">提升等级，获得新特性和法术，让角色变得更强</div>
                </div>
            </div>

            <div class="export-info">
                <div class="export-info-title">导出说明</div>
                <ul>
                    <li><strong>JSON</strong>：保存所有选择的 ID 记录，用于后续重新编辑角色</li>
                    <li><strong>PDF</strong>：生成标准打印格式的 D&D 5e 角色卡，可保存为文件或直接打印</li>
                </ul>
            </div>
        </div>
    `;
}

// 导出 JSON 存档
export function exportCharacterJSON() {
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
        selectedSpells: character.selectedSpells || [],
        lockedSpells: character.lockedSpells || [],
        classPackage: character.classPackage ? { id: character.classPackage.id } : null,
        bgPackage: character.bgPackage ? { id: character.bgPackage.id } : null,
        shoppingItems: character.shoppingItems || [],
        currency: character.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
        name: character.name || '',
        player: character.player || '',
        alignment: character.alignment || '',
        level: character.level || 1,
        personalTraits: character.personalTraits || '',
        ideals: character.ideals || '',
        bonds: character.bonds || '',
        flaws: character.flaws || '',
        backstory: character.backstory || '',
        selectedLanguages: character.selectedLanguages || []
    };

    const jsonStr = JSON.stringify(saveData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const filename = `${(character.name || '未命名角色').replace(/\s+/g, '_')}的存档.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导出 PDF
export function exportCharacterPDF() {
    const name = character.name || 'dnd_char';

    if (typeof html2canvas === 'undefined') {
        alert('html2canvas 库未加载，请检查网络连接后刷新页面重试');
        return;
    }
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        alert('jsPDF 库未加载，请检查网络连接后刷新页面重试');
        return;
    }

    const html = generatePrintableHTML();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.style.cssText = 'position:absolute;left:0;top:0;width:210mm;height:auto;z-index:9999;background:#fff;';
    document.body.appendChild(wrapper);

    setTimeout(async () => {
        try {
            window.scrollTo(0, 0);

            if (wrapper.scrollHeight === 0) {
                throw new Error('包裹元素内容高度为 0');
            }

            const canvas = await html2canvas(wrapper, {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('Canvas 渲染为空');
            }

            const JSPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
            if (typeof JSPDF !== 'function') {
                throw new Error('jsPDF 构造函数不可用');
            }
            const pdf = new JSPDF({
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            });

            const margin = 8;
            const pageWidth = 210 - margin * 2;
            const pageHeight = 297 - margin * 2;

            const canvasAspect = canvas.width / canvas.height;
            const pageAspect = pageWidth / pageHeight;

            let imgWidth, imgHeight;
            if (canvasAspect > pageAspect) {
                imgWidth = pageWidth;
                imgHeight = imgWidth / canvasAspect;
            } else {
                imgHeight = pageHeight;
                imgWidth = imgHeight * canvasAspect;
            }

            let remainingHeight = canvas.height;
            let srcY = 0;
            let pageIndex = 0;

            while (remainingHeight > 0) {
                if (pageIndex > 0) pdf.addPage();

                const pageCanvasH = (pageHeight / imgHeight) * canvas.height;
                const srcH = Math.min(pageCanvasH, remainingHeight);

                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = srcH;
                const ctx = pageCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

                const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
                const displayH = (srcH / canvas.height) * imgHeight;
                pdf.addImage(pageImgData, 'JPEG', margin, margin, imgWidth, displayH);

                srcY += srcH;
                remainingHeight -= srcH;
                pageIndex++;
            }

            pdf.save(`${name.replace(/\s+/g, '_')}的角色卡.pdf`);

            document.body.removeChild(wrapper);
        } catch (err) {
            console.error('PDF 导出失败:', err);
            try {
                const printWin = window.open('', '_blank');
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

// 生成可打印的角色卡 HTML（扁平化风格，与角色卡布局一致）
function generatePrintableHTML() {
    var baseAbilities = character.abilities || {};
    var raceBonus = (typeof getRaceAbilityBonus === 'function') ? getRaceAbilityBonus() : {};
    var bgBonus = (character.backgroundBonus && character.backgroundBonus.bonus) || {};

    function toAbilityId(attr) {
        if (typeof attr === 'number') return attr;
        var s = (dataCache.skills || []).find(function(sk) { return sk.name === attr; });
        return s ? s.id : attr;
    }

    function getFinalAbility(attr) {
        var id = toAbilityId(attr);
        return (baseAbilities[id] || 8) + (raceBonus[id] || 0) + (bgBonus[id] || 0);
    }
    function fmtNum(val) { return val >= 0 ? '+' + val : '' + val; }
    function esc(t) { if (!t) return ''; return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function formatDesc(text) {
        if (!text) return '';
        if (/<[a-z][\s\S]*?>/i.test(text)) return text;
        return text.split('\n').filter(Boolean).join('<br>');
    }

    // 从 rules 中解析 spells(id=N) 获取法术真数据（替代占位名称/描述）
    function resolveSpellFromRules(feature) {
        if (!feature || !feature.rules) return null;
        var m = String(feature.rules).match(/^spells?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*$/i);
        if (!m) return null;
        return (dataCache.spells || []).find(function(s) { return s.id === parseInt(m[1], 10); }) || null;
    }

    var profBonus = Math.ceil((character.level || 1) / 4) + 1;
    var cls = character.class;
    var race = character.subrace || character.race;

    var abilityIdToAttr = { 1: 'strength', 4: 'dexterity', 9: 'constitution', 11: 'intelligence', 18: 'wisdom', 25: 'charisma' };
    var saveIdToAbility = { 2: 1, 5: 4, 10: 9, 13: 11, 22: 18, 31: 25 };
    var classSaveIds = cls ? String(cls['saving_throw_prof'] || '').split(',').map(function(s){return parseInt(s.trim())}).filter(function(n){return !isNaN(n)}) : [];

    function isSaveProficient(attr) {
        var id = toAbilityId(attr);
        var engAttr = abilityIdToAttr[id];
        var fromClass = (function(){
            var sid = Object.keys(saveIdToAbility).find(function(k){return saveIdToAbility[k]===id});
            return sid && classSaveIds.includes(parseInt(sid));
        })();
        return fromClass;
    }

    var allSkills = (dataCache.skills||[]).filter(function(s){return s.type===3});
    var allSaves = (dataCache.skills||[]).filter(function(s){return s.type===2});
    var proficientSkillNames = (character.allSkills||[]);
    function isSkillProficient(sn) { return proficientSkillNames.includes(sn); }

    var raceFeatures = race && typeof getRaceFeatures==='function' ? getRaceFeatures(race) : [];
    // 递归收集同表链引用的特性（如"岩石侏儒"→"法术:魔法伎俩"）
    if (raceFeatures.length > 0 && typeof collectChainedRaceFeatures === 'function') {
        raceFeatures.slice().forEach(function(f) {
            collectChainedRaceFeatures(f, raceFeatures);
        });
    }
    var classFeatures = [];
    if (cls && dataCache.classFeatures) {
        var ids = String(cls.chain||'').split(',').map(function(s){return parseInt(s.trim())}).filter(function(n){return !isNaN(n)});
        classFeatures = ids.map(function(id){return dataCache.classFeatures.find(function(f){return f.id===id})}).filter(Boolean);
        // 递归收集同表链引用
        if (typeof collectChainedRaceFeatures === 'function') {
            classFeatures.slice().forEach(function(f) {
                collectChainedRaceFeatures(f, classFeatures);
            });
        }
    }
    var feat = character.selectedFeat ? (dataCache.feats||[]).find(function(f){return f.id===character.selectedFeat}) : null;

    function getPackageItems(pkg) {
        if (!pkg || !pkg.desc) return [];
        return pkg.desc.split('\n').filter(Boolean).map(function(line){
            var m = line.match(/(\d+)\s*x?\s*([^\d].*)/);
            return m ? {qty:parseInt(m[1]),name:m[2].trim()} : {qty:1,name:line.trim()};
        });
    }
    var classPkgItems = getPackageItems(character.classPackage);
    var bgPkgItems = getPackageItems(character.bgPackage);
    var allEquipment = [].concat(classPkgItems, bgPkgItems, (character.shoppingItems||[]).map(function(i){return {qty:i.qty||1,name:i.name}}));
    var equipMap = {};
    allEquipment.forEach(function(item){var k=item.name; equipMap[k] ? equipMap[k].qty+=item.qty : equipMap[k]={qty:item.qty,name:item.name};});
    var equipment = Object.values(equipMap);
    var currency = character.currency || {pp:0,gp:0,ep:0,sp:0,cp:0};
    var currencyMap = {pp:'PP',gp:'GP',ep:'EP',sp:'SP',cp:'CP'};
    var currencyOrder = ['pp','gp','ep','sp','cp'];

    var weaponData = (dataCache.weapons||[]);
    var characterWeapons = equipment.filter(function(eq){
        return weaponData.find(function(w){return eq.name.includes(w.name.replace(/[A-Za-z]/g,'').trim())||w.name.includes(eq.name)});
    }).map(function(eq){
        var w = weaponData.find(function(w){return eq.name.includes(w.name.replace(/[A-Za-z]/g,'').trim())||w.name.includes(eq.name)});
        var isMelee = w && (String(w['weapon_range'])==='61');
        var isFinesse = w && String(w.properties||'').includes('4');
        var atkAbility = isMelee ? getFinalAbility('力量') : getFinalAbility('敏捷');
        if (isFinesse) atkAbility = Math.max(getFinalAbility('力量'),getFinalAbility('敏捷'));
        var atkBonus = calculateModifier(atkAbility) + profBonus;
        return {name: w?w.name:eq.name, atkBonus:fmtNum(atkBonus), damageDice: w?(w.damage_dice||'---'):'---', damageType: translateDamageType(w?(w.damage_type||''):''), effect: translateProperties(w?(w.properties||''):'')};
    });

    var spellInfo = cls && typeof parseSpellCounts==='function' ? parseSpellCounts(cls.id) : null;
    var selectedSpells = [];
    var allSpellIds = (character.selectedSpells || []).slice();
    var bonuses = collectAllFeatureBonuses();
    if (bonuses && bonuses.spells) {
        bonuses.spells.forEach(function(s) {
            if (allSpellIds.indexOf(s.id) === -1) allSpellIds.push(s.id);
        });
    }
    if (allSpellIds.length > 0) {
        selectedSpells = (dataCache.spells || []).filter(function(s) { return allSpellIds.indexOf(s.id) !== -1; });
    }
    var cantrips = selectedSpells.filter(function(s){return s.level===0});
    // 按环位分组
    var spellsByLevel = {};
    for (var i = 1; i <= 9; i++) {
        spellsByLevel[i] = selectedSpells.filter(function(s){return s.level===i});
    }

    var spellAbility = spellInfo && spellInfo.ability ? spellInfo.ability : null;
    var spellAbilityMod = spellAbility ? calculateModifier(getFinalAbility(spellAbility)) : 0;
    var spellAttackBonus = spellAbilityMod + profBonus;
    var spellDC = 8 + spellAbilityMod + profBonus;
    function getMethodLabel(method, spellInfo) {
        // 从映射表获取标签
        var entry = (dataCache.spellcastingMethods || []).find(function(m) { return m.name === method; });
        if (method === 'spellbook' && spellInfo && spellInfo.spellbook_start) {
            return '法术书（' + spellInfo.spellbook_start + '个）';
        }
        return entry ? entry.label : (method || '');
    }

    var maxHP = 0;
    if (cls) { 
        var hd = parseInt((cls.hit_dice||'D8').replace('D','')); 
        maxHP = hd + calculateModifier(getFinalAbility('体质')); 
        if (character.hpPerLevelBonus) {
            maxHP += character.hpPerLevelBonus * (character.level || 1);
        }
    }
    var wisMod = calculateModifier(getFinalAbility('感知'));
    var perceptionSkill = allSkills.find(function(s){return s.name==='察觉'});
    var perceptionProficient = perceptionSkill ? isSkillProficient('察觉') : false;
    var passivePerception = 10 + wisMod + (perceptionProficient ? profBonus : 0);
    var dexMod = calculateModifier(getFinalAbility('敏捷'));
    var baseAC = 10 + dexMod;
    var initiative = dexMod;

    var ABILITY_NAMES = [1, 4, 9, 11, 18, 25];
    var abilitySkillMap = {};
    ABILITY_NAMES.forEach(function(id){
        var attr = abilityIdToAttr[id];
        abilitySkillMap[id] = {save: allSaves.find(function(s){return s.attr===attr}), skills: allSkills.filter(function(s){return s.attr===attr})};
    });
    function abilityDisplayLabel(id) {
        var s = (dataCache.skills || []).find(function(sk){return sk.id===id;});
        return s ? s.name : String(id);
    }

    var css = `
        <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pdf-body { font-family: "Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif; background: #fff; color: #222; line-height: 1.4; width: 210mm; font-size: 10pt; }
        .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 5mm 7mm; background: #fff; }

        /* ---- 头部 ---- */
        .pdf-header { text-align: center; padding: 0 0 3mm; border-bottom: 1.5px solid #222; margin-bottom: 3mm; }
        .pdf-header h1 { font-size: 20pt; font-weight: 700; margin-bottom: 1mm; letter-spacing: 1px; color: #000; }
        .pdf-header .sub { font-size: 9pt; color: #555; }
        .pdf-header .player { font-size: 7.5pt; color: #999; margin-top: 1mm; }

        /* ---- 扁平区域 ---- */
        .pdf-section { padding: 2.5mm 0; border-bottom: 1px solid #ddd; }
        .pdf-section:last-child { border-bottom: none; }
        .pdf-section-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #222; margin-bottom: 2mm; }

        /* ---- 战斗条（无边框，用背景色） ---- */
        .pdf-combat-bar { display: flex; gap: 1mm; }
        .pdf-cb-item { flex: 1; text-align: center; padding: 1.5mm 1mm; background: #f5f5f5; border-radius: 0.5mm; min-width: 0; }
        .pdf-cb-label { font-size: 5.5pt; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .pdf-cb-value { font-size: 11pt; font-weight: 700; color: #000; }

        /* ---- 属性×技能 6列网格（无边框，用背景色） ---- */
        .pdf-ag-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.8mm; }
        .pdf-ag-col { background: #f7f7f7; border-radius: 0.5mm; overflow: hidden; min-width: 0; }
        .pdf-ag-hd { text-align: center; padding: 1mm 0.5mm 0.5mm; background: #eee; }
        .pdf-ag-name { font-size: 6pt; font-weight: 700; color: #555; letter-spacing: 1px; text-transform: uppercase; }
        .pdf-ag-val { font-size: 11pt; font-weight: 700; color: #000; line-height: 1.2; }
        .pdf-ag-mod { font-size: 8pt; font-weight: 700; color: #222; }
        .pdf-ag-bonus { font-size: 4.5pt; color: #999; line-height: 1.1; margin-top: 0.5px; }
        .pdf-ag-bd { padding: 0.5mm 1mm 1mm; }
        .pdf-ag-row { display: flex; align-items: center; gap: 0.5mm; padding: 0.2mm 0.5mm; font-size: 5.5pt; line-height: 1.35; }
        .pdf-ag-dot { font-size: 4pt; width: 8px; text-align: center; flex-shrink: 0; color: #ccc; }
        .pdf-ag-row.on .pdf-ag-dot { color: #222; }
        .pdf-ag-rl { flex: 1; min-width: 0; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pdf-ag-row.on .pdf-ag-rl { color: #222; font-weight: 500; }
        .pdf-ag-rv { font-weight: 600; color: #ccc; flex-shrink: 0; min-width: 14px; text-align: right; font-size: 5pt; }
        .pdf-ag-row.on .pdf-ag-rv { color: #222; }

        /* ---- 武器表格（扁平，无边框单元格） ---- */
        .pdf-wp-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
        .pdf-wp-table th { text-align: left; padding: 0.8mm 1.5mm; font-size: 6pt; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 600; border-bottom: 1px solid #ddd; }
        .pdf-wp-table td { padding: 0.5mm 1.5mm; color: #444; border-bottom: 0.5px solid #eee; }
        .pdf-wp-n { color: #000; font-weight: 500; }
        .pdf-wp-a { color: #2e7d32; font-weight: 600; font-family: 'Consolas', monospace; }
        .pdf-wp-d { color: #b8860b; font-weight: 600; font-family: 'Consolas', monospace; }
        .pdf-wp-t { color: #555; }
        .pdf-wp-e { color: #999; font-size: 6.5pt; }

        /* ---- 法术施法能力条（无边框） ---- */
        .pdf-spell-cast { display: flex; gap: 1mm; margin-bottom: 2mm; flex-wrap: wrap; }
        .pdf-sc-item { display: flex; flex-direction: column; align-items: center; padding: 0.8mm 2.5mm; background: #f5f5f5; border-radius: 0.5mm; min-width: 0; }
        .pdf-sc-label { font-size: 5.5pt; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        .pdf-sc-value { font-size: 8.5pt; font-weight: 700; color: #000; }
        .pdf-sc-note { font-size: 6pt; color: #888; font-style: italic; padding: 0.3mm 2mm; background: #f5f5f5; border-radius: 0.5mm; display: inline-block; }

        /* ---- 法术列表 ---- */
        .pdf-sl-cat { margin-bottom: 1.5mm; }
        .pdf-sl-cat-hd { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #222; border-bottom: 1px solid #ddd; padding: 0.5mm 0; margin-bottom: 0.5mm; }
        .pdf-sl-row { display: flex; align-items: center; gap: 2mm; padding: 0.4mm 0; font-size: 7pt; border-bottom: 0.5px solid #f0f0f0; }
        .pdf-sl-name { font-weight: 500; color: #000; min-width: 35mm; }
        .pdf-sl-comp { color: #888; font-size: 6pt; min-width: 10mm; font-family: 'Consolas', monospace; }
        .pdf-sl-time { color: #999; font-size: 6pt; }
        .pdf-sl-tag { font-size: 5pt; padding: 0.1mm 1.2mm; border-radius: 0.5mm; font-weight: 600; text-transform: uppercase; }
        .pdf-sl-tag-c { color: #e65100; background: #fff3e0; }
        .pdf-sl-tag-r { color: #1565c0; background: #e3f2fd; }

        /* ---- 物品·货币 ---- */
        .pdf-inv-row { display: flex; flex-wrap: wrap; gap: 0.8mm; }
        .pdf-inv-tag { font-size: 7pt; color: #444; padding: 0.3mm 1.5mm; background: #f5f5f5; border-radius: 0.5mm; }
        .pdf-inv-q { color: #999; font-weight: 600; }
        .pdf-coin { font-size: 7pt; font-weight: 600; padding: 0.3mm 2mm; background: #f5f5f5; border-radius: 0.5mm; }
        .pdf-coin-pp { color: #5c6bc0; }
        .pdf-coin-gp { color: #b8860b; }
        .pdf-coin-ep { color: #78909c; }
        .pdf-coin-sp { color: #78909c; }
        .pdf-coin-cp { color: #8d6e63; }

        /* ---- 语言 ---- */
        .pdf-lang-row { display: flex; flex-wrap: wrap; gap: 0.8mm; }
        .pdf-lang-tag { font-size: 7pt; color: #444; padding: 0.3mm 1.5mm; background: #f5f5f5; border-radius: 0.5mm; }

        /* ---- 特性·专长 ---- */
        .pdf-feat-item { padding: 0.8mm 0; border-bottom: 0.5px solid #f0f0f0; }
        .pdf-feat-item:last-child { border-bottom: none; }
        .pdf-feat-n { font-size: 7.5pt; font-weight: 600; color: #000; margin-bottom: 0.2mm; }
        .pdf-feat-n:before { content: '\\25C6 '; color: #222; font-size: 5pt; }
        .pdf-feat-src { display: inline-block; margin-left: 2mm; font-size: 5.5pt; font-weight: 400; color: #999; background: #f5f5f5; padding: 0 1.5mm; border-radius: 0.5mm; text-transform: uppercase; letter-spacing: 1px; }
        .pdf-feat-d { font-size: 6.5pt; color: #555; line-height: 1.5; padding-left: 3mm; }

        /* ---- 技能熟练 ---- */
        .pdf-skill-list { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 3px; }
        .pdf-skill-item { font-size: 6pt; padding: 1px 4px; background: #f5f0e6; border-radius: 2px; }
        .pdf-skill-name { font-weight: 500; }
        .pdf-skill-attr { color: #888; font-size: 5pt; }

        /* ---- 装备列表 ---- */
        .pdf-equip-list { font-size: 6.5pt; }
        .pdf-equip-item { padding: 1px 0; }

        /* ---- 武器精通 ---- */
        .pdf-weapon-list { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 3px; }
        .pdf-weapon-item { font-size: 6pt; padding: 1px 4px; background: #f5f0e6; border-radius: 2px; }

        /* ---- 空状态 ---- */
        .pdf-empty { font-size: 6.5pt; color: #bbb; font-style: italic; }

        @media print { .pdf-body, .sheet { width: 210mm; margin: 0; } }
        </style>
    `;

    function buildAttrs() {
        var html = '';
        html += '<div class="pdf-header">';
        html += '<h1>' + esc(character.name) + '</h1>';
        html += '<div class="sub">';
        html += (getRaceDisplayName() || '未选择种族') + ' · ';
        html += (character.background ? esc(character.background.name) : '未选择背景') + ' · ';
        html += (cls ? esc(cls.name || cls.class) : '未选择职业');
        html += (character.alignment ? ' · ' + esc(character.alignment) : '');
        html += ' · Lv.' + (character.level || 1);
        html += '</div>';
        if (character.player) html += '<div class="player">玩家：' + esc(character.player) + '</div>';
        html += '</div>';

        // 战斗
        html += '<div class="pdf-section"><div class="pdf-section-title">战斗</div>';
        html += '<div class="pdf-combat-bar">';
        html += '<div class="pdf-cb-item"><div class="pdf-cb-label">HP</div><div class="pdf-cb-value">' + maxHP + '</div></div>';
        html += '<div class="pdf-cb-item"><div class="pdf-cb-label">AC</div><div class="pdf-cb-value">' + baseAC + '</div></div>';
        html += '<div class="pdf-cb-item"><div class="pdf-cb-label">先攻</div><div class="pdf-cb-value">' + fmtNum(initiative) + '</div></div>';
        html += '<div class="pdf-cb-item"><div class="pdf-cb-label">熟练</div><div class="pdf-cb-value">' + fmtNum(profBonus) + '</div></div>';
        html += '<div class="pdf-cb-item"><div class="pdf-cb-label">速度</div><div class="pdf-cb-value">30</div></div>';
        html += '<div class="pdf-cb-item"><div class="pdf-cb-label">被动感知</div><div class="pdf-cb-value">' + passivePerception + '</div></div>';
        html += '</div></div>';

        // 属性技能
        html += '<div class="pdf-section"><div class="pdf-section-title">属性 · 技能</div>';
        html += '<div class="pdf-ag-grid">';
        ABILITY_NAMES.forEach(function(attr) {
            var final = getFinalAbility(attr);
            var mod = calculateModifier(final);
            var save = abilitySkillMap[attr].save;
            var skills = abilitySkillMap[attr].skills;
            var saveProf = isSaveProficient(attr);
            var saveVal = mod + (saveProf ? profBonus : 0);
            var base = baseAbilities[attr] || 8;
            var rb = raceBonus[attr] || 0;
            var bb = bgBonus[attr] || 0;
            var bonusHtml = (rb || bb) ? '<div class="pdf-ag-bonus">基' + base + (rb ? '+种' + rb : '') + (bb ? '+背' + bb : '') + '</div>' : '';
            html += '<div class="pdf-ag-col"><div class="pdf-ag-hd"><div class="pdf-ag-name">' + abilityDisplayLabel(attr) + '</div><div class="pdf-ag-val">' + final + '</div><div class="pdf-ag-mod">' + fmtNum(mod) + '</div>' + bonusHtml + '</div><div class="pdf-ag-bd">';
            if (save) {
                html += '<div class="pdf-ag-row' + (saveProf ? ' on' : '') + '"><span class="pdf-ag-dot">' + (saveProf ? '●' : '○') + '</span><span class="pdf-ag-rl">豁免</span><span class="pdf-ag-rv">' + fmtNum(saveVal) + '</span></div>';
            }
            skills.forEach(function(skill) {
                var prof = isSkillProficient(skill.name);
                var val = mod + (prof ? profBonus : 0);
                html += '<div class="pdf-ag-row' + (prof ? ' on' : '') + '"><span class="pdf-ag-dot">' + (prof ? '●' : '○') + '</span><span class="pdf-ag-rl">' + esc(skill.name) + '</span><span class="pdf-ag-rv">' + fmtNum(val) + '</span></div>';
            });
            html += '</div></div>';
        });
        html += '</div></div>';

        // 技能熟练列表
        var allSkills = character.allSkills || [];
        var skillData = dataCache.skills || [];
        var proficientSkills = skillData.filter(function(s) {
            return allSkills.indexOf(s.name) !== -1;
        });
        if (proficientSkills.length > 0) {
            html += '<div class="pdf-section"><div class="pdf-section-title">技能熟练</div>';
            html += '<div class="pdf-skill-list">';
            proficientSkills.forEach(function(skill) {
                html += '<div class="pdf-skill-item"><span class="pdf-skill-name">' + esc(skill.name) + '</span>' +
                        (skill.attr ? '<span class="pdf-skill-attr">（' + esc(skill.attr) + '）</span>' : '') + '</div>';
            });
            html += '</div></div>';
        }

        // 武器
        if (characterWeapons.length > 0) {
            html += '<div class="pdf-section"><div class="pdf-section-title">武器</div>';
            html += '<table class="pdf-wp-table"><thead><tr><th>武器名</th><th>攻击加值</th><th>伤害骰</th><th>伤害类型</th><th>效果</th></tr></thead><tbody>';
            characterWeapons.forEach(function(w) {
                html += '<tr><td class="pdf-wp-n">' + esc(w.name) + '</td><td class="pdf-wp-a">' + w.atkBonus + '</td><td class="pdf-wp-d">' + w.damageDice + '</td><td class="pdf-wp-t">' + w.damageType + '</td><td class="pdf-wp-e">' + (w.effect ? esc(w.effect) : '---') + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        // 法术
        if (selectedSpells.length > 0) {
            html += '<div class="pdf-section"><div class="pdf-section-title">法术</div>';
            if (spellInfo && spellInfo.ability) {
                html += '<div class="pdf-spell-cast">';
                html += '<div class="pdf-sc-item"><span class="pdf-sc-label">施法属性</span><span class="pdf-sc-value">' + spellInfo.ability + '</span></div>';
                html += '<div class="pdf-sc-item"><span class="pdf-sc-label">法术攻击</span><span class="pdf-sc-value">' + fmtNum(spellAttackBonus) + '</span></div>';
                html += '<div class="pdf-sc-item"><span class="pdf-sc-label">法术DC</span><span class="pdf-sc-value">' + spellDC + '</span></div>';
                if (spellInfo.cantrips > 0) html += '<div class="pdf-sc-item"><span class="pdf-sc-label">戏法</span><span class="pdf-sc-value">' + spellInfo.cantrips + '</span></div>';
                if (spellInfo.prepared > 0) html += '<div class="pdf-sc-item"><span class="pdf-sc-label">准备法术</span><span class="pdf-sc-value">' + spellInfo.prepared + '</span></div>';
                for (var si = 1; si <= 9; si++) {
                    if (spellInfo.slots[si] && spellInfo.slots[si] > 0) {
                        html += '<div class="pdf-sc-item"><span class="pdf-sc-label">' + si + '环法术位</span><span class="pdf-sc-value">' + spellInfo.slots[si] + '</span></div>';
                    }
                }
                if (spellInfo.preparation_method) {
                    html += '<div class="pdf-sc-item"><span class="pdf-sc-label">法术方式</span><span class="pdf-sc-value">' + getMethodLabel(spellInfo.preparation_method, spellInfo) + '</span></div>';
                }
                if (spellInfo.preparation_rule) html += '<div class="pdf-sc-note">' + esc(spellInfo.preparation_rule) + '</div>';
                if (spellInfo.note) html += '<div class="pdf-sc-note">' + esc(spellInfo.note) + '</div>';
                html += '</div>';
            }

            function renderSpellsForRing(spells, label) {
                if (spells.length === 0) return;
                html += '<div class="pdf-sl-cat"><div class="pdf-sl-cat-hd">' + label + '</div>';
                spells.forEach(function(s) {
                    var comps = [];
                    if (s['component_v']) comps.push('V');
                    if (s['component_s']) comps.push('S');
                    if (s['component_m']) comps.push('M');
                    html += '<div class="pdf-sl-row"><span class="pdf-sl-name">' + esc(s.name) + '</span><span class="pdf-sl-comp">' + comps.join(',') + '</span><span class="pdf-sl-time">' + (s.casting_time || '---') + '</span>' + (s.concentration ? '<span class="pdf-sl-tag pdf-sl-tag-c">专注</span>' : '') + (s.ritual ? '<span class="pdf-sl-tag pdf-sl-tag-r">仪式</span>' : '') + '</div>';
                });
                html += '</div>';
            }

            renderSpellsForRing(cantrips, '戏法');
            for (var si = 1; si <= 9; si++) {
                var levelSpells = spellsByLevel[si];
                if (levelSpells && levelSpells.length > 0) {
                    renderSpellsForRing(levelSpells, si + '环');
                }
            }
            html += '</div>';
        }

        // 物品货币
        html += '<div class="pdf-section"><div class="pdf-section-title">物品 · 货币</div>';
        html += '<div class="pdf-inv-row">';
        if (equipment.length > 0) {
            equipment.forEach(function(item) {
                html += '<span class="pdf-inv-tag">' + (item.qty > 1 ? '<span class="pdf-inv-q">' + item.qty + 'x</span> ' : '') + esc(item.name) + '</span>';
            });
        } else {
            html += '<span class="pdf-empty">无装备</span>';
        }
        html += '</div>';
        html += '<div style="margin-top:1.5mm;display:flex;gap:1mm;flex-wrap:wrap;">';
        var hasCoin = false;
        currencyOrder.forEach(function(k) {
            if (currency[k] > 0) {
                html += '<span class="pdf-coin pdf-coin-' + k + '">' + currency[k] + ' ' + currencyMap[k] + '</span>';
                hasCoin = true;
            }
        });
        if (!hasCoin) html += '<span class="pdf-empty">0 金</span>';
        html += '</div></div>';

        // 语言
        var pdfLanguageNames = [];
        try {
            var pdfBonuses = collectAllFeatureBonuses();
            if (pdfBonuses && pdfBonuses.languages) {
                pdfBonuses.languages.forEach(function(l) { pdfLanguageNames.push(l.name); });
            }
        } catch(e) { /* 解析失败忽略 */ }
        if (character.selectedLanguages && character.selectedLanguages.length > 0) {
            var langData = dataCache.languages || [];
            character.selectedLanguages.forEach(function(id) {
                var lang = langData.find(function(l) { return l.id === id; });
                if (lang && pdfLanguageNames.indexOf(lang.name) === -1) {
                    pdfLanguageNames.push(lang.name);
                }
            });
        }
        if (pdfLanguageNames.length > 0) {
            html += '<div class="pdf-section"><div class="pdf-section-title">语言</div>';
            html += '<div class="pdf-lang-row">';
            pdfLanguageNames.forEach(function(name) {
                html += '<span class="pdf-lang-tag">' + esc(name) + '</span>';
            });
            html += '</div></div>';
        }

        // 特性专长
        html += '<div class="pdf-section"><div class="pdf-section-title">特性 · 专长</div>';
        if (feat) {
            html += '<div class="pdf-feat-item"><div class="pdf-feat-n">' + esc(feat.name) + '<span class="pdf-feat-src">专长</span></div><div class="pdf-feat-d">' + formatDesc(feat.desc || '') + '</div></div>';
        }
        raceFeatures.forEach(function(f) {
            var spell = resolveSpellFromRules(f);
            html += '<div class="pdf-feat-item"><div class="pdf-feat-n">' + esc(spell ? spell.name : f.name) + '<span class="pdf-feat-src">' + esc(getRaceDisplayName() || '种族') + '</span></div><div class="pdf-feat-d">' + formatDesc(spell ? spell.desc : (f.desc || '')) + '</div></div>';
        });
        classFeatures.forEach(function(f) {
            var spell = resolveSpellFromRules(f);
            html += '<div class="pdf-feat-item"><div class="pdf-feat-n">' + esc(spell ? spell.name : (f.name || f.name)) + '<span class="pdf-feat-src">' + esc(cls ? (cls.name || cls.class) : '职业') + '</span></div><div class="pdf-feat-d">' + formatDesc(spell ? spell.desc : (f.desc || f.desc || '')) + '</div></div>';
        });
        if (!feat && raceFeatures.length === 0 && classFeatures.length === 0) {
            html += '<span class="pdf-empty">暂无特性</span>';
        }
        html += '</div>';

        // 武器精通选择
        var fs = character.featureSelections;
        var weaponSelections = (fs && fs.weapons) || [];
        var weaponData2 = dataCache.weapons || [];
        var propData2 = dataCache.weaponProperties || [];
        if (weaponSelections.length > 0) {
            var masteryNames = [];
            weaponSelections.forEach(function(sel) {
                var w = weaponData2.find(function(w2) { return w2.id === sel.weaponId; });
                if (w && masteryNames.indexOf(w.name) === -1) {
                    masteryNames.push(w.name);
                }
            });
            if (masteryNames.length > 0) {
                html += '<div class="pdf-section"><div class="pdf-section-title">武器精通</div>';
                html += '<div class="pdf-weapon-list">';
                masteryNames.forEach(function(n) {
                    html += '<div class="pdf-weapon-item">' + esc(n) + '</div>';
                });
                html += '</div></div>';
            }
        }

        // 装备列表
        if (equipment && equipment.length > 0) {
            html += '<div class="pdf-section"><div class="pdf-section-title">装备</div>';
            html += '<div class="pdf-equip-list">';
            equipment.forEach(function(item) {
                html += '<div class="pdf-equip-item">' + esc(item.name || item) + '</div>';
            });
            html += '</div></div>';
        }

        return html;
    }

    return css + '<div class="pdf-body"><div class="sheet">' + buildAttrs() + '</div></div>';
}

// 跳转到升级页面：保存当前角色数据到 sessionStorage，然后跳转
export function goUpgrade() {
    // 构造存档数据（复用 exportCharacterJSON 的结构）
    var saveData = {
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
        selectedSpells: character.selectedSpells || [],
        lockedSpells: character.lockedSpells || [],
        classPackage: character.classPackage ? { id: character.classPackage.id } : null,
        bgPackage: character.bgPackage ? { id: character.bgPackage.id } : null,
        shoppingItems: character.shoppingItems || [],
        currency: character.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
        name: character.name || '',
        player: character.player || '',
        alignment: character.alignment || '',
        level: character.level || 1,
        personalTraits: character.personalTraits || '',
        ideals: character.ideals || '',
        bonds: character.bonds || '',
        flaws: character.flaws || '',
        backstory: character.backstory || '',
        selectedLanguages: character.selectedLanguages || []
    };

    // 存到 sessionStorage，升级页面自动读取
    sessionStorage.setItem('upgrade_character_data', JSON.stringify(saveData));
    // 跳转到升级页面
    window.location.href = '/character/dnd_5r/upgrade/upgrade.html';
}

// window 桥接：导出按钮与"前往升级"由导出页动态生成的 HTML 内联事件调用
window.exportCharacterJSON = exportCharacterJSON;
window.exportCharacterPDF = exportCharacterPDF;
window.goUpgrade = goUpgrade;