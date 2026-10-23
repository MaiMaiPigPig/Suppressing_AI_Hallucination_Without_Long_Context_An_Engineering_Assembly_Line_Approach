$(function() {

    // ============================================================
    // 1. 默认显示欢迎页
    // ============================================================
    showWelcome();

    // ============================================================
    // 2. 左侧菜单点击切换
    // ============================================================
    $('.menu-item').click(function() {
        // 高亮当前菜单
        $('.menu-item').removeClass('active');
        $(this).addClass('active');

        // 根据菜单项加载不同内容
        var menu = $(this).data('menu');

        if (menu === 'study') {
            // 学习沙盒 — 使用 iframe 保持独立 JS 上下文
            $('#contentArea').html(
                '<iframe src="/backstage/study/study.html" ' +
                'style="width:100%;height:100%;border:none;display:block;"></iframe>'
            );
        } else if (menu === 'feedback') {
            loadContent('/backstage/report/report.html');
        } else if (menu === 'wish') {
            loadContent('/backstage/wish/wish.html');
        } else if (menu === 'test') {
            // 单元测试 — 使用 iframe 加载，保持独立 JS 上下文
            $('#contentArea').html(
                '<iframe src="/backstage/test/test.html" ' +
                'style="width:100%;height:100%;border:none;display:block;"></iframe>'
            );
        }
    });

    // ============================================================
    // 3. 退出登录
    // ============================================================
    $('#logoutBtn').click(function() {
        if (confirm('确定要退出登录吗？')) {
            window.location.href = '/backstage/login';
        }
    });

    // ============================================================
        // 4. 欢迎页
        // ============================================================
        function showWelcome() {
            $('#contentArea').html(
                '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;text-align:center;">' +
                '<div style="font-size:64px;margin-bottom:16px;">📖</div>' +
                '<h2 style="font-size:24px;font-weight:700;color:#3b2a1f;margin-bottom:8px;">欢迎回来</h2>' +
                '<p style="font-size:15px;color:#8a7a6a;">从左侧菜单选择功能开始操作</p>' +
                '</div>'
            );
        }

        // ============================================================
        // 5. 加载内容的函数（用 AJAX 加载 HTML 片段到内容区）
        // ============================================================
        function loadContent(url) {
            $('#contentArea').load(url, function(response, status, xhr) {
                if (status === 'error') {
                    $('#contentArea').html(
                        '<div style="padding:40px;text-align:center;color:#8a7a6a;">' +
                        '⚠️ 加载失败，请刷新重试' +
                        '</div>'
                    );
                    console.error('加载失败:', url, xhr.status, xhr.statusText);
                }
            });
        }

        // 暴露给子页面使用
        window.loadContent = loadContent;

});