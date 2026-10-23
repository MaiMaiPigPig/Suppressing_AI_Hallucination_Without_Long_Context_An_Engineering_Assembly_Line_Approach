/**
 * core/proficiency/proficiency-link-resolver.js
 * 熟练项取值：按 proficiency.json 的成长表解析某条特性在当前等级下的熟练数值。
 *
 * 【为什么放 core】
 * 这是纯规则查表，与角色卡渲染无关。原先放在 creation/steps/sheet-renderer.js（展示层），
 * 但 review.js 也要用它，展示层之间互相依赖属于职责错位，故收进逻辑层。
 */

import { dataCache } from '../data/cache.js';
import { character } from '../state/character-model.js';

/**
 * 获取特性关联的环位表数值
 * 通过 proficiency_link 中的 ID，查出对应的 type，
 * 再按 type + class_id + level 找到当前等级的实际数值
 * 例如：狂暴特性链接了 [6, 11]，
 * 返回 [{label:"狂暴", value:"2"}, {label:"狂暴伤害", value:"2"}]
 */
export function getFeatureProficiencyValues(feature) {
    var refIds = parseProficiencyLinkIds(feature.proficiency_link);
    if (refIds.length === 0) return null;

    const profData = dataCache.proficiency || [];
    const results = [];

    for (const refId of refIds) {
        // 通过 ID 找到参考条目，获取 type 和 class_id
        const refEntry = profData.find(function(e) { return e.id === refId; });
        if (!refEntry) continue;
        
        const typeName = refEntry.type;
        const clsId = refEntry.class_id;
        
        // 找出所有同职业、同类型且 ≤ 当前等级的条目
        const entries = profData.filter(function(e) {
            return e.type === typeName &&
                   String(e.class_id) === String(clsId) &&
                   e.level <= (character.level || 1);
        });
        if (entries.length === 0) continue;
        
        // 取等级最高的那条（即当前等级的实际数值）
        const best = entries.reduce(function(max, e) {
            return e.level > max.level ? e : max;
        }, entries[0]);
        
        results.push({
            label: String(best['说明'] || best.type || ''),
            value: String(best.value || '0'),
            unit: String(best.value_unit || '')
        });
    }
    
    return results.length > 0 ? results : null;
}

// window 桥接：法术条目由角色卡动态生成，其 onclick 直接引用 toggleSpellDetail。
// 注意必须直接赋值函数引用——若写成箭头函数包装，函数体内的 window.toggleSpellDetail(...)
// 会指向自身造成无限递归。