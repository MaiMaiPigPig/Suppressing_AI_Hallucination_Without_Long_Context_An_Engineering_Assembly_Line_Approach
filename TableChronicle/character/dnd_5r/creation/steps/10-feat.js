// ===== 步骤11: 专长确认 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { unbind } from '../../core/state/character-state.js';

export function renderFeatStep(container) {
    const bg = character.background;
    if (!bg) {
        container.innerHTML = `<div class="subrace-step"><h2>请先选择背景</h2><p>返回上一步完成选择</p></div>`;
        return;
    }

    // 所有起源专长（type=42），用于"所有专长"列表
    const allFeats = (dataCache.feats || []).filter(f => f.type === 42);
    // 所有专长（不限类型），用于查找背景推荐和已选专长
    const allFeatsAnyType = (dataCache.feats || []);

    const selectedFeatId = character.selectedFeat;
    let selectedFeat;
    if (selectedFeatId) {
        selectedFeat = allFeatsAnyType.find(f => f.id === selectedFeatId);
        console.log('[调试] [renderFeatStep] 已有已选专长: id=' + selectedFeatId + ' 名称=' + (selectedFeat ? selectedFeat.name : '?'));
    } else {
        const bgFeatId = parseInt(bg.feat) || 0;
        selectedFeat = allFeatsAnyType.find(f => f.id === bgFeatId);
        if (selectedFeat) {
            character.selectedFeat = selectedFeat.id;
            console.log('[调试] [renderFeatStep] 未找到已选专长，从背景获取默认: id=' + selectedFeat.id + ' 名称=' + selectedFeat.name);
        }
    }

    container.innerHTML = `
        <div class="feat-step">
            <div class="ability-header">
                <div class="ability-header-left">
                    <h2>专长确认</h2>
                </div>
                <div class="ability-header-right">
                    <label class="unbind-toggle ${unbind.feat ? 'active' : ''}" onclick="toggleUnbind('feat')">
                        <span class="unbind-icon">🔓</span> 解绑专长
                    </label>
                    <span class="unbind-hint">请先与你的DM商议后再决定是否解绑</span>
                </div>
            </div>
            <div class="feat-layout">
                <div class="feat-left">
                    ${!unbind.feat ? `
                    <div class="feat-section">
                        <div class="feat-section-title">背景推荐</div>
                        <div class="feat-card-grid">
                            ${(() => {
                                const bgFeatId = parseInt(bg.feat) || 0;
                                const bgFeat = allFeatsAnyType.find(f => f.id === bgFeatId);
                                if (!bgFeat) return '<div class="feat-empty">该背景没有初始专长</div>';
                                const desc = bgFeat.desc || '';
                                return `
                                    <div class="feat-card ${character.selectedFeat === bgFeat.id ? 'selected' : ''}"
                                          data-feat-id="${bgFeat.id}" onclick="selectFeat(${bgFeat.id})">
                                        <div class="feat-card-name">${bgFeat.name}</div>
                                        <div class="feat-card-desc">${desc.length > 60 ? desc.substring(0, 60) + '…' : desc}</div>
                                    </div>
                                `;
                            })()}
                        </div>
                    </div>
                    ` : ''}
                    ${unbind.feat ? `
                    <div class="feat-section">
                        <div class="feat-section-title">所有专长</div>
                        <div class="feat-card-grid">
                            ${allFeats.map(f => {
                                const desc = f.desc || '';
                                return `
                                    <div class="feat-card ${character.selectedFeat === f.id ? 'selected' : ''}"
                                          data-feat-id="${f.id}" onclick="selectFeat(${f.id})">
                                        <div class="feat-card-name">${f.name}</div>
                                        <div class="feat-card-desc">${desc.length > 60 ? desc.substring(0, 60) + '…' : desc}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="feat-right" id="featDetail">
                    ${selectedFeat ? buildFeatDetail(selectedFeat) : '<div class="empty-detail">请在左侧选择一个专长</div>'}
                </div>
            </div>
        </div>
    `;
}

// 先决条件翻译
function translateFeatPrereq(prereqStr) {
    return prereqStr || '';
}

function buildFeatDetail(feat) {
    let html = `<div class="feat-detail-name">${feat.name}</div>`;
    if (feat.prerequisite) html += `<div class="feat-detail-prereq">前置：${translateFeatPrereq(feat.prerequisite)}</div>`;
    if (feat.desc) html += `<div class="feat-detail-desc">${feat.desc}</div>`;
    if (!feat.desc) html += `<div class="feat-detail-desc">暂无说明</div>`;
    return html;
}

function selectFeat(featId) {
    const allFeatsAnyType = (dataCache.feats || []);
    const feat = allFeatsAnyType.find(f => f.id === featId);
    console.log('[调试] [selectFeat] 用户选择专长: id=' + featId + ' 名称=' + (feat ? feat.name : '?') + ' 解绑状态=' + unbind.feat);
    // 清除之前专长的待选数据，并清空后续步骤的所有数据
    window.clearDataAfterStep(11);

    character.selectedFeat = featId;
    // 特性收集已移至步骤14（特性总览）统一处理，此处不再重复调用
    const detailEl = document.getElementById('featDetail');
    if (detailEl && feat) {
        detailEl.innerHTML = buildFeatDetail(feat);
    }
    // 高亮选中
    document.querySelectorAll('.feat-card').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.featId) === featId);
    });
    window.updateProgress();
}

window.selectFeat = selectFeat;