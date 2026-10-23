/**
 * creation/steps/feature-selection-main.js
 * 特性额外选择的主流程：渲染选择页、刷新选中态、确认并写回角色数据。
 *
 * 由设计-v0.4-004-001 从 feature.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { collectAllAlreadySelectedIds, getSelectionTitle, renderSelectionItems } from './13-review-renderer.js';
import { addPendingSelectionsFromItem, hasPendingSelections, loadCandidates } from './13-review-utils.js';
import { restoreSavedSelectionsToState } from './13-review.js';
/**
 * 渲染特性选择步骤（新布局：所有待选项同时显示，左侧选择区 + 右侧角色预览）
 */
export async function renderFeatureSelectionStep(container, nextStepOverride) {
    if (!hasPendingSelections()) {
        // 如果指定了下一步目标，直接跳转
        if (nextStepOverride) {
            currentStep = nextStepOverride;
            renderStep(currentStep);
            updateProgress();
            updateButtons();
            document.getElementById('stepContent').scrollTop = 0;
            return;
        }
        currentStep++;
        renderStep(currentStep);
        updateProgress();
        updateButtons();
        return;
    }

    // 先设置标志，确保按钮状态正确（必须在 await 之前设置）
    window._nextStepAfterSelection = nextStepOverride || currentStep;
    window._isInFeatureSelection = true;

    // 加载所有待选项的候选数据
    for (const pending of character.pendingSelections) {
        await loadCandidates(pending);
    }

    // ===== 候选数据加载完成，此时恢复已保存的选择状态 =====
    // 放在这里是因为 restore 需要 candidates 做精确匹配，
    // 避免恢复自动添加（非用户手动选择）的数据
    if (typeof restoreSavedSelectionsToState === 'function') {
        restoreSavedSelectionsToState();
    }

    // 调试：打印每个分组的候选数
    if (window.__DEBUG.render) {
        console.log('[渲染候选] 共 ' + character.pendingSelections.length + ' 个分组:');
        character.pendingSelections.forEach(function(p, idx) {
            var state = (window._allSelectionsState || {})[idx];
            var selected = state ? state.selectedIds.length : 0;
            console.log('  [' + idx + '] ' + (p.category || p.type) + ' | 候选: ' + (p.candidates ? p.candidates.length : 0) + ' | 已选: ' + selected + '/' + p.count + ' | 来源: ' + (p.sourceName || '?'));
        });
    }
    
    // 初始化全局选择状态：每个待选项对应一个已选ID数组
    if (!window._allSelectionsState) {
        window._allSelectionsState = {};
    }
    character.pendingSelections.forEach((pending, idx) => {
        if (!window._allSelectionsState[idx]) {
            window._allSelectionsState[idx] = { selectedIds: [] };
        }
    });

    // 构造左侧选择区HTML
    let leftHtml = '<div class="feature-selection-left">';
    character.pendingSelections.forEach((pending, idx) => {
        const title = getSelectionTitle(pending);
        const state = window._allSelectionsState[idx] || { selectedIds: [] };
        const sectionId = 'feat-section-' + idx;
        const gridId = 'feat-grid-' + idx;
        const collapsed = state._collapsed || false;

        leftHtml += `
            <div class="feat-section" data-index="${idx}">
                <div class="feat-section-header" data-target="${sectionId}">
                    <span class="feat-section-title">${title}</span>
                    <span class="feat-section-count">已选 ${state.selectedIds.length} / ${pending.count}</span>
                    <span class="feat-section-toggle">${collapsed ? '▶' : '▼'}</span>
                </div>
                <div class="feat-section-body ${collapsed ? 'collapsed' : ''}" id="${sectionId}">
                    <div class="selection-grid" id="${gridId}">
                        ${renderSelectionItems(pending, idx)}
                    </div>
                    <div class="feat-section-hint">
                        需要选择 ${pending.count} 项，当前已选 <span class="section-selected-count">${state.selectedIds.length}</span> / ${pending.count}
                    </div>
                </div>
            </div>`;
    });
    leftHtml += '</div>';

    // 计算总需选数和总已选数
    const totalNeeded = character.pendingSelections.reduce((sum, p) => sum + p.count, 0);
    const totalSelected = Object.values(window._allSelectionsState).reduce((sum, s) => sum + s.selectedIds.length, 0);

    // 右侧详情面板（初始显示提示信息）
    const rightHtml = '<div class="detail-panel" id="detailPanel">' +
        '<div class="detail-panel-placeholder">点击左侧选项查看详情</div>' +
    '</div>';

    container.innerHTML = `
        <div class="step-container">
            <div class="step-title">
                <h2>特性选择</h2>
                <p>根据种族/职业/背景规则，请完成以下所有选择</p>
            </div>

            <div class="feature-selection-layout">
                ${leftHtml}
                <div class="feature-selection-right">
                    ${rightHtml}
                </div>
            </div>

            </div>
    `;

    // 绑定每个待选项的点击事件
    character.pendingSelections.forEach((pending, idx) => {
        const gridEl = document.getElementById('feat-grid-' + idx);
        if (!gridEl) return;
        gridEl.querySelectorAll('.selection-item').forEach(el => {
            // 点击选择/取消选择，同时显示详情
            el.addEventListener('click', (e) => {
                // 显示详情（无论是否禁用，都允许查看详情）
                showItemDetail(el);
                
                // 已选禁用的选项不可再选择
                if (el.classList.contains('disabled')) {
                    return;
                }
                
                const id = el.dataset.id;
                const state = window._allSelectionsState[idx];
                const existingIdx = state.selectedIds.indexOf(id);
                
                // 检查是否已在其他分组中被选中（跨分组去重）
                if (existingIdx === -1) {
                    const alreadyInOther = Object.entries(window._allSelectionsState || {}).some(([otherIdx, otherState]) => {
                        return parseInt(otherIdx) !== idx && otherState.selectedIds.includes(id);
                    });
                    if (alreadyInOther) {
                        alert('此选项已在其他分组中选择过，不能重复选择');
                        return;
                    }
                }
                
                if (existingIdx >= 0) {
                    // 取消选择
                    state.selectedIds.splice(existingIdx, 1);
                    el.classList.remove('selected');
                    if (window.__DEBUG.select) {
                        console.log('[选择取消]', pending.category || pending.type, 'id:', id, '名称:', el.dataset.name);
                    }
                } else {
                    // 选择
                    if (state.selectedIds.length >= pending.count) {
                        alert(`此类别最多只能选择 ${pending.count} 项`);
                        return;
                    }
                    state.selectedIds.push(id);
                    el.classList.add('selected');
                    if (window.__DEBUG.select) {
                        console.log('[选择新增]', pending.category || pending.type, 'id:', id, '名称:', el.dataset.name);
                    }
                }
                // 更新计数
                updateAllSelectionsUI();
            });
        });
    });

    // 绑定折叠/展开事件
    document.querySelectorAll('.feat-section-header').forEach(header => {
        header.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const body = document.getElementById(targetId);
            if (!body) return;
            const isCollapsed = body.classList.toggle('collapsed');
            const toggle = this.querySelector('.feat-section-toggle');
            if (toggle) toggle.textContent = isCollapsed ? '▶' : '▼';
            // 保存状态
            const idx = parseInt(this.closest('.feat-section').dataset.index);
            if (window._allSelectionsState[idx]) {
                window._allSelectionsState[idx]._collapsed = isCollapsed;
            }
        });
    });
}

/**
 * 更新所有选择UI上的计数和跨分组禁用状态
 * 区分两种已选状态：
 * 1. 前置步骤已选 → 保持原有标识，不改变
 * 2. 当前页其他分组已选 → 添加本页已选标识
 */

/**
 * 更新所有选择UI上的计数和跨分组禁用状态
 * 区分两种已选状态：
 * 1. 前置步骤已选 → 保持原有标识，不改变
 * 2. 当前页其他分组已选 → 添加本页已选标识
 */
export function updateAllSelectionsUI() {
    // 收集分类好的已选ID
    const { allIds, currentPageIds, previousStepIds, previousStepLabels } = collectAllAlreadySelectedIds();

    // 更新每个section的计数和项目的禁用状态
    document.querySelectorAll('.feat-section').forEach(section => {
        const idx = parseInt(section.dataset.index);
        const state = window._allSelectionsState[idx];
        if (!state) return;
        const headerCount = section.querySelector('.feat-section-count');
        if (headerCount) headerCount.textContent = `已选 ${state.selectedIds.length} / ${character.pendingSelections[idx].count}`;
        const bodyCount = section.querySelector('.section-selected-count');
        if (bodyCount) bodyCount.textContent = state.selectedIds.length;

        // 更新本分组内每个项目的禁用状态（跨分组去重+前置步骤已选禁用）
        section.querySelectorAll('.selection-item').forEach(itemEl => {
            const itemId = itemEl.dataset.id;
            // 从 data-compkey 提取原始ID（用于 choose 类型的带前缀ID）
            // data-compkey 格式："类型:原始ID"（如 "spell:4"、"feat:4"）
            const compKey = itemEl.dataset.compkey || '';
            const parts = compKey.split(':');
            const origId = parts.length > 1 ? parts[1] : itemId;

            // 如果该ID在当前分组未被选中，但在其他分组或前置步骤已被选中 → 禁用
            const isSelectedHere = state.selectedIds.includes(itemId);
            // 同时检查复合键（前置步骤用）、原始ID（本页常规项用）、带前缀ID（本页choose类型用）
            const shouldDisable = !isSelectedHere && (allIds.has(compKey) || allIds.has(itemId) || allIds.has(origId));

            if (shouldDisable) {
                itemEl.classList.add('disabled');
                itemEl.classList.add('already-selected');

                // 根据来源添加对应标识（前置步骤用复合键检查，本页用带前缀ID检查）
                const isPreviousStep = previousStepIds.has(compKey);
                const isCurrentPage = currentPageIds.has(itemId);

                // 清除旧的标识
                const oldHint = itemEl.querySelector('.disabled-hint');
                if (oldHint) oldHint.remove();

                // 添加新的标识
                const nameEl = itemEl.querySelector('.selection-item-name');
                if (nameEl) {
                    const span = document.createElement('span');
                    if (isPreviousStep) {
                        // 使用 data-compkey（复合键）查找 previousStepLabels
                        // 不能用原始ID查找，因为标签是用 "类型:ID" 格式存储的
                        const compKey = itemEl.dataset.compkey || '';
                        const stepLabel = previousStepLabels[compKey] || '前置步骤';
                        span.className = 'disabled-hint previous-step';
                        span.textContent = '（' + stepLabel + '已选）';
                        itemEl.classList.add('previous-step-selected');
                        itemEl.classList.remove('current-page-selected');
                    } else if (isCurrentPage) {
                        span.className = 'disabled-hint current-page';
                        span.textContent = '（本页已选）';
                        itemEl.classList.add('current-page-selected');
                        itemEl.classList.remove('previous-step-selected');
                    } else {
                        span.className = 'disabled-hint';
                        span.textContent = '（已选）';
                        itemEl.classList.remove('previous-step-selected');
                        itemEl.classList.remove('current-page-selected');
                    }
                    nameEl.appendChild(span);
                }
            } else if (!isSelectedHere) {
                // 没有被选中 → 恢复可用
                itemEl.classList.remove('disabled');
                itemEl.classList.remove('already-selected');
                itemEl.classList.remove('previous-step-selected');
                itemEl.classList.remove('current-page-selected');
                const hint = itemEl.querySelector('.disabled-hint');
                if (hint) hint.remove();
            }
        });
    });

    // 更新全局计数
    const totalSelected = Object.values(window._allSelectionsState).reduce((sum, s) => sum + s.selectedIds.length, 0);
    const globalCount = document.getElementById('globalSelectedCount');
    if (globalCount) globalCount.textContent = totalSelected;
}

/**
 * 显示选项详情到右侧面板
 */

/**
 * 显示选项详情到右侧面板
 */
export function showItemDetail(el) {
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    const name = el.dataset.name || '';
    const fulldesc = el.dataset.fulldesc || '';
    const category = el.dataset.category || '';

    // 类别中文名
    const categoryNames = {
        skill: '技能',
        feats: '专长',
        tool: '工具',
        weapon: '武器',
        spell: '法术',
        language: '语言',
        armor: '护甲'
    };
    const catName = categoryNames[category] || category;

    let html = '<div class="detail-panel-content">';
    html += `<h3 class="detail-panel-title">${name}</h3>`;
    html += `<div class="detail-panel-type">${catName}</div>`;
    if (fulldesc) {
        // 将 \n 替换为 <br> 以支持多行描述
        const descHtml = fulldesc.replace(/\n/g, '<br>');
        html += `<div class="detail-panel-desc">${descHtml}</div>`;
    }
    html += '</div>';
    panel.innerHTML = html;
}

/**
 * 确认所有选择并保存
 */

/**
 * 确认所有选择并保存
 */
export function confirmAllSelections() {
    // 验证所有待选项是否都已选够数量
    for (let idx = 0; idx < character.pendingSelections.length; idx++) {
        const pending = character.pendingSelections[idx];
        const state = window._allSelectionsState[idx];
        if (!state || state.selectedIds.length < pending.count) {
            const title = getSelectionTitle(pending);
            alert(`"${title}" 尚未选完（需要 ${pending.count} 项，当前已选 ${state?.selectedIds.length || 0} 项）`);
            // 自动展开未完成的section
            const section = document.querySelector(`.feat-section[data-index="${idx}"]`);
            if (section) {
                const body = section.querySelector('.feat-section-body');
                if (body) {
                    body.classList.remove('collapsed');
                    const toggle = section.querySelector('.feat-section-toggle');
                    if (toggle) toggle.textContent = '▼';
                }
            }
            return;
        }
    }

    // 全部验证通过，保存所有选择结果
    const resolved = character.featureSelections;

    // ===== 先清空本次待选项对应的旧数据，防止返回后再确认时重复叠加 =====
    // 遍历所有待选项，收集涉及到的 category，清空对应的 featureSelections 数组
    var categoriesToReset = new Set();
    character.pendingSelections.forEach(function(p) {
        if (p.category) categoriesToReset.add(p.category);
        if (p.type === 'proficiency') categoriesToReset.add('expertise');
    });
    categoriesToReset.forEach(function(cat) {
        switch (cat) {
            case 'class_extra': resolved.classExtra = []; break;
            case 'skills': resolved.skills = []; break;
            case 'tools': resolved.tools = []; break;
            case 'weapons': resolved.weapons = []; break;
            case 'spells': resolved.spells = []; break;
            case 'languages': resolved.languages = []; break;
            case 'armors': resolved.armors = []; break;
            case 'feats': resolved.feats = []; break;
            case 'expertise': resolved.expertise = []; break;
        }
    });
    // choose 类型的清除（涉及多个 category）
    character.pendingSelections.forEach(function(p) {
        if (p.type === 'choose' && p.categories) {
            p.categories.forEach(function(cat) {
                switch (cat.category) {
                    case 'skills': resolved.skills = []; break;
                    case 'tools': resolved.tools = []; break;
                    case 'weapons': resolved.weapons = []; break;
                    case 'spells': resolved.spells = []; break;
                    case 'languages': resolved.languages = []; break;
                    case 'feats': resolved.feats = []; break;
                }
            });
        }
    });

    character.pendingSelections.forEach((pending, idx) => {
        const state = window._allSelectionsState[idx];
        const selectedIds = state.selectedIds;

        selectedIds.forEach(id => {
            // 处理 proficiency 类型（专精选择）
            if (pending.type === 'proficiency') {
                if (!resolved.expertise) resolved.expertise = [];
                var expName = getSelectedName(pending, id);
                if (!expName) {
                    var expCand = pending.candidates.find(function(c) { return String(c.id) === String(id); });
                    expName = expCand ? (expCand.name || '') : '';
                }
                resolved.expertise.push({
                    id: parseInt(id) || id,
                    name: expName,
                    source: pending.source || 'unknown',
                    sourceLabel: pending.sourceLabel || pending.sourceName || '',
                    link: pending.link != null ? pending.link : null
                });
                return;
            }

            // 处理 choose 类型（多类组合选择）
            if (pending.type === 'choose') {
                const item = pending.candidates.find(c => String(c.id) === String(id));
                if (item) {
                    const origId = item._origId || item.id;
                    const baseInfo = {
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    };
                    if (item._category === 'skills') {
                        if (!resolved.skills) resolved.skills = [];
                        resolved.skills.push(Object.assign({}, baseInfo, { id: origId, name: item.name || '' }));
                    } else if (item._category === 'tools') {
                        resolved.tools.push(Object.assign({}, baseInfo, {
                            typeId: pending.categories.find(c => c.category === 'tools')?.typeId || 0,
                            toolId: origId,
                            name: item.name || ''
                        }));
                    } else if (item._category === 'weapons') {
                        resolved.weapons.push(Object.assign({}, baseInfo, {
                            typeId: pending.categories.find(c => c.category === 'weapons')?.typeId || 0,
                            weaponId: origId,
                            featureId: pending.featureId || 0,
                            name: item.name || ''
                        }));
                    } else if (item._category === 'spells') {
                        const cat = pending.categories.find(c => c.category === 'spells');
                        resolved.spells.push(Object.assign({}, baseInfo, {
                            classId: cat?.classId || 0,
                            lv: cat?.level || 0,
                            spellId: origId,
                            name: item.name || ''
                        }));
                    } else if (item._category === 'languages') {
                        if (!resolved.languages) resolved.languages = [];
                        resolved.languages.push(Object.assign({}, baseInfo, { id: origId, name: item.name || '' }));
                    } else if (item._category === 'feats') {
                        if (!resolved.feats) resolved.feats = [];
                        resolved.feats.push(Object.assign({}, baseInfo, {
                            typeId: pending.categories.find(c => c.category === 'feats')?.typeId || 0,
                            featId: origId,
                            name: item.name || ''
                        }));
                    }
                }
                return;
            }

            // 处理 code_choose 类型（code-handler 选择）
            // 保存用户选择到 character.codeSelections，供后续流程使用
            if (pending.type === 'code_choose') {
                const item = pending.candidates.find(c => String(c.id) === String(id));
                if (item) {
                    if (!character.codeSelections) character.codeSelections = {};
                    character.codeSelections[pending.codeName] = {
                        selectedIndex: item._optIndex,
                        label: item.name,
                        desc: item.desc || '',
                        rules: item._rules || '',
                        marker: item._marker || ''
                    };
                    // 如果选的是法术，同步到法术列表
                    if (item._category === 'spells' && item._origId != null) {
                        if (!character.selectedSpells) character.selectedSpells = [];
                        if (!character.selectedSpells.includes(item._origId)) {
                            character.selectedSpells.push(item._origId);
                        }
                        // 记录为锁定法术
                        if (!character.lockedSpells) character.lockedSpells = [];
                        if (!character.lockedSpells.includes(item._origId)) {
                            character.lockedSpells.push(item._origId);
                        }
                    }
                }
                return;
            }

            // 辅助函数：从待选项的 candidates 中找到选中项的名称
            function getSelectedName(pend, selId) {
                if (!pend.candidates) return '';
                var cand = pend.candidates.find(function(c) { return String(c.id) === String(selId); });
                return cand ? (cand.name || '') : '';
            }

            switch (pending.category) {
                case 'tools':
                    resolved.tools.push({
                        typeId: pending.typeId,
                        toolId: parseInt(id, 10) || id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'weapons':
                    resolved.weapons.push({
                        typeId: pending.typeId,
                        weaponId: parseInt(id, 10) || id,
                        featureId: pending.featureId || 0,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'spells':
                    resolved.spells.push({
                        classId: pending.classId,
                        lv: pending.level,
                        spellId: parseInt(id, 10) || id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'skills':
                    if (!resolved.skills) resolved.skills = [];
                    resolved.skills.push({
                        id: parseInt(id) || id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'languages':
                    if (!resolved.languages) resolved.languages = [];
                    resolved.languages.push({
                        id: parseInt(id) || id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'armors':
                    if (!resolved.armors) resolved.armors = [];
                    resolved.armors.push({
                        id: parseInt(id) || id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'feats':
                    if (!resolved.feats) resolved.feats = [];
                    resolved.feats.push({
                        typeId: pending.typeId,
                        featId: parseInt(id) || id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                case 'class_extra':
                    // 职业额外选项保存到 featureSelections.classExtra
                    if (!resolved.classExtra) resolved.classExtra = [];
                    resolved.classExtra.push({
                        classId: pending.classId,
                        groupName: pending.groupName,
                        extraId: id,
                        name: getSelectedName(pending, id),
                        source: pending.source || 'unknown',
                        sourceLabel: pending.sourceLabel || pending.sourceName || '',
                        link: pending.link != null ? pending.link : null
                    });
                    break;
                
            }
        });
    });

    // 清空待选队列（旧的待选已解决，但可能有嵌套选择需追加）
    character.pendingSelections = [];

    // ===== 检查嵌套选择：已选专长是否有自己的规则 =====
    // 如"巧匠"专长选了之后，还需要选 tool(type=66)+3（工具选择）
    // 如"音乐家"专长选了之后，还需要选 tool(type=67)+3（乐器选择）
    //
    // 使用 _processedFeatIds 跟踪已处理过的专长，防止无限循环。
    // 场景：用户确认主选择后，检查专长是否有嵌套选择（如魔法学徒专长需要选法术）。
    // 嵌套选择确认后，confirmAllSelections 再次执行，如果不用跟踪，
    // 相同专长会再次触发 addPendingSelectionsFromItem，导致无限循环无法进入下一步。
    if (resolved.feats && resolved.feats.length > 0) {
        if (!window._processedFeatIds) {
            window._processedFeatIds = new Set();
        }
        resolved.feats.forEach(featSel => {
            const featId = featSel.featId || featSel;
            // 已处理过的专长跳过，防止无限循环
            if (window._processedFeatIds.has(featId)) return;
            window._processedFeatIds.add(featId);

            const feat = (dataCache.feats || []).find(f => f.id === featId);
            if (feat) {
                addPendingSelectionsFromItem(feat);
            }
        });
    }

    // ===== 检查 code_choose 嵌套选择 =====
    // 用户选择了"奇术使Thaumaturge"后，还需额外选一个牧师戏法。
    // 选择了"术师Magician"后，还需额外选一个德鲁伊戏法。
    //
    // 使用 _processedCodeChoose 跟踪已处理过的 codeName，防止无限循环。
    // 场景：用户确认 code_choose 后，选中选项的 rules 可能触发新的选择。
    // 新选择确认后又走到这里，如果是同一个 codeName 就直接跳过。
    if (character.codeSelections) {
        if (!window._processedCodeChoose) {
            window._processedCodeChoose = {};
        }
        Object.keys(character.codeSelections).forEach(function(key) {
            if (window._processedCodeChoose[key]) return;
            window._processedCodeChoose[key] = true;

            var sel = character.codeSelections[key];
            if (!sel || !sel.label) return;
            var optEntry = (dataCache.classFeatures || []).find(function(f) { return f.name === sel.label; });
            if (optEntry && optEntry.rules) {
                addPendingSelectionsFromItem(optEntry);
            }
        });
    }

    // 如果有嵌套选择，重新渲染特性选择页面
    // 注意：嵌套选择完成后直接去原始目标步骤（如详情页14），避免回到review步骤造成循环
    if (character.pendingSelections && character.pendingSelections.length > 0) {
        window._allSelectionsState = {};
        renderFeatureSelectionStep(document.getElementById('stepContent'), window._nextStepAfterSelection || 14);
        return;
    }

    // ===== 同步法术选择到 character.selectedSpells =====
    // 让专长/背景选择的法术（如魔法学徒）在完成页的法术列表中正确显示
    if (resolved.spells && resolved.spells.length > 0) {
        if (!character.selectedSpells) character.selectedSpells = [];
        if (!character.lockedSpells) character.lockedSpells = [];
        resolved.spells.forEach(spellSel => {
            if (spellSel.spellId && !character.selectedSpells.includes(spellSel.spellId)) {
                character.selectedSpells.push(spellSel.spellId);
            }
            if (spellSel.spellId && !character.lockedSpells.includes(spellSel.spellId)) {
                character.lockedSpells.push(spellSel.spellId);
            }
        });
    }

    // ===== 同步技能选择到 character.allSkills =====
    // 让技能熟练在完成页的技能网格中正确显示
    // 兼容新旧格式：新格式为 { id, name, ... }，旧格式为纯数字ID
    if (resolved.skills && resolved.skills.length > 0) {
        const skillNames = resolved.skills.map(item => {
            var skillId = (item != null && typeof item === 'object') ? item.id : item;
            const skill = (dataCache.skills || []).find(s => String(s.id) === String(skillId));
            return skill ? skill.name : null;
        }).filter(Boolean);
        // 合并到已有的 allSkills 中（不重复）
        const existing = character.allSkills || [];
        skillNames.forEach(name => {
            if (!existing.includes(name)) {
                existing.push(name);
            }
        });
        character.allSkills = existing;
    }

    // 调试：打印本次确认保存的总数
    if (window.__DEBUG.confirm) {
        var totalItems = 0;
        Object.keys(resolved).forEach(function(k) { totalItems += (resolved[k] || []).length; });
        console.log('[确认保存] 共保存 ' + totalItems + ' 项选择, 待选队列剩余: ' + (character.pendingSelections ? character.pendingSelections.length : 0));
    }

    window._allSelectionsState = {};
    window._isInFeatureSelection = false;

    // 回到原来要去的下一步
    const nextStep = window._nextStepAfterSelection || currentStep;
    window._nextStepAfterSelection = null;
    currentStep = nextStep;
    renderStep(currentStep);
    updateProgress();
    updateButtons();
    document.getElementById('stepContent').scrollTop = 0;
}

/**
 * 获取选择标题
 * 如果选择项有 sourceName（来源名称），会在标题前加上「来源名-」
 * 例如：从"熟习"专长来的技能+工具选择 → 「（熟习）-技能、工匠工具（共选 3 项）」
 *       从"巧匠"专长来的工具选择 → 「（巧匠）-1个工匠工具」
 */