// ===== 步骤10: 技能选择 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { unbind } from '../../core/state/character-state.js';

export function renderSkillStep(container) {
    const cls = character.class;
    const bg = character.background;

    if (!cls || !bg) {
        container.innerHTML = `<div class="subrace-step"><h2>请先选择职业和背景</h2><p>返回上一步完成选择</p></div>`;
        return;
    }

    // 解析职业技能列表
    let classSkillIds;
    const skillStr = cls['skill_prof'] || '';
    if (skillStr === 'all') {
        classSkillIds = (dataCache.skills || []).filter(s => s.type === 3).map(s => s.id);
    } else {
        classSkillIds = skillStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    }
    const classSkillCount = cls['count'] || 1;
    const classSkills = classSkillIds.map(id => (dataCache.skills || []).find(s => s.id === id)).filter(Boolean);

    // 解析背景技能（bg.skills现在是ID列表，如 "21,17"）
    const bgSkillIds = (bg.skills || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const bgSkills = bgSkillIds.map(id => (dataCache.skills || []).find(s => s.id === id)).filter(Boolean);

    // 所有技能
    const allSkills = (dataCache.skills || []).filter(s => s.type === 3);

    const selectedClassIds = character.classSkills || [];
    const selectedBgIds = character.backgroundSkills || [];

    // 计算被对方选中的技能ID（用于置灰）
    const classSelectedIds = new Set(selectedClassIds);
    const bgSelectedIds = new Set(selectedBgIds);

    container.innerHTML = `
        <div class="skill-step">
            <div class="ability-header">
                <h2>技能选择</h2>
            </div>

            <div class="skill-section">
                <div class="skill-section-title">
                    <span>职业技能 — 选择 ${unbind.classSkill ? '任意数量' : classSkillCount + ' 项'}</span>
                    <span class="skill-count">已选 ${selectedClassIds.length}${unbind.classSkill ? '' : ' / ' + classSkillCount}</span>
                </div>
                <div class="skill-unbind">
                    <label class="unbind-toggle ${unbind.classSkill ? 'active' : ''}" onclick="toggleUnbind('classSkill')">
                        <span class="unbind-icon">🔓</span> 解绑职业
                    </label>
                    <span class="unbind-hint">请先与你的DM商议后再决定是否解绑</span>
                </div>
                <div class="skill-grid">
                    ${(unbind.classSkill ? allSkills : classSkills).map(s => {
                        const isSelected = selectedClassIds.includes(s.id);
                        const isBgSelected = bgSelectedIds.has(s.id);
                        const disabled = (!unbind.classSkill && selectedClassIds.length >= classSkillCount && !isSelected) || isBgSelected;
                        return `
                            <div class="skill-item ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
                                 onclick="${disabled ? '' : 'toggleClassSkill(' + s.id + ')'}">
                                <span class="skill-name">${s.name}</span>
                                <span class="skill-ability">${s.attr || ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="skill-divider"></div>

            <div class="skill-section">
                <div class="skill-section-title">
                    <span>背景技能${unbind.bgSkill ? '（自由选择）' : ''}</span>
                    <span class="skill-count">已选 ${selectedBgIds.length}</span>
                </div>
                <div class="skill-unbind">
                    <label class="unbind-toggle ${unbind.bgSkill ? 'active' : ''}" onclick="toggleUnbind('bgSkill')">
                        <span class="unbind-icon">🔓</span> 解绑背景
                    </label>
                    <span class="unbind-hint">请先与你的DM商议后再决定是否解绑</span>
                </div>
                <div class="skill-grid">
                    ${(unbind.bgSkill ? allSkills : bgSkills).map(s => {
                        const isSelected = selectedBgIds.includes(s.id);
                        const isClassSelected = classSelectedIds.has(s.id);
                        return `
                            <div class="skill-item ${isSelected ? 'selected' : ''} ${isClassSelected ? 'disabled' : ''}"
                                 onclick="${isClassSelected ? '' : 'toggleBgSkill(' + s.id + ')'}">
                                <span class="skill-name">${s.name}</span>
                                <span class="skill-ability">${s.attr || ''}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${!unbind.classSkill && selectedClassIds.length < classSkillCount ? '<div class="skill-hint">请选择足够的职业技能再继续</div>' : ''}
        </div>
    `;
}

function toggleClassSkill(skillId) {
    let selected = [...(character.classSkills || [])];
    const idx = selected.indexOf(skillId);
    if (idx >= 0) {
        selected.splice(idx, 1);
    } else {
        const cls = character.class;
        const count = cls['count'] || 1;
        if (!unbind.classSkill && selected.length >= count) return;
        // 检查是否已被背景选中
        if ((character.backgroundSkills || []).includes(skillId)) return;
        selected.push(skillId);
    }
    character.classSkills = selected;
    character.allSkills = mergeSkills();
    renderSkillStep(document.getElementById('stepContent'));
}

function toggleBgSkill(skillId) {
    let selected = [...(character.backgroundSkills || [])];
    const idx = selected.indexOf(skillId);
    if (idx >= 0) {
        selected.splice(idx, 1);
    } else {
        // 检查是否已被职业选中
        if ((character.classSkills || []).includes(skillId)) return;
        selected.push(skillId);
    }
    character.backgroundSkills = selected;
    character.allSkills = mergeSkills();
    renderSkillStep(document.getElementById('stepContent'));
}

function mergeSkills() {
    const classSkillNames = (character.classSkills || []).map(id => {
        const s = (dataCache.skills || []).find(sk => sk.id === id);
        return s ? s.name : null;
    }).filter(Boolean);
    const bgSkillNames = (character.backgroundSkills || []).map(id => {
        const s = (dataCache.skills || []).find(sk => sk.id === id);
        return s ? s.name : null;
    }).filter(Boolean);
    return [...new Set([...classSkillNames, ...bgSkillNames])];
}

function toggleUnbind(key) {
    unbind[key] = !unbind[key];
    window.renderStep(window.currentStep);
    window.updateProgress();
}

window.toggleClassSkill = toggleClassSkill;
window.toggleBgSkill = toggleBgSkill;
window.toggleUnbind = toggleUnbind;