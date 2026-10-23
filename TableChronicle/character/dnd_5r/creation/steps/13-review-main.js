/**
 * creation/steps/review-main.js
 * 特性总览步骤的主流程：渲染总览页、汇总面板、确认完成。
 *
 * 由设计-v0.4-004-001 从 review.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { getSubclassFeatures, parseProficiencyLinkIds } from '../../handlers/data-query.js';
import { escapeHtml } from '../../utils/html.js';
import { hasPendingSelections, renderFeatureSelectionStep } from './13-review.js';
import { collectAllSources, collectSelectionsFromSource, getAllClassFeatures } from './13-review-collector.js';
import { getFeatureProficiencyValues } from './15-sheet.js';
// window 桥接：评审总览页底部按钮与汇总面板由动态 HTML 内联事件调用
window.buildSelectionSummary = buildSelectionSummary;

window.confirmReviewComplete = confirmReviewComplete;

/**
 * 渲染特性选择总览步骤
 * 收集所有已选来源的全部特性，提取所有待选项目，集中展示
 */
export async function renderReviewStep(container) {
    // 1. 收集所有来源
    const sources = collectAllSources();

    // 2. 清空旧的待选队列和选择状态，重新收集（保留已有 featureSelections 结果）
    character.pendingSelections = [];
    character._visitedChainIds = [];
    character._processedBasicItems = undefined; // 重置 basic 规则防重复跟踪，允许重新应用
    window._allSelectionsState = {};
    window._processedFeatIds = undefined; // 重置专长嵌套处理跟踪，允许重新处理嵌套选择

    // 3. 逐个处理来源，递归收集所有待选项目
    try {
        for (const source of sources) {
            await collectSelectionsFromSource(source, new Set());
        }
    } catch (err) {
        console.error('[renderReviewStep] 处理来源时出错:', err);
    }

    // 4. 重置 visited 状态，避免影响后续流程
    character._visitedChainIds = undefined;

    // 5. [已移除] restoreSavedSelectionsToState() 不再在这里调用
    //    改为在 renderFeatureSelectionStep 中加载完 candidates 后再恢复，
    // 这样可以利用 candidates 列表做精确检查，避免恢复自动添加的项

    // 6. 渲染结果
    if (hasPendingSelections()) {
        // 直接在特性总览步骤中渲染特性选择页，选择完成后自动进入详情步骤（14）
        await renderFeatureSelectionStep(container, 14);
        // 修改标题，告知用户当前在特性总览
        const titleEl = container.querySelector('.step-title h2');
        if (titleEl) titleEl.textContent = '特性选择总览';
        const descEl = container.querySelector('.step-title p');
        if (descEl) descEl.textContent = '已汇总所有来源的特性，请完成以下所有选择';
        // 更新进度条显示当前在总览步骤
        currentStep = 13;
        updateProgress();
        updateButtons();
    } else {
        renderReviewComplete(container);
    }
}

/**
 * 从已保存的 featureSelections 恢复选择状态到 _allSelectionsState
 * 当用户从角色详情页（步骤14）返回特性总览（步骤13）时，
 * featureSelections 中还保留着上一轮已确认的选择数据，
 * 需要将其映射回 _allSelectionsState，确保：
 *   1. 进度条显示正确的已选数
 *   2. 已选项在 UI 中正确标记为绿色选中状态
 *   3. 选项仍可操作（非禁用），因为返回后用户可以修改选择
 *
 * 匹配策略：遍历 pendingSelections 中的每个待选项，根据 category 和 groupName
 * 去 featureSelections 中找到对应的已选条目，将 ID 填入 _allSelectionsState
 */

/**
 * 无待选项目时显示总览完成页
 */
export function renderReviewComplete(container) {
    // 收集已选内容的摘要信息
    const summary = buildSelectionSummary();

    // 收集职业特性中的自动资源数值（proficiency_link）
    var profResourcesHtml = '';
    if (character.class && dataCache.classFeatures) {
        var cls = character.class;
        var allClassFeatures = [];
        // 收集所有等级的职业特性
        for (var lvl = 1; lvl <= (character.level || 1); lvl++) {
            var lvlFeats = getAllClassFeatures(cls, lvl);
            lvlFeats.forEach(function(f) { allClassFeatures.push(f); });
            if (character.subclass) {
                var subFeats = getSubclassFeatures(character.subclass.class_id, character.subclass.id, lvl);
                subFeats.forEach(function(f) { allClassFeatures.push(f); });
            }
        }
        // 筛选有 proficiency_link 的特性
        var linkedFeatures = allClassFeatures.filter(function(f) {
            return parseProficiencyLinkIds(f.proficiency_link).length > 0;
        });
        if (linkedFeatures.length > 0) {
            // 使用 sheet.js 中的 getFeatureProficiencyValues（如果可用）
            var profItems = [];
            linkedFeatures.forEach(function(f) {
                var vals = (typeof getFeatureProficiencyValues === 'function') ? getFeatureProficiencyValues(f) : null;
                if (vals && vals.length > 0) {
                    vals.forEach(function(v) {
                        var displayVal = v.value;
                        if (v.label.indexOf('伤害') !== -1 && displayVal.indexOf('+') !== 0 && displayVal.indexOf('-') !== 0) {
                            displayVal = '+' + displayVal;
                        }
                        profItems.push({
                            featureName: f.name,
                            label: v.label,
                            value: displayVal + (v.unit || '')
                        });
                    });
                }
            });
            if (profItems.length > 0) {
                profResourcesHtml = '<div class="review-summary" style="margin-top:12px;">' +
                    '<div class="review-summary-header" style="color:#c9a84c;font-size:0.95rem;">' +
                    '<span class="review-summary-icon" style="background:rgba(201,168,76,0.2);color:#c9a84c;">⚡</span>' +
                    '自动资源数值' +
                    '</div>' +
                    '<div class="review-summary-list">' +
                    profItems.map(function(item) {
                        return '<div class="review-summary-item">' +
                            '<span class="review-summary-label">' + escapeHtml(item.featureName) + ' — ' + escapeHtml(item.label) + '</span>' +
                            '<span class="review-summary-value" style="color:#c9a84c;">' + escapeHtml(item.value) + '</span>' +
                            '</div>';
                    }).join('') +
                    '</div>' +
                    '</div>';
            }
        }
    }

    container.innerHTML = `
        <div class="step-container">
            <div class="step-title">
                <h2>特性选择总览</h2>
                <p>所有特性已处理完毕，无需额外选择</p>
            </div>

            <div class="review-summary">
                <div class="review-summary-header">
                    <span class="review-summary-icon">✓</span>
                    所有特性规则已自动处理
                </div>
                <div class="review-summary-list">
                    ${summary.map(item => `
                        <div class="review-summary-item">
                            <span class="review-summary-label">${item.label}</span>
                            <span class="review-summary-value">${item.value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${profResourcesHtml}

            <div class="feature-selection-footer">
                <div class="feature-selection-footer-hint">
                    确认无误后，点击下方按钮继续
                </div>
                <button class="btn btn-primary" onclick="confirmReviewComplete()">
                    进入角色详情 →
                </button>
            </div>
        </div>
    `;
}

/**
 * 构建已选内容摘要
 */

/**
 * 构建已选内容摘要
 */
export function buildSelectionSummary() {
    const summary = [];

    // 种族
    if (character.race) {
        summary.push({ label: '种族', value: character.race.name || '未选择' });
    }
    // 亚种
    if (character.subrace) {
        summary.push({ label: '亚种', value: character.subrace.name || '未选择' });
    }
    // 职业
    if (character.class) {
        summary.push({ label: '职业', value: character.class.name || character.class.class || '未选择' });
    }
    // 背景
    if (character.background) {
        summary.push({ label: '背景', value: character.background.name || '未选择' });
    }
    // 已选专长
    if (character.selectedFeat) {
        const feat = (dataCache.feats || []).find(f => f.id === character.selectedFeat);
        if (feat) summary.push({ label: '专长', value: feat.name || '未选择' });
    }
    // 技能熟练
    if (character.allSkills && character.allSkills.length > 0) {
        summary.push({ label: '技能熟练', value: character.allSkills.length + ' 项' });
    }
    // 法术
    if (character.selectedSpells && character.selectedSpells.length > 0) {
        summary.push({ label: '法术', value: character.selectedSpells.length + ' 个' });
    }

    if (summary.length === 0) {
        summary.push({ label: '状态', value: '暂无已选数据' });
    }

    return summary;
}

/**
 * 确认总览完成，进入详情页
 */

/**
 * 确认总览完成，进入详情页
 */
export function confirmReviewComplete() {
    currentStep = 14; // 详情步骤
    renderStep(currentStep);
    updateProgress();
    updateButtons();
    document.getElementById('stepContent').scrollTop = 0;
}

// ===== 注入CSS样式 =====