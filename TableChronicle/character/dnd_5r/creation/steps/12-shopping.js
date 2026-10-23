// ===== 步骤13: 商城购物 =====

import { dataCache } from '../../core/data/cache.js';
import { character } from '../../core/state/character-model.js';
import { formatCurrency, parsePrice, toCP } from '../../utils/currency.js';

export function renderShoppingStep(container) {
    container.innerHTML = `
        <div class="shop-step">
            <div class="ability-header">
                <h2>商城购物</h2>
                <div class="shop-balance" id="shopBalance">
                    ${renderBalance()}
                </div>
            </div>
            <div class="shop-layout">
                <div class="shop-left">
                    <div class="shop-section">
                        <div class="shop-section-title">已有物品（来自套装，不可修改）</div>
                        <div class="shop-owned-items" id="shopOwnedItems">
                            ${renderOwnedItems()}
                        </div>
                    </div>
                    <div class="shop-section">
                        <div class="shop-section-title">选购商品</div>
                        <div class="shop-category-select">
                            <select id="shopCategory" onchange="renderShopGrid()" class="shop-select">
                                <option value="items">冒险用品</option>
                                <option value="weapons">武器</option>
                                <option value="armors">护甲</option>
                                <option value="tools">工具</option>
                                <option value="magic_items">魔法物品</option>
                            </select>
                        </div>
                        <div class="shop-grid" id="shopGrid"></div>
                    </div>
                </div>
                <div class="shop-right">
                    <div class="shop-section">
                        <div class="shop-section-title">商品详情</div>
                        <div class="shop-detail" id="shopDetail">
                            <div class="shop-detail-empty">请在左侧选择一个商品</div>
                        </div>
                    </div>
                    <div class="shop-section">
                        <div class="shop-section-title">购物车</div>
                        <div class="shop-cart" id="shopCart"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    renderShopGrid();
    renderCart();
}

function renderBalance() {
    // 分别计算职业和背景的金币
    const classGoldCP = getPackageGoldCP(character.classPackage);
    const bgGoldCP = getPackageGoldCP(character.bgPackage);
    // 计算购物车总价
    const cartTotal = (character.shoppingItems || []).reduce((sum, item) => sum + (item.priceCP || 0) * item.qty, 0);
    // 公式结果 = 职业金币 + 背景金币 - 购物车
    const formulaResult = classGoldCP + bgGoldCP - cartTotal;
    const resultStr = formulaResult >= 0 ? formatCurrency(formulaResult) : '负值 ' + formatCurrency(Math.abs(formulaResult));
    return `
        <div class="shop-balance-formula">
            <span class="shop-balance-label">职业金币</span>
            <span class="shop-balance-val">${formatCurrency(classGoldCP)}</span>
            <span class="shop-balance-op">+</span>
            <span class="shop-balance-label">背景金币</span>
            <span class="shop-balance-val">${formatCurrency(bgGoldCP)}</span>
            <span class="shop-balance-op">−</span>
            <span class="shop-balance-label">购物车</span>
            <span class="shop-balance-val">${formatCurrency(cartTotal)}</span>
            <span class="shop-balance-op">=</span>
            <span class="shop-balance-result">${resultStr}</span>
        </div>
    `;
}

function getPackageGoldCP(pkg) {
    if (!pkg) return 0;
    const content = pkg.desc || '';
    let total = 0;
    const gpMatch = content.match(/(\d+)\s*(?:GP|gp|金币)/);
    const spMatch = content.match(/(\d+)\s*(?:SP|sp|银币)/);
    const cpMatch = content.match(/(\d+)\s*(?:CP|cp|铜币)/);
    // 也匹配PP（铂金币）
    const ppMatch = content.match(/(\d+)\s*(?:PP|pp|铂金币)/);
    if (ppMatch) total += parseInt(ppMatch[1]) * 1000;
    if (gpMatch) total += parseInt(gpMatch[1]) * 100;
    if (spMatch) total += parseInt(spMatch[1]) * 10;
    if (cpMatch) total += parseInt(cpMatch[1]);
    return total;
}

// ===== 购物预算：职业金币 + 背景金币 − 购物车 =====
function getRemainingBudget() {
    const classGoldCP = getPackageGoldCP(character.classPackage);
    const bgGoldCP = getPackageGoldCP(character.bgPackage);
    const cartTotal = (character.shoppingItems || []).reduce(function(sum, item) {
        return sum + (item.priceCP || 0) * item.qty;
    }, 0);
    return classGoldCP + bgGoldCP - cartTotal;
}

// 根据购物车和套装金币，同步更新顶栏货币输入框
function updateNavbarCurrencyFromCart() {
    const classGoldCP = getPackageGoldCP(character.classPackage);
    const bgGoldCP = getPackageGoldCP(character.bgPackage);
    const cartTotal = (character.shoppingItems || []).reduce((sum, item) => sum + (item.priceCP || 0) * item.qty, 0);
    const remaining = classGoldCP + bgGoldCP - cartTotal;
    let r = Math.max(0, remaining);
    const pp = Math.floor(r / 1000); r %= 1000;
    const gp = Math.floor(r / 100); r %= 100;
    const ep = Math.floor(r / 50); r %= 50;
    const sp = Math.floor(r / 10); r %= 10;
    const cp = r;
    document.getElementById('platinum') && (document.getElementById('platinum').value = pp);
    document.getElementById('gold') && (document.getElementById('gold').value = gp);
    document.getElementById('electrum') && (document.getElementById('electrum').value = ep);
    document.getElementById('silver') && (document.getElementById('silver').value = sp);
    document.getElementById('copper') && (document.getElementById('copper').value = cp);
    character.currency = { pp, gp, ep, sp, cp };
}

function renderOwnedItems() {
    const items = getPackageItems();
    if (items.length === 0) return '<div class="shop-empty">暂无套装物品</div>';
    return items.map(item => `
        <div class="shop-owned-item">
            <span class="shop-owned-name">${item.name}</span>
            <span class="shop-owned-qty">×${item.qty}</span>
        </div>
    `).join('');
}

export function getPackageItems() {
    const result = [];
    const pkgs = [character.classPackage, character.bgPackage].filter(Boolean);
    pkgs.forEach(pkg => {
        const detailIds = String(pkg['suit_id'] || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        detailIds.forEach(did => {
            const detail = (dataCache.packageDetails || []).find(d => d.id === did);
            if (!detail) return;
            const src = detail['source'] || '';
            const qty = detail['count'] || 1;
            let name = detail['desc'] || '';
            if (src.includes('item=')) {
                const itemId = parseInt(src.split('=')[1]);
                const item = (dataCache.items || []).find(i => i.id === itemId);
                if (item) name = item['attr'] || name;
            } else if (src.includes('weapon=')) {
                const wpId = parseInt(src.split('=')[1]);
                const wp = (dataCache.weapons || []).find(w => w.id === wpId);
                if (wp) name = wp['name'] || name;
            } else if (src.includes('armor=')) {
                const arId = parseInt(src.split('=')[1]);
                const ar = (dataCache.armors || []).find(a => a.id === arId);
                if (ar) name = ar['name'] || name;
            }
            if (name.includes('金币')) return;
            result.push({ name, qty });
        });
    });
    return result;
}

function renderShopGrid() {
    const cat = document.getElementById('shopCategory')?.value || 'items';
    const gridEl = document.getElementById('shopGrid');
    if (!gridEl) return;

    let items = [];
    if (cat === 'items') items = (dataCache.items || []).filter(i => i['visible'] === 1);
    else if (cat === 'weapons') items = dataCache.weapons || [];
    else if (cat === 'armors') items = dataCache.armors || [];
    else if (cat === 'tools') items = dataCache.tools || [];
    else if (cat === 'magic_items') items = dataCache.magic_items || [];

    gridEl.innerHTML = items.map((item, idx) => {
        const name = item['attr'] || item['name'] || item['name'] || item['name'] || '未知';
        const price = item['cost'] || item['cost'] || '';
        const p = parsePrice(price);
        return `
            <div class="shop-grid-item" onclick="showShopDetail(${idx}, '${cat}')" data-index="${idx}">
                <span class="shop-grid-name">${name}</span>
                <span class="shop-grid-price">${p.value > 0 ? p.value + p.unit : ''}</span>
            </div>
        `;
    }).join('');

    // 默认选中第一个
    if (items.length > 0) showShopDetail(0, cat);
}

function showShopDetail(idx, cat) {
    const detailEl = document.getElementById('shopDetail');
    if (!detailEl) return;

    let items = [];
    if (cat === 'items') items = (dataCache.items || []).filter(i => i['visible'] === 1);
    else if (cat === 'weapons') items = dataCache.weapons || [];
    else if (cat === 'armors') items = dataCache.armors || [];
    else if (cat === 'tools') items = dataCache.tools || [];
    else if (cat === 'magic_items') items = dataCache.magic_items || [];

    const item = items[idx];
    if (!item) {
        detailEl.innerHTML = '<div class="shop-detail-empty">请选择一个商品</div>';
        return;
    }

    const name = item['attr'] || item['name'] || item['name'] || item['name'] || '未知';
    const price = item['cost'] || item['cost'] || '';
    const weight = item['weight'] || '';
    const desc = item['desc'] || item['desc'] || '';
    const p = parsePrice(price);
    const priceStr = p.value > 0 ? p.value + p.unit : '';

    // 检查是否需要选择：
    // - 有包含子选项
    // - 且父物品本身没有价格（或价格为空/null）→ 需要选择其中一个
    // - 如果父物品有价格 → 直接整个加入，不需要选
    const containIds = (item['contains'] || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const hasSubOptions = containIds.length > 0;
    const parentHasPrice = p.value > 0 && price && price !== '' && price !== 'null';
    const needSelection = hasSubOptions && !parentHasPrice;

    if (needSelection) {
        // 需要选择（无价格，从子选项中选一个加入）
        // 加载子选项
        const subItems = containIds.map(id => (dataCache.items || []).find(i => i.id === id)).filter(Boolean);
        // 清除之前的选择
        delete window._selectedSubOption;

        let subOptionsHtml = subItems.map(sub => {
            const subName = sub['attr'] || '未知';
            const subPrice = sub['cost'] || '';
            const subWeight = sub['weight'] || '';
            const sp = parsePrice(subPrice);
            const subPriceStr = sp.value > 0 ? sp.value + sp.unit : '';
            return `
                <div class="shop-sub-option" onclick="selectSubOption(${sub.id}, '${cat}')" data-sub-id="${sub.id}">
                    <span class="shop-sub-name">${subName}</span>
                    <span class="shop-sub-info">
                        ${subPriceStr ? `<span class="shop-sub-price">${subPriceStr}</span>` : ''}
                        ${subWeight && subWeight !== 'null' && subWeight !== '—' ? `<span class="shop-sub-weight">${subWeight}</span>` : ''}
                    </span>
                </div>
            `;
        }).join('');

        detailEl.innerHTML = `
            <div class="shop-detail-name">${name}</div>
            ${desc ? `<div class="shop-detail-desc">${desc}</div>` : ''}
            <div class="shop-detail-sub-title">请选择一种：</div>
            <div class="shop-sub-options">${subOptionsHtml}</div>
            <div class="shop-detail-selected" id="shopSelectedSub">
                <span class="shop-selected-hint">请在上方选择一个选项</span>
            </div>
            <div class="shop-detail-actions">
                <button class="bonus-btn" onclick="changePendingQty(-1)">−</button>
                <span class="shop-detail-qty" id="shopPendingQty">0</span>
                <button class="bonus-btn" onclick="changePendingQty(1)">+</button>
                <button class="shop-confirm-btn" onclick="confirmAddSubOption('${cat}')">确定</button>
            </div>
        `;
    } else if (hasSubOptions && parentHasPrice) {
        // 有价格+有子选项 → 整个作为套装加入购物车，显示子选项清单
        const subItems = containIds.map(id => (dataCache.items || []).find(i => i.id === id)).filter(Boolean);
        let subListHtml = subItems.map(sub => {
            const subName = sub['attr'] || '未知';
            return `<span class="shop-bundle-item">${subName}</span>`;
        }).join('、');

        detailEl.innerHTML = `
            <div class="shop-detail-name">${name}</div>
            ${priceStr ? `<div class="shop-detail-price">价格：${priceStr}</div>` : ''}
            ${weight ? `<div class="shop-detail-weight">重量：${weight}</div>` : ''}
            ${desc ? `<div class="shop-detail-desc">${desc}</div>` : ''}
            <div class="shop-detail-bundle">
                <span class="shop-detail-bundle-label">包含：</span>
                ${subListHtml}
            </div>
            <div class="shop-detail-actions">
                <button class="bonus-btn" onclick="changePendingQty(-1)">−</button>
                <span class="shop-detail-qty" id="shopPendingQty">0</span>
                <button class="bonus-btn" onclick="changePendingQty(1)">+</button>
                <button class="shop-confirm-btn" onclick="confirmAddToCart('${name}', '${cat}')">确定</button>
            </div>
        `;
    } else {
        // 普通商品（无子选项）
        detailEl.innerHTML = `
            <div class="shop-detail-name">${name}</div>
            ${priceStr ? `<div class="shop-detail-price">价格：${priceStr}</div>` : ''}
            ${weight ? `<div class="shop-detail-weight">重量：${weight}</div>` : ''}
            ${desc ? `<div class="shop-detail-desc">${desc}</div>` : ''}
            <div class="shop-detail-actions">
                <button class="bonus-btn" onclick="changePendingQty(-1)">−</button>
                <span class="shop-detail-qty" id="shopPendingQty">0</span>
                <button class="bonus-btn" onclick="changePendingQty(1)">+</button>
                <button class="shop-confirm-btn" onclick="confirmAddToCart('${name}', '${cat}')">确定</button>
            </div>
        `;
    }

    // 高亮grid项
    document.querySelectorAll('.shop-grid-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.index) === idx);
    });
}

// 选择子选项
function selectSubOption(subId, cat) {
    // 查找子选项
    const sub = (dataCache.items || []).find(i => i.id === subId);
    if (!sub) return;

    const subName = sub['attr'] || '未知';
    const subPrice = sub['cost'] || '';
    const subWeight = sub['weight'] || '';
    const sp = parsePrice(subPrice);
    const subPriceStr = sp.value > 0 ? sp.value + sp.unit : '';

    // 存储选择
    window._selectedSubOption = {
        name: subName,
        priceCP: toCP(subPrice),
        priceStr: subPriceStr,
        weight: subWeight
    };

    // 更新UI
    const selectedEl = document.getElementById('shopSelectedSub');
    if (selectedEl) {
        selectedEl.innerHTML = `
            <span class="shop-selected-label">已选：</span>
            <span class="shop-selected-name">${subName}</span>
            ${subPriceStr ? `<span class="shop-selected-price">${subPriceStr}</span>` : ''}
        `;
    }

    // 高亮子选项
    document.querySelectorAll('.shop-sub-option').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.subId) === subId);
    });
}

// 确认添加子选项到购物车
function confirmAddSubOption(cat) {
    if (!window._selectedSubOption) {
        alert('请先选择一种选项');
        return;
    }

    const qtyEl = document.getElementById('shopPendingQty');
    if (!qtyEl) return;
    const qty = parseInt(qtyEl.textContent) || 0;
    if (qty <= 0) return;

    const sub = window._selectedSubOption;
    const priceCP = sub.priceCP;

    character.shoppingItems = character.shoppingItems || [];
    const existing = character.shoppingItems.find(si => si.name === sub.name && si.cat === cat);
    const oldQty = existing ? existing.qty : 0;

    // 检查余额（使用套装预算而非 character.currency）
    const addedCost = priceCP * qty;
    const balance = getRemainingBudget();
    if (addedCost > balance) {
        alert('余额不足！请先减少购物车中其他商品的数量。');
        return;
    }

    if (existing) {
        existing.qty += qty;
    } else {
        character.shoppingItems.push({ name: sub.name, cat, qty, priceCP });
    }

    // 重置
    qtyEl.textContent = '0';
    delete window._selectedSubOption;
    renderCart();
    updateNavbarCurrencyFromCart();
    const balanceEl = document.getElementById('shopBalance');
    if (balanceEl) balanceEl.innerHTML = renderBalance();
}

function changePendingQty(delta) {
    const el = document.getElementById('shopPendingQty');
    if (!el) return;
    let qty = parseInt(el.textContent) || 0;
    qty = Math.max(0, qty + delta);
    el.textContent = qty;
}

function confirmAddToCart(name, cat) {
    const qtyEl = document.getElementById('shopPendingQty');
    if (!qtyEl) return;
    const qty = parseInt(qtyEl.textContent) || 0;
    if (qty <= 0) return;

    // 获取商品价格
    let items = [];
    if (cat === 'items') items = (dataCache.items || []).filter(i => i['visible'] === 1);
    else if (cat === 'weapons') items = dataCache.weapons || [];
    else if (cat === 'armors') items = dataCache.armors || [];
    else if (cat === 'tools') items = dataCache.tools || [];
    else if (cat === 'magic_items') items = dataCache.magic_items || [];
    const item = items.find(i => (i['attr'] || i['name'] || i['name'] || i['name'] || '') === name);
    const price = item ? (item['cost'] || item['cost'] || '') : '';
    const priceCP = toCP(price);

    character.shoppingItems = character.shoppingItems || [];
    const existing = character.shoppingItems.find(si => si.name === name && si.cat === cat);
    const oldQty = existing ? existing.qty : 0;
    const newQty = oldQty + qty;

    // 检查余额（使用套装预算而非 character.currency）
    const addedCost = priceCP * qty;
    const balance = getRemainingBudget();
    if (addedCost > balance) {
        alert('余额不足！请先减少购物车中其他商品的数量。');
        return;
    }

    if (existing) {
        existing.qty += qty;
    } else {
        character.shoppingItems.push({ name, cat, qty, priceCP });
    }
    // 重置待确认数量
    qtyEl.textContent = '0';
    renderCart();
    updateNavbarCurrencyFromCart();
    // 更新余额显示
    const balanceEl = document.getElementById('shopBalance');
    if (balanceEl) balanceEl.innerHTML = renderBalance();
}

function renderCart() {
    const cartEl = document.getElementById('shopCart');
    if (!cartEl) return;
    const items = character.shoppingItems || [];
    if (items.length === 0) {
        cartEl.innerHTML = '<div class="shop-empty">购物车为空</div>';
        return;
    }
    // 计算总价
    const totalCP = items.reduce((sum, item) => sum + (item.priceCP || 0) * item.qty, 0);
    cartEl.innerHTML = items.map((item, idx) => {
        const priceStr = item.priceCP ? formatCurrency(item.priceCP) : '';
        const subtotal = item.priceCP ? formatCurrency(item.priceCP * item.qty) : '';
        return `
            <div class="shop-cart-item">
                <div class="shop-cart-info">
                    <span class="shop-cart-name">${item.name}</span>
                    ${priceStr ? `<span class="shop-cart-price">${priceStr}/个</span>` : ''}
                </div>
                <div class="shop-cart-controls">
                    <button class="cart-qty-btn" onclick="changeCartQty(${idx}, -1)">−</button>
                    <span class="cart-qty">${item.qty}</span>
                    <button class="cart-qty-btn" onclick="changeCartQty(${idx}, 1)">+</button>
                    <button class="shop-cart-remove" onclick="removeCartItem(${idx})">✕</button>
                </div>
                ${subtotal ? `<span class="shop-cart-subtotal">${subtotal}</span>` : ''}
            </div>
        `;
    }).join('');
    // 总价信息
    cartEl.innerHTML += `
        <div class="shop-cart-total">
            <span>合计：${formatCurrency(totalCP)}</span>
        </div>
    `;
}

function changeCartQty(idx, delta) {
    if (!character.shoppingItems || idx >= character.shoppingItems.length) return;
    const item = character.shoppingItems[idx];
    const newQty = Math.max(0, item.qty + delta);
    if (newQty === 0) {
        character.shoppingItems.splice(idx, 1);
    } else {
        // 检查余额是否够
        const oldCost = (item.priceCP || 0) * item.qty;
        const newCost = (item.priceCP || 0) * newQty;
        const diff = newCost - oldCost;
        if (diff > 0 && getRemainingBudget() < diff) {
            alert('余额不足！');
            return;
        }
        item.qty = newQty;
    }
    renderCart();
    updateNavbarCurrencyFromCart();
    // 更新余额显示
    const balanceEl = document.getElementById('shopBalance');
    if (balanceEl) balanceEl.innerHTML = renderBalance();
}

function removeCartItem(idx) {
    if (!character.shoppingItems || idx >= character.shoppingItems.length) return;
    character.shoppingItems.splice(idx, 1);
    renderCart();
    updateNavbarCurrencyFromCart();
    // 更新余额显示
    const balanceEl = document.getElementById('shopBalance');
    if (balanceEl) balanceEl.innerHTML = renderBalance();
}

// window 桥接：以下函数由购物步骤动态生成的 HTML 内联事件（onclick/onchange）调用，
// 模块作用域下不会自动成为全局，必须显式挂载到 window。
window.renderShopGrid = renderShopGrid;
window.showShopDetail = showShopDetail;
window.selectSubOption = selectSubOption;
window.confirmAddSubOption = confirmAddSubOption;
window.changePendingQty = changePendingQty;
window.confirmAddToCart = confirmAddToCart;
window.changeCartQty = changeCartQty;
window.removeCartItem = removeCartItem;