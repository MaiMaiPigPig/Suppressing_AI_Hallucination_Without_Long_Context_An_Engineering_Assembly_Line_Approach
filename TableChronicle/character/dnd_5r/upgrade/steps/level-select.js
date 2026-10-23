import { escapeHtml, upgradeState, stepState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import {
    getSubclassFeatures,
    getSpellSlotsForLevel,
    getSpellPrepForLevel,
    getCantripCountForLevel,
    getCountFromProficiencyRef,
    collectAllClassExtraAll,
    getAbilityNameById,
    getSpellMethodInfo,
    getProfBonus
} from '../../handlers/data-query.js';
import { getClassFeaturesAtLevel1 as getClassFeatures } from '../../creation/steps/03-class.js';
import { processItemRules } from '../../handlers/index.js';
import { renderStep } from '../flow/step-router.js';
import { ensureLevelGains } from '../flow/lifecycle.js';
import { renderSubclassSelection } from './feature-select.js';

/**
 * 渲染升级概览页
 */
function renderOverviewStep($content) {
    const currentLevel = character.level;
    const nextLevel = currentLevel + 1;
    const gains = ensureLevelGains(nextLevel);

    $content.html(`
        <div class="upgrade-result" style="justify-content:flex-start;padding-top:10px;">
            <div class="upgrade-header">
                <h2>升级概览</h2>
                <p class="subtitle">${currentLevel} 级 → <strong>${nextLevel} 级</strong></p>
            </div>

            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">⭐</span> 基础提升</div>
                <div class="change-row">
                    <span class="label">等级</span>
                    <span class="value">${currentLevel} → ${nextLevel}</span>
                </div>
                <div class="change-row">
                    <span class="label">熟练加值</span>
                    <span class="value">${getProfBonus(currentLevel)} → <strong style="color:#4caf50;">${getProfBonus(nextLevel)}</strong></span>
                </div>
                ${gains.hpGain > 0 ? `
                <div class="change-row">
                    <span class="label">生命值</span>
                    <span class="value diff" title="${escapeHtml(gains.hpGainDetail)}">${character.hp_max || '?'} → ${(character.hp_max || 0) + gains.hpGain}  <strong style="color:#4caf50;">+${gains.hpGain}</strong></span>
                </div>
                ` : ''}
            </div>

            ${gains.abilityImprovement ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">💪</span> 属性提升</div>
                <div class="change-row">
                    <span class="value">获得属性提升机会或选择一项专长</span>
                </div>
            </div>
            ` : ''}

            ${gains.classFeatures && gains.classFeatures.length > 0 ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">✨</span> 新特性</div>
                <div class="change-row">
                    <span class="label">职业特性</span>
                    <span class="value">${gains.classFeatures.length} 项</span>
                </div>
                ${gains.subclassFeatures && gains.subclassFeatures.length > 0 ? `
                <div class="change-row">
                    <span class="label">${gains.subclassName ? escapeHtml(gains.subclassName) : '子职'}特性</span>
                    <span class="value">${gains.subclassFeatures.length} 项</span>
                </div>
                ` : ''}
            </div>
            ` : gains.subclassFeatures && gains.subclassFeatures.length > 0 ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">🌟</span> 新特性</div>
                <div class="change-row">
                    <span class="label">${gains.subclassName ? escapeHtml(gains.subclassName) : '子职'}特性</span>
                    <span class="value">${gains.subclassFeatures.length} 项</span>
                </div>
            </div>
            ` : ''}

            ${gains.spellcastingInfo && Object.keys(gains.spellcastingInfo).length > 0 ? (function(sc) {
                const abilityName = getAbilityNameById(sc.ability);
                const methodInfo = getSpellMethodInfo(sc.method);
                let prepHtml = '';
                if (sc.preparedGain > 0) {
                    prepHtml = '<div class="change-row">' +
                        '<span class="label">准备法术</span>' +
                        '<span class="value diff">' + sc.preparedCurrent + ' + ' + sc.preparedGain + ' = <strong style="color:#4caf50;">' + sc.preparedNext + '</strong></span>' +
                        '</div>';
                } else if (sc.preparedNext > 0) {
                    prepHtml = '<div class="change-row">' +
                        '<span class="label">准备法术</span>' +
                        '<span class="value">' + sc.preparedNext + ' 个</span>' +
                        '</div>';
                }
                let cantripHtml = '';
                if (sc.cantripGain > 0) {
                    cantripHtml = '<div class="change-row">' +
                        '<span class="label">戏法</span>' +
                        '<span class="value diff">' + sc.cantripCurrent + ' + ' + sc.cantripGain + ' = <strong style="color:#4caf50;">' + sc.cantripNext + '</strong></span>' +
                        '</div>';
                } else if (sc.cantripNext > 0) {
                    cantripHtml = '<div class="change-row">' +
                        '<span class="label">戏法</span>' +
                        '<span class="value">' + sc.cantripNext + ' 个</span>' +
                        '</div>';
                }
                if (!prepHtml && !cantripHtml) return '';
                return '<div class="section" style="max-width:640px;">' +
                    '<div class="section-title"><span class="icon">🔮</span> 施法能力</div>' +
                    '<div class="change-row"><span class="label">施法属性</span><span class="value">' + abilityName + '</span></div>' +
                    (methodInfo.label ? '<div class="change-row"><span class="label">施法方式</span><span class="value">' + escapeHtml(methodInfo.label) + '</span></div>' : '') +
                    prepHtml +
                    cantripHtml +
                    '</div>';
            })(gains.spellcastingInfo) : ''}

            ${Object.keys(gains.newSpellSlots).length > 0 ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">🔮</span> 新法术位</div>
                ${Object.entries(gains.newSpellSlots).map(([level, count]) => `
                <div class="change-row">
                    <span class="label">${level}环</span>
                    <span class="value diff">+${count}</span>
                </div>
                `).join('')}
            </div>
            ` : ''}

            ${gains.features.length === 0 && !gains.abilityImprovement && Object.keys(gains.newSpellSlots).length === 0 ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">📋</span> 升级内容</div>
                <div class="change-row">
                    <span class="value" style="color:var(--text-muted);">该等级无特殊内容，仅有基础属性提升</span>
                </div>
            </div>
            ` : ''}
        </div>
    `);
}

/**
 * 渲染新增特性页
 */
function renderFeaturesStep($content) {
    if (!character.class) {
        stepState.current = 0;
        renderStep(0);
        return;
    }

    const gains = ensureLevelGains();

    const classFeaturesHtml = (gains.classFeatures || []).map(f => {
        const desc = f.desc || '';
        return `
        <div class="feature-item">
            <span class="f-icon">🛠️</span>
            <div>
                <div class="f-name">${escapeHtml(f.name)}</div>
                ${desc
                    ? `<div class="f-desc">${desc}</div>`
                    : '<div class="f-desc" style="color:var(--text-muted);">该特性暂无详细描述</div>'}
            </div>
        </div>`;
    }).join('');

    const subclassName = gains.subclassName ? escapeHtml(gains.subclassName) : null;
    const subclassFeaturesHtml = (gains.subclassFeatures && gains.subclassFeatures.length > 0 ? gains.subclassFeatures : []).map(f => {
        const desc = f.desc || '';
        return `
        <div class="feature-item">
            <span class="f-icon">🌟</span>
            <div>
                <div class="f-name">${escapeHtml(f.name)}</div>
                ${desc
                    ? `<div class="f-desc">${desc}</div>`
                    : '<div class="f-desc" style="color:var(--text-muted);">该特性暂无详细描述</div>'}
            </div>
        </div>`;
    }).join('');

    $content.html(`
        <div class="upgrade-result" style="justify-content:flex-start;padding-top:10px;">
            <div class="upgrade-header">
                <h2>新增特性</h2>
                <p class="subtitle">第 ${upgradeState.newLevel} 级获得的特性详情</p>
            </div>

            ${(gains.classFeatures && gains.classFeatures.length > 0) ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">✨</span> 职业特性</div>
                ${classFeaturesHtml}
            </div>
            ` : ''}

            ${(gains.subclassFeatures && gains.subclassFeatures.length > 0) ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">🌟</span> ${subclassName || '子职'}特性</div>
                ${subclassFeaturesHtml}
            </div>
            ` : ''}

            ${(!gains.classFeatures || gains.classFeatures.length === 0) && (!gains.subclassFeatures || gains.subclassFeatures.length === 0) ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">📋</span> 特性详情</div>
                <div class="change-row">
                    <span class="value" style="color:var(--text-muted);">该等级无新特性</span>
                </div>
            </div>
            ` : ''}

            ${(upgradeState.pendingSelections && upgradeState.pendingSelections.length > 0) || (upgradeState.classExtraGroups && upgradeState.classExtraGroups.length > 0) ? `
            <div class="section" style="max-width:640px;">
                <div class="section-title"><span class="icon">🎯</span> 需要选择的内容</div>
                <div class="change-row">
                    <span class="value">请在下一步完成相关选择</span>
                </div>
                ${upgradeState.pendingSelections && upgradeState.pendingSelections.length > 0 ? `
                <div class="change-row">
                    <span class="label">待选项</span>
                    <span class="value">${upgradeState.pendingSelections.length} 项</span>
                </div>
                ` : ''}
                ${upgradeState.classExtraGroups && upgradeState.classExtraGroups.length > 0 ? `
                <div class="change-row">
                    <span class="label">额外选项</span>
                    <span class="value">${upgradeState.classExtraGroups.length} 组</span>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
    `);
}

/**
 * 渲染子职选择页
 */
function renderSubclassStep($content) {
    if (!upgradeState.needsSubclassSelection) {
        stepState.current = 3;
        renderStep(3);
        return;
    }

    $content.html(`
        <div class="upgrade-result" style="justify-content:flex-start;padding-top:10px;">
            <div class="upgrade-header" style="margin-bottom:12px;">
                <h2 style="font-size:1.4rem;margin:0 0 4px;">选择子职业</h2>
                <p class="subtitle" style="font-size:0.85rem;margin:0;">为你的 ${character.class ? character.class.name : '职业'} 选择一个子职业</p>
            </div>
            <div id="subclassSelectionContainer" style="width:100%;flex:1;display:flex;flex-direction:column;"></div>
        </div>
    `);

    renderSubclassSelection($('#subclassSelectionContainer'));
}

/**
 * 计算升到指定等级时的升级收益
 */
function calculateLevelGains(level) {
    const clsId = character.class ? character.class.id : 0;
    const cls = character.class;
    const classFeatures = dataCache.classFeatures || [];
    const proficiency = dataCache.proficiency || [];
    const spellcasting = dataCache.spellcasting || [];

    const mainFeatures = classFeatures.filter(function(f) {
        return f.class === clsId && f.level === level && (f.subclass === 0 || f.subclass === "0");
    });

    var subclassFeatures = [];
    var needsSubclassSelection = false;
    if (cls && cls.subclass_level) {
        var scLevels = String(cls.subclass_level).split(',').map(Number);
        if (scLevels.includes(level)) {
            if (!character.subclass) {
                needsSubclassSelection = true;
            } else {
                subclassFeatures = getSubclassFeatures(clsId, character.subclass.id, level);
            }
        }
    }

    var allFeatures = mainFeatures.concat(subclassFeatures);

    // HP 增长计算
    var hpGain = 0;
    var hpGainDetail = '';
    if (cls) {
        var abilities = character.abilities || {};
        var race = character.subrace || character.race;
        var raceBonus = {};
        if (race && race.bonus) {
            try { raceBonus = JSON.parse(race.bonus); } catch(e) { /* JSON解析失败，保留空对象 */ }
        }
        var bgBonus = (character.backgroundBonus && character.backgroundBonus.bonus) || {};
        var conVal = (abilities[9] || 8) + (raceBonus[9] || 0) + (bgBonus[9] || 0);
        var conMod = Math.floor((conVal - 10) / 2);
        if (level > 1) {
            hpGain = (cls.hp_per_level || 5) + conMod;
            hpGainDetail = cls.hp_per_level + '(升级生命) + ' + conMod + '(体质)';
        } else {
            var hdStr = cls.hit_dice || 'D8';
            var hd = parseInt(hdStr.replace('D', ''));
            hpGain = hd + conMod;
            hpGainDetail = hdStr + '(生命骰) + ' + conMod + '(体质)';
        }
        if (character.hpPerLevelBonus) {
            hpGain += character.hpPerLevelBonus;
            hpGainDetail += ' + ' + character.hpPerLevelBonus + '(专长)';
        }
    }

    // 专长/属性提升
    let abilityImprovement = false;
    let feats = [];
    if (cls && cls.feat_level) {
        const featLevels = String(cls.feat_level).split(',').map(Number);
        if (featLevels.includes(level)) {
            abilityImprovement = true;
        }
    }

    // 新法术位
    const newSpellSlots = {};
    if (proficiency.length > 0) {
        const currentSlots = getSpellSlotsForLevel(clsId, level - 1, proficiency);
        const nextSlots = getSpellSlotsForLevel(clsId, level, proficiency);
        for (let i = 1; i <= 9; i++) {
            const cur = currentSlots[i] || 0;
            const next = nextSlots[i] || 0;
            if (next > cur) {
                newSpellSlots[`${i}`] = next - cur;
            }
        }
    }

    // 施法信息
    const spellcastingInfo = {};
    const scCfg = dataCache.spellcasting ? dataCache.spellcasting.find(s => s.class === clsId) : null;
    if (scCfg && cls && cls.spellcaster && cls.spellcaster > 0) {
        const methodId = parseInt(String(scCfg.preparation_method || '').split('=')[0]);
        let currentPrep, nextPrep;

        if (methodId === 3) {
            const bookStart = parseInt(scCfg.spellbook_start) || 6;
            const bookGain = parseInt(scCfg.spellbook_gain_per_level) || 2;
            const currentLevel = level - 1;
            currentPrep = currentLevel < 1 ? 0 : bookStart + bookGain * (currentLevel - 1);
            nextPrep = bookStart + bookGain * (level - 1);
        } else {
            currentPrep = getSpellPrepForLevel(clsId, level - 1, proficiency);
            nextPrep = getSpellPrepForLevel(clsId, level, proficiency);
        }

        const currentCantrip = getCantripCountForLevel(clsId, level - 1, proficiency);
        const nextCantrip = getCantripCountForLevel(clsId, level, proficiency);
        spellcastingInfo.ability = scCfg.spellcasting_ability;
        spellcastingInfo.method = scCfg.preparation_method;
        spellcastingInfo.preparedCurrent = currentPrep;
        spellcastingInfo.preparedNext = nextPrep;
        spellcastingInfo.preparedGain = Math.max(0, nextPrep - currentPrep);
        spellcastingInfo.cantripCurrent = currentCantrip;
        spellcastingInfo.cantripNext = nextCantrip;
        spellcastingInfo.cantripGain = Math.max(0, nextCantrip - currentCantrip);
        spellcastingInfo.preparationRule = scCfg.preparation_rule;
        spellcastingInfo.spellbookStart = scCfg.spellbook_start;
        spellcastingInfo.spellbookGainPerLevel = scCfg.spellbook_gain_per_level;
        spellcastingInfo.spellbookDesc = scCfg.spellbook_desc;
        spellcastingInfo.note = scCfg.note;
    }

    // 处理特性规则
    var pendingSelections = [];
    var weaponMasteryResults = [];
    allFeatures.forEach(function(f) {
        var selResults = processFeatureRules(f);
        selResults.forEach(function(r) {
            if (f.name && !r.sourceName) r.sourceName = f.name;
            if (f.id != null && !r.featureId) r.featureId = f.id;
            pendingSelections.push(r);
        });
        try {
            var allResults = processItemRules(f, character);
            if (allResults && Array.isArray(allResults)) {
                allResults.forEach(function(r) {
                    if (r && r.success && r.type === 'weapon_mastery') {
                        if (f.name && !r.sourceName) r.sourceName = f.name;
                        if (f.id != null && !r.featureId) r.featureId = f.id;
                        weaponMasteryResults.push({ result: r, feature: f });
                    }
                });
            }
        } catch(e) {
            console.warn('[升级] 收集武器精通结果失败:', f.name || f.id, e);
        }
    });

    // 展开 weapon_mastery 为武器选择项
    weaponMasteryResults.forEach(function(wm) {
        var result = wm.result;
        var feature = wm.feature;
        var classId = parseInt(feature.class, 10);
        if (!classId || !dataCache.classes) return;
        var clsData = dataCache.classes.find(function(c) { return c.id === classId; });
        if (!clsData || !clsData.weapon) return;
        var weaponProf = String(clsData.weapon).split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });

        var proficiencyCount = getCountFromProficiencyRef(feature, classId, level);
        if (proficiencyCount <= 0) return;

        var pending = {
            type: 'filter',
            category: 'weapons',
            success: true,
            needUserSelect: true,
            count: proficiencyCount,
            filterParams: { category: weaponProf },
            showMasteryOnly: true,
            classId: classId,
            expression: result.expression,
            sourceName: result.sourceName || feature.name,
            featureId: result.featureId || feature.id
        };

        var exists = pendingSelections.some(function(p) {
            return p.type === 'filter' && p.category === 'weapons' && p.featureId === pending.featureId;
        });
        if (!exists) {
            pendingSelections.push(pending);
        }
    });

    var classExtraGroups = collectUpgradeClassExtra(cls, level);

    var mainFeatureObjs = mainFeatures.map(function(f) {
        return {
            id: f.id,
            name: f.name,
            desc: f.desc || '',
            hasSelection: pendingSelections.some(function(s) { return s.featureId === f.id; })
        };
    });
    var subclassFeatureObjs = subclassFeatures.map(function(f) {
        return {
            id: f.id,
            name: f.name,
            desc: f.desc || '',
            hasSelection: pendingSelections.some(function(s) { return s.featureId === f.id; })
        };
    });

    return {
        hpGain: hpGain,
        hpGainDetail: hpGainDetail,
        features: mainFeatureObjs.concat(subclassFeatureObjs),
        classFeatures: mainFeatureObjs,
        subclassFeatures: subclassFeatureObjs,
        subclassName: character.subclass ? character.subclass.name : null,
        feats: feats,
        abilityImprovement: abilityImprovement,
        newSpellSlots: newSpellSlots,
        pendingSelections: pendingSelections,
        classExtraGroups: classExtraGroups,
        needsSubclassSelection: needsSubclassSelection,
        spellcastingInfo: spellcastingInfo
    };
}

// ===== 以下函数已迁至 handlers/data-query.js（升级与车卡共用）=====
// getSpellSlotsForLevel / getSpellPrepForLevel / getCantripCountForLevel
// getAbilityNameById / getSpellMethodInfo / getProfBonus
// getSubclassFeatures / getProficiencyCount
// =====
// processFeatureRules、collectUpgradeClassExtra 保留在此（流程适配层）

/**
 * 解析单条特性的规则，找出需要用户手动选择的内容（适配层：封装对 handlers.processItemRules 的调用）
 */
function processFeatureRules(feature) {
    if (!feature) return [];
    try {
        var results = processItemRules(feature, character);
        if (!results || !Array.isArray(results)) return [];
        return results.filter(function(r) { return r && r.success && r.needUserSelect; });
    } catch(e) {
        console.warn('[升级] 解析特性规则失败:', feature.name || feature.id, e);
        return [];
    }
}

/**
 * 收集当前等级需要选择的 class_extra 选项（与 handlers/data-query.js 共用 collectAllClassExtraAll + extraByFeatureId 索引）
 */
function collectUpgradeClassExtra(cls, level) {
    if (!cls || !dataCache.classFeatures || !dataCache.classExtra) return [];

    // ===== class_extra_all：遍历所有等级（1 → 当前），自动获得（委托给 upgrade.js 的 collectAllClassExtraAll）=====
    collectAllClassExtraAll(cls, level);

    // ===== class_extra (choice)：只收集当前等级新增的选择项 =====
    var results = [];
    var chainToFeature = {};

    function collectFromFeatures(features) {
        features.forEach(function(f) {
            if (f.extra !== 'class_extra') return;
            var extras = dataCache.extraByFeatureId ? dataCache.extraByFeatureId[f.id] : null;
            if (!extras || extras.length === 0) return;
            chainToFeature[f.id] = f;
            results = results.concat(extras.map(function(e) { return e; }));
        });
    }

    collectFromFeatures(getClassFeatures(cls, level));

    if (character.subclass) {
        collectFromFeatures(getSubclassFeatures(cls.id, character.subclass.id, level));
    }

    if (results.length === 0) return [];

    results = results.filter(function(e) {
        var fid = e.chain;
        var f = chainToFeature[fid];
        if (f && f.class) return String(f.class) === String(cls.id);
        return true;
    });
    if (results.length === 0) return [];

    var groups = {};
    results.forEach(function(e) {
        var catName = e.category || '其他选项';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(e);
    });

    var groupedResults = [];
    Object.keys(groups).forEach(function(catName) {
        var items = groups[catName];
        if (items.length === 0) return;

        var sourceFeature = null;
        if (items[0].chain && chainToFeature[items[0].chain]) {
            sourceFeature = chainToFeature[items[0].chain];
        }
        if (!sourceFeature) return;

        var count = getCountFromProficiencyRef(sourceFeature, cls, level);

        if (count <= 0) return;

        groupedResults.push({
            groupName: catName,
            count: count,
            featureId: sourceFeature.id,
            candidates: items,
            selected: []
        });
    });

    return groupedResults;
}

// 注：findExtraByChain 已在 upgrade.js 中统一定义（使用 extraByFeatureId 索引加速），此处不重复定义

export {
    renderOverviewStep,
    renderFeaturesStep,
    renderSubclassStep,
    calculateLevelGains,
    processFeatureRules,
    collectUpgradeClassExtra
};