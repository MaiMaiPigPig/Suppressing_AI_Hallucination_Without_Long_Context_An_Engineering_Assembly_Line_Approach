// ============================================================
// 专长先决条件处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 解析专长的先决条件，用于检查角色是否满足条件。
// 专长（Feat）通常有前置要求，比如"需要敏捷13+"或"需要4级"。
//
// 匹配规则（7种模式）：
//   1. [id列表]+[数值]         — 属性提升（如 1,4,9,11,18,25+2）
//   2. lv=[n]                  — 等级要求（lv=4）
//   3. lv>=[n]                 — 最低等级要求（lv>=4）
//   4. ability([id1]|[id2])>=[n] — 多属性任一项达标
//   5. ability([id])>=[n]      — 单属性要求
//   6. feature([name1]|[name2]) — 需要拥有某特性
//   7. armor_trained([type])   — 需要某护甲受训
//
// 【注意】这个 handler 与 attribute.js 的区别：
//   - attribute.js 是"引用属性值"（用于公式计算）
//   - 本文件是"检查属性条件是否满足"（用于条件判断）
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("lv=4")              → 需要4级
//   handlers.parseRule("ability(4)>=13")    → 需要敏捷13+
//   handlers.parseRule("feature(战斗风格：防御)") → 需要"防御"战斗风格
//   handlers.parseRule("1,4,9,11,18,25+2")  → 属性提升（全属性+2）
//
// 【返回值用法】
//   if (result.type === 'feat-require') {
//     if (result.subtype === 'ability_boost') {
//       // 属性提升：让用户选择哪些属性提升 result.boost
//     } else if (result.subtype === 'level_min') {
//       // 检查角色等级是否 >= result.requiredLevel
//     } else if (result.subtype === 'ability_min') {
//       // 检查角色属性值是否 >= result.requiredValue
//     } else if (result.subtype === 'ability_or') {
//       // 检查 result.abilityIds 中至少一个属性 >= result.requiredValue
//     } else if (result.subtype === 'feature_required') {
//       // 检查角色是否拥有 result.featureNames 中的任一个特性
//     } else if (result.subtype === 'armor_trained') {
//       // 检查角色是否有 result.armorType 类型的护甲熟练
//     }
//   }
//
// 【JS语法 - 给初学者】
//   .every(function(id) { return ...; })
//   .every() 是数组方法，检查数组的"所有"元素是否都满足条件。
//   全部满足返回 true，有一个不满足就返回 false。
//   类似"且"（AND）的关系。
//   这里检查所有 id 是否都在 ABILITY_ID_MAP 中，确认是属性ID列表。
//
//   .split('|').map(...).filter(Boolean)
//   split('|') 按竖线分割（竖线在正则中是"或"的意思，但在字符串中是普通字符）
//   map(...) 对每个元素执行函数（去空格）
//   filter(Boolean) 过滤掉空字符串（Boolean 作为函数会把空字符串转为 false）
//
// ============================================================



// 属性ID → 英文名映射
// 与 attribute.js 中的映射一致，保持统一
export const ABILITY_ID_MAP = {
    1: 'strength',
    4: 'dexterity',
    9: 'constitution',
    11: 'intelligence',
    18: 'wisdom',
    25: 'charisma',
};

// ============================================================
// 函数：parse(rule)  — 解析专长先决条件规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "lv=4" / "ability(4)>=13" / "feature(战斗风格：防御)" / "1,4,9,11,18,25+2"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'feat-require',        // 固定为 'feat-require'
//       subtype: 'ability_boost'|'level_equal'|'level_min'|'ability_or'|'ability_min'|'feature_required'|'armor_trained',
//       success: true|false,
//       needUserSelect: true|false,  // 仅 ability_boost 需要用户选择
//       expression: rule
//       // 各子类型的额外字段见具体代码注释
//     }
//     失败时返回 { type: 'feat-require', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 模式1：[id列表]+[数值] — 属性提升
    // 匹配以逗号分隔的数字列表，后跟 + 和数值
    // 检查列表中的 id 是否全部在 ABILITY_ID_MAP 中
    // 如果是，则认为是属性提升而非其他操作
    // 示例：1,4,9,11,18,25+2 → 全属性+2
    // ----------------------------------------------------------
    var attrBoostMatch = rule.match(/^([\d,\s]+)\s*\+\s*(\d+)\s*$/);
    if (attrBoostMatch) {
        var ids = attrBoostMatch[1].split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        // 检查是否是属性ID列表（全部在映射表中）
        var isAbilityIds = ids.every(function(id) { return ABILITY_ID_MAP[id]; });
        if (isAbilityIds) {
            return {
                type: 'feat-require',
                category: 'ability',
                subtype: 'ability_boost',               // 属性提升
                success: true,
                needUserSelect: true,                    // 需要用户选择分配
                abilityIds: ids,                          // 属性ID列表
                boost: parseInt(attrBoostMatch[2], 10),  // 提升数值
                count: 1,
                expression: rule
            };
        }
    }

    // ----------------------------------------------------------
    // 模式2：lv=[n] — 等级要求（精确值）
    // 必须正好达到指定等级才能选择该专长
    // 示例：lv=4 → 需要正好4级
    // ----------------------------------------------------------
    var lvEqualMatch = rule.match(/^lv\s*=\s*(\d+)\s*$/i);
    if (lvEqualMatch) {
        return {
            type: 'feat-require',
            subtype: 'level_equal',                      // 等级等于
            success: true,
            needUserSelect: false,
            requiredLevel: parseInt(lvEqualMatch[1], 10),
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式3：lv>=[n] — 最低等级要求
    // 必须达到或超过指定等级才能选择该专长
    // 示例：lv>=4 → 需要4级或以上
    // ----------------------------------------------------------
    var lvGteMatch = rule.match(/^lv\s*>=\s*(\d+)\s*$/i);
    if (lvGteMatch) {
        return {
            type: 'feat-require',
            subtype: 'level_min',                        // 等级最低
            success: true,
            needUserSelect: false,
            requiredLevel: parseInt(lvGteMatch[1], 10),
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式4：ability([id1]|[id2])>=[n] — 多属性任一项达标
    // 两个属性中至少有一个达到指定值
    // 示例：ability(4|18)>=13 → 需要敏捷或感知13+
    // ----------------------------------------------------------
    var abilityOrMatch = rule.match(/^ability\s*\(\s*(\d+)\s*\|\s*(\d+)\s*\)\s*>=\s*(\d+)\s*$/i);
    if (abilityOrMatch) {
        return {
            type: 'feat-require',
            subtype: 'ability_or',                       // 属性任选其一达标
            success: true,
            needUserSelect: false,
            abilityIds: [parseInt(abilityOrMatch[1], 10), parseInt(abilityOrMatch[2], 10)],
            requiredValue: parseInt(abilityOrMatch[3], 10),
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式5：ability([id])>=[n] — 单属性要求
    // 指定属性必须达到或超过指定值
    // 示例：ability(4)>=13 → 需要敏捷13+
    // ----------------------------------------------------------
    var abilityMatch = rule.match(/^ability\s*\(\s*(\d+)\s*\)\s*>=\s*(\d+)\s*$/i);
    if (abilityMatch) {
        return {
            type: 'feat-require',
            subtype: 'ability_min',                      // 属性最低要求
            success: true,
            needUserSelect: false,
            abilityId: parseInt(abilityMatch[1], 10),
            requiredValue: parseInt(abilityMatch[2], 10),
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式6：feature([name1]|[name2]) — 特性要求
    // 需要拥有指定的特性（或特性列表中的任一个）
    // 示例：feature(战斗风格：防御) → 需要拥有"防御"战斗风格
    // ----------------------------------------------------------
    var featureMatch = rule.match(/^feature\s*\(\s*([^)]+)\s*\)\s*$/i);
    if (featureMatch) {
        var names = featureMatch[1].split('|').map(function(s) { return s.trim(); }).filter(Boolean);
        return {
            type: 'feat-require',
            subtype: 'feature_required',                 // 特性要求
            success: true,
            needUserSelect: false,
            featureNames: names,                          // 特性名称列表
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式7：armor_trained([type]) — 护甲受训要求
    // 需要拥有指定类型的护甲熟练
    // 示例：armor_trained(light) → 需要轻甲熟练
    // ----------------------------------------------------------
    var armorMatch = rule.match(/^armor_trained\s*\(\s*(\w+)\s*\)\s*$/i);
    if (armorMatch) {
        return {
            type: 'feat-require',
            subtype: 'armor_trained',                    // 护甲受训要求
            success: true,
            needUserSelect: false,
            armorType: armorMatch[1].toLowerCase(),       // 护甲类型
            expression: rule
        };
    }

    // 未匹配到任何先决条件模式
    return {
        type: 'feat-require',
        success: false,
        needUserSelect: false
    };
};