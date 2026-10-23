import { upgradeState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { renderCharacterSheet } from '../../creation/steps/15-sheet.js';

// ===== upgrade/steps/sheet-update.js =====
// 升级角色卡：用升级后的法术列表渲染角色详情。

// 第2步：角色详情 — 复用完整车卡渲染
// ============================================================
function renderUpgradeSheetStep($content) {
    $('#stepContent').addClass('sheet-active');

    // 临时用升级后的法术列表渲染角色详情，渲染完恢复
    const origSelected = character.selectedSpells;
    try {
        character.selectedSpells = getUpgradedSpellIds();
        renderCharacterSheet($content[0]);
    } finally {
        character.selectedSpells = origSelected;
    }
}

// ============================================================
// 第3步：保存导出 + 继续升级
// ============================================================

// ============================================================
// 计算升级后的法术 ID 列表（原始已选 - 移除 + 新增法术 + 新增戏法）
function getUpgradedSpellIds() {
    const original = character.selectedSpells || [];
    const removed = upgradeState._upgradeRemovedSpells || [];
    const newSpells = upgradeState._upgradeNewSpells || [];
    const newCantrips = upgradeState._upgradeNewCantrips || [];

    const merged = [
        ...original.filter(id => !removed.includes(id)),
        ...newSpells,
        ...newCantrips
    ];
    return [...new Set(merged)];
}

export {
    renderUpgradeSheetStep,
    getUpgradedSpellIds
};