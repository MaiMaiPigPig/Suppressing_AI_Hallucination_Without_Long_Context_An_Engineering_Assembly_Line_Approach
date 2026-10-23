/**
 * creation/flow/navigation.js
 * 步骤导航：nextStep、prevStep、goToStep + 进度条/按钮更新
 */

import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { clearDataAfterStep } from '../../core/state/character-state.js';
import { renderStep } from './step-router.js';
import { isSpellStepSkippable } from '../../core/spells/spell-system.js';
import { getCurrentStep, setCurrentStep, getTotalSteps } from './lifecycle.js';
import { confirmAllSelections } from '../steps/13-review.js';
import { goUpgrade } from '../steps/16-export.js';

const TOTAL_STEPS = 16;

/**
 * 下一步
 */
export function nextStep() {
    let currentStep = getCurrentStep();

    // 验证当前步骤
    if (currentStep === 1 && !character.race) {
        alert('请先选择一个种族');
        return;
    }
    if (currentStep === 3 && !character.class) {
        alert('请先选择一个职业');
        return;
    }
    if (currentStep === 4 && !character.classPackage) {
        alert('请先选择职业套装');
        return;
    }
    if (currentStep === 5 && !character.background) {
        alert('请先选择一个背景');
        return;
    }
    if (currentStep === 6 && !character.bgPackage) {
        alert('请先选择背景套装');
        return;
    }
    if (currentStep === 7 && !character.abilities) {
        alert('请先完成基础属性分配');
        return;
    }
    if (currentStep === 8) {
        const bonus = character.backgroundBonus;
        if (!bonus || Object.values(bonus.bonus || {}).reduce((a, b) => a + b, 0) === 0) {
            alert('请分配背景属性加值');
            return;
        }
    }
    if (currentStep === 11 && !character.selectedFeat) {
        alert('请确认专长');
        return;
    }
    if (currentStep === 12) {
        const balance = getCurrencyCP();
        if (balance < 0) {
            alert('余额不足（负值），请减少购物车商品或调整货币');
            return;
        }
    }
    if (currentStep === 14 && (!character.name || !character.name.trim())) {
        alert('请填写角色名字');
        return;
    }

    if (currentStep < TOTAL_STEPS) {
        currentStep++;

        // 无亚种时自动跳过步骤2
        if (currentStep === 2) {
            const hasSubraces = character.race && (dataCache.races || []).filter(r => r.subrace === character.race.id && r.level <= character.level).length > 0;
            if (!hasSubraces) {
                currentStep++;
            }
        }

        // 无施法能力时自动跳过步骤11
        if (currentStep === 11 && isSpellStepSkippable()) {
            currentStep++;
        }

        setCurrentStep(currentStep);
        renderStep(currentStep);
        updateProgress();
        updateButtons();
        document.getElementById('stepContent').scrollTop = 0;
    }
}

/**
 * 上一步
 */
export function prevStep() {
    let currentStep = getCurrentStep();

    // 离开特性选择页时，恢复导航按钮状态
    window._isInFeatureSelection = false;
    window._processedFeatIds = undefined;

    if (currentStep > 1) {
        currentStep--;

        // 无亚种时自动跳过步骤2
        if (currentStep === 2) {
            const hasSubraces = character.race && (dataCache.races || []).filter(r => r.subrace === character.race.id && r.level <= character.level).length > 0;
            if (!hasSubraces) {
                currentStep--;
            }
        }

        // 无施法能力时自动跳过步骤11
        if (currentStep === 11 && isSpellStepSkippable()) {
            currentStep--;
        }

        setCurrentStep(currentStep);
        renderStep(currentStep);
        updateProgress();
        updateButtons();
        document.getElementById('stepContent').scrollTop = 0;
    }
}

/**
 * 跳转到指定步骤
 * @param {number} step
 */
export function goToStep(step) {
    let currentStep = getCurrentStep();

    // 离开特性选择页时，恢复导航按钮状态
    window._isInFeatureSelection = false;
    window._processedFeatIds = undefined;

    // 检查目标步骤是否被禁用
    const targetItem = document.querySelector(`.step-item[data-step="${step}"]`);
    if (targetItem && targetItem.classList.contains('disabled')) return;

    // 只允许跳转到已完成的步骤或当前步骤
    if (step <= currentStep) {
        setCurrentStep(step);
        renderStep(step);
        updateProgress();
        updateButtons();
        document.getElementById('stepContent').scrollTop = 0;
    }
}

/**
 * 更新进度条
 */
export function updateProgress() {
    const currentStep = getCurrentStep();
    const items = document.querySelectorAll('.step-item');
    const hasSubraces = character.race && (dataCache.races || []).filter(r => r.subrace === character.race.id && r.level <= character.level).length > 0;

    updateStepLabel(items, 1, character.race ? character.race.name : null);
    updateStepLabel(items, 2, character.subrace ? character.subrace.name : null);
    updateStepLabel(items, 3, character.class ? character.class.name : null);
    updateStepLabel(items, 5, character.background ? character.background.name : null);

    items.forEach(item => {
        const step = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed', 'disabled');

        if (step === 2 && character.race && !hasSubraces) {
            item.classList.add('disabled');
        }
        if (step === 11 && isSpellStepSkippable()) {
            item.classList.add('disabled');
        }

        if (step === currentStep) {
            item.classList.add('active');
        } else if (step < currentStep) {
            item.classList.add('completed');
        }
    });

    document.getElementById('stepIndicator').textContent =
        `第 ${currentStep} 步，共 ${TOTAL_STEPS} 步`;
}

/**
 * 更新步骤标签文字
 */
export function updateStepLabel(items, stepNum, selectedName) {
    const item = Array.from(items).find(el => parseInt(el.dataset.step) === stepNum);
    if (!item) return;
    const label = item.querySelector('.step-label');
    const defaultLabel = item.dataset.defaultLabel || '';
    if (label) {
        label.textContent = selectedName || defaultLabel;
    }
}

/**
 * 更新按钮状态
 */
export function updateButtons() {
    const currentStep = getCurrentStep();
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';

    if (currentStep === TOTAL_STEPS) {
        nextBtn.textContent = '⬆️ 升级';
        nextBtn.onclick = function() { goUpgrade(); };
        nextBtn.style.visibility = 'visible';
    } else if (window._isInFeatureSelection) {
        nextBtn.textContent = '下一步 →';
        nextBtn.onclick = function() { confirmAllSelections(); };
        nextBtn.style.visibility = 'visible';
    } else {
        nextBtn.textContent = '下一步 →';
        nextBtn.onclick = function() { nextStep(); };
        nextBtn.style.visibility = 'visible';
    }
}

// 获取货币总值（铜币单位）
function getCurrencyCP() {
    const c = character.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    return (c.pp || 0) * 1000 + (c.gp || 0) * 100 + (c.ep || 0) * 50 + (c.sp || 0) * 10 + (c.cp || 0);
}