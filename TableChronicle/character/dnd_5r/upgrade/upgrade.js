import { loadData } from '../core/data/loader.js';
import { renderStep } from './flow/step-router.js';
import { loadCharacterFromJSON } from './flow/lifecycle.js';
import {
    nextStep,
    prevStep,
    goToStep,
    goBackToCharacter
} from './flow/navigation.js';
import { importCharacter, continueUpgrade } from './flow/lifecycle.js';
import {
    exportUpgradedCharacter,
    exportUpgradePDF
} from './steps/export-update.js';
import {
    upgradeToggleSpell,
    startReplace,
    confirmReplace,
    cancelReplace,
    upgradePreparedToggle,
    upgradeSpellbookAdd,
    upgradeSpellbookAddExtra,
    previewUpgradeSpell
} from './steps/spell-update-interactions.js';
import { closeSelectionModal, confirmSelectionModal } from '../creation/ui/selection-modal.js';

// 暴露内联 onclick handler 到全局作用域
Object.assign(window, {
    nextStep,
    prevStep,
    goToStep,
    goBackToCharacter,
    importCharacter,
    continueUpgrade,
    exportUpgradedCharacter,
    exportUpgradePDF,
    upgradeToggleSpell,
    startReplace,
    confirmReplace,
    cancelReplace,
    upgradePreparedToggle,
    upgradeSpellbookAdd,
    upgradeSpellbookAddExtra,
    previewUpgradeSpell,
    closeSelectionModal,
    confirmSelectionModal
});

// ===== 重置按钮 =====
$('#resetBtn').on('click', function () {
    if (confirm('确定要重置吗？所有未保存的数据将丢失。')) {
        location.reload();
    }
});

// ===== 页面初始化 =====
$(async function () {
    await loadData(['phb']);
    console.log('[升级] 初始化完成');

    // 尝试从 sessionStorage 读取角色数据（从车卡页面跳转过来的）
    var savedData = sessionStorage.getItem('upgrade_character_data');
    if (savedData) {
        try {
            var data = JSON.parse(savedData);
            sessionStorage.removeItem('upgrade_character_data');
            loadCharacterFromJSON(data);
            return;
        } catch (e) {
            console.warn('[升级] sessionStorage 数据读取失败', e);
        }
    }
    // 如果没有缓存数据，显示导入页
    renderStep(0);
});