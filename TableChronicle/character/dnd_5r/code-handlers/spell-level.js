// ============================================================
// code(spell-level) 环位法术选择处理器
// ============================================================
//
// 【作用】
// 处理 code 列标记为 "spell-level" 的数据行。
// 表示该特性允许角色根据当前拥有的法术位环阶，
// 从特定学派的法术中选择习得。
//
// 数据行示例（法师子职·防护学者）：
//   rules: "spells(class=12,school=7)+2"
//   意思：从法师(class=12)的防护学派(school=7)中选2个法术
//
// 逻辑流程：
//   1. 解析 rules 表达式 → 获取 class / school / count
//   2. 查角色等级 → 确定当前最高法术环阶
//   3. 从全法术列表过滤出匹配的结果
//   4. 初始3级选2个，后续每获新环阶选1个
//
// 【返回值】
//   {
//     type: 'spell-level',
//     title: '防护学者',
//     schoolId: 7,
//     classId: 12,
//     maxLevel: 2,          // 当前最高可选法术环阶
//     count: 2,             // 本次可选数量
//     isUpgrade: false,     // 是否升级追加
//     matchCount: 45,       // 符合条件的法术总数（供UI展示）
//     desc: '...',
//     rowData: rowData
//   }

(function() {

    // ============================================================
    // 全施法者法术位环阶表
    // 等级 → 可获得的新环阶
    // ============================================================
    var SPELL_LEVEL_BY_LEVEL = {
        1: 1,  2: 1,  3: 2,  4: 2,
        5: 3,  6: 3,  7: 4,  8: 4,
        9: 5,  10: 5, 11: 6, 12: 6,
        13: 7, 14: 7, 15: 8, 16: 8,
        17: 9, 18: 9, 19: 9, 20: 9
    };

    // 各环阶首次获得的等级
    var LEVEL_FOR_SPELL_LEVEL = {
        1: 1, 2: 3, 3: 5, 4: 7,
        5: 9, 6: 11, 7: 13, 8: 15, 9: 17
    };

    // ============================================================
    // 获取角色当前最高法术环阶
    // ============================================================
    function getMaxSpellLevel(classLevel) {
        return SPELL_LEVEL_BY_LEVEL[classLevel] || 0;
    }

    // ============================================================
    // 获取某环阶首次获得的等级
    // ============================================================
    function getLevelForSpellLevel(spellLevel) {
        return LEVEL_FOR_SPELL_LEVEL[spellLevel] || 99;
    }

    // ============================================================
    // 从自描述表达式提取参数: spells(class=12,school=7)+2
    // 返回 { classId: 12, schoolId: 7, count: 2 }
    // ============================================================
    function parseSpellExpression(rules) {
        if (!rules) return null;
        var s = String(rules).trim();
        var m = s.match(/^spells?\s*\(([^)]+)\)\s*(?:\+(\d+))?\s*$/i);
        if (!m) return null;
        var condStr = m[1];
        var count = m[2] ? parseInt(m[2]) : 1;
        var result = { classId: 0, schoolId: 0, count: count };
        var parts = condStr.split(',');
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split('=');
            if (kv.length === 2) {
                var key = kv[0].trim().toLowerCase();
                var val = parseInt(kv[1]);
                if (key === 'class') result.classId = val;
                if (key === 'school') result.schoolId = val;
            }
        }
        return result;
    }

    // ============================================================
    // 从上下文中获取角色等级
    // 优先取 dataCache 中已保存的角色等级
    // ============================================================
    function getCharacterLevel(context) {
        if (!context) return 0;

        // context.level 直接提供
        if (context.level) return parseInt(context.level);

        // 全局 character 对象
        try {
            if (typeof character !== 'undefined' && character.level) {
                return parseInt(character.level);
            }
        } catch(e) { /* character 对象不可用时忽略 */ }

        return 0;
    }

    // ============================================================
    // 主处理函数
    // ============================================================
    function handleSpellLevel(rowData, context) {
        // ---- 1. 从自描述表达式解析 class/school/count ----
        var expr = parseSpellExpression(rowData.rules);
        if (!expr) {
            console.warn('[spell-level] 无法解析表达式, id:', rowData.id, 'rules:', rowData.rules);
            return null;
        }

        var schoolId = expr.schoolId;
        var classId = expr.classId;

        // ---- 3. 角色等级 & 环阶 ----
        var level = getCharacterLevel(context);
        var maxLevel = getMaxSpellLevel(level);

        // 3级获得此特性时，上限固定为2环
        var isInitial = (level <= 3);
        var usableMaxLevel = isInitial ? Math.min(maxLevel, 2) : maxLevel;

        // ---- 4. 初始/升级判断 ----
        var count = isInitial ? (expr.count || 2) : 1;

        var isUpgrade = false;
        if (!isInitial) {
            var thresholdLevel = getLevelForSpellLevel(maxLevel);
            isUpgrade = (level === thresholdLevel);
        }

        // ---- 5. 计算符合条件的法术数量 ----
        var matchCount = 0;
        if (schoolId > 0 && typeof dataCache !== 'undefined' && dataCache.spells) {
            for (var i = 0; i < dataCache.spells.length; i++) {
                var spell = dataCache.spells[i];
                if (spell.school !== schoolId) continue;
                if (spell.level < 0 || spell.level > usableMaxLevel) continue;
                matchCount++;
            }
        }

        // ---- 6. 返回结果 ----
        return {
            type: 'spell-level',
            code: 'spell-level',
            title: rowData.name || '选择法术',
            schoolId: schoolId,
            classId: classId,
            maxLevel: usableMaxLevel,
            count: count,
            isInitial: isInitial,
            isUpgrade: isUpgrade,
            matchCount: matchCount,
            desc: rowData.desc || '',
            rowData: rowData,
            context: context
        };
    }

    // ============================================================
    // 特性总览专用处理器（spell-level-review）
    // 在 handleSpellLevel 的基础上包装，直接加载候选法术列表，
    // 返回前端特性选择页可用的格式（code_choose 类型）
    // ============================================================
    var SCHOOL_MAP = {
        7: '防护', 8: '咒法', 9: '预言', 10: '附魔',
        11: '塑能', 12: '幻术', 13: '死灵', 14: '变化'
    };

    // ============================================================
    // 从 dataCache.spells 中按条件筛选法术
    // ============================================================
    function loadSpellCandidates(classId, schoolId, maxLevel) {
        var candidates = [];
        try {
            if (typeof dataCache === 'undefined' || !dataCache.spells) return candidates;
            for (var i = 0; i < dataCache.spells.length; i++) {
                var spell = dataCache.spells[i];
                // 学派过滤
                if (schoolId > 0 && spell.school !== schoolId) continue;
                // 环阶过滤（0戏法 ~ maxLevel）
                var sLv = spell.level != null ? parseInt(spell.level) : -1;
                if (sLv < 0 || sLv > maxLevel) continue;
                // 职业过滤
                var sClassRaw = spell.class;
                var sClassList = [];
                if (typeof sClassRaw === 'number') {
                    sClassList = [sClassRaw];
                } else if (typeof sClassRaw === 'string') {
                    sClassList = sClassRaw.split(/[、，,]/).map(function(n) { return parseInt(n.trim(), 10); }).filter(function(n) { return !isNaN(n); });
                }
                if (!sClassList.some(function(cid) { return cid === classId; })) continue;

                candidates.push({
                    id: 'spell_' + spell.id,
                    name: spell.name + (spell.name_en ? ' · ' + spell.name_en : ''),
                    desc: 'Lv' + sLv + ' ' + (SCHOOL_MAP[spell.school] || ''),
                    fulldesc: spell.desc || '',
                    _category: 'spells',
                    _origId: spell.id
                });
            }
        } catch(e) {
            console.warn('[spell-level-review] 加载法术失败:', e);
        }
        return candidates;
    }

    function handleSpellLevelReview(rowData, context) {
        var baseResult = handleSpellLevel(rowData, context);
        if (!baseResult) return null;

        // 直接加载候选法术
        var candidates = loadSpellCandidates(
            baseResult.classId,
            baseResult.schoolId,
            baseResult.maxLevel
        );

        return {
            type: 'code_choose',
            code: 'spell-level',
            success: true,
            needUserSelect: true,
            count: baseResult.count || 1,
            title: baseResult.title || '选择法术',
            category: 'code_choose',
            codeName: rowData.name || 'spell-level',
            candidates: candidates,
            expression: 'code(spell-level)',
            rowData: rowData,
            context: context
        };
    }

    // ============================================================
    // 注册到全局注册表
    // ============================================================
    if (window.CodeHandlers) {
        CodeHandlers.register('spell-level', handleSpellLevel);
        CodeHandlers.register('spell-level-review', handleSpellLevelReview);
        console.log('code-handler 已注册: spell-level, spell-level-review');
    }
})();