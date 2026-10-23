// ===== 步骤6: 选择背景套装 =====
import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';

export function renderBackgroundPackageStep(container) {
    const bg = character.background;
    if (!bg) {
        container.innerHTML = `
            <div class="subrace-step">
                <h2>请先选择背景</h2>
                <p>返回上一步选择一个背景</p>
            </div>
        `;
        return;
    }

    const bgPackageIds = String(bg.suit_id || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const bgPkgs = (dataCache.packages || []).filter(p => bgPackageIds.includes(p.id));

    if (bgPkgs.length === 0) {
        container.innerHTML = `
            <div class="subrace-step">
                <h2>${bg.name}</h2>
                <p>该背景没有可选的起始套装</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="race-step">
            <div class="race-grid" id="bgPackageGrid">
                ${bgPkgs.map(p => `
                    <div class="race-card ${character.bgPackage?.id === p.id ? 'selected' : ''}"
                         onclick="selectBgPackage(${p.id})" data-bg-pkg-id="${p.id}">
                        <div class="race-name">${p.name}</div>
                        <div class="race-subtitle">${(p.desc || '').slice(0, 20)}${(p.desc || '').length > 20 ? '...' : ''}</div>
                    </div>
                `).join('')}
            </div>
            <div class="race-detail" id="bgPackageDetail">
                ${character.bgPackage && bgPackageIds.includes(character.bgPackage.id)
                    ? buildPackageDetail(character.bgPackage)
                    : '<div class="empty-detail">点击左侧套装查看详情</div>'}
            </div>
        </div>
    `;
}

function selectBgPackage(pkgId) {
    const pkg = (dataCache.packages || []).find(p => p.id === pkgId);
    if (!pkg) return;

    window.clearDataAfterStep(6);

    character.bgPackage = pkg;

    window.fillCurrencyFromPackage();

    document.querySelectorAll('.race-card[data-bg-pkg-id]').forEach(card => {
        card.classList.toggle('selected', parseInt(card.dataset.bgPkgId) === pkgId);
    });

    document.getElementById('bgPackageDetail').innerHTML = buildPackageDetail(pkg);
    window.updateProgress();
}

function buildPackageDetail(pkg) {
    let gp = 0, sp = 0, cp = 0;
    const content = pkg.desc || '';
    const gpMatch = content.match(/(\d+)\s*GP/i);
    const spMatch = content.match(/(\d+)\s*SP/i);
    const cpMatch = content.match(/(\d+)\s*CP/i);
    if (gpMatch) gp = parseInt(gpMatch[1]);
    if (spMatch) sp = parseInt(spMatch[1]);
    if (cpMatch) cp = parseInt(cpMatch[1]);

    let classPkgGold = 0, bgPkgGold = 0;
    if (character.classPackage) {
        const m = (character.classPackage.desc || '').match(/(\d+)\s*GP/i);
        if (m) classPkgGold = parseInt(m[1]);
    }
    if (character.bgPackage && character.bgPackage.id !== pkg.id) {
        const m = (character.bgPackage.desc || '').match(/(\d+)\s*GP/i);
        if (m) bgPkgGold = parseInt(m[1]);
    }

    const detailIds = String(pkg.suit_id || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const detailItems = detailIds.map(id => {
        const item = (dataCache.packageDetails || []).find(d => d.id === id);
        return item ? item : null;
    }).filter(Boolean);

    return `
        <h3>${pkg.name}</h3>
        <div class="detail-subtitle">起始装备套装</div>

        <div class="detail-features">
            <h4>包含物品</h4>
            <div class="detail-feature">
                <div class="feat-desc" style="color:#e0e0e0;line-height:1.8;font-size:0.9rem;">
                    ${content || '暂无说明'}
                </div>
            </div>
            ${detailItems.length > 0 ? `
            <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
                ${detailItems.map(d => `<span style="background:rgba(201,168,76,0.15);padding:3px 10px;border-radius:4px;font-size:0.8rem;color:#c9a84c;">${d.desc}</span>`).join('')}
            </div>` : ''}
            ${gp > 0 || classPkgGold > 0 || bgPkgGold > 0 ? `
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(201,168,76,0.2);">
                <span style="color:#c9a84c;font-weight:600;">金币组成：</span>
                ${classPkgGold > 0 && pkg.id === character.classPackage?.id ? `<div style="color:#a89b8c;font-size:0.85rem;">职业套装结余：${classPkgGold} GP</div>` : ''}
                ${bgPkgGold > 0 ? `<div style="color:#a89b8c;font-size:0.85rem;">背景套装结余：${bgPkgGold} GP</div>` : ''}
                ${gp > 0 ? `<div style="color:#f0e6d3;font-size:0.95rem;margin-top:4px;">此套装结余：${gp} GP</div>` : ''}
                ${classPkgGold > 0 || bgPkgGold > 0 ? `<div style="color:#c9a84c;margin-top:4px;font-size:0.9rem;">合计：${classPkgGold + bgPkgGold} GP</div>` : ''}
            </div>` : ''}
        </div>
    `;
}

window.selectBgPackage = selectBgPackage;