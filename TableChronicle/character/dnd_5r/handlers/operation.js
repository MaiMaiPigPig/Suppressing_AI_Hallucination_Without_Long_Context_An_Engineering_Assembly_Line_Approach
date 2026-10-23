// ============================================================
// 数值运算处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 处理"从某类数据中选 N 项"的规则，不加筛选条件，全体可选。
// 比如：skill+1 表示从所有技能中选1个熟练，language+2 表示选2个语言。
//
// 【关键区别 - 与 filter.js 的对比】
//   operation（本文件）："全体中选择" — 所有项都可选，没有筛选条件
//     示例：skill+1 → 从所有18个技能中选1个
//   filter.js："条件筛选" — 有筛选条件，只显示符合条件的选项
//     示例：spell(class=4,lv=0)+1 → 只显示德鲁伊戏法
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("skill+1")       → 英文：从所有技能中选1个
//   handlers.parseRule("技能+1")        → 中文：同上
//   handlers.parseRule("language+2")    → 从所有语言中选2个
//   handlers.parseRule("skill(all)")    → 直接获得所有技能熟练（不需要选）
//
// 【返回值用法】
//   if (result.type === 'operation') {
//     if (result.subtype === 'skill_add') {
//       // 显示所有技能列表，让用户选 result.count 个
//     } else if (result.subtype === 'skill_all') {
//       // 直接给角色添加所有技能熟练
//     } else if (result.subtype === 'language_add') {
//       // 显示所有语言列表，让用户选 result.count 个
//     }
//   }
//
// 【JS语法 - 给初学者】
//   /^skill\s*\+\s*(\d+)\s*$/i  — 正则的 i 结尾表示不区分大小写
//   所以 "Skill+1" 和 "SKILL+1" 都能匹配
//
//   /^技能\s*\+\s*(\d+)\s*$/  — 中文正则，没有 i 因为中文不区分大小写
//
//   var match = skillEnMatch || skillCnMatch;
//   || 在这里是"取第一个有值的变量"：如果英文匹配就用英文结果，否则用中文结果
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析数值运算规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "skill+1" / "技能+1" / "language+2" / "skill(all)"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'operation',           // 固定为 'operation'
//       category: 'skills'|'tools'|'languages',  // 类别
//       subtype: 'skill_add'|'skill_all'|'tool_add'|'language_add',
//       success: true|false,
//       needUserSelect: true|false,  // true=需要选，false=自动全部添加
//       count: 1,                    // 选择数量（skill_all 没有此字段）
//       expression: rule
//     }
//     失败时返回 { type: 'operation', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // skill(all) — 获得所有技能熟练
    // 特殊规则：直接赋予所有技能的熟练项，不需要用户选择
    // 常用于某些种族或背景的固定效果（如所有熟练）
    //
    // 用法：result.needUserSelect === false，直接批量添加所有技能
    // ----------------------------------------------------------
    if (/^skill\s*\(\s*all\s*\)\s*$/i.test(rule)) {
        return {
            type: 'operation',
            category: 'skills',
            subtype: 'skill_all',
            success: true,
            needUserSelect: false,    // 全部获得，不需要选择
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // skill+[N] 或 技能+[N] — 获得N个技能熟练
    // 支持英文和中文两种写法，因为 JSON 数据中可能混用
    // 用户需要从所有技能中选择 N 项
    //
    // 示例：skill+1 → 选1个技能, 技能+2 → 选2个技能
    // 用法：从 skills.json 加载所有技能，让用户选 result.count 个
    // ----------------------------------------------------------
    var skillEnMatch = rule.match(/^skill\s*\+\s*(\d+)\s*$/i);
    var skillCnMatch = rule.match(/^技能\s*\+\s*(\d+)\s*$/);
    if (skillEnMatch || skillCnMatch) {
        var match = skillEnMatch || skillCnMatch;  // 取有值的那一个
        return {
            type: 'operation',
            category: 'skills',
            subtype: 'skill_add',
            success: true,
            needUserSelect: true,                   // 需要用户选择哪些技能
            count: parseInt(match[1], 10),           // 选择数量
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 工具+[N] — 获得N个工具熟练
    // 用户需要从所有工具中选择 N 项
    //
    // 示例：工具+1 → 选1个工具熟练
    // 用法：从 tools.json 加载所有工具，让用户选 result.count 个
    // ----------------------------------------------------------
    var toolMatch = rule.match(/^工具\s*\+\s*(\d+)\s*$/);
    if (toolMatch) {
        return {
            type: 'operation',
            category: 'tools',
            subtype: 'tool_add',
            success: true,
            needUserSelect: true,
            count: parseInt(toolMatch[1], 10),
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // language+[N] — 获得N个语言
    // 用户需要从所有语言中选择 N 项
    //
    // 示例：language+2 → 选2个语言
    // 用法：从 languages.json 加载所有语言，让用户选 result.count 个
    // ----------------------------------------------------------
    var langMatch = rule.match(/^language\s*\+\s*(\d+)\s*$/i);
    if (langMatch) {
        return {
            type: 'operation',
            category: 'languages',
            subtype: 'language_add',
            success: true,
            needUserSelect: true,
            count: parseInt(langMatch[1], 10),
            expression: rule
        };
    }

    // 未匹配到任何运算模式
    return {
        type: 'operation',
        success: false,
        needUserSelect: false
    };
};