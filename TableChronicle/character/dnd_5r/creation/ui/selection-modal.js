/**
 * creation/ui/selection-modal.js
 * 选择弹窗系统 + 待选收集
 */

let _selectionContext = null;

/**
 * 打开选择弹窗
 * @param {string} title - 弹窗标题
 * @param {Array} items - 可选项目列表 [{id, name, desc}]
 * @param {number} maxSelect - 最多选几个
 * @param {Function} onConfirm - 确认回调(selectedIds)
 * @param {Array} preSelected - 预选中的ID列表
 */
export function openSelectionModal(title, items, maxSelect, onConfirm, preSelected) {
    _selectionContext = {
        items: items,
        maxSelect: maxSelect,
        selected: preSelected ? [...preSelected] : [],
        onConfirm: onConfirm
    };

    document.getElementById('selectionModalTitle').textContent = title;
    const body = document.getElementById('selectionModalBody');
    body.innerHTML = items.map(item => {
        const isSelected = _selectionContext.selected.includes(item.id);
        return `
            <div class="selection-item ${isSelected ? 'selected' : ''}"
                 data-id="${item.id}">
                <div class="selection-item-name">${item.name}</div>
                ${item.desc ? `<div class="selection-item-desc">${item.desc}</div>` : ''}
            </div>
        `;
    }).join('');

    // 绑定点击事件（事件委托）
    body.querySelectorAll('.selection-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            toggleSelectionItem(id);
            el.classList.toggle('selected');
        });
    });

    if (items.length > 4) {
        body.style.display = 'grid';
        body.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        body.style.gap = '8px';
    } else {
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = '6px';
    }

    updateSelectionHint();
    document.getElementById('selectionModalOverlay').style.display = 'flex';
}

function toggleSelectionItem(id) {
    if (!_selectionContext) return;
    const idx = _selectionContext.selected.indexOf(id);
    if (idx >= 0) {
        _selectionContext.selected.splice(idx, 1);
    } else {
        if (_selectionContext.selected.length >= _selectionContext.maxSelect) {
            alert('最多只能选择 ' + _selectionContext.maxSelect + ' 项');
            return;
        }
        _selectionContext.selected.push(id);
    }
    updateSelectionHint();
}

function updateSelectionHint() {
    const hint = document.getElementById('selectionModalHint');
    if (!_selectionContext) return;
    hint.textContent = `已选：${_selectionContext.selected.length} / ${_selectionContext.maxSelect === Infinity ? '不限' : _selectionContext.maxSelect}`;
}

export function closeSelectionModal() {
    document.getElementById('selectionModalOverlay').style.display = 'none';
    _selectionContext = null;
}

export function confirmSelectionModal() {
    if (!_selectionContext) return;
    const selected = _selectionContext.selected;
    if (selected.length === 0) {
        alert('请至少选择一项');
        return;
    }
    _selectionContext.onConfirm(selected);
    closeSelectionModal();
}