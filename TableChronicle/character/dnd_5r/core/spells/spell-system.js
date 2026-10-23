/**
 * core/spells/spell-system.js
 * 施法规则引擎：施法配置读取、法术位/戏法/准备法术数量计算、法术步骤可跳过判断。
 *
 * 【为什么放 core】
 * 这些是纯规则计算，和 DOM、步骤导航无关。原先散落在 creation/steps/spells.js（展示层）
 * 和 creation/flow/step-router.js（流程层），流程层直接持有规则逻辑违反架构红线，
 * 故统一收到逻辑层，creation/ 与 upgrade/ 共用同一份实现。
 */

import { dataCache } from '../data/cache.js';
import { character } from '../state/character-model.js';

/**
 * 通过技能ID获取属性名称（如 1→力量, 25→魅力）
 * @param {number} skillId - skills.json 中的ID
 * @returns {string|null}
 */
export function getAbilityNameById(skillId) {
    if (skillId == null) return null;
    const skill = (dataCache.skills || []).find(s => s.id === skillId);
    return skill ? skill.name : null;
}

/**
 * 通过方法ID获取方法名称（如 1→known, 3→spellbook）
 * @param {number} methodId - spellcasting_methods.json 中的ID
 * @returns {string|null}
 */

/**
 * 通过方法ID获取方法名称（如 1→known, 3→spellbook）
 * @param {number} methodId - spellcasting_methods.json 中的ID
 * @returns {string|null}
 */
export function getMethodNameById(methodId) {
    if (methodId == null) return null;
    const method = (dataCache.spellcastingMethods || []).find(m => m.id === methodId);
    return method ? method.name : null;
}

/**
 * 从 spellcasting.json 中读取指定职业的施法配置
 * 自动解析ID引用为实际文本
 * @param {number} classId - 职业ID
 * @returns {{ spellcasting_ability: string|null, preparation_method: string|null, preparation_rule: string|null, prepared_formula: string|null, prepared_formula_label: string|null, spellbook_start: number|null, spellbook_gain_per_level: number|null, spellbook_desc: string|null, note: string|null }|null}
 */

/**
 * 从 spellcasting.json 中读取指定职业的施法配置
 * 自动解析ID引用为实际文本
 * @param {number} classId - 职业ID
 * @returns {{ spellcasting_ability: string|null, preparation_method: string|null, preparation_rule: string|null, prepared_formula: string|null, prepared_formula_label: string|null, spellbook_start: number|null, spellbook_gain_per_level: number|null, spellbook_desc: string|null, note: string|null }|null}
 */
export function getSpellcastingConfig(classId) {
    const raw = (dataCache.spellcasting || []).find(c => c.class_id === classId || c.class === classId) || null;
    if (!raw) return null;

    // 解析施法属性（ID → 名称）
    const abilityName = getAbilityNameById(raw.spellcasting_ability);

    // 准备法术数从 proficiency.json 表读取（type=spell_preparation），不使用公式
    return {
        spellcasting_ability: abilityName,
        preparation_method: raw.preparation_method,
        preparation_rule: raw.preparation_rule,
        prepared_formula: null,
        spellbook_start: raw.spellbook_start || null,
        spellbook_gain_per_level: raw.spellbook_gain_per_level || null,
        spellbook_desc: raw.spellbook_desc,
        note: raw.note
    };
}

/**
 * 解析 preparation_method 字段
 * 支持 "3=6" 格式（方法ID=数量），自动解析方法ID为方法名
 * @param {string} raw - 原始值，如 "1"、"2"、"3=6"
 * @returns {{ method: string, value: number|null }}
 */

/**
 * 解析 preparation_method 字段
 * 支持 "3=6" 格式（方法ID=数量），自动解析方法ID为方法名
 * @param {string} raw - 原始值，如 "1"、"2"、"3=6"
 * @returns {{ method: string, value: number|null }}
 */
export function parsePreparationMethod(raw) {
    if (raw == null) return { method: null, value: null };
    raw = String(raw); // 确保是字符串（JSON中可能存数字）
    const eqIdx = raw.indexOf('=');
    let methodId, value;
    if (eqIdx !== -1) {
        methodId = raw.substring(0, eqIdx);
        value = parseInt(raw.substring(eqIdx + 1)) || null;
    } else {
        methodId = raw;
        value = null;
    }
    // 解析方法ID为方法名
    const methodName = getMethodNameById(parseInt(methodId));
    return {
        method: methodName || methodId,
        value: value
    };
}

/**
 * 从 proficiency.json 中读取法术数据（戏法数、准备法术数、各环位数量）
 * @param {number} classId - 职业ID
 * @param {number} characterLevel - 角色等级
 * @returns {{ cantrips: number, prepared: number, slots: object, ability: string|null, note: string|null }}
 */

/**
 * 从 proficiency.json 中读取法术数据（戏法数、准备法术数、各环位数量）
 * @param {number} classId - 职业ID
 * @param {number} characterLevel - 角色等级
 * @returns {{ cantrips: number, prepared: number, slots: object, ability: string|null, note: string|null }}
 */
export function getSpellDataFromProficiency(classId, characterLevel) {
    const profData = dataCache.proficiency || [];
    const config = getSpellcastingConfig(classId);
    
    // 解析 preparation_method（方法ID → 方法名），兼容旧版 "3=6" 格式
    const parsedMethod = parsePreparationMethod(config ? config.preparation_method : null);
    // spellbook_start 从独立列读取，同时兼容旧版从 preparation_method 解析
    const spellbookStart = (config ? config.spellbook_start : null) ?? (parsedMethod.value ?? null);

    const result = {
        cantrips: 0,
        prepared: 0,
        slots: {},        // { 1: N, 2: N, ... }
        ability: config ? config.spellcasting_ability : null,
        note: config ? config.note : null,
        preparation_method: parsedMethod.method,
        preparation_rule: config ? config.preparation_rule : null,
        prepared_formula: null,  // 不再使用公式显示，准备法术数从 proficiency.json 表读取
        spellbook_start: spellbookStart,
        spellbook_gain_per_level: config ? config.spellbook_gain_per_level : null,
        spellbook_desc: config ? config.spellbook_desc : null
    };

    // 1. 读取戏法数（type=cantrip）
    const cantripEntries = profData.filter(e =>
        String(e.class_id) === String(classId) &&
        e.type === 'cantrip' &&
        e.level <= characterLevel
    );
    const maxCantripEntry = cantripEntries.reduce((max, e) =>
        e.level > (max ? max.level : 0) ? e : max, null
    );
    if (maxCantripEntry) {
        result.cantrips = parseInt(maxCantripEntry.value) || 0;
    }

    // 2. 读取准备法术数（type=spell_preparation）
    const prepEntries = profData.filter(e =>
        String(e.class_id) === String(classId) &&
        e.type === 'spell_preparation' &&
        e.level <= characterLevel
    );
    const maxPrepEntry = prepEntries.reduce((max, e) =>
        e.level > (max ? max.level : 0) ? e : max, null
    );
    if (maxPrepEntry) {
        result.prepared = parseInt(maxPrepEntry.value) || 0;
    }

    // 3. 读取环位（type=spell_slots）
    const slotsEntries = profData.filter(e =>
        String(e.class_id) === String(classId) &&
        e.type === 'spell_slots' &&
        e.level <= characterLevel
    );
    const maxSlotsEntry = slotsEntries.reduce((max, e) =>
        e.level > (max ? max.level : 0) ? e : max, null
    );
    if (maxSlotsEntry) {
        for (let i = 1; i <= 9; i++) {
            const key = 'slot_' + i;
            if (maxSlotsEntry[key] !== '' && maxSlotsEntry[key] !== null && maxSlotsEntry[key] !== undefined) {
                result.slots[i] = parseInt(maxSlotsEntry[key]) || 0;
            }
        }
    }

    return result;
}

/**
 * 从职业特性的车卡数据中解析额外法术选择（格式: "spell(class=X,lv=0)+N"）
 * 追加到从 proficiency.json 读取的基础数据上
 * @param {number} classId - 职业ID
 * @param {object} baseData - getSpellDataFromProficiency 返回的基础数据
 * @returns {{ cantrips: number, prepared: number, slots: object, ability: string|null, note: string|null }}
 */

/**
 * 从职业特性的车卡数据中解析额外法术选择（格式: "spell(class=X,lv=0)+N"）
 * 追加到从 proficiency.json 读取的基础数据上
 * @param {number} classId - 职业ID
 * @param {object} baseData - getSpellDataFromProficiency 返回的基础数据
 * @returns {{ cantrips: number, prepared: number, slots: object, ability: string|null, note: string|null }}
 */
export function parseExtraSpells(classId, baseData) {
    const result = {
        cantrips: baseData.cantrips,
        prepared: baseData.prepared,
        slots: { ...baseData.slots },
        ability: baseData.ability,
        note: baseData.note,
        preparation_method: baseData.preparation_method,
        preparation_rule: baseData.preparation_rule,
        prepared_formula: baseData.prepared_formula,
        spellbook_start: baseData.spellbook_start,
        spellbook_gain_per_level: baseData.spellbook_gain_per_level,
        spellbook_desc: baseData.spellbook_desc
    };

    const allFeatures = dataCache.classFeatures || [];
    allFeatures.forEach(f => {
        if (f.class !== classId) return;
        const data = f['rules'] || '';
        if (!data) return;

        // 匹配格式: spell(任何内容 lv=0) + N
        const matches = data.match(/spell\(.*?lv\s*[=＝]\s*(\d+).*?\)\s*[+＋]\s*(\d+)/i);
        if (matches) {
            const lv = parseInt(matches[1]);
            const count = parseInt(matches[2]);
            if (lv === 0) result.cantrips += count;
            else if (lv >= 1 && lv <= 9) {
                // 如果是环位追加，增加 prepared 数量（因为高级法术也需要准备）
                result.prepared += count;
            }
        }
    });

    return result;
}

/**
 * 解析法术数据（供 sheet.js 和 export.js 使用）
 * @param {number} classId - 职业ID
 * @returns {{ cantrips: number, prepared: number, slots: object, ability: string|null, note: string|null }}
 */

/**
 * 解析法术数据（供 sheet.js 和 export.js 使用）
 * @param {number} classId - 职业ID
 * @returns {{ cantrips: number, prepared: number, slots: object, ability: string|null, note: string|null }}
 */
export function parseSpellCounts(classId) {
    const level = character.level || 1;
    const baseData = getSpellDataFromProficiency(classId, level);
    const result = parseExtraSpells(classId, baseData);
    // 应用专长/特性等来源的额外法术位（如 spell_slot(1)+1）
    if (character.extraSpellSlots) {
        character.extraSpellSlots.forEach(function(extra) {
            if (extra.level >= 1 && extra.level <= 9) {
                result.slots[extra.level] = (result.slots[extra.level] || 0) + extra.count;
            }
        });
    }
    return result;
}

/**
 * 收集种族特性自动添加的法术，标记为锁定（不可取消选择）
 * 在法术选择页面（步骤11）提前处理，因为特性总览（步骤14）在其之后
 * 纯解析方式，不调 addPendingSelectionsFromItem，避免副作用
 */

/**
 * 判断法术步骤是否可跳过（无施法能力或无法术数据的职业）
 * @returns {boolean}
 */
export function isSpellStepSkippable() {
    if (!character.class) return true;
    const classId = character.class.id;

    // 施法能力判断已统一走 core 数据（proficiency.json + spellcasting.json）
    const data = getSpellDataFromProficiency(classId, character.level || 1);
    if (!data.ability) return true;
    if (data.cantrips === 0 && Object.keys(data.slots).length === 0) return true;

    if (!dataCache.spells || !Array.isArray(dataCache.spells) || dataCache.spells.length === 0) return true;
    const hasSpellsForClass = dataCache.spells.some(s => {
        if (!s.class) return false;
        const classIds = String(s.class).split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });
    if (!hasSpellsForClass) return true;

    return false;
}

// 技能 ID → 中文名映射工具
