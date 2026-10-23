// ===== 步骤6: 选择背景 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';

export function renderBackgroundStep(container) {
    const backgrounds = dataCache.backgrounds || [];

    if (backgrounds.length === 0) {
        container.innerHTML = `
            <div class="subrace-step">
                <h2>暂无背景数据</h2>
                <p>背景数据加载失败，请检查数据文件</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="race-step">
            <div class="race-grid" id="backgroundGrid">
                ${backgrounds.map(b => `
                    <div class="race-card ${character.background?.id === b.id ? 'selected' : ''}"
                         onclick="selectBackground(${b.id})" data-background-id="${b.id}">
                        <div class="race-name">${b.name}</div>
                        <div class="race-subtitle">${(() => {
                        const skillIds = (b.skills || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                        return skillIds.map(id => {
                            const sk = (dataCache.skills || []).find(s => s.id === id);
                            return sk ? sk.name : '';
                        }).filter(Boolean).join('、').slice(0, 20);
                    })()}</div>
                    </div>
                `).join('')}
            </div>
            <div class="race-detail" id="backgroundDetail">
                ${character.background
                    ? buildBackgroundDetail(character.background)
                    : '<div class="empty-detail">点击左侧背景查看详情</div>'}
            </div>
        </div>
    `;
}

function selectBackground(bgId) {
    const bg = (dataCache.backgrounds || []).find(b => b.id === bgId);
    if (!bg) return;

    // 清除之前背景的待选数据，并清空后续步骤的所有数据
    window.clearDataAfterStep(5);

    character.background = bg;
    // 特性收集已移至步骤14（特性总览）统一处理，此处不再重复调用

    document.querySelectorAll('.race-card[data-background-id]').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.backgroundId) === bgId);
    });

    document.getElementById('backgroundDetail').innerHTML = buildBackgroundDetail(bg);
    window.updateProgress();
}

function buildBackgroundDetail(bg) {
    // 解析属性ID列表 → 名称（attr = "11,18,25"）
    const attrIds = (bg.attr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const attrNames = attrIds.map(id => getSkillName(id)).filter(Boolean).join('、') || '无';

    // 解析技能ID列表 → 名称
    const skillIds = (bg.skills || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const skillNames = skillIds.map(id => {
        const s = (dataCache.skills || []).find(sk => sk.id === id);
        return s ? s.name : '';
    }).filter(Boolean).join('、') || '无';

    // 解析初始专长ID → 名称
    const featId = parseInt(bg.feat) || 0;
    const featName = featId ? ((dataCache.feats || []).find(f => f.id === featId)?.name || bg.feat) : '无';

    // 解析工匠熟练
    let toolName = '无';
    let toolTypeId = 0;
    const toolStr = (bg.tool || '').trim();
    if (toolStr) {
        // 格式1: tool(type=67) 或 tools(type=67)+N — 按类型选（如乐器、工匠工具）
        const toolTypeMatch = toolStr.match(/^tools?\s*\(\s*type\s*=\s*(\d+)\s*\)\s*(?:\+(\d+))?\s*$/i);
        if (toolTypeMatch) {
            toolTypeId = parseInt(toolTypeMatch[1]);
            const count = toolTypeMatch[2] ? parseInt(toolTypeMatch[2]) : 1;
            const typeMap = { 66: `工匠工具（任选${count > 1 ? count : '一种'}）`, 67: `乐器（任选${count > 1 ? count : '一种'}）`, 68: `赌具（任选${count > 1 ? count : '一种'}）`, 69: `其他工具（任选${count > 1 ? count : '一种'}）` };
            toolName = typeMap[toolTypeId] || toolStr;
        }
        // 格式2: tool=4 — 直接指定具体工具ID
        else {
            const toolIdMatch = toolStr.match(/^tool\s*=\s*(\d+)$/i);
            if (toolIdMatch) {
                const toolId = parseInt(toolIdMatch[1]);
                const t = (dataCache.tools || []).find(tl => tl.id === toolId);
                toolName = t ? t.name : (toolIdMatch[1] + '号工具');
            }
            // 格式3: tools(id=N)+N — 通过id直接指定工具（带数量）
            else {
                const toolIdExplicit = toolStr.match(/^tools?\s*\(\s*id\s*=\s*(\d+)\s*\)\s*(?:\+(\d+))?\s*$/i);
                if (toolIdExplicit) {
                    const explicitToolId = parseInt(toolIdExplicit[1]);
                    const t = (dataCache.tools || []).find(tl => tl.id === explicitToolId);
                    toolName = t ? t.name : ('工具#' + explicitToolId);
                }
                else {
                    toolName = toolStr;
                }
            }
        }
    }

    const toolTypeLabels = { 66: '工匠工具', 67: '乐器', 68: '赌具', 69: '其他工具' };
    const toolLabel = toolTypeLabels[toolTypeId] || '工具熟练';

    return `
        <h3>${bg.name}</h3>
        <div class="detail-subtitle">背景</div>
        <div class="detail-features">
            <div class="detail-feature" style="border-bottom:none;">
                <div class="feat-name">背景故事</div>
                <div class="feat-desc" style="color:#e0e0e0;line-height:1.8;font-size:0.9rem;">${bg.desc || '暂无说明'}</div>
            </div>
            <div class="detail-feature">
                <div class="feat-name">属性</div>
                <div class="feat-desc">${attrNames}</div>
            </div>
            <div class="detail-feature">
                <div class="feat-name">熟练技能</div>
                <div class="feat-desc">${skillNames}</div>
            </div>
            <div class="detail-feature">
                <div class="feat-name">初始专长</div>
                <div class="feat-desc">${featName}</div>
            </div>
            <div class="detail-feature" style="border-bottom:none;">
                <div class="feat-name">${toolLabel}</div>
                <div class="feat-desc">${toolName}</div>
            </div>
        </div>
    `;
}

window.selectBackground = selectBackground;
window.buildBackgroundDetail = buildBackgroundDetail;