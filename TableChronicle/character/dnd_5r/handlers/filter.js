// ============================================================
// 条件筛选处理器 - 全局作用域
// ============================================================
//
// 【这个文件有什么用？】
// 按条件从数据表中筛选数据，供用户从中选择指定数量。
// 比如：德鲁伊需要从所有戏法中选2个，战士需要从所有简易武器中选1个。
//
// 【关键区别 - 与 table-ref.js 的对比】
//   filter（本文件）："条件筛选" — 显示筛选结果给用户，让用户选
//     示例：spell(class=4,lv=0)+2 → 显示德鲁伊戏法列表，让用户选2个
//   table-ref.js："固定引用" — 直接添加，不需要用户选择
//     示例：spell=56 → 直接给角色添加至圣斩法术
//
// 【调用方式】
// 外部通过 index.js 的 parseRule() 自动路由过来：
//   handlers.parseRule("spell(class=4,lv=0)+2")  → 德鲁伊戏法选2个
//   handlers.parseRule("feats(type=44)+1")       → 起源专长选1个
//   handlers.parseRule("tool(type=66)+1")        → 工匠工具选1个
//
// 【返回值用法】
//   if (result.type === 'filter' && result.needUserSelect) {
//     // 根据 result.category 决定从哪个 JSON 加载数据
//     // 根据 result 中的条件参数（classId, level, toolType 等）筛选数据
//     // 显示给用户，让用户选择 result.count 个
//   }
//
// 【JS语法 - 给初学者】
//   (?:\s*\+\s*(\d+))?
//   正则中的 (?:...) 表示"非捕获组"——只匹配不提取
//   后面的 ? 表示整个组是可选的，可以有也可以没有
//   (\d+) 是捕获组，提取数字，match[3] 就是选择数量
//
// ============================================================



// ============================================================
// 函数：parse(rule)  — 解析条件筛选规则
// ============================================================
// 【参数说明】
//   @param {string} rule - 规则字符串
//     例如: "spell(class=4,lv=0)+2" / "feats(type=44)+1" / "tool(type=66)"
//
// 【返回值说明】
//   @returns {object}
//     {
//       type: 'filter',              // 固定为 'filter'
//       category: 'spells'|'tools'|'weapons'|'feats',  // 筛选类别
//       success: true|false,
//       needUserSelect: true,        // 需要用户选择
//       count: 2,                    // 需要选择的数量（默认1）
//       expression: rule
//       // 根据 category 不同，还有额外筛选参数：
//       //   spell: classId(职业ID), level(环位)
//       //   tool: toolType(工具类型ID)
//       //   weapon: weaponType(武器类型ID)
//       //   feats: featType(专长类型ID)
//     }
//     失败时返回 { type: 'filter', success: false, needUserSelect: false }
//
// ============================================================
export function parse(rule) {
    rule = String(rule).trim();

    // ----------------------------------------------------------
    // 法术筛选：spell(...)+[数量]
    // 从法术表中筛选指定职业和环位的法术
    //
    // 参数说明（从括号内解析 key=value 对）：
    //   class: 职业ID，支持单个(4)或多个(3,4,12)
    //   lv: 法术环位（0=戏法, 1=1环...），可选
    //   school: 学派ID，可选
    //   dice: 是否有伤害骰（1=有伤害, 0=无伤害），可选
    //
    // 支持格式：
    //   spell(class=4,lv=0)+2     → 德鲁伊戏法选2个
    //   spell(class=3,4,12)+2     → 牧师/德鲁伊/法师法术选2个（所有等级）
    //   spell(lv=6,class=11)+1    → 邪术师6环法术选1个（顺序颠倒）
    //   spell(class=12,school=7)+2 → 法师防护学派法术选2个
    //   spell(class=11,lv=0,dice=1) → 邪术师有伤害骰的戏法（先决条件用）
    // 用法：从 spells.json 中筛选符合条件的法术，让用户选N个
    // ----------------------------------------------------------
    var spellOuterMatch = rule.match(/^spells?\s*\(\s*([^)]+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i);
    if (spellOuterMatch) {
        var inner = spellOuterMatch[1];   // 括号内的内容，如 "class=4,lv=0" 或 "class=3,4,12"
        var count = spellOuterMatch[2] ? parseInt(spellOuterMatch[2], 10) : 1;
        
        // 解析 key=value 对，value 可能包含逗号（如 class=3,4,12）
        // 策略：按逗号分割，但识别 key= 开头的作为键的开始
        var parts = inner.split(',');
        var params = {};
        var currentKey = null;
        for (var pi = 0; pi < parts.length; pi++) {
            var part = parts[pi].trim();
            var kvMatch = part.match(/^(\w+)\s*=\s*(.+)$/);
            if (kvMatch) {
                currentKey = kvMatch[1].toLowerCase();
                params[currentKey] = (params[currentKey] || '') + kvMatch[2];
            } else if (currentKey) {
                // 续接上一个 key 的值（处理 class=3,4,12 中的 ",4" 和 ",12"）
                params[currentKey] += ',' + part;
            }
        }
        
        var classIdStr = params['class'] || '';
        var levelStr = params['lv'] || '';
        var schoolStr = params['school'] || '';
        var diceStr = params['dice'] || '';
        var idStr = params['id'] || '';
        
        // 参数校验：warn 不支持的参数
        var spellSupported = ['class', 'lv', 'school', 'dice', 'id'];
        Object.keys(params).forEach(function(k) {
            if (spellSupported.indexOf(k) < 0) {
                console.warn('[filter.js spell] 未支持的参数: ' + k + '=' + params[k] + ' (rule: ' + rule + ')');
            }
        });
        
        // id=N 直接指定法术ID，不需要用户选择
        if (idStr) {
            var directSpellId = parseInt(idStr, 10);
            if (!isNaN(directSpellId)) {
                return {
                    type: 'filter',
                    category: 'spells',
                    success: true,
                    needUserSelect: false,
                    selectMode: 'single',
                    id: directSpellId,
                    count: 1,
                    expression: rule
                };
            }
        }
        
        // 解析 classId 列表（支持多个：3,4,12）
        var classIdList = [];
        if (classIdStr) {
            classIdList = classIdStr.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        }
        
        // 解析 schoolId 列表（支持多个：9,10）
        var schoolList = [];
        if (schoolStr) {
            schoolList = schoolStr.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        }
        
        // 解析 dice 参数（1=有伤害骰, 0=无伤害骰）
        var diceFilter = null;
        if (diceStr) {
            var diceVal = parseInt(diceStr, 10);
            if (diceVal === 1 || diceVal === 0) {
                diceFilter = diceVal;
            }
        }
        
        // 使用第一个 classId 作为主要 classId（兼容旧代码）
        var primaryClassId = classIdList.length > 0 ? classIdList[0] : null;
        
        var result = {
            type: 'filter',
            category: 'spells',
            success: true,
            needUserSelect: true,
            classId: primaryClassId,         // 主职业ID（兼容旧字段）
            classIdList: classIdList,        // 所有职业ID列表（新增）
            level: levelStr ? parseInt(levelStr, 10) : null,  // 法术环位，可能为空
            school: schoolList.length > 0 ? schoolList[0] : null, // 主学派ID（兼容旧字段）
            schoolList: schoolList,          // 所有学派ID列表（新增，支持多学派筛选）
            dice: diceFilter,                // 伤害骰筛选（1=有, 0=无, null=不限制）
            count: count,
            expression: rule
        };
        return result;
    }

    // ----------------------------------------------------------
    // 工具筛选：tool(type=[类型id])+[数量]
    // 从工具表中筛选指定类型的工具
    //
    // 类型ID映射：
    //   66 = 工匠工具（如铁匠工具、木工工具）
    //   67 = 乐器（如鲁特琴、长笛）
    //   68 = 赌具（如骰子、卡牌）
    //   69 = 其他工具
    //
    // 示例：tool(type=66)+1 → 从工匠工具中选1个
    // 用法：从 tools.json 中筛选 type=66 的工具，让用户选1个
    // ----------------------------------------------------------
    var toolMatch = rule.match(/^tools?\s*\(\s*type\s*=\s*(\d+)\s*\)(?:\s*\+\s*(\d+))?\s*$/i);
    if (toolMatch) {
        return {
            type: 'filter',
            category: 'tools',
            success: true,
            needUserSelect: true,
            typeId: parseInt(toolMatch[1], 10),       // 工具类型ID，如 66
            count: toolMatch[2] ? parseInt(toolMatch[2], 10) : 1,
            expression: rule
        };
    }

    // 工具直接指定：tools(id=N)+N — 通过ID直接引用工具
    var toolIdMatch = rule.match(/^tools?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i);
    if (toolIdMatch) {
        return {
            type: 'filter',
            category: 'tools',
            success: true,
            needUserSelect: false,
            selectMode: 'single',
            id: parseInt(toolIdMatch[1], 10),
            count: toolIdMatch[2] ? parseInt(toolIdMatch[2], 10) : 1,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 武器复合筛选：weapon(category=X,Y;range=Z)+[数量]
    // 从武器表中按多个条件组合筛选
    //
    // 支持参数：
    //   category: 武器类别（63=简易, 64=军用），多个用逗号分隔
    //   range: 武器范围（61=近战, 62=远程），可选
    //
    // 示例：
    //   weapon(category=63,64;range=61)+2  → 简易/军用近战武器中选2个
    //   weapon(category=63,64)+3           → 简易/军用武器中选3个
    // ----------------------------------------------------------
    var weaponCompoundMatch = rule.match(/^weapons?\s*\(\s*(category\s*=\s*[\d,]+(?:\s*;\s*range\s*=\s*\d+)?)\s*\)(?:\s*\+\s*(\d+))?\s*$/i);
    if (weaponCompoundMatch) {
        var inner = weaponCompoundMatch[1];
        var count = weaponCompoundMatch[2] ? parseInt(weaponCompoundMatch[2], 10) : 1;
        
        // 解析 category 和 range
        var parts = inner.split(';');
        var filterParams = {};
        for (var pi = 0; pi < parts.length; pi++) {
            var kv = parts[pi].trim().split('=');
            if (kv.length === 2) {
                var key = kv[0].trim().toLowerCase();
                var val = kv[1].trim();
                if (key === 'category') {
                    filterParams.category = val.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
                } else if (key === 'range') {
                    filterParams.range = parseInt(val, 10);
                }
            }
        }
        
        return {
            type: 'filter',
            category: 'weapons',
            success: true,
            needUserSelect: true,
            filterParams: filterParams,   // { category: [63,64], range: 61 }
            count: count,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 武器筛选：weapon(type=[类型id])+[数量]
    // 从武器表中筛选指定类型的武器
    //
    // 类型ID映射：
    //   61 = 近战武器
    //   62 = 远程武器
    //   63 = 简易武器
    //   64 = 军用武器
    //
    // 示例：weapon(type=63) → 从简易武器中选1个
    // ----------------------------------------------------------
    var weaponMatch = rule.match(/^weapons?\s*\(\s*type\s*=\s*(\d+)\s*\)(?:\s*\+\s*(\d+))?\s*$/i);
    if (weaponMatch) {
        return {
            type: 'filter',
            category: 'weapons',
            success: true,
            needUserSelect: true,
            typeId: parseInt(weaponMatch[1], 10),   // 武器类型ID，如 63
            count: weaponMatch[2] ? parseInt(weaponMatch[2], 10) : 1,
            expression: rule
        };
    }

    // 武器直接指定：weapons(id=N)+N — 通过ID直接引用武器
    var weaponIdMatch = rule.match(/^weapons?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i);
    if (weaponIdMatch) {
        return {
            type: 'filter',
            category: 'weapons',
            success: true,
            needUserSelect: false,
            selectMode: 'single',
            id: parseInt(weaponIdMatch[1], 10),
            count: weaponIdMatch[2] ? parseInt(weaponIdMatch[2], 10) : 1,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 专长筛选：feats(type=[类型id])+[数量]
    // 从专长表中筛选指定类型的专长
    //
    // 类型ID映射：
    //   44 = 战斗风格（职业特性）
    //   45 = 传奇恩惠（高级专长）
    //
    // 示例：feats(type=44)+1 → 从战斗风格中选1个
    // 用法：从 feats.json 中筛选 type=44 的专长，让用户选1个
    // ----------------------------------------------------------
    var featsMatch = rule.match(/^feats?\s*\(\s*type\s*=\s*(\d+)\s*\)(?:\s*\+\s*(\d+))?\s*$/i);
    if (featsMatch) {
        return {
            type: 'filter',
            category: 'feats',
            success: true,
            needUserSelect: true,
            typeId: parseInt(featsMatch[1], 10),   // 专长类型ID，如 44
            count: featsMatch[2] ? parseInt(featsMatch[2], 10) : 1,
            expression: rule
        };
    }

    // 专长直接指定：feats(id=N)+N — 通过ID直接引用专长
    var featsIdMatch = rule.match(/^feats?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i);
    if (featsIdMatch) {
        return {
            type: 'filter',
            category: 'feats',
            success: true,
            needUserSelect: false,
            selectMode: 'single',
            id: parseInt(featsIdMatch[1], 10),
            count: featsIdMatch[2] ? parseInt(featsIdMatch[2], 10) : 1,
            expression: rule
        };
    }

    // ----------------------------------------------------------
    // 技能筛选：skill(...)+[数量]
    // 从技能表中筛选指定条件的技能
    //
    // 支持格式：
    //   skill(type=3)+1     → 筛选 type=3 的技能（纯技能）
    //   skill(11,12,18)+1   → 技能ID列表
    //
    // 注意：type=3 是技能（非属性、非豁免），在技能选择页和特性页中使用
    // ----------------------------------------------------------
    // 技能直接指定：skills(id=N)+N — 通过ID直接引用技能
    var skillIdMatch = rule.match(/^skills?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i);
    if (skillIdMatch) {
        return {
            type: 'filter',
            category: 'skills',
            success: true,
            needUserSelect: false,
            selectMode: 'single',
            id: parseInt(skillIdMatch[1], 10),
            count: skillIdMatch[2] ? parseInt(skillIdMatch[2], 10) : 1,
            expression: rule
        };
    }

    var skillMatch = rule.match(/^skills?\s*\(\s*(.+)\s*\)\s*(?:\+\s*(\d+))?\s*$/i);
    if (skillMatch) {
        var inner = skillMatch[1];
        var count = skillMatch[2] ? parseInt(skillMatch[2], 10) : 1;
        
        // 尝试解析 type=N 格式
        var typeMatch = inner.match(/^\s*type\s*=\s*(\d+)\s*$/i);
        if (typeMatch) {
            return {
                type: 'filter',
                category: 'skills',
                success: true,
                needUserSelect: true,
                typeId: parseInt(typeMatch[1], 10),
                count: count,
                expression: rule
            };
        }
        
        // 否则是 ID 列表格式：skill(11,12,18)+1
        var ids = inner.split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        return {
            type: 'filter',
            category: 'skills',
            success: true,
            needUserSelect: true,
            skillIds: ids,
            count: count,
            expression: rule
        };
    }

    // 未匹配到任何筛选模式
    return {
        type: 'filter',
        success: false,
        needUserSelect: false
    };
};