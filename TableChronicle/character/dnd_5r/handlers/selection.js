// ============================================================
// 选择与范围处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 处理三种格式的"多选一"或"范围选择"规则：
//   1. 带编号的多选一：[1]选项A,[2]选项B,[3]选项C...
//   2. 范围选择：[起始id]→[结束id] 或 growup([起始id]→[结束id])
//   3. ID列表选择：[id1],[id2],[id3]...
//
// 【关键区别 - 与其他 Handler 的对比】
//   - 与 filter 不同：filter 是从数据表中按条件筛选（如"选一个德鲁伊戏法"）
//   - 与 choose 不同：choose 是跨类别混合选择（如"从技能和工具中选3个"）
//   - 本文件：选项直接写在规则字符串中（如"[1]Feats(type=44)+1,[2]spell(...)"）
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2")  → 二选一
//   handlers.parseRule("303→322")  → 从环位熟练表中选id=303~322的数据
//   handlers.parseRule("303,304,305")  → 从id=303,304,305中选择
//
// 【返回值用法】
//   if (result.type === 'selection') {
//     if (result.subtype === 'numbered_choice') {
//       // 显示 result.options 列表，让用户选 result.count 个（通常1个）
//     } else if (result.subtype === 'range') {
//       // 从数据表中取出 id 在 result.startId ~ result.endId 之间的数据
//     } else if (result.subtype === 'id_list') {
//       // 从数据表中取出 id 在 result.ids 列表中的数据
//     }
//   }
//
// 【JS语法 - 给初学者】
//   rule.match(/\[\d+\]/)
//   .match() 检查字符串是否匹配正则表达式。
//   /\[\d+\]/ 匹配 [1]、[2]、[3]... 这样的编号模式。
//   \[ 和 \] 是转义的方括号，\d+ 匹配1个或多个数字。
//   如果匹配到返回数组，没匹配到返回 null。
//
//   /\[(\d+)\]\s*([^\[\]]+?)(?=\[\d+\]|$)/g
//   正则匹配：编号 + 选项内容 + 后面是下一个编号或结尾。
//   \[(\d+)\] 捕获编号数字
//   [^\[\]]+? 懒惰匹配选项内容（不含方括号）
//   (?=\[\d+\]|$) 正向预查：后面是 [N] 或字符串结尾
//   结尾的 /g 表示"全局匹配"，会找出所有匹配项，而不是只找第一个。
//
//   .pattern.exec(rule) 在循环中反复调用，可以依次取出所有匹配项。
//   当所有匹配都取完后，.exec() 会返回 null，循环结束。
//
//   .split(',').map(...).filter(...)
//   三步连用：拆字符串 → 转数字 → 去掉无效值。
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析选择与范围规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2" / "303→322" / "303,304,305"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'selection',           // 固定为 'selection'
//       subtype: 'numbered_choice'|'range'|'id_list',  // 子类型
//       success: true|false,
//       needUserSelect: true,        // 都需要用户选择
//       expression: rule
//       // 根据 subtype 不同，还有额外字段：
//       //   numbered_choice: options(选项数组), count(选几个)
//       //   range: startId(起始ID), endId(结束ID)
//       //   id_list: ids(ID数组)
//     }
//     失败时返回 { type: 'selection', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 模式1：带编号的多选一
    // 用 [1][2][3]... 这样的编号标记不同的选项
    // 用户从多个选项中选一个
    // 解析策略：
    //   1. 用正则提取带编号的选项
    //   2. 如果正则没匹配到（可能格式不标准），按行手动拆分
    // 示例：[1]Feats(type=44)+1,[2]spell(class=3,lv=0)+2
    // 示例：[1]8,41,108\n[2]20,64,128\n[3]24,90,140\n[4]1,160,84
    // ----------------------------------------------------------
    if (rule.match(/\[\d+\]/)) {
        var options = [];
        // 正则匹配带编号的选项：
        //   \[(\d+)\]  → 捕获编号（如 [1]）
        //   [^\[\]]+? → 选项内容（不含方括号，懒惰匹配）
        //   (?=\[\d+\]|$) → 直到下一个 [N] 或字符串结尾
        var pattern = /\[(\d+)]\s*([^[\]]+?)(?=\[\d+]|$)/g;
        var match;
        while ((match = pattern.exec(rule)) !== null) {
            var opt = match[2].replace(/[,，\s]+$/, '').trim();
            if (opt) {
                options.push(opt);
            }
        }

        // 如果正则没匹配到，按行拆分再提取编号后的内容
        if (options.length === 0) {
            var lines = rule.split(/\n/);
            for (var li = 0; li < lines.length; li++) {
                var lineMatch = lines[li].match(/\[\d+\]\s*(.+)/);
                if (lineMatch) {
                    var clean = lineMatch[1].trim();
                    if (clean) options.push(clean);
                }
            }
        }

        return {
            type: 'selection',
            category: 'selection',
            subtype: 'numbered_choice',    // 带编号的多选一
            success: true,
            needUserSelect: true,           // 需要用户选择
            options: options,               // 选项列表
            count: 1,                       // 默认选1个
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式2：范围选择
    // 用 → 箭头连接起始id和结束id
    // 还可以包裹在 growup() 中
    // 示例：303→322 或 growup(303→322)
    // 表示从数据表中选取id从303到322的所有数据
    // ----------------------------------------------------------
    var rangeMatch = rule.match(/(?:growup\s*\(\s*)?(\d+)\s*→\s*(\d+)(?:\s*\))?/);
    if (rangeMatch) {
        var startId = parseInt(rangeMatch[1], 10);
        var endId = parseInt(rangeMatch[2], 10);
        return {
            type: 'selection',
            subtype: 'range',                           // 范围选择
            success: true,
            needUserSelect: true,                        // 需要用户选择
            startId: startId,                            // 起始ID
            endId: endId,                                // 结束ID
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 模式3：ID列表选择
    // 纯数字ID列表，用逗号分隔
    // 示例：303,304,305 → 从id=303,304,305中选择
    // 注意：这个匹配必须放在最后，因为太容易误匹配
    // ----------------------------------------------------------
    var listMatch = rule.match(/^(\d+\s*,\s*\d[\d,\s]*)$/);
    if (listMatch) {
        var ids = listMatch[1].split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        return {
            type: 'selection',
            subtype: 'id_list',                          // ID列表选择
            success: true,
            needUserSelect: true,
            ids: ids,                                    // ID列表
            expression: rule
        };
    }

    // 未匹配到任何选择模式
    return {
        type: 'selection',
        success: false,
        needUserSelect: false
    };
};