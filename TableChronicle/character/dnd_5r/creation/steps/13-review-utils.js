/**
 * creation/steps/feature-selection-utils.js
 * 特性额外选择的工具层：待选队列增删查、规则解析入队、候选数据加载。
 *
 * 由设计-v0.4-004-001 从 feature.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { dataCache } from '../../core/data/cache.js';
import { findItemSourceTable } from '../../core/data/indexes.js';
import { character } from '../../core/state/character-model.js';
import { getSchoolMap, getFeatTypeMap, getWeaponTypeMap } from '../../core/data/dictionary.js';
import { getCountFromProficiencyRef } from '../../handlers/data-query.js';
import { processItemRules } from '../../handlers/index.js';
// ===== 调试开关 =====
// 在控制台输入以下命令开启对应模块的调试日志：
//   __DEBUG.add = true     // 待选队列新增
//   __DEBUG.restore = true  // 恢复已选状态
//   __DEBUG.render = true   // 渲染时的候选数据
//   __DEBUG.select = true   // 用户点击选择
//   __DEBUG.confirm = true  // 确认保存
window.__DEBUG = window.__DEBUG || {};

// 全局待选队列 — 存储所有等待用户选择的选择项
character.pendingSelections = character.pendingSelections || [];
// 全局已选结果 — 存储用户已经做出的选择（供后续流程使用）
character.featureSelections = character.featureSelections || {
    tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: []
};

// 学派ID → 中文名映射（spells.json 中 school 字段值为 7~14），已迁移至 dictionary.js getSchoolMap()

/**
 * ===== 公共检测入口 =====
 * 只要用户选中了一个对象（种族/职业/背景/专长/特性等），
 * 就调用这个函数，自动检测该对象是否需要用户做额外选择。
 *
 * 各页面调用示例：
 *   - race.js:  selectRace(race) 里调 addPendingSelectionsFromItem(race)
 *   - class.js: selectClass(cls) 里调 addPendingSelectionsFromItem(cls)
 *   - background.js: selectBackground(bg) 里调 addPendingSelectionsFromItem(bg)
 *   - feat.js: selectFeat(feat) 里调 addPendingSelectionsFromItem(feat)
 *
 * @param {object} item - 用户选中的数据对象（如一个种族、一个背景等）
 */

/**
 * ===== 公共检测入口 =====
 * 只要用户选中了一个对象（种族/职业/背景/专长/特性等），
 * 就调用这个函数，自动检测该对象是否需要用户做额外选择。
 *
 * 各页面调用示例：
 *   - race.js:  selectRace(race) 里调 addPendingSelectionsFromItem(race)
 *   - class.js: selectClass(cls) 里调 addPendingSelectionsFromItem(cls)
 *   - background.js: selectBackground(bg) 里调 addPendingSelectionsFromItem(bg)
 *   - feat.js: selectFeat(feat) 里调 addPendingSelectionsFromItem(feat)
 *
 * @param {object} item - 用户选中的数据对象（如一个种族、一个背景等）
 */
export function addPendingSelectionsFromItem(item) {
    if (!item) return;

    character.pendingSelections = character.pendingSelections || [];
    character.featureSelections = character.featureSelections || {
        tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: []
    };

    // ===== 防重复标记：跟踪已处理过 basic 规则的 item =====
    // basic 规则（如 hp_per_lv、ability 等）是自动应用的数值型规则，
    // 不需要用户选择，但每次调用 addPendingSelectionsFromItem 都会被重新应用。
    // 如果同一个 item 被多次传入（如 review.js 收集一次，confirmAllSelections
    // 嵌套选择又处理一次），basic 规则会被重复累加，导致数值翻倍。
    // 使用 _processedBasicItems 追踪已处理过的 item.id，确保只应用一次。
    if (!character._processedBasicItems) {
        character._processedBasicItems = new Set();
    }
    const itemId = item.id;
    const isBasicAlreadyProcessed = itemId != null && character._processedBasicItems.has(itemId);

    // ===== 关键步骤：调用 handlers 解析规则 =====
    // handlers.processItemRules() 会扫描 item 的 rules 和 tool 字段：
    //   "rules"  — 主规则字段（特性、专长等）
    //   "tool"   — 背景的工匠工具规则
    // 其他字段（chain/dice/choice/skills/feat/code_effects）是数值ID或链引用，
    // 由 processChainReferences 独立处理，不在此处解析。
    // 它会把每个字段按逗号分割成多条规则，然后逐条用 handlers.parseRule() 解析
    // 解析结果里 success=true 表示识别成功，needUserSelect=true 需要用户选择
    const results = processItemRules(item, character);
    // ===== 处理 choice/rules/code_effects 字段：本表链引用 =====
    // 通用处理，自动识别源表并递归加载同表链引用
    processChainReferences(item);

    // 将需要用户选择的结果加入待选队列
    results.forEach(result => {
        // 只有成功解析且需要用户选择的才加入
        if (result && result.success && result.needUserSelect) {
            // 标记来源：注明该选择项来自哪个来源（专长名、背景名、种族名等）
            if (item && item.name && !result.sourceName) {
                result.sourceName = item.name;
            }
            // 标记 featureId：关联到来源的特性/专长ID（用于展示时反查）
            if (item && item.id != null && !result.featureId) {
                result.featureId = item.id;
            }
            // 标记来源类别和ID（用于 featureSelections 数据溯源）
            if (!result.source) {
                result.source = findItemSourceTable(item) || 'unknown';
            }
            if (!result.sourceLabel) {
                result.sourceLabel = item.name || '';
            }
            if (!result.link) {
                result.link = item.id != null ? item.id : null;
            }
            // 检查是否已存在同类型的选择项（避免重复加入）
            const exists = character.pendingSelections.some(p => isSameSelection(p, result));
            if (!exists) {
                character.pendingSelections.push(result);
                if (window.__DEBUG.add) {
                    console.log('[待选新增]', result.type, result.category || '', '来源:', result.sourceName || item.name, '需选数:', result.count);
                }
            }
        }
        // basic 类型：数值自动应用（如 hp_per_lv）
        // 注意：已处理过的 item 跳过，防止重复累加
        if (result && result.success && result.type === 'basic' && result.subtype === 'hp_per_lv' && !isBasicAlreadyProcessed) {
            // 每级额外生命值，如 hp_per_lv+2 表示每级+2
            // 存到角色数据中，sheet.js 计算 HP 时会读取
            if (!character.hpPerLevelBonus) character.hpPerLevelBonus = 0;
            character.hpPerLevelBonus += result.value;
        }

        // spell_slot 类型：增加法术位
        if (result && result.success && result.type === 'spell_slot') {
            if (!character.extraSpellSlots) character.extraSpellSlots = [];
            var existing = character.extraSpellSlots.find(function(e) { return e.level === result.level; });
            if (existing) {
                existing.count += result.count;
            } else {
                character.extraSpellSlots.push({ level: result.level, count: result.count });
            }
        }

        // weapon_mastery 类型：武器精通
        // 需要把通用标记展开为具体的 pending 选择项：
        //   1. 从 item.class 取职业ID
        //   2. 查 classes.json 拿武器熟练范围（weapon 字段）
        //   3. 查 proficiency_link → proficiency.json 拿可选数量
        //   4. 构建 pending 选择项（category=weapons, filterParams, showMasteryOnly）
        if (result && result.success && result.type === 'weapon_mastery') {
            var classId = parseInt(item.class, 10);
            if (!classId || !dataCache.classes) {
                console.warn('[feature-selection] weapon_mastery: 无法获取职业ID', item);
                return;
            }

            // 1. 查 classes.json 拿武器熟练范围
            var clsData = dataCache.classes.find(function(c) { return c.id === classId; });
            if (!clsData || !clsData.weapon) {
                console.warn('[feature-selection] weapon_mastery: 职业数据中无 weapon 字段', classId);
                return;
            }

            var weaponProf = String(clsData.weapon).split(',').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });

            // 2. 通过 proficiency_link 获取当前等级的可选数量
            var proficiencyCount = getCountFromProficiencyRef(item, classId);

            if (proficiencyCount <= 0) {
                console.warn('[feature-selection] weapon_mastery: 数量为0, classId=' + classId);
                return;
            }

            // 3. 构建 pending 选择项
            var pending = {
                type: 'filter',
                category: 'weapons',
                success: true,
                needUserSelect: true,
                count: proficiencyCount,
                filterParams: { category: weaponProf },
                showMasteryOnly: true,
                classId: classId,
                expression: result.expression,
                sourceName: result.sourceName || item.name,
                featureId: result.featureId || item.id
            };

            // 检查是否已存在（避免重复加入）
            var exists = character.pendingSelections.some(function(p) { return isSameSelection(p, pending); });
            if (!exists) {
                character.pendingSelections.push(pending);
            }
        }
    });

    // 标记此 item 的 basic 规则已处理，防止重复累加
    if (itemId != null) {
        character._processedBasicItems.add(itemId);
    }

    // 清理临时 visited 状态
    character._visitedChainIds = undefined;
}

/**
 * 查找数据项所属的源表
 * 遍历所有已知数据缓存，找到包含该 item.id 的表
 */
// findItemSourceTable / collectChainedRaceFeatures 已迁至 handlers/data-query.js

/**
 * 处理 choice/rules/code_effects 字段：本表链引用
 * 这些字段中的数字ID表示引用本表（同表）的其他数据项
 * 如"森林侏儒" choice:48 → 本表 id=48（法术:动物交谈）
 * 如"天启" choice:9, rules:10, code_effects:11 → 本表 id=9,10,11
 */

/**
 * 处理 choice/rules/code_effects 字段：本表链引用
 * 这些字段中的数字ID表示引用本表（同表）的其他数据项
 * 如"森林侏儒" choice:48 → 本表 id=48（法术:动物交谈）
 * 如"天启" choice:9, rules:10, code_effects:11 → 本表 id=9,10,11
 */
export function processChainReferences(item) {
    if (!item || !item.id) return;
    // 已访问检查：防止循环引用导致死循环（如 天启→死灵环绕→天启）
    if (character._visitedChainIds) {
        if (character._visitedChainIds.indexOf(item.id) !== -1) {
            return;
        }
    } else {
        character._visitedChainIds = [];
    }
    character._visitedChainIds.push(item.id);

    var sourceTable = findItemSourceTable(item);
    if (!sourceTable) {
        return;
    }
    var sourceData = null;
    var tableMap = {
        'raceFeatures': dataCache.raceFeatures,
        'classFeatures': dataCache.classFeatures,
        'feats': dataCache.feats,
        'backgrounds': dataCache.backgrounds
    };
    sourceData = tableMap[sourceTable];
    if (!sourceData || !Array.isArray(sourceData)) return;

    // 注意：code_effects 不在此列，因为它的语义是"代码效果/计数"，不是"特性ID引用"
    // 如 法师戏法 的 code_effects:1 表示"可选1个戏法"，而非引用特性ID=1
    var chainFields = ['choice', 'rules'];
    chainFields.forEach(function(field) {
        var val = item[field];
        if (val !== undefined && val !== null && val !== '') {
            // 只处理纯数字值（如 10、11），跳过公式字符串（如 "8+Proficiency+..."）
            // 防止 parseInt("8+Proficiency+...") 返回 8 导致错误的链引用
            if (typeof val === 'string' && !/^\d+$/.test(val)) return;
            var targetId = parseInt(val);
            if (!isNaN(targetId) && targetId !== item.id) {
                var target = sourceData.find(function(f) { return f && f.id === targetId; });
                if (target) {
                    addPendingSelectionsFromItem(target);
                }
            }
        }
    });
}

/**
 * 防止同一个规则被重复加入队列（比如同一个特性被多次触发）
 */

/**
 * 防止同一个规则被重复加入队列（比如同一个特性被多次触发）
 */
export function isSameSelection(a, b) {
    if (a.type !== b.type) return false;       // 不同类型 → 不同
    if (a.category !== b.category) return false; // 不同类别 → 不同
    // 筛选类（如 tool(type=68)）：比较 typeId 或 expression（含数量差异）
    if (a.type === 'filter' || a.type === 'proficiency') {
        // 优先比较完整表达式（含数量差异，如 tool(type=67) vs tool(type=67)+3）
        if (a.expression && b.expression && a.expression === b.expression) {
            // 表达式相同但来源不同 → 视为不同选择（如职业和专长都要选乐器，各选各的）
            if (a.sourceName && b.sourceName && a.sourceName !== b.sourceName) return false;
            return true;
        }
        // 无表达式时，比较 typeId（仅当 count 也相同时视为重复）
        if (a.typeId && b.typeId && a.typeId === b.typeId && a.count === b.count) return true;
        if (a.classId && b.classId && a.classId === b.classId && a.level === b.level) return true;
    }
    // 运算类（如 skill+1）：比较 subtype
    if (a.type === 'operation') {
        if (a.subtype === b.subtype) return true;
    }
    // 二选一（如 ①spell,②feat）：比较选项列表
    if (a.type === 'selection' && a.subtype === 'numbered_choice') {
        if (a.options && b.options && JSON.stringify(a.options) === JSON.stringify(b.options)) return true;
    }
    // 多类组合选择（如 choose(skill,tool)+3）：比较表达式原文
    if (a.type === 'choose') {
        if (a.expression && b.expression && a.expression === b.expression) return true;
    }
    // code 选择（如 choose-review）：比较 codeName
    if (a.type === 'code_choose') {
        if (a.codeName && b.codeName && a.codeName === b.codeName) return true;
    }
    return false;
}

/**
 * 清空所有待选择
 */

/**
 * 清空所有待选择
 */
export function clearAllPendingSelections() {
    character.pendingSelections = [];
    character.featureSelections = {
        tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: []
    };
}

/**
 * 检查当前是否有任何待选择项
 */

/**
 * 检查当前是否有任何待选择项
 */
export function hasPendingSelections() {
    return character.pendingSelections && character.pendingSelections.length > 0;
}

/**
 * 获取当前第一个待选择项
 */

/**
 * 获取当前第一个待选择项
 */
export function getCurrentPending() {
    if (!hasPendingSelections()) return null;
    return character.pendingSelections[0];
}

/**
 * 移除当前已完成的待选择项
 */

/**
 * 移除当前已完成的待选择项
 */
export function removeCurrentPending() {
    if (!hasPendingSelections()) return;
    character.pendingSelections.shift();
}

/**
 * 获取候选数据（异步加载JSON）
 */

/**
 * 获取候选数据（异步加载JSON）
 */
export async function loadCandidates(pending) {
    if (pending.candidates) return pending.candidates; // 已加载

    // ===== 处理 proficiency 类型（专精/熟练选择，如 Proficiency>pure+2） =====
    // proficiency 处理器返回 type: 'proficiency' 但没有 category 字段。
    // 需要路由到 skill 的候选数据加载逻辑。
    // 注意：专精只考虑技能（type=3），不包括属性（type=1）和豁免（type=2）
    if (pending.type === 'proficiency') {
        if (pending.skillIds) {
            pending.candidates = (dataCache.skills || [])
                .filter(s => pending.skillIds.includes(s.id) && s.type === 3)
                .map(s => ({ id: s.id, name: s.name, desc: s.attr || '', fulldesc: s.desc || '', attr: s.attr || '' }));
        } else {
            // 专精只能从已熟练的技能中选
            // character.allSkills 存的是技能名称数组
            const proficientNames = (character.allSkills || []).map(n => String(n).trim()).filter(Boolean);
            var allSkills = (dataCache.skills || []).filter(s => s.type === 3);

            if (proficientNames.length > 0) {
                // 有已熟练技能 → 只显示这些
                pending.candidates = allSkills
                    .filter(s => proficientNames.includes(String(s.name).trim()))
                    .map(s => ({ id: s.id, name: s.name, desc: s.attr || '', fulldesc: s.desc || '', attr: s.attr || '' }));
            } else {
                // 还没有已熟练技能 → 显示全部（fallback，防止空列表让页面卡死）
                pending.candidates = allSkills
                    .map(s => ({ id: s.id, name: s.name, desc: s.attr || '', fulldesc: s.desc || '', attr: s.attr || '' }));
            }
        }
        return pending.candidates;
    }

    // ===== 处理 code_choose 类型（code-handler 选择，如 choose-review） =====
    // code_choose 处理器已将 candidates 包装好（在 processItemRules 中），
    // 直接返回即可，无需从 dataCache 加载
    if (pending.type === 'code_choose') {
        return pending.candidates || [];
    }

    // ===== 处理 choose 类型（多类组合选择，如 choose(skill,tool(type=66))+3） =====
    // choose 处理器返回 type: 'choose' 但没有 category 字段。
    // 需要路由到 choose 的候选数据加载逻辑。
    if (pending.type === 'choose') {
        pending.candidates = [];
        (pending.categories || []).forEach(cat => {
            // 根据 cat.category（source_table 命名）选择数据源
            if (cat.category === 'skills' && cat.type === 'all') {
                const items = (dataCache.skills || []).map(s => ({
                    id: 'skill_' + s.id,
                    name: s.name,
                    desc: s.attr || '',
                    fulldesc: s.desc || '',
                    _category: 'skills',
                    _origId: s.id
                }));
                items.forEach(item => {
                    if (!pending.candidates.some(c => c._origId === item._origId && c._category === 'skills')) {
                        pending.candidates.push(item);
                    }
                });
            } else if (cat.category === 'tools' && cat.typeId) {
                const labels = { 66: '工匠工具', 67: '乐器', 68: '赌具', 69: '其他工具' };
                const items = (dataCache.tools || [])
                    .filter(t => t.type === cat.typeId)
                    .map(t => ({
                        id: 'tool_' + t.id,
                        name: t.name,
                        desc: (labels[cat.typeId] || '工具') + (t.operation ? ' · ' + t.operation : ''),
                        fulldesc: (t.operation ? '用法：' + t.operation : '') + (t.craft ? '\n可制作：' + t.craft : ''),
                        _category: 'tools',
                        _origId: t.id
                    }));
                items.forEach(item => {
                    if (!pending.candidates.some(c => c._origId === item._origId && c._category === 'tools')) {
                        pending.candidates.push(item);
                    }
                });
            } else if (cat.category === 'weapons' && cat.typeId) {
                const wlabels = getWeaponTypeMap();
                const isRange = cat.typeId === 61 || cat.typeId === 62;
                const items = (dataCache.weapons || [])
                    .filter(w => isRange ? w.weapon_range === cat.typeId : w.weapon_category === cat.typeId)
                    .map(w => ({
                        id: 'weapon_' + w.id,
                        name: w.name,
                        desc: (wlabels[cat.typeId] || '武器') + (w.damage_dice ? ' · ' + w.damage_dice + w.damage_type : ''),
                        fulldesc: (w.desc || '') + (w.damage_dice ? '\n伤害：' + w.damage_dice + ' ' + (w.damage_type || '') : '') + (w.weight ? '\n重量：' + w.weight + ' ' + (w.weight_unit || '') : '') + (w.cost ? '\n价格：' + w.cost + ' gp' : ''),
                        _category: 'weapons',
                        _origId: w.id
                    }));
                items.forEach(item => {
                    if (!pending.candidates.some(c => c._origId === item._origId && c._category === 'weapons')) {
                        pending.candidates.push(item);
                    }
                });
            } else if (cat.category === 'spells' && cat.classId != null) {
                // 构建classId列表（支持多个）
                var chooseSpellClassIds = cat.classIdList && cat.classIdList.length > 0
                    ? cat.classIdList
                    : [cat.classId];
                const items = (dataCache.spells || [])
                    .filter(s => {
                        // 正确解析class字段
                        var sClassRaw = s.class;
                        var sClassList = [];
                        if (typeof sClassRaw === 'number') {
                            sClassList = [sClassRaw];
                        } else if (typeof sClassRaw === 'string') {
                            sClassList = sClassRaw.split(/[、，,]/).map(function(n) { return parseInt(n.trim(), 10); }).filter(function(n) { return !isNaN(n); });
                        }
                        var classMatch = chooseSpellClassIds.some(function(cid) { return sClassList.indexOf(cid) !== -1; });
                        if (!classMatch) return false;
                        
                        // 环位匹配
                        if (cat.level != null) {
                            var sLv = s.level != null ? String(s.level) : '';
                            if (sLv !== String(cat.level)) return false;
                        }
                        return true;
                    })
                    .map(s => ({
                        id: 'spell_' + s.id,
                        name: s.name,
                        desc: (getSchoolMap()[s.school] || s.school || '') + (s.name_en ? ' · ' + s.name_en : ''),
                        fulldesc: (s.desc || '') + (s.school ? '\n学派：' + (getSchoolMap()[s.school] || '通用') : '') + (s.level != null ? '\n环位：' + s.level : ''),
                        _category: 'spells',
                        _origId: s.id
                    }));
                items.forEach(item => {
                    if (!pending.candidates.some(c => c._origId === item._origId && c._category === 'spells')) {
                        pending.candidates.push(item);
                    }
                });
            } else if (cat.category === 'languages' && cat.type === 'all') {
                const items = (dataCache.languages || []).map(l => ({
                    id: 'lang_' + l.id,
                    name: l.name,
                    desc: l.desc || '',
                    fulldesc: l.desc || '',
                    _category: 'languages',
                    _origId: l.id
                }));
                items.forEach(item => {
                    if (!pending.candidates.some(c => c._origId === item._origId && c._category === 'languages')) {
                        pending.candidates.push(item);
                    }
                });
            } else if (cat.category === 'feats' && cat.typeId) {
                const featLabels = getFeatTypeMap();
                const items = (dataCache.feats || [])
                    .filter(f => f.type === cat.typeId)
                    .map(f => ({
                        id: 'feat_' + f.id,
                        name: f.name,
                        desc: (featLabels[cat.typeId] || '专长') + (f.desc ? ' · ' + f.desc : ''),
                        fulldesc: f.desc || '',
                        _category: 'feats',
                        _origId: f.id
                    }));
                items.forEach(item => {
                    if (!pending.candidates.some(c => c._origId === item._origId && c._category === 'feats')) {
                        pending.candidates.push(item);
                    }
                });
            }
        });
        return pending.candidates;
    }

    // ===== 常规 filter 类型：根据 source_table 名称动态查找数据表 =====
    // 表名 → dataCache 字段映射，与 lookup_table 的 source_table 命名一致
    const TABLE_MAP = {
        'skills': dataCache.skills,
        'tools': dataCache.tools,
        'weapons': dataCache.weapons,
        'spells': dataCache.spells,
        'languages': dataCache.languages,
        'armors': dataCache.armors,
        'feats': dataCache.feats
    };
    
    const sourceData = TABLE_MAP[pending.category];
    if (sourceData) {
        // 根据 pending 参数筛选数据
        let filtered = [...sourceData];
        
        if (pending.category === 'tools') {
            if (pending.typeId) {
                filtered = filtered.filter(t => t.type === pending.typeId);
            }
            pending.candidates = filtered.map(t => ({
                id: t.id,
                name: t.name,
                desc: t.operation || '',
                fulldesc: (t.operation ? '用法：' + t.operation : '') + (t.craft ? '\n可制作：' + t.craft : '')
            }));
        } else if (pending.category === 'weapons') {
            if (pending.typeId) {
                const isRange = pending.typeId === 61 || pending.typeId === 62;
                filtered = filtered.filter(w => isRange ? w.weapon_range === pending.typeId : w.weapon_category === pending.typeId);
            }
            // 复合筛选条件（如 proficiency_filter 传来的 category+range）
            if (pending.filterParams) {
                var fp = pending.filterParams;
                if (fp.category && fp.category.length > 0) {
                    filtered = filtered.filter(function(w) { return fp.category.indexOf(w.weapon_category) !== -1; });
                }
                if (fp.range) {
                    filtered = filtered.filter(function(w) { return w.weapon_range === fp.range; });
                }
            }
            // 武器精通特性：只显示有 mastery 属性的武器
            if (pending.showMasteryOnly) {
                filtered = filtered.filter(function(w) { return w.mastery; });
            }
            pending.candidates = filtered.map(w => ({
                id: w.id,
                name: w.name,
                desc: (w.damage_dice || '') + ' ' + (w.damage_type || ''),
                fulldesc: (w.desc || '') + (w.damage_dice ? '\n伤害：' + w.damage_dice + ' ' + (w.damage_type || '') : '') + (w.weight ? '\n重量：' + w.weight + ' ' + (w.weight_unit || '') : '') + (w.cost ? '\n价格：' + w.cost + ' gp' : '')
            }));
        } else if (pending.category === 'spells') {
            var spellClassIds = pending.classIdList && pending.classIdList.length > 0
                ? pending.classIdList
                : (pending.classId != null ? [pending.classId] : []);
            if (spellClassIds.length > 0) {
                filtered = filtered.filter(s => {
                    var sClassRaw = s.class;
                    var sClassList = [];
                    if (typeof sClassRaw === 'number') {
                        sClassList = [sClassRaw];
                    } else if (typeof sClassRaw === 'string') {
                        sClassList = sClassRaw.split(/[、，,]/).map(function(n) { return parseInt(n.trim(), 10); }).filter(function(n) { return !isNaN(n); });
                    }
                    var classMatch = spellClassIds.some(function(cid) { return sClassList.indexOf(cid) !== -1; });
                    if (!classMatch) return false;
                    if (pending.level != null) {
                        var sLv = s.level != null ? String(s.level) : '';
                        if (sLv !== String(pending.level)) return false;
                    }
                    if (pending.schoolList && pending.schoolList.length > 0) {
                        var sSchool = parseInt(s.school, 10);
                        if (pending.schoolList.indexOf(sSchool) === -1) return false;
                    } else if (pending.school != null) {
                        var sSchool = parseInt(s.school, 10);
                        if (sSchool !== pending.school) return false;
                    }
                    // dice 筛选：1=有伤害骰, 0=无伤害骰
                    if (pending.dice != null) {
                        var hasDice = s.dice && String(s.dice).trim() !== '';
                        if (pending.dice === 1 && !hasDice) return false;
                        if (pending.dice === 0 && hasDice) return false;
                    }
                    return true;
                });
            }
            pending.candidates = filtered.map(s => ({
                id: s.id,
                name: s.name,
                desc: (getSchoolMap()[s.school] || s.school || '') + (s.name_en ? ' · ' + s.name_en : ''),
                fulldesc: (s.desc || '') + (s.school ? '\n学派：' + (getSchoolMap()[s.school] || '通用') : '') + (s.level != null ? '\n环位：' + s.level : '')
            }));
        } else if (pending.category === 'skills') {
            if (pending.skillIds) {
                filtered = filtered.filter(s => pending.skillIds.includes(s.id));
            } else if (pending.typeId != null) {
                filtered = filtered.filter(s => s.type === pending.typeId);
            }
            pending.candidates = filtered.map(s => ({
                id: s.id, name: s.name, desc: s.attr || '', fulldesc: s.desc || '', attr: s.attr || ''
            }));
        } else if (pending.category === 'languages') {
            pending.candidates = filtered.map(l => ({
                id: l.id, name: l.name, desc: l.desc || '', fulldesc: l.desc || ''
            }));
        } else if (pending.category === 'armors') {
            if (pending.typeId) {
                filtered = filtered.filter(a => a.armor === pending.typeId);
            }
            pending.candidates = filtered.map(a => ({
                id: a.id,
                name: a.name,
                desc: 'AC ' + (a.ac || ''),
                fulldesc: (a.desc || '') + (a.ac ? '\n护甲等级：' + a.ac : '') + (a.weight ? '\n重量：' + a.weight + ' ' + (a.weight_unit || '') : '') + (a.cost ? '\n价格：' + a.cost + ' gp' : '') + (a.stealth ? '\n隐匿：' + a.stealth : '')
            }));
        } else if (pending.category === 'feats') {
            if (pending.typeId) {
                filtered = filtered.filter(f => f.type === pending.typeId);
            }
            pending.candidates = filtered.map(f => ({
                id: f.id, name: f.name, desc: f.desc ? f.desc.substring(0, 30) + (f.desc.length > 30 ? '…' : '') : '', fulldesc: f.desc || ''
            }));
        }
    } else if (pending.category === 'class_extra') {
        // 职业额外选项（如魔能祈唤、战技等），候选数据已在创建时预加载
        // 无对应 source_table，保持独立处理
    } else {
        pending.candidates = [];
    }

    return pending.candidates || [];
}

/**
 * 渲染特性选择步骤（新布局：所有待选项同时显示，左侧选择区 + 右侧角色预览）
 */