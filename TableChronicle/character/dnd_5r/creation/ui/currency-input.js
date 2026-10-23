/**
 * creation/ui/currency-input.js
 * 货币输入更新
 */

import { character } from '../../core/state/character-model.js';

/**
 * 从输入框更新 character.currency
 */
export function updateCurrency() {
    character.currency = {
        pp: parseInt(document.getElementById('platinum')?.value) || 0,
        gp: parseInt(document.getElementById('gold')?.value) || 0,
        ep: parseInt(document.getElementById('electrum')?.value) || 0,
        sp: parseInt(document.getElementById('silver')?.value) || 0,
        cp: parseInt(document.getElementById('copper')?.value) || 0
    };
}