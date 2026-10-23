// ============================================================
// 角色资源处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 处理角色资源的引用和增加操作。
// 角色资源是"有次数限制的能力"，比如：
//   - 野蛮人的"狂暴"（Rage）—— 每天几次
//   - 武僧的"气"（Ki）—— 每短休恢复
//   - 圣武士的"至圣斩"（Divine Smite）
//   - 战士的"动作如潮"（Action Surge）
//
// 匹配规则：
//   Character([资源名称])+[数值]  — 增加指定资源的计数
//   Character([资源名称])          — 简单引用资源（不做增减）
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("Character(狂暴)+1")  → 狂暴使用次数+1
//   handlers.parseRule("Character(气)")      → 引用气的当前值
//
// 【返回值用法】
//   if (result.type === 'resource') {
//     if (result.subtype === 'add') {
//       // 在角色数据中，找到 result.resourceName 对应的资源，增加 result.value
//     } else if (result.subtype === 'reference') {
//       // 读取 result.resourceName 对应的资源的当前值
//     }
//   }
//
// 【JS语法 - 给初学者】
//   /^character\s*\(\s*([^)]+)\s*\)\s*\+\s*(\d+)\s*$/i
//   正则匹配 Character(名称)+数字 的格式。
//   ([^)]+) 捕获组：匹配不是 ) 的任意字符（即括号内的资源名称）
//   (\d+) 捕获组：匹配数字（即增加的数量）
//   /i 不区分大小写，所以 "Character(狂暴)" 和 "character(狂暴)" 都行。
//
//   [^)]+ 中的 ^ 表示"否定"，在方括号 [^)] 内部表示"不是 ) 的字符"
//   所以 [^)]+ 匹配一个或多个不是 ) 的字符。
//
//   match[1] 是第一个捕获组的内容，即资源名称
//   match[2] 是第二个捕获组的内容，即增加数量
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析角色资源规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "Character(狂暴)+1" / "Character(气)"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'resource',            // 固定为 'resource'
//       subtype: 'add'|'reference',  // 子类型
//       success: true|false,
//       needUserSelect: false,       // 纯操作，不需要选择
//       resourceName: '狂暴',        // 资源名称（中文）
//       value: 1,                    // 增加数量（reference 时为 0）
//       expression: rule
//     }
//     失败时返回 { type: 'resource', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 子模式1：Character([资源名称])+[数值]
    // 增加指定资源的计数
    // 示例：Character(狂暴)+1 → 狂暴使用次数增加1次
    // ----------------------------------------------------------
    var addMatch = rule.match(/^character\s*\(\s*([^)]+)\s*\)\s*\+\s*(\d+)\s*$/i);
    if (addMatch) {
        return {
            type: 'resource',
            subtype: 'add',                          // 增加资源
            success: true,
            needUserSelect: false,
            resourceName: addMatch[1].trim(),        // 资源名称（如"狂暴"）
            value: parseInt(addMatch[2], 10),         // 增加数量
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 子模式2：Character([资源名称])
    // 简单引用资源当前值，不做增减
    // 示例：Character(气) → 引用气的当前值
    // ----------------------------------------------------------
    var simpleMatch = rule.match(/^character\s*\(\s*([^)]+)\s*\)\s*$/i);
    if (simpleMatch) {
        return {
            type: 'resource',
            subtype: 'reference',                    // 引用资源
            success: true,
            needUserSelect: false,
            resourceName: simpleMatch[1].trim(),     // 资源名称
            value: 0,                                // 引用标记，不增加
            expression: rule
        };
    }

    // 未匹配到任何资源模式
    return {
        type: 'resource',
        success: false,
        needUserSelect: false
    };
};