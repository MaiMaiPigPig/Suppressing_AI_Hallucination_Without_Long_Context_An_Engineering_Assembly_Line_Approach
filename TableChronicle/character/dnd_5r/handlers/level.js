// ============================================================
// 等级引用处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 引用和计算角色的职业等级，用于特性效果的数值计算。
// 比如：武僧的"徒手打击"伤害 = 武僧等级，野蛮人的"狂暴伤害" = 野蛮人等级/2。
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("lv:class(6)")          → 简单引用武僧等级
//   handlers.parseRule("lv:class(1)*0.5>↓")    → 野蛮人等级的一半，向下取整
//   handlers.parseRule("lv:class(6)=10")       → 判断武僧等级是否=10
//
// 【返回值用法】
//   if (result.type === 'level') {
//     var classLevel = character.classes[result.classId].level;  // 取职业等级
//     if (result.subtype === 'simple') {
//       return classLevel;                           // 直接返回等级
//     } else if (result.subtype === 'multiply') {
//       return Math[result.round === '↑' ? 'ceil' : 'floor'](classLevel * result.multiplier);
//     } else if (result.subtype === 'equal') {
//       return classLevel === result.targetLevel;    // 返回 true/false
//     }
//   }
//
// 【JS语法 - 给初学者】
//   parseFloat("0.5") → 0.5
//   把字符串转成浮点数（小数）
//
//   Math.ceil(2.3) → 3  （向上取整）
//   Math.floor(2.7) → 2  （向下取整）
//   这里用 ↑↓ 符号来控制取整方向
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析等级引用规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "lv:class(6)" / "lv:class(1)*0.5>↓" / "lv:class(6)=10"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'level',             // 固定为 'level'
//       subtype: 'simple'|'multiply'|'equal',  // 具体子类型
//       success: true|false,
//       needUserSelect: false,     // 纯计算，不需要选择
//       classId: 6,                // 职业ID
//       expression: rule
//       // 根据 subtype 不同，还有额外字段：
//       //   simple: 无额外字段
//       //   multiply: multiplier(倍数), round(取整方向↑或↓)
//       //   equal: targetLevel(目标等级)
//     }
//     失败时返回 { type: 'level', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();
    var r = rule.toLowerCase();

    // ----------------------------------------------------------
    // 子模式1：lv:class([职业id])=[数值]
    // 判断某职业等级是否等于指定值
    // 用于特性中的等级条件判断
    //
    // 示例：lv:class(6)=10 → 如果武僧等级=10，条件成立
    // 用法：用 result.targetLevel 做 === 比较
    // ----------------------------------------------------------
    var equalMatch = r.match(/^lv:class\s*\(\s*(\d+)\s*\)\s*=\s*(\d+)\s*$/);
    if (equalMatch) {
        return {
            type: 'level',
            subtype: 'equal',
            success: true,
            needUserSelect: false,
            classId: parseInt(equalMatch[1], 10),       // 职业ID
            targetLevel: parseInt(equalMatch[2], 10),   // 目标等级
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 子模式2：lv:class([职业id])*[倍数]>[取整方向]
    // 等级乘以倍数并取整
    // 取整方向：↑=向上取整, ↓=向下取整
    //
    // 示例：lv:class(1)*0.5>↓ → 野蛮人等级/2 向下取整
    // 用法：classLevel * result.multiplier，然后按 result.round 取整
    // ----------------------------------------------------------
    var mulMatch = r.match(/^lv:class\s*\(\s*(\d+)\s*\)\s*\*\s*([\d.]+)\s*>\s*([↑↓])\s*$/);
    if (mulMatch) {
        return {
            type: 'level',
            subtype: 'multiply',
            success: true,
            needUserSelect: false,
            classId: parseInt(mulMatch[1], 10),       // 职业ID
            multiplier: parseFloat(mulMatch[2]),       // 倍数（如 0.5）
            round: mulMatch[3],                         // 取整方向 ↑ 或 ↓
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 子模式3：lv:class([职业id])
    // 简单引用某职业的当前等级
    // 这是最常用的模式
    //
    // 示例：lv:class(6) → 武僧的当前等级
    // 用法：直接取 character.classes[result.classId].level
    // ----------------------------------------------------------
    var simpleMatch = r.match(/^lv:class\s*\(\s*(\d+)\s*\)\s*$/);
    if (simpleMatch) {
        return {
            type: 'level',
            subtype: 'simple',
            success: true,
            needUserSelect: false,
            classId: parseInt(simpleMatch[1], 10),  // 职业ID
            expression: rule
        };
    }

    // 未匹配到任何等级模式
    return {
        type: 'level',
        success: false,
        needUserSelect: false
    };
};