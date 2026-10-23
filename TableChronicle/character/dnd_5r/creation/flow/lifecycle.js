/**
 * creation/flow/lifecycle.js
 * 车卡生命周期：欢迎页、新角色、导入角色
 */

import { character, resetCharacter } from '../../core/state/character-model.js';
import { dataCache, _fullDataCache } from '../../core/data/cache.js';
import { resetUnbind } from '../../core/state/character-state.js';
import { renderStep } from './step-router.js';
import { updateProgress, updateButtons } from './navigation.js';
import { clearAllPendingSelections } from '../steps/13-review.js';
import { renderDLCStep } from '../steps/dlc.js';

let currentStep = 0;
const TOTAL_STEPS = 16;

export function getCurrentStep() { return currentStep; }
export function setCurrentStep(step) { currentStep = step; }
export function getTotalSteps() { return TOTAL_STEPS; }

/**
 * 渲染欢迎页
 * @param {HTMLElement} container
 */
export function renderStartStep(container) {
    container.innerHTML = `
        <div class="start-step">
            <div class="start-content">
                <div class="start-logo">🎲</div>
                <h1 class="start-title">D&amp;D 5R 角色卡生成</h1>
                <p class="start-desc">创建你的角色，踏上冒险之旅</p>
                <div class="start-buttons">
                    <div class="start-card" id="start-new-character">
                        <div class="start-card-icon">✨</div>
                        <div class="start-card-title">新角色</div>
                        <div class="start-card-desc">从零开始创建一位全新的角色</div>
                        <div style="font-size:0.75rem;color:#c9a84c;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">💡 无需规则书，跟随引导逐步创建即可</div>
                    </div>
                    <div class="start-card" id="start-import-character">
                        <div class="start-card-icon">📂</div>
                        <div class="start-card-title">导入角色</div>
                        <div class="start-card-desc">从 JSON 存档中载入已有角色继续编辑</div>
                        <div style="font-size:0.75rem;color:#c9a84c;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">💡 升级的话需要导入角色</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('start-new-character').addEventListener('click', startNewCharacter);
    document.getElementById('start-import-character').addEventListener('click', importCharacter);
}

/**
 * 开始新角色
 */
export function startNewCharacter() {
    resetCharacter();

    // 彻底清理全局状态
    if (typeof window !== 'undefined') {
        window._isInFeatureSelection = false;
        window._nextStepAfterSelection = null;
        window._allSelectionsState = {};
        window._processedFeatIds = undefined;
    }
    character._visitedChainIds = undefined;
    resetUnbind();
    clearAllPendingSelections();

    // 重置 dataCache 为完整数据
    if (_fullDataCache && Object.keys(_fullDataCache).length > 0) {
        Object.keys(_fullDataCache).forEach(key => {
            dataCache[key] = JSON.parse(JSON.stringify(_fullDataCache[key]));
        });
    }

    // 显示步骤进度条和按钮
    document.getElementById('stepProgress').style.display = '';
    document.getElementById('stepIndicator').style.display = '';
    document.getElementById('prevBtn').style.visibility = 'hidden';
    document.getElementById('nextBtn').style.visibility = 'hidden';

    // 先显示DLC选择页面
    renderDLCStep(document.getElementById('stepContent'));
}

/**
 * 导入角色
 */
export function importCharacter() {
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

/**
 * 从 JSON 加载角色数据
 * @param {Object} data
 */
export function loadCharacterFromJSON(data) {
    const findById = (list, id) => list.find(item => item.id === id);
    const findByName = (list, name) => list.find(item => item.name === name || item.name === name);

    character.race = findById(dataCache.races || [], data.raceId);
    character.subrace = findById(dataCache.races || [], data.subraceId);
    character.class = findById(dataCache.classes || [], data.classId);
    character.subclass = findById(dataCache.classes || [], data.subclassId);
    character.background = findById(dataCache.backgrounds || [], data.backgroundId);
    character.abilities = data.abilities || null;

    // 统一转 ID key（兼容旧存档中文 key）
    if (character.abilities && typeof character.abilities === 'object') {
        var abCopy = {};
        Object.keys(character.abilities).forEach(function(k) {
            var id = Number(k);
            if (isNaN(id)) {
                var s = (dataCache.skills || []).find(function(sk) { return sk.name === k; });
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

    // 兼容旧存档：backgroundBonus.bonus 的 key 转 ID
    if (character.backgroundBonus && character.backgroundBonus.bonus) {
        var bbCopy = {};
        Object.keys(character.backgroundBonus.bonus).forEach(function(k) {
            var id = Number(k);
            if (isNaN(id)) {
                var s = (dataCache.skills || []).find(function(sk) { return sk.name === k; });
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
    character.classPackage = data.classPackage ? findById(dataCache.packages || [], data.classPackage.id) : null;
    character.bgPackage = data.bgPackage ? findById(dataCache.packages || [], data.bgPackage.id) : null;
    character.shoppingItems = data.shoppingItems || [];
    character.currency = data.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    character.name = data.name || '';
    character.player = data.player || '';
    character.alignment = data.alignment || '';
    character.level = data.level || 1;
    character.personalTraits = data.personalTraits || '';
    character.ideals = data.ideals || '';
    character.bonds = data.bonds || '';
    character.flaws = data.flaws || '';
    character.backstory = data.backstory || '';
    character.selectedLanguages = data.selectedLanguages || [];

    // 显示步骤进度条和按钮
    document.getElementById('stepProgress').style.display = '';
    document.getElementById('stepIndicator').style.display = '';
    document.getElementById('stepIndicator').textContent = '第 15 步，共 16 步';
    document.getElementById('prevBtn').style.visibility = 'visible';
    document.getElementById('nextBtn').style.visibility = 'visible';

    // 跳转到角色卡展示页（第15步）
    currentStep = 15;
    renderStep(15);
    updateProgress();
    updateButtons();
}