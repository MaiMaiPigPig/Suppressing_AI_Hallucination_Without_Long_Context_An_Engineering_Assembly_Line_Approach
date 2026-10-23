// ===== review.js 入口 =====
// 本文件不承载实现，只做两件事：
//   1. 保持原对外接口（step-router.js / 其他模块的 import 路径无需改动）
//   2. 执行原文件里的顶层副作用（全局样式注入等）

// ===== 注入CSS样式 =====
(function() {
    if (document.getElementById('review-step-css')) return;
    const style = document.createElement('style');
    style.id = 'review-step-css';
    style.textContent = `
/* ===== 特性选择总览步骤 ===== */
.review-summary {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(201,168,76,0.25);
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
}
.review-summary-header {
    color: #4caf50;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.review-summary-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(76,175,80,0.2);
    border-radius: 50%;
    font-size: 1rem;
}
.review-summary-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.review-summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
}
.review-summary-label {
    color: #a89b8c;
    font-size: 0.9rem;
}
.review-summary-value {
    color: #f0e6d3;
    font-size: 0.9rem;
    font-weight: 500;
}

/* ===== 特性选择页布局 ===== */
.feature-selection-layout {
    display: flex;
    gap: 24px;
    min-height: 400px;
}
.feature-selection-left {
    flex: 0 0 60%;
    overflow-y: auto;
    max-height: 70vh;
}
.feature-selection-right {
    flex: 1;
    min-width: 300px;
}

/* 选择分组 */
.feat-section {
    background: rgba(0,0,0,0.15);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
}
.feat-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.04);
    cursor: pointer;
    user-select: none;
}
.feat-section-header:hover {
    background: rgba(255,255,255,0.07);
}
.feat-section-title {
    flex: 1;
    color: #c9a84c;
    font-size: 1rem;
    font-weight: 600;
}
.feat-section-count {
    color: #8a9b6e;
    font-size: 0.85rem;
    white-space: nowrap;
}
.feat-section-toggle {
    color: #a89b8c;
    font-size: 0.8rem;
    width: 16px;
    text-align: center;
}
.feat-section-body {
    padding: 10px 14px;
}
.feat-section-body.collapsed {
    display: none;
}
.feat-section-hint {
    color: #a89b8c;
    font-size: 0.8rem;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
}

/* 选择网格 */
.selection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
}

/* 选择项卡片 */
.selection-item {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
    transition: all 0.15s;
}
.selection-item:hover:not(.disabled):not(.selected) {
    border-color: rgba(201,168,76,0.4);
    background: rgba(201,168,76,0.08);
}
.selection-item.selected {
    border-color: #4caf50;
    background: rgba(76,175,80,0.12);
}
.selection-item.disabled {
    opacity: 0.45;
    cursor: default;
}
.selection-item.prereq-blocked {
    opacity: 0.35;
    cursor: not-allowed;
}
.selection-item-name {
    color: #f0e6d3;
    font-size: 0.88rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}
.selection-item-desc {
    color: #a89b8c;
    font-size: 0.78rem;
    margin-top: 4px;
    line-height: 1.4;
}

/* 禁用提示标签 */
.disabled-hint {
    font-size: 0.75rem;
    font-weight: 400;
    color: #8a9b6e;
}
.disabled-hint.previous-step {
    color: #8a9b6e;
}
.disabled-hint.current-page {
    color: #c9a84c;
}

/* 详情面板 */
.detail-panel {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 16px;
    position: sticky;
    top: 10px;
    max-height: 70vh;
    overflow-y: auto;
}
.detail-panel-placeholder {
    color: #666;
    text-align: center;
    padding: 40px 0;
    font-size: 0.9rem;
}
.detail-panel-content {
    color: #f0e6d3;
}
.detail-panel-title {
    color: #c9a84c;
    font-size: 1.1rem;
    margin-bottom: 4px;
}
.detail-panel-type {
    color: #a89b8c;
    font-size: 0.8rem;
    margin-bottom: 12px;
}
.detail-panel-desc {
    color: #ccc;
    font-size: 0.88rem;
    line-height: 1.5;
}

/* 空提示 */
.empty-hint {
    color: #666;
    text-align: center;
    padding: 16px;
    font-size: 0.85rem;
}

/* 完成页底部按钮区 */
.feature-selection-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
}
.feature-selection-footer-hint {
    color: #a89b8c;
    font-size: 0.85rem;
}
`;
    document.head.appendChild(style);
})();

// window 桥接：评审总览页底部按钮与汇总面板由动态 HTML 内联事件调用

export { renderReviewStep, renderReviewComplete, buildSelectionSummary, confirmReviewComplete } from './13-review-main.js';
export { restoreSavedSelectionsToState, collectAllSources, collectSelectionsFromSource, collectClassExtraSelections, findInAllTables, translatePrereq, getAllClassFeatures } from './13-review-collector.js';
// 从 09-feature-selection 迁移来的函数，对外入口统一
export { renderFeatureSelectionStep, updateAllSelectionsUI, showItemDetail, confirmAllSelections } from './13-review-engine.js';
export { addPendingSelectionsFromItem, hasPendingSelections, clearAllPendingSelections } from './13-review-utils.js';
export { getSelectionTitle, collectAllAlreadySelectedIds, checkPrerequisite, renderSelectionItems } from './13-review-renderer.js';