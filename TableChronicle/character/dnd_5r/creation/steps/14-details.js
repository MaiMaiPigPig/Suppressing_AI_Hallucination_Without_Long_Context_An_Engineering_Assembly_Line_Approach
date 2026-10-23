// ===== 步骤15: 角色详情 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { escapeHtml } from '../../utils/html.js';
import { collectAllFeatureBonuses } from './08-bonus.js';

const ALIGNMENTS = [
    '守序善良', '中立善良', '混乱善良',
    '守序中立', '绝对中立', '混乱中立',
    '守序邪恶', '中立邪恶', '混乱邪恶'
];

export function renderDetailsStep(container) {
    container.innerHTML = `
        <div class="details-step">
            <div class="ability-header">
                <h2>角色详情</h2>
            </div>
            <div class="details-desc">填写角色的基本信息与背景故事</div>

            <div class="details-grid">
                <!-- 第一行：名字 + 玩家 -->
                <div class="details-row">
                    <div class="details-field">
                        <label class="details-label">名字 <span class="details-required">*</span></label>
                        <input type="text" class="details-input" id="detailName" value="${escapeHtml(character.name)}" placeholder="输入角色名字" oninput="saveDetailField('name', this.value)">
                    </div>
                    <div class="details-field">
                        <label class="details-label">玩家</label>
                        <input type="text" class="details-input" id="detailPlayer" value="${escapeHtml(character.player)}" placeholder="输入玩家名字" oninput="saveDetailField('player', this.value)">
                    </div>
                </div>

                <!-- 第二行：等级 + 阵营 -->
                <div class="details-row">
                    <div class="details-field">
                        <label class="details-label">等级</label>
                        <input type="number" class="details-input" id="detailLevel" value="1" min="1" max="20" disabled>
                    </div>
                    <div class="details-field">
                        <label class="details-label">阵营</label>
                        <select class="details-input" id="detailAlignment" onchange="saveDetailField('alignment', this.value)">
                            <option value="">— 选择阵营 —</option>
                            ${ALIGNMENTS.map(a => `<option value="${a}" ${character.alignment === a ? 'selected' : ''}>${a}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- 分隔线 -->
            <div class="ability-divider"></div>

            <!-- 语言选择 -->
            <div class="details-field details-field-full">
                <label class="details-label">语言 <span class="details-hint">选择3种语言</span></label>
                <div class="language-tag-grid" id="languageGrid">
                    ${(function() {
                        // 收集已从特性中获得的语言（如背景、种族等），这些语言不可再选
                        const grantedLanguages = [];
                        try {
                            const bonuses = collectAllFeatureBonuses();
                            if (bonuses && bonuses.languages) {
                                bonuses.languages.forEach(l => grantedLanguages.push(l.id));
                            }
                        } catch(e) { /* ignore */ }
                        return (dataCache.languages || []).map(lang => {
                            const isGranted = grantedLanguages.includes(lang.id);
                            const isSelected = (character.selectedLanguages || []).includes(lang.id);
                            const classes = [];
                            if (isGranted) classes.push('granted');
                            if (isSelected) classes.push('selected');
                            return '<div class="language-tag ' + classes.join(' ') + '" ' +
                                     'data-lang-id="' + lang.id + '" ' +
                                     'data-granted="' + isGranted + '" ' +
                                     'onclick="toggleLanguage(' + lang.id + ', this)">' +
                                lang.name + (isGranted ? ' ✓' : '') +
                                '</div>';
                        }).join('');
                    })()}
                </div>
                <div class="language-counter" id="languageCounter">已选择 ${(character.selectedLanguages || []).length} / 3</div>
            </div>

            <!-- 个人特点 -->
            <div class="details-field details-field-full">
                    <label class="details-label">个人特点</label>
                    <textarea class="details-textarea" id="detailTraits" placeholder="描述你的角色的性格特点、习惯、怪癖等..." oninput="saveDetailField('personalTraits', this.value)">${escapeHtml(character.personalTraits)}</textarea>
                </div>

                <!-- 理想 -->
                <div class="details-field details-field-full">
                    <label class="details-label">理想</label>
                    <textarea class="details-textarea" id="detailIdeals" placeholder="你的角色相信什么？追求什么？" oninput="saveDetailField('ideals', this.value)">${escapeHtml(character.ideals)}</textarea>
                </div>

                <!-- 羁绊/心结 -->
                <div class="details-field details-field-full">
                    <label class="details-label">羁绊 / 心结</label>
                    <textarea class="details-textarea" id="detailBonds" placeholder="角色在乎的人、事、物，或无法释怀的过去..." oninput="saveDetailField('bonds', this.value)">${escapeHtml(character.bonds)}</textarea>
                </div>

                <!-- 缺点 -->
                <div class="details-field details-field-full">
                    <label class="details-label">缺点</label>
                    <textarea class="details-textarea" id="detailFlaws" placeholder="角色的恐惧、弱点、不良习惯..." oninput="saveDetailField('flaws', this.value)">${escapeHtml(character.flaws)}</textarea>
                </div>

                <!-- 背景故事 -->
                <div class="details-field details-field-full">
                    <label class="details-label">背景故事</label>
                    <textarea class="details-textarea details-textarea-lg" id="detailBackstory" placeholder="写下角色的过往经历、冒险动机..." oninput="saveDetailField('backstory', this.value)">${escapeHtml(character.backstory)}</textarea>
                </div>
            </div>
        </div>
    `;
}

function saveDetailField(field, value) {
    character[field] = value;
}

// ===== 语言选择 =====
function toggleLanguage(langId, el) {
    // 已从特性获得的语言不可操作
    if (el && el.dataset.granted === 'true') return;
    if (!character.selectedLanguages) character.selectedLanguages = [];
    const idx = character.selectedLanguages.indexOf(langId);
    if (idx !== -1) {
        // 取消选择
        character.selectedLanguages.splice(idx, 1);
        el.classList.remove('selected');
    } else {
        // 最多选3个
        if (character.selectedLanguages.length >= 3) return;
        character.selectedLanguages.push(langId);
        el.classList.add('selected');
    }
    // 更新计数器
    const counter = document.getElementById('languageCounter');
    if (counter) counter.textContent = `已选择 ${character.selectedLanguages.length} / 3`;
}

window.toggleLanguage = toggleLanguage;
window.saveDetailField = saveDetailField;