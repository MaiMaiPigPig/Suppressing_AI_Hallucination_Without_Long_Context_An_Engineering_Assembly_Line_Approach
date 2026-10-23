/**
 * creation/app.js
 * 车卡入口：加载数据 + 初始化流程
 */

import { loadData } from '../core/data/loader.js';
import { dataCache, _fullDataCache } from '../core/data/cache.js';
import { character, resetCharacter } from '../core/state/character-model.js';
import { renderStartStep, setCurrentStep } from './flow/lifecycle.js';
import { prevStep, goToStep, updateProgress, updateButtons } from './flow/navigation.js';
import { updateCurrency } from './ui/currency-input.js';
import { closeSelectionModal, confirmSelectionModal } from './ui/selection-modal.js';
import { renderStep, formatAbilityDisplay } from './flow/step-router.js';
import { resetUnbind } from '../core/state/character-state.js';
import { clearAllPendingSelections } from './steps/13-review.js';

window.renderStep = renderStep;
window.formatAbilityDisplay = formatAbilityDisplay;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();

        // 检查是否是从升级页返回
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('loadFromSession') === '1') {
            var savedData = sessionStorage.getItem('upgrade_character_data');
            if (savedData) {
                try {
                    var data = JSON.parse(savedData);
                    // 动态导入 lifecycle 中的 loadCharacterFromJSON
                    const { loadCharacterFromJSON } = await import('./flow/lifecycle.js');
                    loadCharacterFromJSON(data);
                    return;
                } catch (e) {
                    console.warn('[车卡] 从 sessionStorage 加载角色数据失败', e);
                }
            }
        }

        // 显示欢迎页
        renderStartStep(document.getElementById('stepContent'));
        document.getElementById('stepProgress').style.display = 'none';
        document.getElementById('prevBtn').style.visibility = 'hidden';
        document.getElementById('nextBtn').style.visibility = 'hidden';
        document.getElementById('stepIndicator').style.display = 'none';
        setCurrentStep(0);

        // 事件委托：进度条步骤点击
        document.getElementById('stepProgress').addEventListener('click', (e) => {
            const stepEl = e.target.closest('[data-step]');
            if (stepEl) {
                const step = parseInt(stepEl.dataset.step, 10);
                goToStep(step);
            }
        });

        // 底部导航按钮
        document.getElementById('prevBtn').addEventListener('click', prevStep);

        // 弹窗事件委托
        document.getElementById('selectionModalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'selectionModalOverlay') {
                closeSelectionModal();
            }
        });
        document.getElementById('selectionModalClose').addEventListener('click', closeSelectionModal);
        document.getElementById('selectionModalCancel').addEventListener('click', closeSelectionModal);
        document.getElementById('selectionModalConfirm').addEventListener('click', confirmSelectionModal);

    } catch (err) {
        document.getElementById('stepContent').innerHTML = `
            <div class="error-msg">
                <h3>⚠️ 数据加载失败</h3>
                <p>${err.message}</p>
                <button onclick="location.reload()" class="btn btn-primary">重试</button>
            </div>`;
    }
});

// 重置按钮
document.getElementById('resetBtn')?.addEventListener('click', async () => {
    if (confirm('确定要重置所有数据吗？')) {
        resetCharacter();
        window._isInFeatureSelection = false;
        window._nextStepAfterSelection = null;
        window._allSelectionsState = {};
        window._processedFeatIds = undefined;
        character._visitedChainIds = undefined;
        setCurrentStep(1);
        resetUnbind();

        clearAllPendingSelections();

        renderStep(1);
        updateProgress();
        updateButtons();

        document.getElementById('platinum') && (document.getElementById('platinum').value = 0);
        document.getElementById('gold') && (document.getElementById('gold').value = 0);
        document.getElementById('electrum') && (document.getElementById('electrum').value = 0);
        document.getElementById('silver') && (document.getElementById('silver').value = 0);
        document.getElementById('copper') && (document.getElementById('copper').value = 0);
    }
});