// index/index.js
// 主页交互逻辑（仅跳转，无其他功能）

document.addEventListener('DOMContentLoaded', function() {

    // 获取三个按钮
    const startBtn = document.getElementById('startBtn');
    const wishBtn = document.getElementById('wishBtn');
    const reportBtn = document.getElementById('reportBtn');

    // 1. 开始冒险 → 跳转到游戏页面（后续实现）
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            window.location.href = '/character';
        });
    }

    // 2. 许愿池 → 跳转到 /wish
    if (wishBtn) {
        wishBtn.addEventListener('click', function() {
            window.location.href = '/wish';
        });
    }

    // 3. 纠错反馈 → 跳转到 /report
    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            window.location.href = '/report';
        });
    }

});