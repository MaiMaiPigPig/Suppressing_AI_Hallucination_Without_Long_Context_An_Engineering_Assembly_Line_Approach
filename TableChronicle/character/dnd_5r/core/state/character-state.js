/**
 * core/state/character-state.js
 * 角色状态操作：clearDataAfterStep、unbind 管理
 */

import { character } from './character-model.js';
import { STEP_DATA_FIELDS, UPGRADE_STEP_DATA_FIELDS } from '../constants/character-constants.js';

// 解绑开关
export let unbind = {
    classSkill: false,
    bgSkill: false,
    bonus: false,
    feat: false
};

/**
 * 重置解绑开关
 */
export function resetUnbind() {
    unbind = { classSkill: false, bgSkill: false, bonus: false, feat: false };
}

/**
 * 清除指定步骤之后的所有角色数据
 * 当用户返回前面的页面并修改内容时，后面页面的数据需要清空
 * @param {number} step - 当前操作的步骤号（将清除该步骤之后的数据）
 * @param {string} mode - 模式：'creation' 或 'upgrade'，默认 'creation'
 */
export function clearDataAfterStep(step, mode = 'creation') {
    // 清除全局状态
    if (typeof window !== 'undefined') {
        window._isInFeatureSelection = false;
        window._nextStepAfterSelection = null;
        window._allSelectionsState = {};
        window._processedFeatIds = undefined;
    }
    if (character) {
        character._visitedChainIds = undefined;
    }

    const mapping = mode === 'upgrade' ? UPGRADE_STEP_DATA_FIELDS : STEP_DATA_FIELDS;
    const maxStep = mode === 'upgrade' ? 6 : 17;

    for (let s = step + 1; s <= maxStep; s++) {
        const fields = mapping[s] || [];
        for (const field of fields) {
            if (field === 'pendingSelections') {
                character.pendingSelections = [];
            } else if (field === 'featureSelections') {
                character.featureSelections = { tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: [] };
            } else if (field === 'currency') {
                character.currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
            } else if (field === 'classSkills' || field === 'backgroundSkills' || field === 'allSkills' || field === 'selectedSpells' || field === 'lockedSpells' || field === 'shoppingItems' || field === 'selectedLanguages') {
                character[field] = [];
            } else if (field === 'abilities' || field === 'backgroundBonus' || field === 'selectedFeat' || field === 'classPackage' || field === 'bgPackage') {
                character[field] = null;
            } else if (field === 'race' || field === 'subrace' || field === 'class' || field === 'subclass' || field === 'background') {
                character[field] = null;
            } else if (field === 'name' || field === 'player' || field === 'alignment' || field === 'personalTraits' || field === 'ideals' || field === 'bonds' || field === 'flaws' || field === 'backstory') {
                character[field] = '';
            } else if (field === 'level') {
                character[field] = 1;
            } else {
                character[field] = undefined;
            }
        }
    }
}