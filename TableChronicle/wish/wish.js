// wish/wish.js
// 许愿池页面交互逻辑

// ===== 冷却控制：30秒置灰 =====
const COOLDOWN_DURATION = 30000;

function startCooldown(btn, key) {
    const endTime = Date.now() + COOLDOWN_DURATION;
    localStorage.setItem(key, endTime);
    btn.disabled = true;
    setTimeout(function() {
        btn.disabled = false;
        localStorage.removeItem(key);
    }, COOLDOWN_DURATION);
}

function checkCooldown(btn, key) {
    const endTime = parseInt(localStorage.getItem(key));
    if (endTime && endTime > Date.now()) {
        btn.disabled = true;
        var remain = endTime - Date.now();
        setTimeout(function() {
            btn.disabled = false;
            localStorage.removeItem(key);
        }, remain);
        return true;
    }
    localStorage.removeItem(key);
    return false;
}

// ===== 状态标签渲染 =====
function getStatusBadge(status) {
    if (status === 0) return '<span class="wish-item-badge unread">未读</span>';
    if (status === 1) return '<span class="wish-item-badge received">已收到</span>';
    if (status === 2) return '<span class="wish-item-badge completed">已完成</span>';
    return '';
}

// ===== 类型文本 =====
function getTypeText(type) {
    var map = { 'new_rule': '新增规则', 'new_class': '新增职业', 'new_feature': '新增功能' };
    return map[type] || type || '-';
}

// ===== 时间格式化 =====
function formatTime(t) {
    if (!t) return '';
    return t.replace('T', ' ').substring(0, 16);
}

// ===== 加载心愿列表 =====
function loadWishList() {
    var listEl = document.getElementById('wishList');
    var countEl = document.getElementById('wishCount');
    if (!listEl) return;

    fetch('/api/wishes')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data.success) return;
            var items = data.data || [];
            countEl.textContent = items.length + ' 个心愿';

            if (items.length === 0) {
                listEl.innerHTML = '<div class="wish-list-empty">🌙 还没有心愿，快来许下第一个吧</div>';
                return;
            }

            var html = '';
            for (var i = 0; i < items.length; i++) {
                var d = items[i];
                html += '<div class="wish-item">'
                    +   '<div class="wish-item-top">'
                    +     '<span class="wish-item-content">' + d.content + '</span>'
                    +     getStatusBadge(d.status)
                    +   '</div>'
                    +   '<div class="wish-item-type">📂 ' + getTypeText(d.type) + '</div>'
                    +   '<div class="wish-item-time">🕐 ' + formatTime(d.created_at) + '</div>'
                    + '</div>';
            }
            listEl.innerHTML = html;
        })
        .catch(function(err) {
            console.error('加载心愿列表失败:', err);
        });
}

document.addEventListener('DOMContentLoaded', function() {

    const submitBtn = document.getElementById('submitBtn');
    const wishInput = document.getElementById('wishInput');
    const categorySelect = document.getElementById('categorySelect');

    // 加载心愿列表
    loadWishList();

    if (!submitBtn || !wishInput || !categorySelect) {
        console.warn('许愿池元素未找到，请检查 HTML id');
        return;
    }

    // 检查是否有冷却中
    checkCooldown(submitBtn, 'wish_cooldown');

    submitBtn.addEventListener('click', function() {
        if (submitBtn.disabled) return;

        const content = wishInput.value.trim();
        const type = categorySelect.value;

        if (!content) {
            alert('请写下你的心愿');
            return;
        }

        submitBtn.disabled = true;

        fetch('/api/wish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, type: type })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                wishInput.value = '';
                setTimeout(function() {
                    startCooldown(submitBtn, 'wish_cooldown');
                }, 400 + Math.random() * 600);
                // 刷新列表
                loadWishList();
            } else {
                submitBtn.disabled = false;
                alert('❌ ' + data.message);
            }
        })
        .catch(function(err) {
            console.error(err);
            submitBtn.disabled = false;
        });
    });

});