/**
 * creation/steps/sheet-renderer.js
 * 角色卡的子渲染器：伤害类型/武器属性翻译、法器条目与法术详情渲染、熟练值提取。
 *
 * 由设计-v0.4-004-001 从 sheet.js 拆分而来，对外接口由入口文件原样 re-export。
 */

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { getFeatureProficiencyValues } from '../../core/proficiency/proficiency-link-resolver.js';
import { translateDamageType, translateProperties, getSchoolMap } from '../../core/data/dictionary.js';
import { parseProficiencyLinkIds } from '../../handlers/data-query.js';

// 实现已移至 core/proficiency/，此处 re-export 保持 sheet.js 入口对 review.js 的接口不变。
export { getFeatureProficiencyValues };
import { escapeHtml } from '../../utils/html.js';

// window 桥接：法术条目由角色卡动态生成，其 onclick 直接引用 toggleSpellDetail。
// 注意必须直接赋值函数引用——若写成箭头函数包装，函数体内的 window.toggleSpellDetail(...)
// 会指向自身造成无限递归。
window.toggleSpellDetail = toggleSpellDetail;

// ===== 法术条目 =====
export function renderSpellItem(spell, showPrepare) {
    const comps = [];
    let matDesc = '';
    if (spell['component_v']) comps.push('V');
    if (spell['component_s']) comps.push('S');
    if (spell['component_m'] && spell['component_m'] !== 0 && spell['component_m'] !== '0') {
        comps.push('M');
        if (typeof spell['component_m'] === 'string') matDesc = spell['component_m'];
    }
    const compStr = comps.join('、');

    const detailId = `sd-${spell.id}`;
    const toggleId = `st-${spell.id}`;

    // 环位标签
    const levelLabel = spell.level === 0 ? '戏法' : spell.level + '环';

    // 学派名称
    const schoolName = getSchoolMap()[spell.school] || '通用';

    // 职业列表
    const classIds = String(spell.class || '').split('、').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const classNames = classIds.map(id => {
        const c = (dataCache.classes || []).find(cls => cls.id === id);
        return c ? c.class : '';
    }).filter(Boolean).join('，');

    // 持续时间（含专注前缀）
    const durationText = (spell.concentration ? '专注，' : '') + (spell.duration || '—');

    // 详细描述
    const detailText = formatSpellDetail(spell);

    return `
        <div class="sl-item">
            <div class="sl-row">
                ${showPrepare ? '<span class="sl-prep" onclick="this.textContent=this.textContent===\'☐\'?\'☑\':\'☐\';this.classList.toggle(\'checked\')">☐</span>' : ''}
                <span class="sl-name">${escapeHtml(spell.name)}</span>
                <span class="sl-comp">${compStr}</span>
                <span class="sl-time">${spell.casting_time || '—'}</span>
                ${spell.concentration ? '<span class="sl-tag sl-tag-c">专注</span>' : ''}
                ${spell.ritual ? '<span class="sl-tag sl-tag-r">仪式</span>' : ''}
                <button class="sl-btn" onclick="toggleSpellDetail('${detailId}', '${toggleId}')" id="${toggleId}">详情▾</button>
            </div>
            <div class="sl-detail" id="${detailId}">
                <div class="sd-card">
                    <div class="sd-header">
                        <div class="sd-header-name">${escapeHtml(spell.name)}${spell.name_en ? '<span class="sd-header-en">｜' + escapeHtml(spell.name_en) + '</span>' : ''}</div>
                        <div class="sd-header-level">${levelLabel} · ${schoolName}${classNames ? '（' + classNames + '）' : ''}</div>
                    </div>
                    <div class="sd-meta">
                        <div class="sd-meta-row">
                            <span class="sd-meta-label">施法时间</span>
                            <span class="sd-meta-value">${spell.casting_time || '—'}${spell.ritual ? '（可仪式）' : ''}</span>
                        </div>
                        <div class="sd-meta-row">
                            <span class="sd-meta-label">施法距离</span>
                            <span class="sd-meta-value">${spell.range || '—'}</span>
                        </div>
                        <div class="sd-meta-row">
                            <span class="sd-meta-label">法术成分</span>
                            <span class="sd-meta-value">${compStr || '—'}${matDesc ? '<span class="sd-mat-desc">（' + escapeHtml(matDesc) + '）</span>' : ''}</span>
                        </div>
                        <div class="sd-meta-row">
                            <span class="sd-meta-label">持续时间</span>
                            <span class="sd-meta-value">${durationText}</span>
                        </div>
                    </div>
                    <div class="sd-desc">${detailText}</div>
                </div>
            </div>
        </div>
    `;
}

// ===== 法术详情格式化 =====

// ===== 法术详情格式化 =====
export function formatSpellDetail(spell) {
    let text = spell.desc || '';
    // 数据已在加载时预处理，占位符已替换为实际值
    // 替换字面量 \n 为 <br>（JSON 中存的是 \\n，解析后为 \n 字符串）
    return text.replace(/\\n/g, '<br>').split('\n').filter(Boolean).join('<br>');
}

// ===== 切换法术详情 =====

// ===== 切换法术详情 =====
export function toggleSpellDetail(detailId, toggleId) {
    const detail = document.getElementById(detailId);
    const toggle = document.getElementById(toggleId);
    if (detail && toggle) {
        const isOpen = detail.style.display === 'block';
        detail.style.display = isOpen ? 'none' : 'block';
        toggle.textContent = isOpen ? '详情▾' : '详情▴';
    }
}

/**
 * 获取特性关联的环位表数值
 * 通过 proficiency_link 中的 ID，查出对应的 type，
 * 再按 type + class_id + level 找到当前等级的实际数值
 * 例如：狂暴特性链接了 [6, 11]，
 * 返回 [{label:"狂暴", value:"2"}, {label:"狂暴伤害", value:"2"}]
 */