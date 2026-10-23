// ===== 步骤7: 基础属性 =====
import { ABILITY_NAMES } from '../../core/constants/character-constants.js';
import { character } from '../../core/state/character-model.js';
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

let abilityStepState = {
    mode: 'random',
    randomSets: [],
    selectedSetIndex: -1,
    selectedIndex: null,  // 当前点中的数字索引（不是值，避免同值同时选中）
    assignments: {},        // { 1: 16, 4: 14, ... }（key = skill ID）
    usedIndices: new Set()  // 已分配的索引
};

export function calculateModifier(score) {
    return Math.floor((score - 10) / 2);
}

function formatMod(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

function roll4d6() {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
}

function generateAbilitySet() {
    const set = Array.from({ length: 6 }, () => roll4d6());
    set.sort((a, b) => b - a);
    return set;
}

export function renderAbilityStep(container) {
    if (!abilityStepState.mode) abilityStepState.mode = 'random';

    container.innerHTML = `
        <div class="ability-step">
            <div class="ability-header">
                <h2>基础属性</h2>
                <div class="ability-tabs">
                    <button class="ability-tab ${abilityStepState.mode === 'random' ? 'active' : ''}" onclick="switchAbilityMode('random')">🎲 随机</button>
                    <button class="ability-tab ${abilityStepState.mode === 'pointbuy' ? 'active' : ''}" onclick="switchAbilityMode('pointbuy')">📊 购点</button>
                </div>
            </div>
            <div class="ability-body">
                ${abilityStepState.mode === 'random' ? renderRandomPanel() : renderPointBuyPanel()}
            </div>
        </div>
    `;
}

function switchAbilityMode(mode) {
    abilityStepState.mode = mode;
    if (mode === 'random') {
        abilityStepState.selectedSetIndex = -1;
        abilityStepState.randomSets = [];
        abilityStepState.assignments = {};
        abilityStepState.selectedIndex = null;
        abilityStepState.usedIndices = new Set();
    } else {
        abilityStepState.pointBuyValues = { 1: 8, 4: 8, 9: 8, 11: 8, 18: 8, 25: 8 };
        abilityStepState.pointsRemaining = 27;
    }
    renderAbilityStep(document.getElementById('stepContent'));
}

function renderRandomPanel() {
    let html = '';

    // 生成控制区
    html += `
        <div class="ability-controls">
            <div class="ability-control-row">
                <label>随机次数：</label>
                <input type="number" id="randomCount" value="3" min="1" max="20" class="ability-input-num">
                <button class="btn btn-primary" onclick="doRandomGenerate()">🎲 随机生成</button>
            </div>
        </div>
    `;

    // 已生成的组列表
    if (abilityStepState.randomSets.length > 0) {
        html += `<div class="ability-sets">`;
        abilityStepState.randomSets.forEach((set, idx) => {
            const isSelected = abilityStepState.selectedSetIndex === idx;
            html += `
                <div class="ability-set ${isSelected ? 'selected' : ''}">
                    <span class="ability-set-label">第${idx + 1}组</span>
                    <span class="ability-set-values">[ ${set.join(', ')} ]</span>
                    ${!isSelected ? `<button class="btn btn-sm btn-secondary" onclick="selectAbilitySet(${idx})">选择</button>` : '<span class="ability-set-check">✅ 已选</span>'}
                </div>
            `;
        });
        html += `</div>`;
    }

    // 已选择一组后，显示分配面板
    if (abilityStepState.selectedSetIndex >= 0) {
        html += renderAssignmentPanel();
    }

    return html;
}

function doRandomGenerate() {
    const count = parseInt(document.getElementById('randomCount')?.value) || 3;
    abilityStepState.randomSets = Array.from({ length: count }, () => generateAbilitySet());
    abilityStepState.selectedSetIndex = -1;
    abilityStepState.assignments = {};
    abilityStepState.selectedIndex = null;
    abilityStepState.usedIndices = new Set();
    renderAbilityStep(document.getElementById('stepContent'));
}

function selectAbilitySet(idx) {
    abilityStepState.selectedSetIndex = idx;
    abilityStepState.assignments = {};
    abilityStepState.selectedIndex = null;
    abilityStepState.usedIndices = new Set();
    // 初始化所有属性为未分配
    ABILITY_NAMES.forEach(name => { abilityStepState.assignments[name] = null; });
    renderAbilityStep(document.getElementById('stepContent'));
}

function renderAssignmentPanel() {
    const set = abilityStepState.randomSets[abilityStepState.selectedSetIndex];
    if (!set) return '';

    // 如果所有属性都已分配，自动保存到 character
    const allAssigned = ABILITY_NAMES.every(function(id) { return abilityStepState.assignments[id] !== null; });
    if (allAssigned) {
        character.abilities = {};
        ABILITY_NAMES.forEach(function(id) {
            character.abilities[id] = abilityStepState.assignments[id].value;
        });
    } else {
        character.abilities = null;
    }

    let html = `<div class="ability-divider"></div>`;

    // 数字池
    html += `<div class="ability-pool">`;
    html += `<div class="ability-pool-label">数值池（点击数字，再点击属性栏填入）</div>`;
    html += `<div class="ability-pool-numbers">`;
    set.forEach((val, i) => {
        const isUsed = abilityStepState.usedIndices.has(i);
        const isSelected = abilityStepState.selectedIndex === i && !isUsed;
        html += `<span class="ability-pool-num ${isUsed ? 'used' : ''} ${isSelected ? 'selected' : ''}" onclick="${isUsed ? '' : `selectAbilityNumber(${i})`}">${val}</span>`;
    });
    html += `</div></div>`;

    // 属性分配表
    html += `<div class="ability-assignments">`;
    ABILITY_NAMES.forEach(function(id) {
        const data = abilityStepState.assignments[id];
        const val = data ? data.value : null;
        const mod = val !== null ? calculateModifier(val) : null;
        const label = getSkillName(id);
        html += `
            <div class="ability-row">
                <span class="ability-label">${label}</span>
                <span class="ability-slot ${val !== null ? 'filled' : ''}" onclick="assignAbilityNumber(${id})">
                    ${val !== null ? val : '—'}
                </span>
                <span class="ability-mod ${mod !== null ? (mod >= 0 ? 'positive' : 'negative') : ''}">
                    ${mod !== null ? formatMod(mod) : '—'}
                </span>
            </div>
        `;
    });
    html += `</div>`;

    // 种族加成提示
    if (character.race) {
        html += `<div class="ability-race-bonus">提示：种族属性加成的效果将在最终面板中自动计算。</div>`;
    }

    return html;
}

function selectAbilityNumber(index) {
    abilityStepState.selectedIndex = abilityStepState.selectedIndex === index ? null : index;
    renderAbilityStep(document.getElementById('stepContent'));
}

function assignAbilityNumber(attrId) {
    // 如果点击已有值的格子且没有选中的数字，则清空该格子
    if (abilityStepState.selectedIndex === null) {
        if (abilityStepState.assignments[attrId] !== null) {
            // 从 usedIndices 中移除
            const oldIdx = abilityStepState.assignments[attrId].index;
            abilityStepState.usedIndices.delete(oldIdx);
            abilityStepState.assignments[attrId] = null;
            character.abilities = null;
            renderAbilityStep(document.getElementById('stepContent'));
        }
        return;
    }

    const set = abilityStepState.randomSets[abilityStepState.selectedSetIndex];
    if (!set) return;

    const val = set[abilityStepState.selectedIndex];
    // 如果该属性已有值，先归还到池中
    if (abilityStepState.assignments[attrId] !== null) {
        const oldIdx = abilityStepState.assignments[attrId].index;
        abilityStepState.usedIndices.delete(oldIdx);
        abilityStepState.assignments[attrId] = null;
    }

    // 标记该索引为已用
    abilityStepState.usedIndices.add(abilityStepState.selectedIndex);
    abilityStepState.assignments[attrId] = { value: val, index: abilityStepState.selectedIndex };
    abilityStepState.selectedIndex = null;

    // 检查是否全部分配完
    const allAssigned = ABILITY_NAMES.every(function(id) { return abilityStepState.assignments[id] !== null; });
    if (allAssigned) {
        character.abilities = {};
        ABILITY_NAMES.forEach(function(id) {
            character.abilities[id] = abilityStepState.assignments[id].value;
        });
        // 更新进度条
        updateProgress();
    } else {
        character.abilities = null;
    }

    renderAbilityStep(document.getElementById('stepContent'));
}

// ===== 购点面板 =====
function renderPointBuyPanel() {
    if (!abilityStepState.pointBuyValues) {
        abilityStepState.pointBuyValues = { 1: 8, 4: 8, 9: 8, 11: 8, 18: 8, 25: 8 };
        abilityStepState.pointsRemaining = 27;
    }

    const values = abilityStepState.pointBuyValues;
    let remaining = 27;
    ABILITY_NAMES.forEach(function(id) {
        const v = values[id] || 8;
        remaining -= POINT_COST[v] || 0;
    });

    let html = '';

    // 剩余点数 + 推荐按钮
    html += `<div class="ability-points-header">`;
    html += `<div class="ability-points-remaining">剩余点数：<span class="${remaining < 0 ? 'over' : remaining === 0 ? 'zero' : ''}">${remaining}</span> / 27</div>`;
    html += `<button class="btn btn-secondary" onclick="applyRecommendedAttributes()" ${character.class ? '' : 'disabled'}>⭐ 推荐属性</button>`;
    html += `</div>`;

    // 属性行
    html += `<div class="ability-assignments">`;
    ABILITY_NAMES.forEach(function(id) {
        const val = values[id] || 8;
        const mod = calculateModifier(val);
        const canUp = val < 15 && remaining - (POINT_COST[val + 1] - POINT_COST[val]) >= 0;
        const canDown = val > 8;
        const label = getSkillName(id);
        html += `
            <div class="ability-row">
                <span class="ability-label">${label}</span>
                <div class="ability-point-controls">
                    <button class="ability-point-btn" onclick="adjustPointBuy(${id}, -1)" ${canDown ? '' : 'disabled'}>−</button>
                    <span class="ability-point-value">${val}</span>
                    <button class="ability-point-btn" onclick="adjustPointBuy(${id}, 1)" ${canUp ? '' : 'disabled'}>+</button>
                </div>
                <span class="ability-mod ${mod >= 0 ? 'positive' : 'negative'}">${formatMod(mod)}</span>
                <span class="ability-point-cost">花费 ${POINT_COST[val]} 点</span>
            </div>
        `;
    });
    html += `</div>`;

    // 花费表
    html += `
        <div class="ability-divider"></div>
        <div class="ability-cost-table">
            <div class="ability-cost-title">属性值点数花费表</div>
            <div class="ability-cost-grid">
                <div class="ability-cost-row"><span>数值</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span><span>13</span><span>14</span><span>15</span></div>
                <div class="ability-cost-row"><span>花费</span><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>7</span><span>9</span></div>
            </div>
        </div>
    `;

    // 自动保存到 character
    const allValid = remaining >= 0 && ABILITY_NAMES.every(function(id) { return (values[id] || 8) >= 8; });
    if (remaining >= 0) {
        character.abilities = {};
        ABILITY_NAMES.forEach(function(id) {
            character.abilities[id] = values[id] || 8;
        });
    } else {
        character.abilities = null;
    }

    return html;
}

function adjustPointBuy(attrId, delta) {
    if (!abilityStepState.pointBuyValues) {
        abilityStepState.pointBuyValues = { 1: 8, 4: 8, 9: 8, 11: 8, 18: 8, 25: 8 };
    }
    const current = abilityStepState.pointBuyValues[attrId] || 8;
    const newVal = current + delta;
    if (newVal < 8 || newVal > 15) return;

    // 计算当前剩余点数
    let remaining = 27;
    ABILITY_NAMES.forEach(function(id) {
        const v = id === attrId ? current : (abilityStepState.pointBuyValues[id] || 8);
        remaining -= POINT_COST[v] || 0;
    });

    // 检查是否够点
    const costDelta = (POINT_COST[newVal] || 0) - (POINT_COST[current] || 0);
    if (delta > 0 && remaining - costDelta < 0) return;

    abilityStepState.pointBuyValues[attrId] = newVal;
    updateProgress();
    renderAbilityStep(document.getElementById('stepContent'));
}

// 推荐属性：根据职业的 recommended_abilities 字段自动分配
function applyRecommendedAttributes() {
    if (!character.class) {
        alert('请先选择职业');
        return;
    }

    // 优先使用 recommended_abilities 字段（"15 13 14 10 12 8" 格式，按属性顺序映射）
    var rec = character.class['recommended_abilities'];
    if (rec && rec !== '-' && rec !== '') {
        var parts = rec.split(/\s+/).map(Number);
        if (parts.length === 6 && parts.every(function(v) { return !isNaN(v); })) {
            // ABILITY_NAMES 顺序: [1=力量, 4=敏捷, 9=体质, 11=智力, 18=感知, 25=魅力]
            // recommended_abilities 顺序对应: [力量, 敏捷, 体质, 智力, 感知, 魅力]
            var result = {};
            ABILITY_NAMES.forEach(function(id, i) {
                result[id] = parts[i];
            });

            // 根据当前模式应用
            if (abilityStepState.mode === 'pointbuy') {
                abilityStepState.pointBuyValues = result;
            } else {
                // 随机模式：将推荐值作为唯一一组，自动分配
                abilityStepState.randomSets = [parts.slice()]; // 复制一份
                abilityStepState.selectedSetIndex = 0;
                abilityStepState.assignments = {};
                ABILITY_NAMES.forEach(function(id, i) {
                    abilityStepState.assignments[id] = { value: parts[i], index: i };
                });
                abilityStepState.usedIndices = new Set([0, 1, 2, 3, 4, 5]);
                abilityStepState.selectedIndex = null;
            }

            // 写入角色数据
            character.abilities = {};
            ABILITY_NAMES.forEach(function(id) {
                character.abilities[id] = result[id];
            });

            updateProgress();
            renderAbilityStep(document.getElementById('stepContent'));
            return;
        }
    }

    // 没有 recommended_abilities，回退用 primary_ability + 标准数组分配
    var suggestion = character.class['primary_ability'] || '';
    if (typeof suggestion === 'number') suggestion = String(suggestion);

    var primaryStatIds = [];
    if (suggestion.indexOf('|') >= 0) {
        suggestion.split('|').forEach(function(s) {
            var id = parseInt(s.trim(), 10);
            if (!isNaN(id)) primaryStatIds.push(id);
        });
    } else if (suggestion.indexOf(',') >= 0) {
        suggestion.split(',').forEach(function(s) {
            var id = parseInt(s.trim(), 10);
            if (!isNaN(id)) primaryStatIds.push(id);
        });
    } else {
        var id = parseInt(suggestion, 10);
        if (!isNaN(id)) primaryStatIds.push(id);
    }

    var others = ABILITY_NAMES.filter(function(a) { return primaryStatIds.indexOf(a) < 0 && a !== 9; });
    var priority = primaryStatIds.concat([9]).concat(others);
    const fallbackValues = [15, 14, 13, 12, 10, 8];

    const priorityResult = {};
    priority.forEach(function(attr, i) {
        priorityResult[attr] = fallbackValues[i] || 8;
    });

    if (abilityStepState.mode === 'pointbuy') {
        abilityStepState.pointBuyValues = priorityResult;
    } else {
        // 回退到标准数组用于随机模式
        var arr = ABILITY_NAMES.map(function(id) { return priorityResult[id]; });
        abilityStepState.randomSets = [arr];
        abilityStepState.selectedSetIndex = 0;
        abilityStepState.assignments = {};
        ABILITY_NAMES.forEach(function(id, i) {
            abilityStepState.assignments[id] = { value: arr[i], index: i };
        });
        abilityStepState.usedIndices = new Set([0, 1, 2, 3, 4, 5]);
        abilityStepState.selectedIndex = null;
    }

    character.abilities = {};
    ABILITY_NAMES.forEach(function(id) {
        character.abilities[id] = priorityResult[id];
    });

    updateProgress();
    renderAbilityStep(document.getElementById('stepContent'));
}

// ===== window 桥接：供模板内联 onclick 调用 =====
window.switchAbilityMode = switchAbilityMode;
window.doRandomGenerate = doRandomGenerate;
window.applyRecommendedAttributes = applyRecommendedAttributes;
window.selectAbilitySet = selectAbilitySet;
window.selectAbilityNumber = selectAbilityNumber;
window.assignAbilityNumber = assignAbilityNumber;
window.adjustPointBuy = adjustPointBuy;