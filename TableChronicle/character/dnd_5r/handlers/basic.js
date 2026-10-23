// ============================================================
// 基础值处理器 - ES Module
// ============================================================
//
// 【这个文件有什么用？】
// 处理那些"直接显示/计算数值，不需要用户选择"的规则。
// 比如：生命值(hp)、护甲等级(ac=...)、速度(speed+10)。
//
// 【调用方式】
// 外部不会直接调用它，而是通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("hp")       → 自动走到 basic.js
//   handlers.parseRule("ac=10+2")  → 自动走到 basic.js
//
// 【返回值用法】
// 调用方拿到结果后：
//   if (result.type === 'basic') {
//     if (result.subtype === 'hp') { 显示生命值 }
//     if (result.subtype === 'ac') { 用 result.formula 算护甲 }
//     if (result.subtype === 'speed') { 速度 += result.value }
//   }
//
// 【JS语法 - 给初学者】
//   handlers.basic = handlers.basic || {};
//   确保 handlers.basic 存在，如果不存在就新建空对象。
//   这样每个 handler 文件可以独立加载，互相不影响。
//
//   handlers.basic.parse = function(rule) { ... }
//   给 handlers.basic 对象添加一个名为 parse 的函数。
//   在其他地方可以通过 handlers.basic.parse("xxx") 调用。
//
//   isNaN(value) ? 0 : value
//   三目运算符：如果 value 是 NaN（Not a Number）就用 0，否则用 value。
//   parseInt() 如果解析失败会返回 NaN，所以需要保护。
//
// ============================================================

// ============================================================
// 函数：parse(rule)  — 解析基础值规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "hp" / "ac=10+AbilityModifiers(4)" / "speed+10"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'basic',           // 固定为 'basic'
//       subtype: 'hp'|'ac'|'speed'|'display',  // 具体子类型
//       success: true|false,     // 是否识别成功
//       needUserSelect: false,   // 基础值都不需要用户选择
//       expression: rule,        // 原始规则原文
//       ...其他字段（因 subtype 而异）
//     }
//     失败时返回 { type: 'basic', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();
    var r = rule.toLowerCase();

    // ----------------------------------------------------------
    // hp_per_lv+[N] — 每级生命值增加
    // 每角色等级增加固定生命值，如 hp_per_lv+2 表示每级+2生命值
    // 类似D&D 5e的"坚韧"专长效果
    //
    // 用法：result.subtype === 'hp_per_lv' 时，用 result.value 每级加生命
    // ----------------------------------------------------------
    if (r.startsWith('hp_per_lv+')) {
        var value = parseInt(rule.substring(10).trim(), 10);
        return {
            type: 'basic',
            subtype: 'hp_per_lv',
            success: true,
            needUserSelect: false,
            value: isNaN(value) ? 0 : value,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // hp — 生命值
    // 在 JSON 中写 rules: "hp" 表示这个特性提供生命值
    // 具体数值由角色生成时根据职业、体质等计算
    //
    // 用法：result.subtype === 'hp' 时，调用方知道要处理生命值
    // ----------------------------------------------------------
    if (r === 'hp') {
        return {
            type: 'basic',
            subtype: 'hp',
            success: true,
            needUserSelect: false,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // ac=... — 护甲等级公式
    // 等号后面是计算公式，如 ac=10+AbilityModifiers(4)
    // 注意：这里的 formula 是字符串，调用方需要自己计算它
    // 比如用 eval() 或自定义公式计算器
    //
    // 用法：result.subtype === 'ac' 时，用 result.formula 算护甲
    // ----------------------------------------------------------
    if (r.startsWith('ac=')) {
        // .substring(3) 从第3个字符开始截取，即去掉 "ac=" 三个字符
        // 比如 "ac=10+AbilityModifiers(4)" → "10+AbilityModifiers(4)"
        var formula = rule.substring(3).trim();
        return {
            type: 'basic',
            subtype: 'ac',
            success: true,
            needUserSelect: false,
            formula: formula,     // 计算公式原文，如 "10+AbilityModifiers(4)"
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // speed+[N] — 速度增加
    // 在角色基础速度上增加指定数值（单位：尺）
    // 比如 speed+10 表示角色速度+10尺
    //
    // 用法：result.subtype === 'speed' 时，用 result.value 加速度
    // ----------------------------------------------------------
    if (r.startsWith('speed+')) {
        // .substring(6) 去掉 "speed+" 6个字符，取后面的数字部分
        // parseInt() 把字符串转成整数
        // isNaN() 检查是否为非数字，如果是就用 0 兜底
        var value = parseInt(rule.substring(6).trim(), 10);
        return {
            type: 'basic',
            subtype: 'speed',
            success: true,
            needUserSelect: false,
            value: isNaN(value) ? 0 : value,  // 增加的速度值
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // ac+[N] — AC固定加值
    // 在AC上增加固定数值，如 ac+2 表示AC+2
    // 注意和 ac=...（AC公式）的区别：ac+ 是直接加数值，ac= 是设置公式
    //
    // 用法：result.subtype === 'ac_bonus' 时，用 result.value 加AC
    // ----------------------------------------------------------
    if (r.startsWith('ac+')) {
        var value = parseInt(rule.substring(3).trim(), 10);
        return {
            type: 'basic',
            subtype: 'ac_bonus',
            success: true,
            needUserSelect: false,
            value: isNaN(value) ? 0 : value,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // ability(1)+2, ability(4)-1 — 属性加成
    // ability(属性ID) + 正负号 + 数值
    // ID: 1=力量, 4=敏捷, 9=体质, 11=智力, 18=感知, 25=魅力
    //
    // 用法：result.subtype === 'ability_bonus' 时，用 result.value 加属性
    // ----------------------------------------------------------
    var abilityMatch = rule.match(/^ability\((\d+)\)\s*([+-])\s*(\d+)$/);
    if (abilityMatch) {
        return {
            type: 'basic',
            subtype: 'ability_bonus',
            abilityId: parseInt(abilityMatch[1], 10),            // 属性ID（1=力量, 4=敏捷...）
            value: (abilityMatch[2] === '+' ? 1 : -1) * parseInt(abilityMatch[3], 10),  // 正负值
            success: true,
            needUserSelect: false,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // Character(直接显示) — 直接显示
    // 将字段内容直接作为文本显示，不做任何计算
    // 比如某些特性的描述文本
    //
    // 用法：result.subtype === 'display' 时，直接显示原文
    // ----------------------------------------------------------
    if (r.indexOf('character(直接显示)') >= 0) {
        return {
            type: 'basic',
            subtype: 'display',
            success: true,
            needUserSelect: false,
            expression: rule
        };
    }

    // 未匹配到任何基础值模式
    // 调用方检查 success === false 就知道没有匹配成功
    return {
        type: 'basic',
        success: false,
        needUserSelect: false
    };
};