// report/report.js
// 纠错反馈页面交互逻辑

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
    if (status === 0) return '<span class="report-item-badge unread">未读</span>';
    if (status === 1) return '<span class="report-item-badge received">已收到</span>';
    if (status === 2) return '<span class="report-item-badge completed">已完成</span>';
    return '';
}

// ===== 时间格式化 =====
function formatTime(t) {
    if (!t) return '';
    return t.replace('T', ' ').substring(0, 16);
}

// ===== 加载反馈列表（自动按IP过滤） =====
function loadReportList() {
    var listEl = document.getElementById('reportList');
    var countEl = document.getElementById('reportCount');
    if (!listEl) return;

    fetch('/api/reports')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data.success) return;
            var items = data.data || [];
            countEl.textContent = items.length + ' 条';

            if (items.length === 0) {
                listEl.innerHTML = '<div class="report-list-empty">📭 你还没有提交过反馈</div>';
                return;
            }

            var html = '';
            for (var i = 0; i < items.length; i++) {
                var d = items[i];
                html += '<div class="report-item">'
                    +   '<div class="report-item-top">'
                    +     '<span class="report-item-content">' + d.content + '</span>'
                    +     getStatusBadge(d.status)
                    +   '</div>'
                    +   '<div class="report-item-time">🕐 ' + formatTime(d.created_at) + '</div>'
                    + '</div>';
            }
            listEl.innerHTML = html;
        })
        .catch(function(err) {
            console.error('加载反馈列表失败:', err);
        });
}

document.addEventListener('DOMContentLoaded', function() {

    const submitBtn = document.getElementById('submitBtn');
    const errorInput = document.getElementById('errorInput');
    const ruleSelect = document.getElementById('ruleSelect');

    // 加载反馈列表
    loadReportList();

    if (!submitBtn || !errorInput || !ruleSelect) {
        console.warn('纠错页面元素未找到，请检查 HTML id');
        return;
    }

    // 检查是否有冷却中
    checkCooldown(submitBtn, 'report_cooldown');

    submitBtn.addEventListener('click', function() {
        if (submitBtn.disabled) return;

        const content = errorInput.value.trim();
        const rule_type = ruleSelect.value;

        if (!content) {
            alert('请描述你遇到的问题');
            return;
        }

        submitBtn.disabled = true;

        fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, rule_type: rule_type })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                errorInput.value = '';
                setTimeout(function() {
                    startCooldown(submitBtn, 'report_cooldown');
                }, 400 + Math.random() * 600);
                // 刷新列表
                loadReportList();
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