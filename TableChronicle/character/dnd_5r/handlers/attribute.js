// ============================================================
// 属性调整值处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 引用角色的某项属性调整值，用于公式计算。
// 比如 ac=10+AbilityModifiers(4) 中的 AbilityModifiers(4) 就是引用敏捷调整值。
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("AbilityModifiers(1)")  → 自动走到 attribute.js
//
// 注意：这个函数通常不会被单独调用，而是作为公式的一部分
// 比如 ac 公式 "10+AbilityModifiers(4)" 中，会先解析出 AbilityModifiers(4)，
// 再调用这个函数获取属性ID，然后到角色数据中查具体数值。
//
// 【返回值用法】
//   if (result.type === 'attribute') {
//     var value = character.abilities[result.abilityKey];  // 取角色属性值
//     var modifier = Math.floor((value - 10) / 2);         // 算调整值
//   }
//
// 【JS语法 - 给初学者】
//   ABILITY_ID_MAP = { 1: 'strength', 4: 'dexterity', ... }
//   这叫"对象字面量"，类似字典/映射表。
//   通过 ABILITY_ID_MAP[1] 得到 'strength'，通过 ABILITY_ID_MAP[4] 得到 'dexterity'
//
//   match(/^abilitymodifiers\s*\(\s*(\d+)\s*\)\s*$/i)
//   正则匹配。括号 (\d+) 是"捕获组"，匹配到的数字会被提取出来
//   match[1] 就是第一个捕获组的内容
//   结尾的 i 表示不区分大小写
//
// ============================================================

// 确保 handlers.attribute 命名空间存在


// 属性ID → 英文键名映射
// 为什么需要这个映射？
// 规则中写的是属性ID（如 1=力量, 4=敏捷），
// 但角色数据中用的是英文键名（如 character.abilities.strength），
// 所以需要做个转换。
//
// 属性ID对照表：
//   1  = strength    (力量)
//   4  = dexterity   (敏捷)
//   9  = constitution(体质)
//   11 = intelligence(智力)
//   18 = wisdom      (感知)
//   25 = charisma    (魅力)
export const ABILITY_ID_MAP = {
    1: 'strength',
    4: 'dexterity',
    9: 'constitution',
    11: 'intelligence',
    18: 'wisdom',
    25: 'charisma'
};

// ============================================================
// 函数：parse(rule)  — 解析属性调整值引用
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "AbilityModifiers(1)" 或 "AbilityModifiers(4)"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'attribute',           // 固定为 'attribute'
//       success: true|false,         // 是否识别成功
//       needUserSelect: false,       // 纯引用，不需要选择
//       abilityId: 1,                // 属性ID（如 1=力量）
//       abilityKey: 'strength',      // 英文键名（如 'strength'）
//       expression: "AbilityModifiers(1)"  // 原始规则
//     }
//     失败时返回 { type: 'attribute', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // 匹配 AbilityModifiers([属性id])，不区分大小写
    // (\d+) 捕获数字部分，match[1] 就是属性ID
    // 行首 ^ 和行尾 $ 确保整个字符串完全匹配
    // \s* 允许空格，如 "AbilityModifiers( 1 )" 也能匹配
    var match = rule.match(/^abilitymodifiers\s*\(\s*(\d+)\s*\)\s*$/i);
    if (!match) {
        return {
            type: 'attribute',
            success: false,
            needUserSelect: false
        };
    }

    var abilityId = parseInt(match[1], 10);  // 属性ID，如 1
    var abilityKey = ABILITY_ID_MAP[abilityId];  // 转英文键名

    return {
        type: 'attribute',
        success: true,
        needUserSelect: false,
        abilityId: abilityId,      // 属性ID（数字）
        abilityKey: abilityKey,    // 英文键名（如 "strength"）
        expression: rule
    };
};