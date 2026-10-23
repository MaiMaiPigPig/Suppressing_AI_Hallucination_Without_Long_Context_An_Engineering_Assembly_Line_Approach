// ============================================================
// 多类组合选择处理器 - 全局作用域
// ============================================================

import { getFeatTypeMap, getWeaponTypeMap } from '../core/data/dictionary.js';
//
// 【这个文件有什么用？】
// 处理"从多个类别中混合选择，总数固定"的规则。
// 比如某特性允许"从技能和工匠工具中总共选3项"。
//
// 匹配规则：
//   choose([选项A],[选项B],...)+[总数]
//
// 支持的类别（在 parseCategory 中定义）：
//   skill                          — 所有技能
//   tool(type=[id])                — 按类型筛选工具（66=工匠, 67=乐器, 68=赌具, 69=其他）
//   weapon(type=[id])              — 按类型筛选武器（61=近战, 62=远程, 63=简易, 64=军用）
//   spell(class=[id],lv=[环位])    — 按职业和环位筛选法术
//   language                       — 所有语言
//   armor(type=[id])               — 按类型筛选护甲
//   feats(type=[id])               — 按类型筛选专长（42=起源, 44=战斗风格, 45=传奇）
//
// 【关键区别 - 与其他 Handler 的对比】
//   - filter.js：单一类别筛选（如"选一个德鲁伊戏法"）
//   - 本文件：多类别混合选择（如"从技能和工具中总共选3项"）
//   - selection.js：选项写在规则字符串中，不从数据表加载
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("choose(skill,tool(type=66))+3")  → 从技能和工匠工具中总共选3项
//   handlers.parseRule("choose(skill,language)+2")       → 从技能和语言中总共选2项
//
// 【返回值用法】
//   if (result.type === 'choose') {
//     // result.categories 数组包含了所有可选类别
//     // result.total 是总选择数量
//     // result.title 是显示标题，如 "技能、工匠工具"
//     // 遍历 categories，从每个类别对应的 JSON 加载数据
//     // 让用户从所有可选项中选 total 个
//   }
//
// 【JS语法 - 给初学者】
//   export function splitArgs(str) { ... }
//   给 handlers.choose 对象添加一个名叫 splitArgs 的函数。
//   在其他地方可以通过 handlers.choose.splitArgs("xxx") 调用。
//
//   for (var i = 0; i < str.length; i++) { var ch = str[i]; }
//   标准的 for 循环遍历字符串的每个字符。
//   str[i] 通过索引取字符串中的第 i 个字符（从0开始）。
//
//   depth++ 和 depth--
//   ++ 是自增，-- 是自减。
//   depth 用来跟踪"当前在几层括号里面"。
//   遇到 ( 就 depth+1，遇到 ) 就 depth-1。
//   只有 depth===0 时的逗号才是真正的参数分隔符。
//
//   console.warn('[choose] 未识别的类别: ' + arg);
//   console.warn() 在浏览器控制台输出警告信息。
//   不会中断程序执行，用于调试和日志。
//
// ============================================================



// ============================================================
// 辅助函数：splitArgs(str)  — 拆分 choose() 括号内的参数列表
// ============================================================
// 功能：支持嵌套括号，正确处理逗号分隔
// 例如：splitArgs("skill,tool(type=66)") → ["skill", "tool(type=66)"]
//
// 为什么需要这个函数？
// 简单用 .split(',') 会错误地把 "tool(type=66)" 中的逗号也拆开。
// 这个函数会跟踪括号深度，只在深度为0时按逗号拆分。
//
// 【参数说明】
//   @param {string} str - 括号内的内容字符串
//     例如: "skill,tool(type=66)"
//
// 【返回值说明】
//   @returns {array} 分割后的参数数组
//     例如: ["skill", "tool(type=66)"]
//
// ============================================================
export function splitArgs(str) {
    var args = [];
    var current = '';
    var depth = 0;

    // 遍历每个字符，遇到括号则深度+1/-1
    // 只有深度为0时的逗号才是真正的分隔符
    for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (ch === '(') {
            depth++;
            current += ch;
        } else if (ch === ')') {
            depth--;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) args.push(current.trim());

    return args;
};

// ============================================================
// 辅助函数：parseCategory(arg)  — 解析单个类别参数
// ============================================================
// 功能：识别并验证每个类别的格式和参数
// 支持的类别：skill, tool(type=), weapon(type=), spell(class=,lv=),
//             language, armor(type=), feats(type=)
//
// 【参数说明】
//   @param {string} arg - 类别描述字符串
//     例如: "skill" / "tool(type=66)" / "spell(class=4,lv=0)"
//
// 【返回值说明】
//   @returns {object|null}
//     成功时返回对象：
//       {
//         category: 'skills',     // 类别名
//         type: 'all',           // 或 typeId: 66（按类型筛选时）
//         jsonFile: 'skills'     // 对应的 JSON 文件名
//       }
//     失败时返回 null（无法识别的类别）
//
// 【JS语法 - 给初学者】
//   /^skills?$/i.test(arg)
//   .test() 是正则的方法，返回 true 或 false。
//   和 .match() 不同，.test() 只返回布尔值，不返回匹配结果。
//   /^skills?$/i.test("skill") → true
//   /^skills?$/i.test("SKILL") → true（因为 /i 不区分大小写）
//
//   console.warn('[choose] 未识别的类别: ' + arg);
//   console.warn() 在控制台输出警告，用于调试。
//   不会中断程序运行。
//
// ============================================================
export function parseCategory(arg) {
    arg = arg.trim();

    // ----------------------------------------------------------
    // skill — 所有技能
    // 从 skills.json 中提供所有技能供选择
    // ----------------------------------------------------------
    if (/^skills?$/i.test(arg)) {
        return {
            category: 'skills',
            type: 'all',
            jsonFile: 'skills'
        };
    }

    // ----------------------------------------------------------
    // tool(type=[id]) — 按类型筛选工具
    // 从 tools.json 中筛选指定类型的工具
    // 类型ID：66=工匠工具, 67=乐器, 68=赌具, 69=其他工具
    // ----------------------------------------------------------
    var toolMatch = arg.match(/^tools?\s*\(\s*type\s*=\s*(\d+)\s*\)\s*$/i);
    if (toolMatch) {
        return {
            category: 'tools',
            typeId: parseInt(toolMatch[1], 10),
            jsonFile: 'tools'
        };
    }

    // ----------------------------------------------------------
    // weapon(type=[id]) — 按类型筛选武器
    // 从 weapons.json 中筛选指定类型的武器
    // 类型ID：61=近战, 62=远程, 63=简易, 64=军用
    // ----------------------------------------------------------
    var weaponMatch = arg.match(/^weapons?\s*\(\s*type\s*=\s*(\d+)\s*\)\s*$/i);
    if (weaponMatch) {
        return {
            category: 'weapons',
            typeId: parseInt(weaponMatch[1], 10),
            jsonFile: 'weapons'
        };
    }

    // ----------------------------------------------------------
    // spell(class=[id],lv=[环位]) — 按职业和环位筛选法术
    // 从 spells.json 中筛选指定职业和环位的法术
    // 支持多个职业ID：spell(class=3,4,12,lv=0)
    // 支持无环位：spell(class=3,4,12)
    // 示例：spell(class=4,lv=0) → 德鲁伊戏法
    // ----------------------------------------------------------
    var spellMatch = arg.match(/^spells?\s*\(\s*(.+)\s*\)\s*$/i);
    if (spellMatch) {
        // 解析括号内的 key=value 对
        var innerRaw = spellMatch[1];
        var parts = innerRaw.split(',');
        var params = {};
        var currentKey = null;
        for (var spi = 0; spi < parts.length; spi++) {
            var part = parts[spi].trim();
            var kvMatch = part.match(/^(\w+)\s*=\s*(.+)$/);
            if (kvMatch) {
                currentKey = kvMatch[1].toLowerCase();
                params[currentKey] = (params[currentKey] || '') + kvMatch[2];
            } else if (currentKey) {
                params[currentKey] += ',' + part;
            }
        }
        
        var classIdStr = params['class'] || '';
        var levelStr = params['lv'] || '';
        
        // 解析classId列表
        var classIdList = [];
        if (classIdStr) {
            classIdList = classIdStr.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        }
        
        var result = {
            category: 'spells',
            classId: classIdList.length > 0 ? classIdList[0] : null,
            classIdList: classIdList,
            level: levelStr ? parseInt(levelStr, 10) : null,
            jsonFile: 'spells'
        };
        return result;
    }

    // ----------------------------------------------------------
    // language — 所有语言
    // 从 languages.json 中提供所有语言供选择
    // ----------------------------------------------------------
    if (/^languages?$/i.test(arg)) {
        return {
            category: 'languages',
            type: 'all',
            jsonFile: 'languages'
        };
    }

    // ----------------------------------------------------------
    // armor(type=[id]) — 按类型筛选护甲
    // 从 armors.json 中筛选指定类型的护甲
    // ----------------------------------------------------------
    var armorMatch = arg.match(/^armors?\s*\(\s*type\s*=\s*(\d+)\s*\)\s*$/i);
    if (armorMatch) {
        return {
            category: 'armors',
            typeId: parseInt(armorMatch[1], 10),
            jsonFile: 'armors'
        };
    }

    // ----------------------------------------------------------
    // feats(type=[id]) — 按类型筛选专长
    // 从 feats.json 中筛选指定类型的专长
    // 类型ID：42=起源专长, 44=战斗风格, 45=传奇恩惠
    // ----------------------------------------------------------
    var featsMatch = arg.match(/^feats?\s*\(\s*type\s*=\s*(\d+)\s*\)\s*$/i);
    if (featsMatch) {
        return {
            category: 'feats',
            typeId: parseInt(featsMatch[1], 10),
            jsonFile: 'feats'
        };
    }

    // 无法识别的类别
    console.warn('[choose] 未识别的类别: ' + arg);
    return null;
};

// ============================================================
// 函数：parse(rule)  — 解析多类组合选择规则
// ============================================================
//
// 完整流程：
//   1. 用正则匹配 choose(...)+[总数] 的整体格式
//   2. 用 splitArgs 拆分括号内的参数列表
//   3. 对每个参数用 parseCategory 解析类别
//   4. 生成友好的标题描述
//
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "choose(skill,tool(type=66))+3" / "choose(skill,language)+2"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'choose',            // 固定为 'choose'
//       success: true|false,
//       needUserSelect: true,      // 需要用户选择
//       total: 3,                  // 总选择数量
//       count: 3,                  // 兼容通用渲染
//       categories: [              // 类别列表
//         { category: 'skills', type: 'all', jsonFile: 'skills' },
//         { category: 'tools', typeId: 66, jsonFile: 'tools' }
//       ],
//       title: '技能、工匠工具',   // 显示标题
//       expression: rule
//     }
//     失败时返回 { type: 'choose', success: false, needUserSelect: false }
//
// 【JS语法 - 给初学者】
//   chooseMatch[1] 和 chooseMatch[2]
//   正则匹配的结果数组，索引0是完整匹配，索引1开始是捕获组。
//   chooseMatch[1] 是第一个括号 (\d+) 捕获的内容。
//
//   titleParts.join('、')
//   .join() 是数组方法，把数组所有元素用指定分隔符拼成字符串。
//   如 ["技能", "工匠工具"] → "技能、工匠工具"
//
//   !chooseMatch 中的 ! 是"取反"运算符
//   !null → true，!数组 → false
//   所以 if (!chooseMatch) 在匹配失败时进入（没匹配到就返回错误）
//
//   var ci = 0; ci < categories.length; ci++
//   标准的 for 循环遍历数组。
//   categories.length 是数组的长度。
//   categories[ci] 通过索引取数组元素。
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 匹配 choose([选项A],[选项B],...)+[总数]
    // 注意：由于括号内可能含嵌套括号（如 tool(type=66)），
    // 不能用 [^)]+ 简单匹配到第一个 ) 为止（会截断 tool(type=66 缺少末尾括号）。
    // 改用按字符遍历括号深度的方法，找到最外层匹配的 )。
    // ----------------------------------------------------------
    var chooseIdx = rule.search(/choose\s*\(/i);
    if (chooseIdx === -1) {
        return {
            type: 'choose',
            success: false,
            needUserSelect: false,
            message: '格式错误: ' + rule
        };
    }
    var parenStart = rule.indexOf('(', chooseIdx);
    var depth = 0;
    var parenEnd = -1;
    for (var ci = parenStart; ci < rule.length; ci++) {
        if (rule[ci] === '(') depth++;
        else if (rule[ci] === ')') {
            depth--;
            if (depth === 0) {
                parenEnd = ci;
                break;
            }
        }
    }
    if (parenEnd === -1) {
        return {
            type: 'choose',
            success: false,
            needUserSelect: false,
            message: '括号不匹配: ' + rule
        };
    }
    var categoriesStr = rule.substring(parenStart + 1, parenEnd);
    // 解析 +N 总数
    var rest = rule.substring(parenEnd + 1).trim();
    var countMatch = rest.match(/^\+\s*(\d+)\s*$/i);
    if (!countMatch) {
        return {
            type: 'choose',
            success: false,
            needUserSelect: false,
            message: '缺少总数: ' + rule
        };
    }
    var total = parseInt(countMatch[1], 10);  // 总选择数量

    // 解析类别列表（支持嵌套括号）
    var argList = splitArgs(categoriesStr);
    var categories = [];

    // 逐个解析每个类别参数
    for (var i = 0; i < argList.length; i++) {
        var cat = parseCategory(argList[i]);
        if (cat) {
            categories.push(cat);
        }
    }

    // 如果没有可识别的类别，返回失败
    if (categories.length === 0) {
        return {
            type: 'choose',
            success: false,
            needUserSelect: false,
            message: '没有可识别的类别: ' + rule
        };
    }

    // ----------------------------------------------------------
    // 生成友好的标题描述
    // 将类别映射为中文名称，用于显示在UI的选择页标题中
    // 示例：["技能", "工匠工具"] → "技能、工匠工具"
    // ----------------------------------------------------------
    var titleParts = [];
    for (var ci = 0; ci < categories.length; ci++) {
        var c = categories[ci];
        // parseCategory 返回的 category 是复数形式（skills/tools/weapons/spells/languages/armors/feats）
        if (c.category === 'skills') titleParts.push('技能');
        else if (c.category === 'tools') {
            var labels = { 66: '工匠工具', 67: '乐器', 68: '赌具', 69: '其他工具' };
            titleParts.push(labels[c.typeId] || '工具');
        } else if (c.category === 'weapons') {
            titleParts.push(getWeaponTypeMap()[c.typeId] || '武器');
        } else if (c.category === 'spells') titleParts.push((c.level !== null && c.level !== undefined) ? c.level + '环法术' : '法术');
        else if (c.category === 'languages') titleParts.push('语言');
        else if (c.category === 'armors') titleParts.push('护甲');
      else if (c.category === 'feats') {
            titleParts.push(getFeatTypeMap()[c.typeId] || '专长');
        }
        else titleParts.push(c.category);
    }

    return {
        type: 'choose',
        success: true,
        needUserSelect: true,                    // 需要用户选择
        total: total,                             // 总选择数量
        count: total,                             // 兼容通用渲染
        categories: categories,                   // 类别列表（用于数据加载）
        title: titleParts.join('、'),              // 显示标题（如"技能、工匠工具"）
        expression: rule
    };
};