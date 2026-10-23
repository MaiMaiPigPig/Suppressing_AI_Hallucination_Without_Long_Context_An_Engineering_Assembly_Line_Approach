// ============================================================
// 熟练与专精处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 处理"技能熟练升级为专精"的规则。
// 专精 = 熟练项的加倍（2倍熟练加值），只有已拥有熟练的技能才能升级为专精。
//
// 匹配规则：
//   Proficiency>pure+[N]              — 从已有熟练的技能中选 N 个升级为专精
//   Proficiency>pure([id1],[id2])+[N] — 从指定技能列表中选 N 个升级为专精
//   Proficiency>pure                  — 所有已有熟练的技能升级为专精
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("Proficiency>pure+2")         → 选2个已有熟练升专精
//   handlers.parseRule("Proficiency>pure(1,10,17)+1") → 从力/智/魅中选1个升专精
//   handlers.parseRule("Proficiency>pure")           → 所有熟练技能升专精
//
// 【返回值用法】
//   if (result.type === 'proficiency') {
//     if (result.subtype === 'pure_add') {
//       // 显示角色已有熟练的技能列表，让用户选 result.count 个
//     } else if (result.subtype === 'pure_list') {
//       // 只显示 result.skillIds 指定的技能，让用户选 result.count 个
//     } else if (result.subtype === 'pure_all') {
//       // 自动将所有已有熟练的技能升级为专精
//     }
//   }
//
// 【JS语法 - 给初学者】
//   
//   确保 handlers.proficiency 存在，防止重复加载时覆盖。
//
//   .match(/^proficiency>\s*pure\s*\+\s*(\d+)\s*$/i)
//   .match() 是字符串方法，用正则匹配字符串。
//   匹配成功返回数组，match[0] 是完整匹配，match[1] 是第一个括号捕获的内容。
//   匹配失败返回 null。
//   /i 结尾表示不区分大小写，所以 "Proficiency>pure+1" 和 "proficiency>PURE+1" 都能匹配。
//
//   .split(',').map(...).filter(...)
//   split(',') 把字符串按逗号拆成数组
//   map() 对数组每个元素执行函数，返回新数组
//   filter() 过滤掉不符合条件的元素
//   这三步连用：拆字符串 → 转数字 → 去掉无效值
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析熟练与专精规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "Proficiency>pure+2" / "Proficiency>pure(1,10,17)+1" / "Proficiency>pure"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'proficiency',          // 固定为 'proficiency'
//       subtype: 'pure_add'|'pure_list'|'pure_all',  // 子类型
//       success: true|false,
//       needUserSelect: true|false,   // pure_all=false, 其他=true
//       count: 2,                     // 选择数量（pure_all 没有此字段）
//       skillIds: [1,10,17],          // 可选技能ID列表（仅 pure_list 有）
//       expression: rule
//     }
//     失败时返回 { type: 'proficiency', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 子模式1：Proficiency>pure+[N]
    // 从所有已有熟练的技能中，选 N 个升级为专精
    // 示例：Proficiency>pure+2 → 选2个已有熟练的技能升级为专精
    // ----------------------------------------------------------
    var pureAddMatch = rule.match(/^proficiency>\s*pure\s*\+\s*(\d+)\s*$/i);
    if (pureAddMatch) {
        return {
            type: 'proficiency',
            subtype: 'pure_add',
            success: true,
            needUserSelect: true,                       // 需要用户选择
            count: parseInt(pureAddMatch[1], 10),       // 专精数量
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 子模式2：Proficiency>pure([id1],[id2],...)+[N]
    // 从指定的技能列表中，选 N 个升级为专精
    // 括号内的 id 列表限定可选范围
    // 示例：Proficiency>pure(1,10,17)+1 → 从力量、智力、魅力中选1个升专精
    // ----------------------------------------------------------
    var pureListMatch = rule.match(/^proficiency>\s*pure\s*\(\s*([\d,\s]+)\s*\)\s*\+\s*(\d+)\s*$/i);
    if (pureListMatch) {
        var ids = pureListMatch[1].split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        return {
            type: 'proficiency',
            subtype: 'pure_list',
            success: true,
            needUserSelect: true,
            skillIds: ids,                               // 可选的技能ID列表
            count: parseInt(pureListMatch[2], 10),       // 专精数量
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 子模式3：Proficiency>pure
    // 将所有已有熟练的技能升级为专精
    // 不需要用户选择（全部升级）
    // 示例：Proficiency>pure → 所有熟练技能都升专精
    // ----------------------------------------------------------
    var pureSimpleMatch = rule.match(/^proficiency>\s*pure\s*$/i);
    if (pureSimpleMatch) {
        return {
            type: 'proficiency',
            subtype: 'pure_all',
            success: true,
            needUserSelect: false,                       // 全部升级，不需要选择
            expression: rule
        };
    }

    // 未匹配到任何熟练模式
    return {
        type: 'proficiency',
        success: false,
        needUserSelect: false
    };
};