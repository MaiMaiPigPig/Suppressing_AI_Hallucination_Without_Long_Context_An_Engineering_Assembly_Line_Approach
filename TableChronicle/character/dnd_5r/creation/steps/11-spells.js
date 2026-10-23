// ===== 步骤12: 法术选择 =====

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { getSchoolMap } from '../../core/data/dictionary.js';
import {
    getAbilityNameById,
    getMethodNameById,
    getSpellcastingConfig,
    getSpellDataFromProficiency,
    parseSpellCounts
} from '../../core/spells/spell-system.js';

// 施法规则实现已移至 core/spells/spell-system.js，这里保留同名的对外导出，
// 使 step-router.js / sheet.js / export.js / upgrade 桥接的 import 路径无需改动。
export { getSpellcastingConfig, getSpellDataFromProficiency, getMethodNameById, parseSpellCounts };

function collectRaceLockedSpells() {
    if (!character.lockedSpells) character.lockedSpells = [];
    if (!character.selectedSpells) character.selectedSpells = [];

    // 收集所有要处理的来源：种族 + 亚种的 chain ID
    var allIds = [];
    function collectChainIds(source) {
        if (!source || !source.chain) return;
        if (source._spellLockVisited) return;
        source._spellLockVisited = true;

        String(source.chain).split(',').forEach(function(idStr) {
            var id = parseInt(idStr.trim());
            if (isNaN(id) || allIds.indexOf(id) !== -1) return;
            allIds.push(id);
        });
    }

    if (character.race) collectChainIds(character.race);
    if (character.subrace) collectChainIds(character.subrace);

    // 清理临时标记
    if (character.race) delete character.race._spellLockVisited;
    if (character.subrace) delete character.subrace._spellLockVisited;

    // 遍历所有 chain ID，自描述表达式已由 expression 系统处理
    // 此处仅做 ID 遍历标记，具体解析由 expression 系统完成
    allIds.forEach(function(id) {
        // 表达式已在上层处理，无需额外操作
    });
}

export function renderSpellStep(container) {
    const cls = character.class;
    if (!cls) {
        container.innerHTML = `<div class="subrace-step"><h2>请先选择职业</h2><p>返回上一步完成选择</p></div>`;
        return;
    }

    // ===== 收集种族特性自动添加的法术，标记为锁定不可取消 =====
    // 注意：特性总览（步骤14）在法术选择（步骤11）之后，
    // 所以必须在这里提前处理，否则 lockedSpells 会为空
    if (!character.lockedSpells) {
        character.lockedSpells = [];
    }
    collectRaceLockedSpells();

    const classId = cls.id;
    const spellInfo = parseSpellCounts(classId);
    const hasAnySlots = spellInfo.cantrips > 0 || Object.keys(spellInfo.slots).length > 0;
    if (!spellInfo.ability || !hasAnySlots) {
        const note = spellInfo.note ? `（${spellInfo.note}）` : '';
        container.innerHTML = `<div class="subrace-step"><h2>${cls.name || cls.class}没有施法能力</h2><p>该职业在1级时不具备施法能力，请点击下一步继续${note}</p></div>`;
        character.selectedSpells = character.selectedSpells || [];
        return;
    }

    // 获取该职业的所有法术
    const allSpells = (dataCache.spells || []).filter(s => {
        const classIds = String(s.class || '').split(/[、,，]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        return classIds.includes(classId);
    });

    // 按环位分组（只显示有环位的等级）
    const cantrips = allSpells.filter(s => s.level === 0);
    const spellsByLevel = {};
    for (let i = 1; i <= 9; i++) {
        if (spellInfo.slots[i] && spellInfo.slots[i] > 0) {
            spellsByLevel[i] = allSpells.filter(s => s.level === i);
        }
    }

    // 已选法术
    const selected = character.selectedSpells || [];
    const locked = character.lockedSpells || [];

    const maxCantrips = spellInfo.cantrips;
    // 戏法计数：排除种族锁定的（额外给的，不计入职业上限）
    const cantripIds = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id && sp.level === 0);
        return s && !locked.includes(id);
    });

    // 各环位已选法术计数：排除种族锁定的
    const levelCounts = {};
    for (let i = 1; i <= 9; i++) {
        levelCounts[i] = selected.filter(id => {
            const s = allSpells.find(sp => sp.id === id && sp.level === i);
            return s && !locked.includes(id);
        });
    }

    // 准备法术总计数（已选的所有非戏法法术，排除种族锁定的）
    const totalPrepared = selected.filter(id => {
        const s = allSpells.find(sp => sp.id === id);
        return s && s.level > 0 && !locked.includes(id);
    }).length;

    // 判断是否为法术书施法
    const isSpellbook = spellInfo.preparation_method === 'spellbook' && spellInfo.spellbook_start > 0;
    // 法术书模式下，选择上限是 spellbook_start（如法师1级6个），否则是 prepared
    const totalPreparedLimit = isSpellbook ? spellInfo.spellbook_start : (spellInfo.prepared || 0);

    // 默认预览第一个法术
    const previewId = character._spellPreviewId || (allSpells.length > 0 ? allSpells[0].id : null);
    const previewSpell = previewId ? allSpells.find(s => s.id === previewId) : allSpells[0];

    // 构建各环位法术的HTML
    let levelsHTML = '';
    for (let i = 1; i <= 9; i++) {
        const spells = spellsByLevel[i];
        const maxSlots = spellInfo.slots[i] || 0;
        if (!spells || spells.length === 0 || maxSlots === 0) continue;
        const selectedIds = levelCounts[i];
        const totalSelectedNonCantrip = character.selectedSpells ? character.selectedSpells.filter(id => {
            const s = (dataCache.spells || []).find(sp => sp.id === id);
            return s && s.level > 0 && !(character.lockedSpells || []).includes(id);
        }).length : 0;
        levelsHTML += `
        <div class="spell-left-section">
            <div class="spell-left-section-title">${i}环法术（${spells.length}）</div>
            <div class="spell-btn-grid">
                ${spells.map(s => {
                    const isInSelected = selected.includes(s.id);
                    const isLocked = locked.includes(s.id);
                    const disabled = (!isInSelected && totalSelectedNonCantrip >= totalPreparedLimit) || isLocked;
                    const isPreview = previewId === s.id;
                    const clickHandler = isLocked ? '' : `onclick="toggleSpell(${s.id}, ${i}, ${totalPreparedLimit})"`;
                    return `
                        <div class="spell-btn ${isInSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''} ${isPreview ? 'preview' : ''}"
                             ${clickHandler}
                             onmouseenter="previewSpell(${s.id})"
                             title="${isLocked ? '种族特性自动添加，不可取消' : ''}">
                            ${s.name}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    }

    // 准备法术方式说明（从映射表获取标签）
    const methodEntry = (dataCache.spellcastingMethods || []).find(m => m.name === spellInfo.preparation_method);
    let methodLabel = methodEntry ? methodEntry.label : '';
    if (spellInfo.preparation_method === 'spellbook' && spellInfo.spellbook_start) {
        methodLabel = `法术书（${spellInfo.spellbook_start}个）`;
    }

    container.innerHTML = `
        <div class="spell-step">
            <!-- 顶部信息 -->
            <div class="ability-header">
                <h2>法术选择</h2>
                <div class="spell-header-info">
                    ${spellInfo.note ? `<span class="spell-note">${spellInfo.note}</span>` : ''}
                    <span class="spell-casting-ability">施法属性：${spellInfo.ability}</span>
                    ${methodLabel ? `<span class="spell-casting-ability">${methodLabel}</span>` : ''}
                    ${isSpellbook
                        ? `<span class="spell-casting-ability">法术书：${totalPrepared} / ${spellInfo.spellbook_start}</span>`
                        : (spellInfo.prepared > 0 ? `<span class="spell-casting-ability">准备法术：${totalPrepared} / ${spellInfo.prepared}</span>` : '')
                    }
                </div>
                ${spellInfo.preparation_rule ? `
                <div class="spell-rule">
                    <span class="spell-rule-text">${spellInfo.preparation_rule}</span>
                    ${spellInfo.spellbook_desc ? `<span class="spell-rule-formula">${spellInfo.spellbook_desc}</span>` : ''}
                </div>
                ` : ''}
            </div>

            <!-- 计数器区 -->
            <div class="spell-counters">
                ${cantrips.length > 0 && maxCantrips > 0 ? `
                <div class="spell-counter ${cantripIds.length >= maxCantrips ? 'full' : ''}">
                    <span class="spell-counter-label">戏法</span>
                    <span class="spell-counter-value">${cantripIds.length} / ${maxCantrips}</span>
                </div>
                ` : ''}
                ${isSpellbook ? `
                <div class="spell-counter ${totalPrepared >= spellInfo.spellbook_start ? 'full' : ''}">
                    <span class="spell-counter-label">法术书</span>
                    <span class="spell-counter-value">${totalPrepared} / ${spellInfo.spellbook_start}</span>
                </div>
                ` : (spellInfo.prepared > 0 ? `
                <div class="spell-counter ${totalPrepared >= spellInfo.prepared ? 'full' : ''}">
                    <span class="spell-counter-label">准备法术</span>
                    <span class="spell-counter-value">${totalPrepared} / ${spellInfo.prepared}</span>
                </div>
                ` : '')}
                ${Object.keys(spellInfo.slots).map(i => {
                    const maxSlots = spellInfo.slots[i];
                    if (maxSlots === 0) return '';
                    return `
                    <div class="spell-counter">
                        <span class="spell-counter-label">${i}环</span>
                        <span class="spell-counter-value">${maxSlots}</span>
                    </div>
                    `;
                }).join('')}
            </div>

            <!-- 左右分栏 -->
            <div class="spell-body">
                <!-- 左侧：正方形按钮列表 -->
                <div class="spell-left">
                    <!-- 戏法 -->
                    ${cantrips.length > 0 && maxCantrips > 0 ? `
                    <div class="spell-left-section">
                        <div class="spell-left-section-title">戏法（${cantrips.length}）</div>
                        <div class="spell-btn-grid">
                            ${cantrips.map(s => {
                                const isInSelected = selected.includes(s.id);
                                const isLocked = locked.includes(s.id);
                                const disabled = (!isInSelected && cantripIds.length >= maxCantrips) || isLocked;
                                const isPreview = previewId === s.id;
                                const clickHandler = isLocked ? '' : `onclick="toggleSpell(${s.id}, 0, ${maxCantrips})"`;
                                return `
                                    <div class="spell-btn ${isInSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isLocked ? 'locked' : ''} ${isPreview ? 'preview' : ''}"
                                         ${clickHandler}
                                         onmouseenter="previewSpell(${s.id})"
                                         title="${isLocked ? '种族特性自动添加，不可取消' : ''}">
                                        ${s.name}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${levelsHTML}

                    ${maxCantrips === 0 && Object.keys(spellsByLevel).length === 0 ? `
                    <div class="spell-empty">该职业目前没有可选择的法术</div>
                    ` : ''}
                </div>

                <!-- 右侧：详情面板 -->
                <div class="spell-right" id="spellDetailPanel">
                    ${previewSpell ? buildSpellDetailHTML(previewSpell) : '<div class="spell-detail-empty">请选择一个法术查看详情</div>'}
                </div>
            </div>
        </div>
    `;
}

/** 构建法术详情HTML */
export function buildSpellDetailHTML(s) {
    // 法术成分
    const comps = [];
    let matDesc = '';
    if (s['component_v']) comps.push('V');
    if (s['component_s']) comps.push('S');
    if (s['component_m'] && s['component_m'] !== 0 && s['component_m'] !== '0') {
        comps.push('M');
        if (typeof s['component_m'] === 'string') matDesc = s['component_m'];
    }
    const compStr = comps.join('、');

    // 环位
    const levelLabel = (lv) => {
        if (lv === 0) return '戏法';
        if (lv === 1) return '1环';
        return lv + '环';
    };

    // 学派
    const schoolName = getSchoolMap()[s.school] || '通用';

    // 职业列表
    const classIds = String(s.class || '').split('、').map(v => parseInt(v.trim())).filter(n => !isNaN(n));
    const classNames = classIds.map(id => {
        const c = (dataCache.classes || []).find(cls => cls.id === id);
        return c ? (c.name || c.class) : '';
    }).filter(Boolean).join('，');

    // 持续时间
    const durationText = (s.concentration ? '专注，' : '') + (s.duration || '—');

    // 详情描述
    const descText = formatSpellDetailText(s.desc || '');

    return `
        <div class="spell-detail">
            <div class="spell-detail-header">
                <div class="spell-detail-name">${s.name}${s.name_en ? '<span class="sd-header-en"> ｜' + s.name_en + '</span>' : ''}</div>
                <div class="spell-detail-level">${levelLabel(s.level)} · ${schoolName}${classNames ? '（' + classNames + '）' : ''}</div>
            </div>
            <div class="spell-detail-meta">
                <div class="spell-detail-meta-row">
                    <span class="spell-detail-meta-label">施法时间</span>
                    <span class="spell-detail-meta-value">${s.casting_time || '—'}${s.ritual ? '（可仪式）' : ''}</span>
                </div>
                <div class="spell-detail-meta-row">
                    <span class="spell-detail-meta-label">施法距离</span>
                    <span class="spell-detail-meta-value">${s.range || '—'}</span>
                </div>
                <div class="spell-detail-meta-row">
                    <span class="spell-detail-meta-label">法术成分</span>
                    <span class="spell-detail-meta-value">${compStr || '—'}${matDesc ? '<span class="sd-mat-desc">（' + matDesc + '）</span>' : ''}</span>
                </div>
                <div class="spell-detail-meta-row">
                    <span class="spell-detail-meta-label">持续时间</span>
                    <span class="spell-detail-meta-value">${durationText}</span>
                </div>
            </div>
            <div class="spell-detail-desc">${descText}</div>
            ${s.upcast ? `<div class="spell-detail-higher"><strong>升环效果：</strong>${formatSpellDetailText(s.upcast)}</div>` : ''}
        </div>
    `;
}

// 鼠标悬停预览法术
function previewSpell(spellId) {
    character._spellPreviewId = spellId;
    const panel = document.getElementById('spellDetailPanel');
    if (!panel) return;

    const allSpells = dataCache.spells || [];
    const s = allSpells.find(sp => sp.id === spellId);
    if (!s) return;

    panel.innerHTML = buildSpellDetailHTML(s);
}

/**
 * 格式化法术详情文本（数据已在加载时预处理，占位符已替换为实际值）
 * @param {string} text - 法术详情/升环文本
 * @returns {string} 换行转<br>的HTML文本
 */
function formatSpellDetailText(text) {
    if (!text) return '';
    // 替换字面量 \n 为 <br>（JSON 中存的是 \\n，解析后为 \n 字符串）
    return text.replace(/\\n/g, '<br>').split('\n').filter(Boolean).join('<br>');
}

/**
 * 截断法术文本
 */
function truncate(text, maxLen) {
    if (!text) return '';
    const clean = text.replace(/<br>/g, ' ');
    return clean.length > maxLen ? clean.substring(0, maxLen) + '…' : clean;
}

function toggleSpell(spellId, level, maxPrepared) {
    if (!character.selectedSpells) character.selectedSpells = [];

    // 锁定法术不可取消选择
    if (character.lockedSpells && character.lockedSpells.includes(spellId)) {
        alert('该法术由种族特性自动添加，不可取消');
        return;
    }

    const idx = character.selectedSpells.indexOf(spellId);
    if (idx >= 0) {
        // 锁定法术不可取消（在函数入口已拦截，但双重保险）
        if (character.lockedSpells && character.lockedSpells.includes(spellId)) {
            alert('该法术由种族特性自动添加，不可取消');
            return;
        }
        character.selectedSpells.splice(idx, 1);
    } else {
        // 检查总数上限：戏法计数level===0，环位法术计数level>0
        const totalSelected = character.selectedSpells.filter(id => {
            const s = (dataCache.spells || []).find(sp => sp.id === id);
            if (!s || (character.lockedSpells || []).includes(id)) return false;
            return level === 0 ? s.level === 0 : s.level > 0;
        }).length;
        if (totalSelected >= maxPrepared) {
            const label = level === 0 ? '戏法' : '准备法术';
            alert(`已达到${label}上限（${maxPrepared} 个）`);
            return;
        }
        character.selectedSpells.push(spellId);
    }

    // 保存滚动位置
    const leftPanel = document.querySelector('.spell-left');
    const scrollTop = leftPanel ? leftPanel.scrollTop : 0;

    // 重新渲染
    const container = document.getElementById('stepContent');
    renderSpellStep(container);
    updateProgress();

    // 恢复滚动位置
    requestAnimationFrame(() => {
        const newLeft = document.querySelector('.spell-left');
        if (newLeft) newLeft.scrollTop = scrollTop;
    });
}

// window 桥接：toggleSpell/previewSpell 由动态生成的 HTML 内联事件调用；
// 其余函数被 upgrade/ 下的 defer 脚本跨文件引用，模块化后需显式暴露。
// 注意：这里不桥接 getAbilityNameById —— 升级侧用的是 handlers/data-query.js 的同名版本
// （语义不同，带 '—' 兜底），两边同时挂 window 会互相覆盖。
window.toggleSpell = toggleSpell;
window.previewSpell = previewSpell;
window.getSpellDataFromProficiency = getSpellDataFromProficiency;
window.getMethodNameById = getMethodNameById;
window.buildSpellDetailHTML = buildSpellDetailHTML;