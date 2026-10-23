import { upgradeState, stepState } from '../core.js';
import { character } from '../../core/state/character-model.js';
import { dataCache } from '../../core/data/cache.js';
import { renderStep } from './step-router.js';
import { calculateLevelGains } from '../steps/level-select.js';
import { applyUpgradeSelections } from '../steps/selection-apply.js';
import { getProfBonus } from '../../handlers/data-query.js';

// ===== upgrade/flow/lifecycle.js =====
// 升级生命周期：导入角色、读档、等级收益准备、继续升级。

// ============================================================
// 第0步：导入角色
// ============================================================
function renderImportStep($content) {
    const hasCharacter = character.class !== null || character.name !== '';
    const cls = character.class;
    const race = character.subrace || character.race;

    $content.html(`
        <div class="upgrade-welcome">
            <div class="upgrade-header">
                <div class="level-icon">⬆️</div>
                <h2>角色升级系统</h2>
                <p class="subtitle">导入已有角色存档，逐级提升等级</p>
            </div>
            <div class="upgrade-actions">
                <div class="upgrade-card" onclick="importCharacter()">
                    <div class="upgrade-card-icon">📂</div>
                    <div class="upgrade-card-title">导入角色</div>
                    <div class="upgrade-card-desc">从 JSON 存档中载入已有角色</div>
                </div>
                <div class="upgrade-card${hasCharacter ? '' : ' disabled'}" onclick="${hasCharacter ? 'goToStep(1)' : ''}">
                    <div class="upgrade-card-icon">⬆️</div>
                    <div class="upgrade-card-title">开始升级</div>
                    <div class="upgrade-card-desc">${hasCharacter ? `从 ${character.level} 级开始` : '请先导入角色'}</div>
                </div>
            </div>
            ${hasCharacter ? `
            <div class="imported-character">
                <div class="char-name">${character.name || '未命名角色'}</div>
                <div class="char-detail">
                    <span class="char-detail-item">🏷️ ${cls ? cls.name : '-'}</span>
                    <span class="char-detail-item">🧬 ${race ? race.name : '-'}</span>
                    <span class="char-detail-item">📖 ${character.background ? character.background.name : '-'}</span>
                    <span class="char-detail-item"><strong>等级 ${character.level}</strong></span>
                </div>
            </div>
            ` : ''}
        </div>
    `);
}

/**
 * 翻译：拿到「本次升级」的收益数据（HP、特性、法术位、待选项……）。
 *
 * 关键点：升级信息只在这里算一次，然后缓存进 upgradeState。
 * 以前只有「升级概览」那一页会算，后面几页全靠这一页的副作用拿数据；
 * 一旦用户直接点进度条跳到「特性总览」，数据就是空的，
 * 页面会悄悄退回成「升级概览」的样子 —— 看起来就是"特性名字有、描述没有"。
 *
 * @param {number} [targetLevel] - 翻译：要算到几级；不传就用当前目标等级
 * @returns {object} - 翻译：本次升级的收益数据
 */

// ============================================================
// 导入角色
// ============================================================
function importCharacter() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                loadCharacterFromJSON(data);
            } catch (err) {
                alert('导入失败：JSON 格式错误\n' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function loadCharacterFromJSON(data) {
    console.log('[升级] 加载角色数据:', data.name || '未命名', 'Lv.' + (data.level || '?'));

    const findById = (list, id) => list.find(item => item.id === id);

    character.race = findById(dataCache.races || [], data.raceId);
    character.subrace = findById(dataCache.races || [], data.subraceId);
    character.class = findById(dataCache.classes || [], data.classId);
    character.subclass = findById(dataCache.subclasses || [], data.subclassId);
    character.background = findById(dataCache.backgrounds || [], data.backgroundId);
    character.abilities = data.abilities || null;
    if (character.abilities && typeof character.abilities === 'object') {
        let abCopy = {};
        Object.keys(character.abilities).forEach(k => {
            let id = Number(k);
            if (isNaN(id)) {
                let s = (dataCache.skills || []).find(sk => sk.name === k);
                id = s ? s.id : k;
            }
            abCopy[id] = character.abilities[k];
        });
        character.abilities = abCopy;
    }
    character.classSkills = data.classSkills || [];
    character.backgroundSkills = data.backgroundSkills || [];
    character.allSkills = data.allSkills || [];
    character.backgroundBonus = data.backgroundBonus || null;
    if (character.backgroundBonus && character.backgroundBonus.bonus) {
        let bbCopy = {};
        Object.keys(character.backgroundBonus.bonus).forEach(k => {
            let id = Number(k);
            if (isNaN(id)) {
                let s = (dataCache.skills || []).find(sk => sk.name === k);
                id = s ? s.id : k;
            }
            bbCopy[id] = character.backgroundBonus.bonus[k];
        });
        character.backgroundBonus.bonus = bbCopy;
    }
    character.featureSelections = data.featureSelections || { tools: [], weapons: [], spells: [], languages: [], armors: [], feats: [], skills: [], expertise: [], classExtra: [] };
    character.selectedFeat = data.selectedFeat;
    character.selectedSpells = data.selectedSpells || [];
    character.lockedSpells = data.lockedSpells || [];
    character.classExtraAll = data.classExtraAll || [];
    character.classPackage = data.classPackage ? findById(dataCache.packages || [], data.classPackage.id) : null;
    character.bgPackage = data.bgPackage ? findById(dataCache.packages || [], data.bgPackage.id) : null;
    character.shoppingItems = data.shoppingItems || [];
    character.currency = data.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    character.name = data.name || '';
    character.player = data.player || '';
    character.alignment = data.alignment || '';
    character.level = data.level || 1;
    character.hp_max = data.hp_max;  // 如果 JSON 里已有，直接用；否则首次升级时初始化
    if (!character.hp_max && character.class) {
        var _hdStr = character.class.hit_dice || 'D8';
        var _hd = parseInt(_hdStr.replace('D', ''));
        var _hpl = character.class.hp_per_level || 5;
        var _race = character.subrace || character.race;
        var _rb = {}; if (_race && _race.bonus) { try { _rb = JSON.parse(_race.bonus); } catch(e) { /* JSON解析失败，保留空对象 */ } }
        var _bb = (character.backgroundBonus && character.backgroundBonus.bonus) || {};
        var _conVal = (character.abilities && character.abilities[9] || 8) + (_rb[9] || 0) + (_bb[9] || 0);
        var _conMod = Math.floor((_conVal - 10) / 2);
        var _lv = character.level || 1;
        // 1级：生命骰 + 体质修正；后续等级：hp_per_level + 体质修正
        character.hp_max = (_hd + _conMod) + Math.max(0, _lv - 1) * (_hpl + _conMod);
        if (character.hpPerLevelBonus) {
            character.hp_max += character.hpPerLevelBonus * _lv;
        }
    }
    character.personalTraits = data.personalTraits || '';
    character.ideals = data.ideals || '';
    character.bonds = data.bonds || '';
    character.flaws = data.flaws || '';
    character.backstory = data.backstory || '';
    character.selectedLanguages = data.selectedLanguages || [];

    // 重置升级状态
    upgradeState.totalLevelsGained = 0;
    upgradeState.newLevel = character.level + 1;

    console.log('[升级] 角色加载成功:', character.name, '等级', character.level);
    // 翻译：更新导航栏标题，显示职业和等级
    var clsName = character.class ? character.class.name : '—';
    $('.nav-title').text(`DND 5R · ${clsName} Lv.${character.level}`);
    renderStep(0);
}

// ============================================================
// 导出功能
// ============================================================

/**
 * 翻译：拿到「本次升级」的收益数据（HP、特性、法术位、待选项……）。
 *
 * 关键点：升级信息只在这里算一次，然后缓存进 upgradeState。
 * 以前只有「升级概览」那一页会算，后面几页全靠这一页的副作用拿数据；
 * 一旦用户直接点进度条跳到「特性总览」，数据就是空的，
 * 页面会悄悄退回成「升级概览」的样子 —— 看起来就是"特性名字有、描述没有"。
 *
 * @param {number} [targetLevel] - 翻译：要算到几级；不传就用当前目标等级
 * @returns {object} - 翻译：本次升级的收益数据
 */
function ensureLevelGains(targetLevel) {
    // 翻译：目标等级优先级：调用方指定 > 状态里记着的 > 当前等级 + 1
    const target = targetLevel || upgradeState.newLevel || (character.level + 1);

    // 翻译：已经算过同一等级的，直接复用，避免来回翻页时把用户的选择清空
    if (upgradeState.levelGains && upgradeState.levelGains._forLevel === target) {
        return upgradeState.levelGains;
    }

    // 翻译：真正计算这一级的收益
    const gains = calculateLevelGains(target);
    gains._forLevel = target;

    // 翻译：把结果铺开存到状态里，给后面几页用
    upgradeState.levelGains = gains;
    upgradeState.newLevel = target;
    upgradeState.gainedFeatures = gains.features;
    upgradeState.gainedFeats = gains.feats;
    upgradeState.abilityImprovement = gains.abilityImprovement;
    upgradeState.newSpellSlots = gains.newSpellSlots;
    upgradeState.pendingSelections = gains.pendingSelections || [];
    upgradeState.classExtraGroups = gains.classExtraGroups || [];
    upgradeState.hpGain = gains.hpGain;
    upgradeState.hpGainDetail = gains.hpGainDetail;
    upgradeState.spellcastingInfo = gains.spellcastingInfo || {};

    upgradeState.classId = character.class ? character.class.id : null;
    upgradeState.subClassId = character.subclass ? character.subclass.id : null;
    upgradeState.subclassFeatures = gains.subclassFeatures || [];

    var clsData = character.class;
    upgradeState.spellcastingType = (clsData && clsData.spellcaster != null)
        ? parseInt(clsData.spellcaster) || 0
        : 0;

    var currentHp = character.hp_max || 0;
    upgradeState.newMaxHp = currentHp + (gains.hpGain || 0);

    var oldProf = getProfBonus(character.level);
    var newProf = getProfBonus(target);
    upgradeState.proficiencyBonusChange = newProf > oldProf
        ? { from: oldProf, to: newProf }
        : null;

    // 翻译：换了新的一级，之前那级的选择结果作废
    upgradeState.selectedOptions = {};

    // 翻译：法术相关状态也全部刷新，避免上一级的残余状态污染下一级
    delete upgradeState._replaceCountRemaining;
    delete upgradeState._upgradeRemovedSpells;
    delete upgradeState._upgradeNewSpells;
    delete upgradeState._upgradeReplacedSpells;
    delete upgradeState._upgradeNewCantrips;
    delete upgradeState._isInReplaceMode;
    delete upgradeState._replaceTargetId;
    delete upgradeState._replaceNewId;

    // 翻译：这一级要不要选子职业。
    //       以前这个开关从头到尾没被赋过值，永远是 undefined，
    //       结果「子职选择」页被当成"不需要"而永远跳过，用户根本走不到那一页。
    upgradeState.needsSubclassSelection = !!gains.needsSubclassSelection;

    return gains;
}

// ============================================================
// 第1步：升级预览 — 计算升到下一级获得的内容
// ============================================================

// 继续升级：回到预览步骤，等级+1
function continueUpgrade() {
    if (character.level >= upgradeState.maxLevel) {
        alert('已达到最高等级 Lv.' + upgradeState.maxLevel + '，无法继续升级。');
        return;
    }
    stepState.current = 1;
    upgradeState.newLevel = character.level + 1;
    // 翻译：更新导航标题为新等级
    var clsName = character.class ? character.class.name : '—';
    $('.nav-title').text(`DND 5R · ${clsName} Lv.${character.level}`);
    renderStep(1);
}

export {
    renderImportStep,
    importCharacter,
    loadCharacterFromJSON,
    ensureLevelGains,
    continueUpgrade
};