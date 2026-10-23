/**
 * creation/steps/review-collector.js
 * 特性总览的数据收集层：遍历全部来源递归收集待选项目，并恢复已保存的选择状态。
 *
 * 由设计-v0.4-004-001 从 review.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { dataCache } from '../../core/data/cache.js';
import { findItemSourceTable } from '../../core/data/indexes.js';
import { character } from '../../core/state/character-model.js';
import { getCountFromProficiencyRef, getSubclassFeatures } from '../../handlers/data-query.js';
import { addPendingSelectionsFromItem } from './13-review.js';
/**
 * 从已保存的 featureSelections 恢复选择状态到 _allSelectionsState
 * 当用户从角色详情页（步骤15）返回特性总览（步骤14）时，
 * featureSelections 中还保留着上一轮已确认的选择数据，
 * 需要将其映射回 _allSelectionsState，确保：
 *   1. 进度条显示正确的已选数
 *   2. 已选项在 UI 中正确标记为绿色选中状态
 *   3. 选项仍可操作（非禁用），因为返回后用户可以修改选择
 *
 * 匹配策略：遍历 pendingSelections 中的每个待选项，根据 category 和 groupName
 * 去 featureSelections 中找到对应的已选条目，将 ID 填入 _allSelectionsState
 */
export function restoreSavedSelectionsToState() {
    if (!character.featureSelections) return;
    var fs = character.featureSelections;

    // ===== 辅助函数：兼容新旧格式提取 ID =====
    // 新格式：{ id: 21, name: '洞悉', source: 'race', ... }
    // 旧格式：21（纯数字ID）
    function extractId(val) {
        if (val != null && typeof val === 'object') return val.id;
        return val;
    }
    function extractName(val) {
        if (val != null && typeof val === 'object') return val.name || '';
        return '';
    }

    // 辅助函数：检查某个 ID 是否在待选项的 candidates 中
    function isIdInCandidates(pending, id) {
        if (!pending.candidates || pending.candidates.length === 0) return false;
        if (pending.type === 'choose') {
            return pending.candidates.some(function(c) { return String(c._origId) === String(id); });
        }
        return pending.candidates.some(function(c) { return String(c.id) === String(id); });
    }

    // 先检查是否有任何已保存的选择数据
    var hasSavedData = (fs.classExtra && fs.classExtra.length > 0) ||
        (fs.skills && fs.skills.length > 0) ||
        (fs.tools && fs.tools.length > 0) ||
        (fs.weapons && fs.weapons.length > 0) ||
        (fs.spells && fs.spells.length > 0) ||
        (fs.languages && fs.languages.length > 0) ||
        (fs.armors && fs.armors.length > 0) ||
        (fs.feats && fs.feats.length > 0) ||
        (fs.expertise && fs.expertise.length > 0);
    
    if (!hasSavedData) return;

    if (!window._allSelectionsState) {
        window._allSelectionsState = {};
    }

    character.pendingSelections.forEach(function(pending, idx) {
        if (!window._allSelectionsState[idx]) {
            window._allSelectionsState[idx] = { selectedIds: [] };
        }
        var state = window._allSelectionsState[idx];
        if (state.selectedIds.length > 0) return;

        // === 职业额外选项 (class_extra) ===
        if (pending.category === 'class_extra') {
            var savedItems = (fs.classExtra || []).filter(function(sel) {
                return (!pending.groupName || sel.groupName === pending.groupName) &&
                       (!pending.classId || String(sel.classId) === String(pending.classId));
            });
            savedItems.forEach(function(sel) {
                var id = String(sel.extraId);
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 法术 (spells) ===
        if (pending.category === 'spells') {
            var spellIds = (fs.spells || []).filter(function(sel) {
                return (!pending.classId || String(sel.classId) === String(pending.classId)) &&
                       (pending.level == null || String(sel.lv) === String(pending.level));
            }).map(function(sel) { return String(sel.spellId); });
            spellIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 技能 (skills) — 兼容新旧格式 ===
        if (pending.category === 'skills') {
            var skillIds = (fs.skills || []).map(function(item) { return String(extractId(item)); });
            skillIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 工具 (tools) ===
        if (pending.category === 'tools') {
            var toolIds = (fs.tools || []).map(function(sel) { return String(sel.toolId); });
            toolIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 武器 (weapons) ===
        if (pending.category === 'weapons') {
            var weaponIds = (fs.weapons || []).map(function(sel) { return String(sel.weaponId); });
            weaponIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 语言 (languages) — 兼容新旧格式 ===
        if (pending.category === 'languages') {
            var langIds = (fs.languages || []).map(function(item) { return String(extractId(item)); });
            langIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 护甲 (armors) — 兼容新旧格式 ===
        if (pending.category === 'armors') {
            var armorIds = (fs.armors || []).map(function(item) { return String(extractId(item)); });
            armorIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 专长 (feats) ===
        if (pending.category === 'feats') {
            var featIds = (fs.feats || []).map(function(sel) { return String(sel.featId); });
            featIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === 专精 (expertise/proficiency) — 兼容新旧格式 ===
        if (pending.type === 'proficiency') {
            var expIds = (fs.expertise || []).map(function(item) { return String(extractId(item)); });
            expIds.forEach(function(id) {
                if (!state.selectedIds.includes(id) && state.selectedIds.length < pending.count && isIdInCandidates(pending, id)) {
                    state.selectedIds.push(id);
                }
            });
            return;
        }

        // === choose 类型（多类组合选择） ===
        if (pending.type === 'choose' && pending.categories) {
            var restoredCount = 0;
            pending.categories.forEach(function(cat) {
                var savedItems = [];
                switch (cat.category) {
                    case 'tools':
                        savedItems = (fs.tools || []).map(function(sel) {
                            return { id: 'tool_' + sel.toolId, origId: sel.toolId };
                        });
                        break;
                    case 'weapons':
                        savedItems = (fs.weapons || []).map(function(sel) {
                            return { id: 'weapon_' + sel.weaponId, origId: sel.weaponId };
                        });
                        break;
                    case 'skills':
                        savedItems = (fs.skills || []).map(function(item) {
                            var idVal = extractId(item);
                            return { id: 'skill_' + idVal, origId: idVal };
                        });
                        break;
                    case 'languages':
                        savedItems = (fs.languages || []).map(function(item) {
                            var idVal = extractId(item);
                            return { id: 'language_' + idVal, origId: idVal };
                        });
                        break;
                    case 'feats':
                        savedItems = (fs.feats || []).map(function(sel) {
                            return { id: 'feat_' + sel.featId, origId: sel.featId };
                        });
                        break;
                    case 'spells':
                        savedItems = (fs.spells || []).map(function(sel) {
                            return { id: 'spell_' + sel.spellId, origId: sel.spellId };
                        });
                        break;
                    case 'armors':
                        savedItems = (fs.armors || []).map(function(item) {
                            var idVal = extractId(item);
                            return { id: 'armor_' + idVal, origId: idVal };
                        });
                        break;
                }
                savedItems.forEach(function(item) {
                    if (state.selectedIds.length >= pending.count) return;
                    var isInCandidates = pending.candidates.some(function(c) {
                        return String(c.id) === item.id;
                    });
                    if (!isInCandidates) return;
                    if (!state.selectedIds.includes(item.id)) {
                        state.selectedIds.push(item.id);
                        restoredCount++;
                    }
                });
            });
            return;
        }
    });

    // 调试：打印恢复摘要
    if (window.__DEBUG && window.__DEBUG.restore) {
        var restoredTotal = 0;
        Object.keys(window._allSelectionsState).forEach(function(k) {
            restoredTotal += window._allSelectionsState[k].selectedIds.length;
        });
        console.log('[恢复已选] 共恢复 ' + restoredTotal + ' 项选择到 ' + Object.keys(window._allSelectionsState).length + ' 个分组');
    }
    }

/**
 * 收集所有已选来源
 * 返回一个数组，包含所有需要检查的来源对象
 */

/**
 * 收集所有已选来源
 * 返回一个数组，包含所有需要检查的来源对象
 */
export function collectAllSources() {
    const sources = [];

    // 基础种族
    if (character.race) sources.push(character.race);

    // 亚种
    if (character.subrace) sources.push(character.subrace);

    // 职业
    if (character.class) sources.push(character.class);

    // 子职
    if (character.subclass) sources.push(character.subclass);

    // 背景
    if (character.background) sources.push(character.background);

    // 背景套装
    if (character.bgPackage) sources.push(character.bgPackage);

    // 已选专长
    if (character.selectedFeat) {
        const feat = (dataCache.feats || []).find(f => f.id === character.selectedFeat);
        if (feat) sources.push(feat);
    }

    return sources;
}

/**
 * 从单个来源递归收集所有待选项目
 * 
 * 处理顺序：
 *   1. 来源自身的 rules/tool 规则（通过 addPendingSelectionsFromItem）
 *   2. 来源的 choice/rules/code_effects 同表链引用（addPendingSelectionsFromItem 内部处理）
 *   3. 来源的 chain 字段（在所有表中搜索）
 *   4. chain 引用的目标项的 chain/choice/rules/code_effects（递归）
 *   5. 如果是职业，收集职业特性（递归处理每个特性的链引用）
 *   6. 如果是子职，收集子职特性（递归处理每个特性的链引用）
 * 
 * @param {object} source - 来源对象
 * @param {Set} visited - 已访问的ID集合，防止循环引用
 */

/**
 * 从单个来源递归收集所有待选项目
 * 
 * 处理顺序：
 *   1. 来源自身的 rules/tool 规则（通过 addPendingSelectionsFromItem）
 *   2. 来源的 choice/rules/code_effects 同表链引用（addPendingSelectionsFromItem 内部处理）
 *   3. 来源的 chain 字段（在所有表中搜索）
 *   4. chain 引用的目标项的 chain/choice/rules/code_effects（递归）
 *   5. 如果是职业，收集职业特性（递归处理每个特性的链引用）
 *   6. 如果是子职，收集子职特性（递归处理每个特性的链引用）
 * 
 * @param {object} source - 来源对象
 * @param {Set} visited - 已访问的ID集合，防止循环引用
 */
export async function collectSelectionsFromSource(source, visited) {
    if (!source) return;
    if (!visited) visited = new Set();

    // 用 "表名_id" 作为唯一标识，防止不同表相同ID的冲突
    const sourceTable = findItemSourceTable(source);
    const sourceKey = (sourceTable || 'unknown') + '_' + (source.id || '') + '_' + (source.name || '');
    if (visited.has(sourceKey)) {
        return;
    }
    visited.add(sourceKey);

    // ===== 1. 处理来源自身的 rules/tool 规则 =====
    // addPendingSelectionsFromItem 内部会：
    //   - 调用 handlers.processItemRules() 解析 rules/tool 字段
    //   - 调用 processChainReferences() 处理 choice/rules/code_effects 同表链引用
    addPendingSelectionsFromItem(source);

    // ===== 2. 处理 chain 字段 =====
    // chain 字段支持两种格式：
    //   逗号分隔ID：如 "4,45,46"
    //   范围表达式：如 "proficiency(id=443→460)"
    if (source.chain) {
        const chainStr = String(source.chain);
        let chainIds = [];

        // 尝试解析范围表达式格式：table(id=start→end) 或单ID格式：table(id=X)
        const rangeMatch = chainStr.match(/(\w+)\(id=(\d+)(?:→(\d+))?\)/);
        if (rangeMatch) {
            const tableName = rangeMatch[1];
            const startId = parseInt(rangeMatch[2], 10);
            const endId = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : startId;
            const targetTable = dataCache[tableName];
            if (targetTable && Array.isArray(targetTable)) {
                for (let id = startId; id <= endId; id++) {
                    const entry = targetTable.find(function(e) { return e.id === id; });
                    if (entry) chainIds.push({ id: entry.id, entry: entry });
                }
            }
        } else {
            // 回退到逗号分隔格式
            chainIds = chainStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }

        for (const chainItem of chainIds) {
            // 兼容两种格式：新格式是 {id, entry}，旧格式是纯数字
            const targetId = typeof chainItem === 'object' ? chainItem.id : chainItem;
            if (targetId === source.id) continue; // 跳过自身
            
            if (typeof chainItem === 'object' && chainItem.entry) {
                // 新格式：已限定表，直接使用 entry
                await collectSelectionsFromSource(chainItem.entry, visited);
            } else {
                // 旧格式：全表搜索（向后兼容）
                const target = findInAllTables(targetId);
                if (target) {
                    await collectSelectionsFromSource(target, visited);
                }
            }
        }
    }

    // ===== 3. 如果是职业，收集职业特性 =====
    if (source === character.class) {
        for (let lvl = 1; lvl <= (character.level || 1); lvl++) {
            const classFeatures = getAllClassFeatures(source, lvl);
            for (const f of classFeatures) {
                // 递归处理职业特性及其链引用
                await collectSelectionsFromSource(f, visited);
            }
        }
    }

    // ===== 4. 如果是子职，收集子职特性 =====
    if (source === character.subclass) {
        for (let lvl2 = 1; lvl2 <= (character.level || 1); lvl2++) {
            const subclassFeatures = getSubclassFeatures(source.class_id, source.id, lvl2);
            for (const f of subclassFeatures) {
                // 递归处理子职特性及其链引用
                await collectSelectionsFromSource(f, visited);
            }
        }
    }

    // ===== 5. 如果是职业，收集职业额外选项（class_extra） =====
    // 翻译：只有当前处理的是职业对象，才去收集额外选项
    //       比如战士的"战技选项"、术士的"魔能祈唤选项"这些需要用户额外选的
    //       注意：子职的额外选项也在这一步一起收集，因为 collectClassExtraSelections
    //       内部会同时查子职绑定到的特性，不需要单独调一次
    if (source === character.class) {
        await collectClassExtraSelections(source);
    }

    // ===== 6. 特性规则解析（通过 rules/link 机制）已移至 addPendingSelectionsFromItem =====
    // 武器精通由 Weapon>mastery handler + addPendingSelectionsFromItem 数据驱动处理
}

/**
 * 文件名：review.js - 收集职业额外选项（class_extra）
 * 功能：遍历当前职业的所有特性，找到每个特性绑定了哪些额外选项（比如战士的战技、术士的魔能祈唤）
 *       然后按"效果名字"分组，去环位熟练表查当前等级给几个，最后加到待选队列里让用户选
 * 输入：cls - 当前选中的职业对象（比如野蛮人）
 * 输出：直接在 character.pendingSelections 里追加待选项目
 * 
 * 数据流顺序：
 *   1. 遍历当前职业/子职在每个等级上的特性
 *   2. 通过 extraByFeatureId 索引找到绑定到这个特性的额外选项
 *   3. 过滤掉不属于当前主职业、子职业的选项（防止别的职业混进来）
 *   4. 按"效果名字"分组，比如"魔能祈唤选项"、"战技选项"分成不同的组
 *   5. 去环位熟练表（proficiency.json）查当前等级给几个可选项
 *   6. 只有环位表里有记录，才会创建待选项目，否则跳过
 */

/**
 * 文件名：review.js - 收集职业额外选项（class_extra）
 * 功能：遍历当前职业的所有特性，找到每个特性绑定了哪些额外选项（比如战士的战技、术士的魔能祈唤）
 *       然后按"效果名字"分组，去环位熟练表查当前等级给几个，最后加到待选队列里让用户选
 * 输入：cls - 当前选中的职业对象（比如野蛮人）
 * 输出：直接在 character.pendingSelections 里追加待选项目
 * 
 * 数据流顺序：
 *   1. 遍历当前职业/子职在每个等级上的特性
 *   2. 通过 extraByFeatureId 索引找到绑定到这个特性的额外选项
 *   3. 过滤掉不属于当前主职业、子职业的选项（防止别的职业混进来）
 *   4. 按"效果名字"分组，比如"魔能祈唤选项"、"战技选项"分成不同的组
 *   5. 去环位熟练表（proficiency.json）查当前等级给几个可选项
 *   6. 只有环位表里有记录，才会创建待选项目，否则跳过
 */
export async function collectClassExtraSelections(cls) {
    // 翻译：如果职业对象是空的，或者索引还没建好，就直接结束，不往下走了
    if (!cls || !dataCache.extraByFeatureId) return;

    // ===== 1. 收集所有绑定了 "class_extra" 或 "class_extra_all" 标记的特性 =====
    var allExtras = [];       // class_extra (choice) 待选
    var allExtrasAll = [];    // class_extra_all (全部获得)
    var chainToFeature = {};

    for (let lvl = 1; lvl <= (character.level || 1); lvl++) {
        var features = getAllClassFeatures(cls, lvl);
        features.forEach(function(f) {
            if (f.extra !== 'class_extra' && f.extra !== 'class_extra_all') return;
            var extras = dataCache.extraByFeatureId[f.id];
            if (extras) {
                if (!chainToFeature[f.id]) chainToFeature[f.id] = f;
                var mapped = extras.map(function(e) {
                    return e;
                });
                if (f.extra === 'class_extra') {
                    allExtras = allExtras.concat(mapped);
                } else {
                    allExtrasAll = allExtrasAll.concat({
                        featureId: f.id,
                        featureName: f.name,
                        items: mapped
                    });
                }
            }
        });

        if (character.subclass) {
            var subFeatures = getSubclassFeatures(character.subclass.class_id, character.subclass.id, lvl);
            subFeatures.forEach(function(f) {
                if (f.extra !== 'class_extra' && f.extra !== 'class_extra_all') return;
                var extras = dataCache.extraByFeatureId[f.id];
                if (extras) {
                    if (!chainToFeature[f.id]) chainToFeature[f.id] = f;
                    var mapped = extras.map(function(e) {
                        return e;
                    });
                    if (f.extra === 'class_extra') {
                        allExtras = allExtras.concat(mapped);
                    } else {
                        allExtrasAll = allExtrasAll.concat({
                            featureId: f.id,
                            featureName: f.name,
                            items: mapped
                        });
                    }
                }
            });
        }
    }

    // ===== 处理 class_extra_all（全部获得，无需选择，存到 character 供 sheet 展示） =====
    if (allExtrasAll.length > 0) {
        if (!character.classExtraAll) character.classExtraAll = [];
        allExtrasAll.forEach(function(group) {
            var exists = character.classExtraAll.some(function(g) {
                return g.featureId === group.featureId;
            });
            if (!exists) {
                character.classExtraAll.push(group);
            }
        });
    }

    if (allExtras.length === 0) return;

    // ===== 2. 按职业ID过滤 =====
    // 通过 chain 关联的特性 class ID 过滤，避免职业名不一致的问题
    var classId = cls.id;
    allExtras = allExtras.filter(function(e) {
        var fid = e['chain'];
        var f = chainToFeature[fid];
        if (f && f.class) {
            return String(f.class) === String(classId);
        }
        return true;
    });
    if (allExtras.length === 0) return;

    // ===== 3. 按"效果名字"分组 =====
    var groups = {};
    allExtras.forEach(function(e) {
        var catName = e.category || '其他选项';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(e);
    });

    // ===== 4. 每个组去环位熟练表查可选项数量 =====
    Object.keys(groups).forEach(function(catName) {
        var items = groups[catName];
        if (items.length === 0) return;

        var sourceFeature = null;
        if (items[0].chain && chainToFeature[items[0].chain]) {
            sourceFeature = chainToFeature[items[0].chain];
        }
        if (!sourceFeature) {
            console.warn('[collectClassExtraSelections] 找不到来源特性, chain=' + items[0].chain);
            return;
        }

        var count = getCountFromProficiencyRef(sourceFeature, cls);

        if (!count || count <= 0) return;

        var pending = {
            type: 'filter',
            category: 'class_extra',
            success: true,
            needUserSelect: true,
            count: count,
            classId: cls.id,
            groupName: catName,
            candidates: items.map(function(e) {
                var pr = e.prerequisite || '';
                return {
                    id: e.id,
                    name: e.name || '',
                    desc: pr ? '先决：' + translatePrereq(pr) : '',
                    fulldesc: e.desc || '',
                    prereq: pr
                };
            })
        };

        var exists = character.pendingSelections.some(function(p) {
            return p.category === 'class_extra' && p.groupName === catName;
        });
        if (!exists) {
            character.pendingSelections.push(pending);
        }
    });
}

/**
 * 在所有数据表中查找指定ID的数据项
 * 搜索顺序：raceFeatures > classFeatures > feats > backgrounds > races > classes > ...
 * @param {number} id - 要查找的ID
 * @returns {object|null} 找到的数据项，或 null
 */

/**
 * 在所有数据表中查找指定ID的数据项
 * 搜索顺序：raceFeatures > classFeatures > feats > backgrounds > races > classes > ...
 * @param {number} id - 要查找的ID
 * @returns {object|null} 找到的数据项，或 null
 */
export function findInAllTables(id) {
    const tables = [
        { name: 'raceFeatures', data: dataCache.raceFeatures },
        { name: 'classFeatures', data: dataCache.classFeatures },
        { name: 'feats', data: dataCache.feats },
        { name: 'backgrounds', data: dataCache.backgrounds },
        { name: 'races', data: dataCache.races },
        { name: 'classes', data: dataCache.classes },
        { name: 'spells', data: dataCache.spells },
        { name: 'skills', data: dataCache.skills },
        { name: 'tools', data: dataCache.tools },
        { name: 'weapons', data: dataCache.weapons },
        { name: 'armors', data: dataCache.armors },
        { name: 'languages', data: dataCache.languages },
        { name: 'packages', data: dataCache.packages },
        { name: 'monsters', data: dataCache.monsters }
    ];
    
    for (const table of tables) {
        if (table.data && Array.isArray(table.data)) {
            const found = table.data.find(f => f && f.id === id);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

/**
 * 先决条件翻译 - 将代码格式的 prereq 翻译为可读中文
 * 格式: 自描述表达式串联，如 "prerequisite(lv:class(11)=2),spells(class=11,lv=0,dice=1)+1"
 */

/**
 * 先决条件翻译 - 将代码格式的 prereq 翻译为可读中文
 * 格式: 自描述表达式串联，如 "prerequisite(lv:class(11)=2),spells(class=11,lv=0,dice=1)+1"
 */
export function translatePrereq(prereqStr) {
    if (!prereqStr) return '';

    // 辅助函数：按括号深度切分
    function splitTopLevel(str, sep) {
        var parts = [];
        var depth = 0;
        var start = 0;
        for (var i = 0; i < str.length; i++) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') depth--;
            else if (str[i] === sep && depth === 0) {
                parts.push(str.substring(start, i).trim());
                start = i + 1;
            }
        }
        parts.push(str.substring(start).trim());
        return parts;
    }

    var parts = [];
    var conditions = splitTopLevel(prereqStr, ',');
    for (var ci = 0; ci < conditions.length; ci++) {
        var cond = conditions[ci].trim();
        if (!cond) continue;

        // 剥离 prerequisite(...) 外层包裹
        var outerMatch = cond.match(/^prerequisite\((.+)\)$/i);
        if (outerMatch) cond = outerMatch[1];

        // lv:class(X)=Y → 需要[职业名]等级Y
        var m = cond.match(/^lv\s*:\s*class\s*\(\s*(\d+)\s*\)\s*=\s*(\d+)\s*$/i);
        if (m) {
            var cls = (dataCache.classes || []).find(function(c) { return String(c.id) === m[1]; });
            parts.push((cls ? cls.name : '职业#' + m[1]) + '等级' + m[2]);
            continue;
        }

        // spells(class=X, lv=Y, dice=Z) → 需已习得一道造成伤害的[职业]戏法
        var spellMatch = cond.match(
            /^spells?\s*\(\s*class\s*=\s*(\d+)\s*,\s*lv\s*=\s*(\d+)\s*,\s*dice\s*=\s*(\d+)\s*(?:,\s*attack_roll\s*=\s*(\d+))?\s*\)\s*(?:\+\s*(\d+))?\s*$/i
        );
        if (spellMatch) {
            var sClassId = parseInt(spellMatch[1], 10);
            var sClass = (dataCache.classes || []).find(function(c) { return String(c.id) === String(sClassId); });
            parts.push('需已习得一道造成伤害的' + (sClass ? sClass.name : '职业') + '戏法');
            continue;
        }

        // class_extra(id=N) → 需先选择"XX"
        var extraMatch = cond.match(
            /^class_extra\s*\(\s*id\s*=\s*(\d+)\s*\)\s*$/i
        );
        if (extraMatch) {
            var reqId = parseInt(extraMatch[1], 10);
            var classExtra = (dataCache.classExtra || []).find(function(e) { return e.id === reqId; });
            parts.push('需先选择"' + (classExtra ? classExtra.name : '选项#' + reqId) + '"');
            continue;
        }

        // 未知格式 → 原样返回
        parts.push(cond);
    }
    return parts.join('，且');
}

// findItemSourceTable / getSubclassFeatures 已迁至 handlers/data-query.js

/**
 * 获取职业特性（与 class.js 中一致）
 */

/**
 * 获取职业特性（与 class.js 中一致）
 */
export function getAllClassFeatures(cls, level) {
    if (!cls || !dataCache.classFeatures) return [];
    // 翻译：返回符合条件的特性（基础特性 subclass=0 + 已选子职的特性）
    return dataCache.classFeatures.filter(function(f) {
        return f.class === cls.id && f.level === level && 
            (!f.subclass || f.subclass === 0 || (character.subclass && f.subclass === character.subclass.id));
    });
}

/**
 * 无待选项目时显示总览完成页
 */