/**
 * creation/steps/feature-selection-renderer.js
 * 特性额外选择的子渲染器：分组标题、候选项网格、前置条件校验。
 *
 * 由设计-v0.4-004-001 从 feature.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { getFeatTypeMap, getWeaponTypeMap } from '../../core/data/dictionary.js';
/**
 * 获取选择标题
 * 如果选择项有 sourceName（来源名称），会在标题前加上「来源名-」
 * 例如：从"熟习"专长来的技能+工具选择 → 「（熟习）-技能、工匠工具（共选 3 项）」
 *       从"巧匠"专长来的工具选择 → 「（巧匠）-1个工匠工具」
 */
export function getSelectionTitle(p) {
    const typeNames = { 66: '工匠工具', 67: '乐器', 68: '赌具', 69: '其他工具' };
    const sourcePrefix = p.sourceName ? `（${p.sourceName}）-` : '';

    // proficiency 和 choose 类型没有 category 字段，需用 type 判断
    if (p.type === 'proficiency') {
        return `${sourcePrefix}${p.count}个专精`;
    }
    if (p.type === 'choose') {
        return `${sourcePrefix}${p.title || '多类组合'}（共选 ${p.total} 项）`;
    }
    // code_choose 类型：显示特性名称
    if (p.type === 'code_choose') {
        return `${sourcePrefix}选择：${p.title || p.codeName || '特性选项'}`;
    }

    let title;
    switch (p.category) {
        case 'tools':
            title = `${p.count}个${typeNames[p.typeId] || '工具'}`;
            break;
        case 'weapons':
            title = `${p.count}个${getWeaponTypeMap()[p.typeId] || '武器'}`;
            break;
        case 'spells': {
            const cls = (dataCache.classes || []).find(c => c.id === p.classId);
            title = `${p.count}个${cls ? cls.name || cls.class : ''}${p.level}环法术`;
            break;
        }
        case 'skills':
            title = `${p.count}个技能熟练`;
            break;
        case 'languages':
            title = `${p.count}个语言`;
            break;
        case 'armors':
            title = `${p.count}个护甲`;
            break;
        case 'feats': {
            title = `${p.count}个${getFeatTypeMap()[p.typeId] || '专长'}`;
            break;
        }
        case 'class_extra':
            title = `${p.count}个${p.groupName || '职业额外选项'}`;
            break;
        default:
            title = `${p.count}项`;
    }
    return sourcePrefix + title;
}

/**
 * 收集整个车卡流程中所有已经选择的ID（去重），分两类返回：
 * 1. currentPageSelected — 本页面其他分组当前已选（跨分组去重用）
 * 2. previousStepSelected — 前置步骤已保存到 featureSelections 的已选（历史标识用）
 * 3. previousStepLabels — 前置步骤已选ID → 来源步骤名称（如"专长页"、"法术页"）
 *    注意：使用 "类型:ID" 复合key，防止不同类别（如专长和法术）同ID冲突
 */

/**
 * 收集整个车卡流程中所有已经选择的ID（去重），分两类返回：
 * 1. currentPageSelected — 本页面其他分组当前已选（跨分组去重用）
 * 2. previousStepSelected — 前置步骤已保存到 featureSelections 的已选（历史标识用）
 * 3. previousStepLabels — 前置步骤已选ID → 来源步骤名称（如"专长页"、"法术页"）
 *    注意：使用 "类型:ID" 复合key，防止不同类别（如专长和法术）同ID冲突
 */
export function collectAllAlreadySelectedIds() {
    const currentPageIds = new Set();
    const previousStepIds = new Set();  // 使用 "类型:ID" 复合键（如 "spell:2"、"feats:8"）
    // 记录每个前置步骤已选ID的来源步骤名称，用于显示更详细的提示
    // 使用 "类型:ID" 复合key，避免不同表之间的ID冲突
    const previousStepLabels = {};

    // 1. 本页面所有分组当前已选（即使还没确认）
    Object.values(window._allSelectionsState || {}).forEach(state => {
        state.selectedIds.forEach(id => currentPageIds.add(String(id)));
    });

    // 2. 前置步骤已选标记
    //    在技能页/法术页/专长页等前置步骤中已选的项，
    //    在特性总览中显示为"已选中（绿色）+ 禁用（不可操作）"状态，
    //    让用户能清楚看到哪些已经选过了，但不能重复选择。
    
    // ---- 技能页已选（allSkills 存的是技能名称，需要转成 skill ID） ----
    const skillCache = dataCache.skills || [];
    (character.allSkills || []).forEach(skillName => {
        const skill = skillCache.find(s => s.name === skillName);
        if (skill) {
            const key = 'skills:' + skill.id;
            previousStepIds.add(key);
            previousStepLabels[key] = '技能页';
        }
    });

    // ---- 法术页已选（selectedSpells 存的是 spell ID 数组） ----
    (character.selectedSpells || []).forEach(spellId => {
        const key = 'spells:' + spellId;
        previousStepIds.add(key);
        previousStepLabels[key] = '法术页';
    });

    // ---- 专长页已选（selectedFeat 存的是单个 feat ID） ----
    if (character.selectedFeat != null) {
        const key = 'feats:' + character.selectedFeat;
        previousStepIds.add(key);
        previousStepLabels[key] = '专长页';
    }

    // 合并：前置步骤已选（复合键） + 本页已选（原始ID/带前缀ID）
    // 注意：allIds 同时包含两种格式，查找时需要用复合键或原始ID分别检查
    const allIds = new Set([...currentPageIds, ...previousStepIds]);

    return {
        allIds,           // 所有已选ID（复合键 + 原始ID混合）
        currentPageIds,   // 当前页其他分组已选（原始ID/带前缀ID）
        previousStepIds,  // 前置步骤已选（使用 "类型:ID" 复合键）
        previousStepLabels // 前置步骤已选 → 来源步骤名称（复合key "类型:ID"）
    };
}

/**
 * 按括号嵌套深度切分字符串 — 仅按 top-level 分隔符切分
 */
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

/**
 * 先决条件检查 - 评估 class_extra 选项的 prereq 表达式
 * 格式示例: "prerequisite(lv:class(11)=2),spells(class=11,lv=0,dice=1)+1"
 * 多个条件用逗号分隔，全部满足才通过（AND逻辑）
 */

/**
 * 先决条件检查 - 评估 class_extra 选项的 prereq 表达式
 * 格式示例: "prerequisite(lv:class(11)=2),spells(class=11,lv=0,dice=1)+1"
 * 多个条件用逗号分隔，全部满足才通过（AND逻辑）
 */
export function checkPrerequisite(prereqStr) {
    if (!prereqStr || !character) return true;

    // 先按 top-level 逗号拆分子条件（感知括号嵌套），再逐条件处理
    var conditions = splitTopLevel(prereqStr, ',');

    for (var ci = 0; ci < conditions.length; ci++) {
        var cond = conditions[ci].trim();
        if (!cond) continue;

        // 剥离该子条件的 prerequisite(...) 外层包裹
        var outerMatch = cond.match(/^prerequisite\((.+)\)$/i);
        if (outerMatch) cond = outerMatch[1];

        // ---- lv:class(X)=Y — 等级条件（现有逻辑，保留） ----
        var lvMatch = cond.match(/^lv\s*:\s*class\s*\(\s*(\d+)\s*\)\s*=\s*(\d+)\s*$/i);
        if (lvMatch) {
            var classId = parseInt(lvMatch[1], 10);
            var minLevel = parseInt(lvMatch[2], 10);
            var curClass = character.class;
            var curLevel = character.level || 1;
            if (!curClass || String(curClass.id) !== String(classId)) return false;
            if (curLevel < minLevel) return false;
            continue;
        }

        // ---- spells(class=X, lv=Y, dice=Z) — 法术先决条件 ----
        var spellMatch = cond.match(
            /^spells?\s*\(\s*class\s*=\s*(\d+)\s*,\s*lv\s*=\s*(\d+)\s*,\s*dice\s*=\s*(\d+)\s*(?:,\s*attack_roll\s*=\s*(\d+))?\s*\)\s*(?:\+\s*(\d+))?\s*$/i
        );
        if (spellMatch) {
            var sClassId = parseInt(spellMatch[1], 10);
            var sLv = parseInt(spellMatch[2], 10);
            var required = spellMatch[5] ? parseInt(spellMatch[5], 10) : 1;
            var selectedSpells = character.selectedSpells || [];
            var matchingCount = selectedSpells.reduce(function(count, spellId) {
                var spell = (dataCache.spells || []).find(function(s) { return s.id === spellId; });
                if (!spell) return count;
                var spellClasses = Array.isArray(spell.class) ? spell.class : (spell.class ? [spell.class] : []);
                var matches = spellClasses.some(function(c) { return String(c) === String(sClassId); }) &&
                       spell.lv === sLv &&
                       spell.dice && spell.dice.trim() !== '' &&
                       spell.dice !== '0';
                return matches ? count + 1 : count;
            }, 0);
            if (matchingCount < required) return false;
            continue;
        }

        // ---- class_extra(id=N) — 职业额外选项先决条件 ----
        var extraMatch = cond.match(
            /^class_extra\s*\(\s*id\s*=\s*(\d+)\s*\)\s*$/i
        );
        if (extraMatch) {
            var requiredId = parseInt(extraMatch[1], 10);
            var featureSelections = character.featureSelections || {};
            var classExtraSelected = (featureSelections.classExtra || []).some(function(s) {
                return s.id === requiredId;
            });
            if (!classExtraSelected) return false;
            continue;
        }
    }
    return true;
}

/**
 * 渲染选择项列表（含完整描述数据）
 * 已选过的选项自动置灰禁用，不能重复选择
 * 区分两种已选状态：
 * 1. 前置步骤/历史已选 → 添加"（已选）"标识，证明不是本页互动
 * 2. 当前页其他分组已选 → 添加"（本页已选）"标识
 *
 * 注意：previousStepLabels 使用 "类型:ID" 复合键（如 "spell:4"、"feats:4"），
 * 查找时必须构造同样的复合键格式，不能直接用原始ID查找。
 */

/**
 * 渲染选择项列表（含完整描述数据）
 * 已选过的选项自动置灰禁用，不能重复选择
 * 区分两种已选状态：
 * 1. 前置步骤/历史已选 → 添加"（已选）"标识，证明不是本页互动
 * 2. 当前页其他分组已选 → 添加"（本页已选）"标识
 *
 * 注意：previousStepLabels 使用 "类型:ID" 复合键（如 "spell:4"、"feats:4"），
 * 查找时必须构造同样的复合键格式，不能直接用原始ID查找。
 */
export function renderSelectionItems(p, pendingIdx) {
    if (!p.candidates || p.candidates.length === 0) {
        return '<div class="empty-hint">没有可用的选项</div>';
    }

    // 收集所有已选过的ID，分两类返回，并获取前置步骤来源标签
    const { allIds, currentPageIds, previousStepIds, previousStepLabels } = collectAllAlreadySelectedIds();

    // 获取当前分组的已选状态（用于恢复场景，让已选显示为绿色选中状态）
    var currentGroupState = null;
    if (pendingIdx != null && window._allSelectionsState && window._allSelectionsState[pendingIdx]) {
        currentGroupState = window._allSelectionsState[pendingIdx];
    }

    return p.candidates.map(item => {
        // 对 HTML 特殊字符转义
        const safeName = (item.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeDesc = (item.desc || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeFull = (item.fulldesc || item.desc || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const category = p.category || '';
        const itemIdStr = String(item.id);
        
        // ===== choose 类型特殊处理 =====
        // choose 类型的 item.id 带前缀（如 "spell_4"、"feat_4"），
        // 但 previousStepIds/allIds 中存的是原始ID（如 "4"），
        // 所以需要同时检查 item._origId（原始ID）。
        // 同时，currentPageIds 中存的是带前缀的ID（从 _allSelectionsState 来），
        // 所以 currentPageIds 检查用 itemIdStr。
        let isDisabled;
        let isPreviousStep;
        let isCurrentPage;
        let compositeKey;  // 用于查找 previousStepLabels 的复合键
        
        if (p.type === 'choose') {
            // choose 类型：item 有 _category 和 _origId 字段
            const origIdStr = item._origId != null ? String(item._origId) : '';
            compositeKey = (item._category || '') + ':' + origIdStr;
            
            // 用复合键检查前置步骤已选，用带前缀的ID检查本页已选
            isPreviousStep = previousStepIds.has(compositeKey);
            isCurrentPage = currentPageIds.has(itemIdStr);
            // 同时检查复合键（前置步骤）和原始ID（本页）
            isDisabled = isPreviousStep || isCurrentPage || allIds.has(compositeKey);
        } else {
            // 常规类型：使用 pending 的 category + 原始ID
            compositeKey = category + ':' + itemIdStr;
            // 同时检查复合键（前置步骤）和原始ID（本页，如 _allSelectionsState 中的原始ID）
            isPreviousStep = previousStepIds.has(compositeKey);
            isCurrentPage = currentPageIds.has(itemIdStr);
            isDisabled = isPreviousStep || isCurrentPage || allIds.has(compositeKey) || allIds.has(itemIdStr);
            
            // 先决条件检查：class_extra 选项不满足先决条件时禁用
            if (!isDisabled && category === 'class_extra' && item.prereq) {
                if (!checkPrerequisite(item.prereq)) {
                    isDisabled = true;
                }
            }
        }

        // ===== 检查当前项是否在当前分组的已选状态中（用于恢复场景） =====
        // 当用户从详情页返回特性总览时，已保存的选择被恢复到 _allSelectionsState，
        // 这些已选项应该显示为绿色选中状态（selected），而不是灰色禁用（disabled）
        var isSelectedHere = false;
        if (currentGroupState && currentGroupState.selectedIds) {
            // choose 类型用带前缀ID检查，常规类型用原始ID
            if (p.type === 'choose') {
                isSelectedHere = currentGroupState.selectedIds.indexOf(itemIdStr) !== -1;
            } else {
                isSelectedHere = currentGroupState.selectedIds.indexOf(itemIdStr) !== -1;
            }
        }

        // 如果当前项在本分组的已选状态中（由 restoreSavedSelectionsToState 恢复），
        // 则始终显示为绿色选中状态，允许用户取消/修改选择。
        // 即使该项也在 previousStepIds 中（如 allSkills、selectedSpells 等前置步骤数据），
        // 当前步骤的已选状态优先级更高，不应被前置步骤数据禁用。
        var showAsSelected = false;
        if (isSelectedHere) {
            isDisabled = false;
            showAsSelected = true;
        }

        let extraClass = '';
        let extraTitle = '';
        let hintHtml = '';

        // 前置步骤已选（非本分组已选）：显示为"已选中（绿色） + 禁用（不可操作）"
        // 区别于 showAsSelected（本分组已选，可编辑），前置步骤已选不允许重复选择
        if (isPreviousStep && !isSelectedHere) {
            extraClass = 'selected disabled previous-step-selected';
            const stepLabel = previousStepLabels[compositeKey] || '前置步骤';
            extraTitle = ' title="已在' + stepLabel + '选择"';
            hintHtml = '<span class="disabled-hint">（' + stepLabel + '已选）</span>';
        } else if (showAsSelected) {
            extraClass = 'selected';
        } else if (isDisabled) {
            // 先决条件不满足（未被已选逻辑标记，纯属条件不符）
            if (!isPreviousStep && !isCurrentPage && !allIds.has(compositeKey) && !allIds.has(itemIdStr) &&
                category === 'class_extra' && item.prereq && !checkPrerequisite(item.prereq)) {
                extraClass = 'disabled prereq-blocked';
                extraTitle = ' title="未满足先决条件"';
                hintHtml = '<span class="disabled-hint">（条件不符）</span>';
            } else if (isCurrentPage) {
                extraTitle = ' title="已在本页其他分组选择，不能重复选择"';
                hintHtml = '<span class="disabled-hint current-page">（本页已选）</span>';
            } else {
                extraTitle = ' title="已选择过，不能重复选择"';
                hintHtml = '<span class="disabled-hint">（已选）</span>';
            }
            extraClass += ' ' + (isCurrentPage ? 'current-page-selected' : '');
        }

        // 把复合键也存到 data-compkey，供 updateAllSelectionsUI 使用
        return `<div class="selection-item ${extraClass}" data-id="${item.id}" data-category="${category}" data-compkey="${compositeKey}" data-fulldesc="${safeFull}" data-name="${safeName}"${extraTitle}>
            <div class="selection-item-name">${safeName}${hintHtml}</div>
            ${safeDesc ? `<div class="selection-item-desc">${safeDesc}</div>` : ''}
        </div>`;
    }).join('');
}

// ===== 注入CSS样式 =====