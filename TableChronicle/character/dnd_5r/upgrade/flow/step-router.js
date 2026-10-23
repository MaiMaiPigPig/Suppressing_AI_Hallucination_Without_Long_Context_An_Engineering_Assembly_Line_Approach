import { renderImportStep } from './lifecycle.js';
import { renderOverviewStep, renderFeaturesStep, renderSubclassStep } from '../steps/level-select.js';
import { renderSelectionsStep } from '../steps/feature-select.js';
import { renderUpgradeSheetStep } from '../steps/sheet-update.js';
import { renderExportStep } from '../steps/export-update.js';
import { updateProgress, updateStepIndicator, updateNavButtons } from './navigation.js';

// ===== upgrade/flow/step-router.js =====
// 升级步骤路由：按步骤号分发到对应渲染函数。

// ===== 渲染步骤 =====
function renderStep(step) {
    const stepName = ['导入角色','升级概览','子职选择','新增特性','选择确认','角色详情','保存导出'][step] || '未知';
    console.log('[升级] 切换到步骤 %d: %s', step, stepName);

    const $content = $('#stepContent');

    updateProgress(step);
    updateStepIndicator(step);
    updateNavButtons(step);

    // 非角色卡步骤：移除 sheet-active 类，恢复 step-content 默认滚动
    if (step !== 5) {
        $('#stepContent').removeClass('sheet-active');
    }
    // 非子职选择步骤：移除 subclass-active 类
    if (step !== 2) {
        $('#stepContent').removeClass('subclass-active');
    }
    switch (step) {
        case 0: renderImportStep($content); break;
        case 1: renderOverviewStep($content); break;
        case 2: renderSubclassStep($content); break;
        case 3: renderFeaturesStep($content); break;
        case 4: renderSelectionsStep($content); break;
        case 5: renderUpgradeSheetStep($content); break;
        case 6: renderExportStep($content); break;
    }
}

export { renderStep };