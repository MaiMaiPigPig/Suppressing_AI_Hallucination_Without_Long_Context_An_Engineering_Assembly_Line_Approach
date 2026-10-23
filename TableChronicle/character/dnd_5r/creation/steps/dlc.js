// ===== DLC选择步骤 =====

import { dataCache, applyDLCFilter } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { getTotalSteps } from '../flow/lifecycle.js';

/**
 * 渲染DLC选择页面
 */
export function renderDLCStep(container) {
    // 只显示 enabled 为 true 的 DLC（目前只有 PHB）
    const dlcList = (dataCache.dlc || []).filter(d => d.enabled === true);
    if (dlcList.length === 0) {
        // 没有可用DLC，直接进入下一步
        startCharacterCreation();
        return;
    }

    let html = `
        <div class="dlc-step">
            <div class="dlc-header">
                <h2>内容扩展</h2>
                <p>当前可用的扩展内容如下，后续将逐步开放更多扩展。</p>
            </div>
            <div class="dlc-list">
    `;

    dlcList.forEach((item, idx) => {
        const isPHB = item.dlc === 'phb';
        html += `
            <div class="dlc-item">
                <div class="dlc-info">
                    <div class="dlc-name">
                        ${item.dlc.toUpperCase()}
                        ${isPHB ? '<span class="dlc-badge">基础</span>' : ''}
                    </div>
                    <div class="dlc-desc">${item.desc || '暂无说明'}</div>
                </div>
                <div class="dlc-status">
                    <span class="dlc-status-on">已启用</span>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="dlc-footer">
                <button class="btn btn-primary" onclick="confirmDLCSelection()">
                    确认，开始车卡
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * 确认DLC选择，过滤数据后进入车卡流程
 */
function confirmDLCSelection() {
    // 收集启用的DLC列表
    const enabledDLCs = (dataCache.dlc || [])
        .filter(d => d.enabled)
        .map(d => d.dlc);

    character.enabledDLCs = enabledDLCs;
    console.log('[调试] 启用的DLC:', enabledDLCs);

    // 应用DLC过滤
    applyDLCFilter();

    // 进入车卡流程
    startCharacterCreation();
}

/**
 * 开始车卡流程（从步骤1开始）
 */
function startCharacterCreation() {
    // 显示步骤进度条和按钮
    document.getElementById('stepProgress').style.display = '';
    document.getElementById('stepIndicator').style.display = '';
    document.getElementById('stepIndicator').textContent = '第 1 步，共 ' + getTotalSteps() + ' 步';
    document.getElementById('prevBtn').style.visibility = 'hidden';
    document.getElementById('nextBtn').style.visibility = 'visible';

    window.currentStep = 1;
    window.renderStep(1);
    window.updateProgress();
    window.updateButtons();
}

window.confirmDLCSelection = confirmDLCSelection;