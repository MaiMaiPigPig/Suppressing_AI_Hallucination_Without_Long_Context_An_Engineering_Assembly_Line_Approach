// ============================================================
// 表名映射处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 将简写的表名映射到实际的 JSON 文件名。
// 比如规则中写 "growup"，实际加载的是 proficiency.json。
// 这个映射是"硬编码"的，因为表名和文件名的对应关系是固定的。
//
// 映射表 TABLE_MAP：
//   race_feature / race_features → race_features.json（种族特性）
//   class_feature / class_features → class_features.json（职业特性）
//   class_extra → class_extra.json（职业额外数据）
//   growup → proficiency.json（成长/熟练表）
//   shop → items.json（商店/物品表）
//   suit → packages.json（装备包表）
//   magicitems / magic_items → magic_items.json（魔法物品表）
//
// 特点：
//   - 纯映射，不需要用户选择
//   - 实际数据加载由其他代码完成
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("growup")        → 指向 proficiency.json
//   handlers.parseRule("race_features") → 指向 race_features.json
//
// 【返回值用法】
//   if (result.type === 'table-map') {
//     // 需要加载 result.jsonFile + ".json" 文件
//     // 例如 result.jsonFile === 'proficiency' 就加载 proficiency.json
//   }
//
// 【JS语法 - 给初学者】
//   var key = rule.toLowerCase();
//   .toLowerCase() 把字符串转成小写。
//   这样 "Growup"、"GROWUP"、"growup" 都会变成 "growup"，
//   再去映射表里查找，实现不区分大小写。
//
//   TABLE_MAP = { race_feature: 'race_features', ... }
//   这叫"对象字面量"（Object Literal），类似其他语言的"字典"或"映射表"。
//   键（key）是字符串，值（value）也是字符串。
//   通过 TABLE_MAP[key] 获取对应的值，如果 key 不存在返回 undefined。
//
//   if (handlers.tableMap.TABLE_MAP[key]) { ... }
//   JS 中，undefined、null、0、"" 都被视为 false。
//   所以如果 key 不在映射表中，TABLE_MAP[key] 返回 undefined，
//   if 条件不成立，进入 else 分支返回失败。
//
// ============================================================



// 表名 → JSON 文件名映射表
// 键：规则中使用的简写名（不区分大小写，统一转小写后查找）
// 值：实际加载的 JSON 文件名（不含扩展名 .json）
export const TABLE_MAP = {
    race_feature: 'race_features',
    race_features: 'race_features',
    class_features: 'class_features',
    class_feature: 'class_features',
    class_extra: 'class_extra',
    growup: 'proficiency',
    shop: 'items',
    suit: 'packages',
    magicitems: 'magic_items',
    magic_items: 'magic_items',
};

// ============================================================
// 函数：parse(rule)  — 解析表名映射规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "growup" / "race_features" / "class_extra"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'table-map',           // 固定为 'table-map'
//       success: true|false,
//       needUserSelect: false,       // 纯映射，不需要选择
//       tableName: 'growup',         // 输入的简写表名
//       jsonFile: 'proficiency',     // 实际的 JSON 文件名（不含扩展名）
//       expression: rule
//     }
//     失败时返回 { type: 'table-map', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();
    var key = rule.toLowerCase();

    // 在映射表中查找
    if (TABLE_MAP[key]) {
        return {
            type: 'table-map',
            success: true,
            needUserSelect: false,
            tableName: key,                              // 输入的简写表名
            jsonFile: TABLE_MAP[key],                    // 实际的 JSON 文件名
            expression: rule
        };
    }

    // 未匹配到任何表名映射
    return {
        type: 'table-map',
        success: false,
        needUserSelect: false
    };
};