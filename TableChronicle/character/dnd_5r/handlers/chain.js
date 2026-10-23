// ============================================================
// 连锁引用处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 处理"数据引用"规则，即一条数据指向另一条数据。
// 比如：一个特性引用了另一个特性，或者引用法术表中的某条法术。
//
// 匹配规则：
//   chain:[特性id]          — 引用同表中的另一条特性
//   [表名]:[id]             — 引用其他表中的数据
//
// 特点：
//   - 纯引用，不需要用户选择
//   - 常用于特性的"链式"效果，如一个特性指向另一个特性
//   - 跨表引用可以指向任何已知表
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("chain:54")   → 引用同表的特性id=54
//   handlers.parseRule("spell:140")  → 引用法术表中的至圣斩（id=140）
//
// 【返回值用法】
//   if (result.type === 'chain') {
//     if (result.subtype === 'same_table') {
//       // 在当前数据表中找 id = result.targetId 的数据
//     } else if (result.subtype === 'cross_table') {
//       // 在 result.tableName 对应的表中找 id = result.targetId 的数据
//     }
//   }
//
// 【JS语法 - 给初学者】
//   /^chain\s*:\s*(\d+)\s*$/i
//   正则表达式：^ 开头 $ 结尾，确保整个字符串完全匹配。
//   \s* 表示"0个或多个空格"，所以 "chain:54" 和 "chain : 54" 都能匹配。
//   (\d+) 捕获数字部分，match[1] 就是数字。
//   /i 不区分大小写。
//
//   .toLowerCase()
//   把字符串转成小写，方便统一处理。
//   比如 "Spell:140" 转成 "spell:140" 再去匹配。
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析连锁引用规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "chain:54" / "spell:140"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'chain',               // 固定为 'chain'
//       subtype: 'same_table'|'cross_table',  // 子类型
//       success: true|false,
//       needUserSelect: false,       // 纯引用，不需要选择
//       targetId: 54,                // 目标数据ID
//       // 跨表引用还有以下字段：
//       tableName: 'spell',          // 目标表名（仅 cross_table）
//       expression: rule
//     }
//     失败时返回 { type: 'chain', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 子模式1：chain:[特性id]
    // 引用同表中的另一条特性数据
    // 注意：chain 是关键词，冒号后面是目标特性的 id
    // 示例：chain:54 → 引用同表特性id=54
    // ----------------------------------------------------------
    var chainMatch = rule.match(/^chain\s*:\s*(\d+)\s*$/i);
    if (chainMatch) {
        return {
            type: 'chain',
            subtype: 'same_table',                      // 同表引用
            success: true,
            needUserSelect: false,
            targetId: parseInt(chainMatch[1], 10),      // 目标特性ID
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 子模式2：[表名]:[id]
    // 引用其他表中的数据
    // 表名可以是任意字母和下划线组合
    // 示例：spell:140 → 引用法术表中的id=140
    // ----------------------------------------------------------
    var crossMatch = rule.match(/^\s*([a-zA-Z_]+)\s*:\s*(\d+)\s*$/);
    if (crossMatch) {
        var tableName = crossMatch[1].toLowerCase();
        return {
            type: 'chain',
            subtype: 'cross_table',                      // 跨表引用
            success: true,
            needUserSelect: false,
            tableName: tableName,                        // 目标表名
            targetId: parseInt(crossMatch[2], 10),       // 目标ID
            expression: rule
        };
    }

    // 未匹配到任何连锁模式
    return {
        type: 'chain',
        success: false,
        needUserSelect: false
    };
};