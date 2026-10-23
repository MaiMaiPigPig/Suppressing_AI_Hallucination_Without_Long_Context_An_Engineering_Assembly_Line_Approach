/**
 * creation/flow/step-router.js
 * 步骤渲染路由表 + 辅助函数
 */

import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { renderRaceStep, renderSubraceStep } from '../steps/01-race.js';
import { renderClassStep } from '../steps/03-class.js';
import { renderPackageStep } from '../steps/04-class-package.js';
import { renderBackgroundStep } from '../steps/05-background.js';
import { renderBackgroundPackageStep } from '../steps/06-background-package.js';
import { renderAbilityStep } from '../steps/07-ability.js';
import { renderBackgroundBonusStep } from '../steps/08-bonus.js';
import { renderSkillStep } from '../steps/09-skill.js';
import { renderFeatStep } from '../steps/10-feat.js';
import { renderSpellStep } from '../steps/11-spells.js';
import { renderShoppingStep } from '../steps/12-shopping.js';
import { renderReviewStep } from '../steps/13-review.js';
import { renderDetailsStep } from '../steps/14-details.js';
import { renderCharacterSheet } from '../steps/15-sheet.js';
import { renderExportStep } from '../steps/16-export.js';

/**
 * 渲染指定步骤
 * @param {number} step - 步骤编号（1-16）
 * @param {HTMLElement} container - 渲染容器（可选）
 * @throws {Error} 步骤渲染函数内部抛出的异常会向上冒泡，由 app.js 的统一错误处理捕获并显示"数据加载失败"页，
 *                 常见原因是对应步骤的候选数据缺失（如未选职业就进入法术步骤）。
 */
export function renderStep(step, container) {
    const c = container || document.getElementById('stepContent');
    switch (step) {
        case 1: renderRaceStep(c); break;
        case 2: renderSubraceStep(c); break;
        case 3: renderClassStep(c); break;
        case 4: renderPackageStep(c); break;
        case 5: renderBackgroundStep(c); break;
        case 6: renderBackgroundPackageStep(c); break;
        case 7: renderAbilityStep(c); break;
        case 8: renderBackgroundBonusStep(c); break;
        case 9: renderSkillStep(c); break;
        case 10: renderFeatStep(c); break;
        case 11: renderSpellStep(c); break;
        case 12: renderShoppingStep(c); break;
        case 13: renderReviewStep(c); break;
        case 14: renderDetailsStep(c); break;
        case 15: renderCharacterSheet(c); break;
        case 16: renderExportStep(c); break;
    }
}

/**
 * 从所有已选套装和背景提取金额，自动填入货币栏
 */
export function fillCurrencyFromPackage() {
    let pp = 0, gp = 0, sp = 0, cp = 0;

    if (character.classPackage) {
        const content = character.classPackage.desc || '';
        const ppMatch = content.match(/(\d+)\s*(?:PP|pp|铂金币)/);
        const gpMatch = content.match(/(\d+)\s*(?:GP|gp|金币)/);
        const spMatch = content.match(/(\d+)\s*(?:SP|sp|银币)/);
        const cpMatch = content.match(/(\d+)\s*(?:CP|cp|铜币)/);
        if (ppMatch) pp += parseInt(ppMatch[1]);
        if (gpMatch) gp += parseInt(gpMatch[1]);
        if (spMatch) sp += parseInt(spMatch[1]);
        if (cpMatch) cp += parseInt(cpMatch[1]);
    }

    if (character.bgPackage) {
        const content = character.bgPackage.desc || '';
        const ppMatch = content.match(/(\d+)\s*(?:PP|pp|铂金币)/);
        const gpMatch = content.match(/(\d+)\s*(?:GP|gp|金币)/);
        const spMatch = content.match(/(\d+)\s*(?:SP|sp|银币)/);
        const cpMatch = content.match(/(\d+)\s*(?:CP|cp|铜币)/);
        if (ppMatch) pp += parseInt(ppMatch[1]);
        if (gpMatch) gp += parseInt(gpMatch[1]);
        if (spMatch) sp += parseInt(spMatch[1]);
        if (cpMatch) cp += parseInt(cpMatch[1]);
    }

    document.getElementById('platinum') && (document.getElementById('platinum').value = pp);
    document.getElementById('gold') && (document.getElementById('gold').value = gp);
    document.getElementById('electrum') && (document.getElementById('electrum').value = 0);
    document.getElementById('silver') && (document.getElementById('silver').value = sp);
    document.getElementById('copper') && (document.getElementById('copper').value = cp);

    character.currency = { pp, gp, ep: 0, sp, cp };
}

export function getSkillName(id) {
    var s = (dataCache.skills || []).find(function(sk) { return sk.id === Number(id); });
    return s ? s.name : String(id);
}

export function formatAbilityDisplay(value) {
    if (!value && value !== 0) return '';
    var str = String(value);
    if (str.indexOf('|') >= 0) {
        return str.split('|').map(function(id) { return getSkillName(id); }).join('或');
    } else if (str.indexOf(',') >= 0) {
        return str.split(',').map(function(id) { return getSkillName(id); }).join('和');
    } else {
        return getSkillName(str);
    }
}

// window 桥接：供步骤文件中通过 window.getSkillName 调用
window.getSkillName = getSkillName;
window.formatAbilityDisplay = formatAbilityDisplay;
window.fillCurrencyFromPackage = fillCurrencyFromPackage;