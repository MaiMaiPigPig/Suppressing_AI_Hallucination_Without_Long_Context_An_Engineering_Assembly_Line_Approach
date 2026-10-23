/**
 * handlers/data-query.js
 * 数据查询工具（ES Module 版）
 *
 * 这些函数负责从已加载的 dataCache 中查询、映射、收集数据。
 * 不包含 UI 逻辑，不操作 DOM，只做数据层面的查询和组装。
 * 为 creation（车卡）和 upgrade（升级）两个流程共用。
 */

import { dataCache } from '../core/data/cache.js';
import { character } from '../core/state/character-model.js';
import { buildDataIndexes, findItemSourceTable } from '../core/data/indexes.js';

/**
 * 递归收集同表链引用特性
 */
export function collectChainedRaceFeatures(item, collected) {
    if (!item || !item.id) return;
    var sourceTable = findItemSourceTable(item);
    if (!sourceTable) return;
    var tableMap = {
        'raceFeatures': dataCache.raceFeatures,
        'classFeatures': dataCache.classFeatures,
        'feats': dataCache.feats,
        'backgrounds': dataCache.backgrounds
    };
    var sourceData = tableMap[sourceTable];
    if (!sourceData || !Array.isArray(sourceData)) return;

    var chainFields = ['choice', 'rules'];
    chainFields.forEach(function(field) {
        var val = item[field];
        if (val !== undefined && val !== null && val !== '') {
            if (typeof val === 'string' && !/^\d+$/.test(val)) return;
            var targetId = parseInt(val);
            if (!isNaN(targetId) && targetId !== item.id) {
                var alreadyCollected = collected.some(function(f) { return f && f.id === targetId; });
                if (!alreadyCollected) {
                    var target = sourceData.find(function(f) { return f && f.id === targetId; });
                    if (target) {
                        collected.push(target);
                        collectChainedRaceFeatures(target, collected);
                    }
                }
            }
        }
    });
}

/**
 * 获取子职特性
 */
export function getSubclassFeatures(classId, subclassId, level) {
    if (!subclassId || !dataCache.classFeatures) return [];
    return dataCache.classFeatures.filter(function(f) {
        if (f.class !== classId || f.level !== level) return false;
        if (!f.subclass) return false;
        if (subclassId === -1) return f.subclass !== 0;
        return f.subclass === subclassId || f.subclass === -1;
    });
}

/**
 * 从 proficiency.json 查询指定类型的数值
 */
export function getProficiencyCount(type, classId, level) {
    if (!dataCache.proficiency) return 0;
    var entries = dataCache.proficiency.filter(function(e) {
        return e.type === type &&
               String(e.class_id) === String(classId) &&
               e.level <= level;
    });
    if (entries.length === 0) return 0;
    var best = entries.reduce(function(max, e) { return e.level > max.level ? e : max; }, entries[0]);
    return parseInt(best.value) || 0;
}

/**
 * 查询指定职业/等级的法术位
 */
export function getSpellSlotsForLevel(classId, level, proficiency) {
    var slots = {};
    var src = proficiency || dataCache.proficiency;
    if (!src || level < 1) return slots;
    var entries = src.filter(function(e) {
        return String(e.class_id) === String(classId) &&
               e.type === 'spell_slots' &&
               e.level === level;
    });
    entries.forEach(function(e) {
        for (var i = 1; i <= 9; i++) {
            var key = 'slot_' + i;
            if (e[key] !== '' && e[key] !== null && e[key] !== undefined) {
                slots[i] = parseInt(e[key]) || 0;
            }
        }
    });
    return slots;
}

/**
 * 查询指定职业/等级的准备法术数量
 */
export function getSpellPrepForLevel(classId, level, proficiency) {
    var src = proficiency || dataCache.proficiency;
    if (!src || level < 1) return 0;
    var entries = src.filter(function(e) {
        return String(e.class_id) === String(classId) &&
               e.type === 'spell_preparation' &&
               e.level <= level;
    });
    if (entries.length === 0) return 0;
    var best = entries.reduce(function(max, e) { return e.level > max.level ? e : max; }, entries[0]);
    return parseInt(best.value) || 0;
}

/**
 * 查询指定职业/等级的戏法数量
 */
export function getCantripCountForLevel(classId, level, proficiency) {
    var src = proficiency || dataCache.proficiency;
    if (!src || level < 1) return 0;
    var entries = src.filter(function(e) {
        return String(e.class_id) === String(classId) &&
               e.type === 'cantrip' &&
               e.level <= level;
    });
    if (entries.length === 0) return 0;
    var best = entries.reduce(function(max, e) { return e.level > max.level ? e : max; }, entries[0]);
    return parseInt(best.value) || 0;
}

/**
 * 收集所有等级的 class_extra_all 选项
 */
export function collectAllClassExtraAll(cls, currentLevel) {
    if (!character.classExtraAll) character.classExtraAll = [];

    function collectFromLevel(lvl, features) {
        features.forEach(function(f) {
            if (f.extra !== 'class_extra_all') return;
            var extras = dataCache.extraByFeatureId ? dataCache.extraByFeatureId[f.id] : null;
            if (!extras || extras.length === 0) return;
            var exists = character.classExtraAll.some(function(g) { return g.featureId === f.id; });
            if (!exists) {
                character.classExtraAll.push({
                    featureId: f.id,
                    featureName: f.name,
                    items: extras
                });
            }
        });
    }

    for (var lvl = 1; lvl <= currentLevel; lvl++) {
        collectFromLevel(lvl, getAllClassFeatures(cls, lvl));
        if (character.subclass) {
            collectFromLevel(lvl, getSubclassFeatures(cls.id, character.subclass.id, lvl));
        }
    }
}

/**
 * 通过技能ID获取属性名称
 */
export function getAbilityNameById(id) {
    if (id == null) return '—';
    var skill = (dataCache.skills || []).find(function(s) { return s.id === id; });
    return skill ? skill.name : '#' + id;
}

/**
 * 通过施法方法ID获取方法名称和标签
 */
export function getSpellMethodInfo(methodId) {
    if (methodId == null) return { name: null, label: null };
    var raw = String(methodId).split('=')[0];
    var id = parseInt(raw);
    var method = (dataCache.spellMethods || []).find(function(m) { return m.id === id; });
    if (method) {
        return { name: method.name, label: method.label };
    }
    return { name: '#' + id, label: null };
}

/**
 * 根据角色等级获取熟练加值
 */
export function getProfBonus(level) {
    var proficiency = dataCache.proficiency;
    if (!proficiency || !proficiency.length) {
        return 2;
    }
    var entries = proficiency.filter(function(e) {
        return e.class_id === 'all' && e.type === '' && e.value === '' && e.subclass_id === 0;
    });
    var matched = entries
        .filter(function(e) { return e.level <= level; })
        .sort(function(a, b) { return b.level - a.level; });
    return matched.length ? matched[0].prof_bonus : 2;
}

/**
 * 解析 proficiency_link 字段为 ID 数组
 */
export function parseProficiencyLinkIds(raw) {
    var refIds = [];
    if (Array.isArray(raw)) {
        refIds = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
        try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) refIds = parsed;
        } catch(e) {
            refIds = raw.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        }
    }
    return refIds;
}

/**
 * 通过 proficiency_link 查 proficiency 表获取可选数量
 */
export function getCountFromProficiencyRef(feature, clsOrClassId, level) {
    if (!feature || !feature.proficiency_link || !dataCache.proficiency) return 0;

    var refIds = parseProficiencyLinkIds(feature.proficiency_link);
    if (refIds.length === 0) return 0;

    var refEntry = null;
    for (var li = 0; li < refIds.length; li++) {
        refEntry = dataCache.proficiency.find(function(e) { return e.id === refIds[li]; });
        if (refEntry) break;
    }
    if (!refEntry) return 0;

    var classId;
    if (clsOrClassId && typeof clsOrClassId === 'object') {
        classId = clsOrClassId.id;
    } else {
        classId = clsOrClassId;
    }
    if (!classId) classId = feature.class;

    var lvl = level || (typeof character !== 'undefined' && character ? (character.level || 1) : 1);

    return getProficiencyCount(refEntry.type, classId, lvl);
}

/**
 * 获取职业特性（辅助函数，供 collectAllClassExtraAll 使用）
 */
function getAllClassFeatures(cls, lvl) {
    if (!dataCache.classFeatures || !cls) return [];
    return dataCache.classFeatures.filter(function(f) {
        return f.class === cls.id && f.level === lvl && (!f.subclass || f.subclass === 0);
    });
}

// ============================================================
// 全局桥接：兼容 upgrade.js 等通过全局作用域直接调用
// ============================================================
if (typeof window !== 'undefined') {
    window.findItemSourceTable = findItemSourceTable;
    window.collectChainedRaceFeatures = collectChainedRaceFeatures;
    window.getSubclassFeatures = getSubclassFeatures;
    window.getProficiencyCount = getProficiencyCount;
    window.getSpellSlotsForLevel = getSpellSlotsForLevel;
    window.getSpellPrepForLevel = getSpellPrepForLevel;
    window.getCantripCountForLevel = getCantripCountForLevel;
    window.collectAllClassExtraAll = collectAllClassExtraAll;
    window.getAbilityNameById = getAbilityNameById;
    window.getSpellMethodInfo = getSpellMethodInfo;
    window.getProfBonus = getProfBonus;
    window.parseProficiencyLinkIds = parseProficiencyLinkIds;
    window.getCountFromProficiencyRef = getCountFromProficiencyRef;
}