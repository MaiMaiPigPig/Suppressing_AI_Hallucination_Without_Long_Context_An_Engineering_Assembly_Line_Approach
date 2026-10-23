$(function() {
    // ===== 忘记密码：显示弹窗 =====
    $('#forgotPwdLink').click(function(e) {
        e.preventDefault();
        $('#forgotModal').addClass('show');
    });

    // ===== 关闭弹窗 =====
    $('#closeModal, #modalConfirmBtn').click(function() {
        $('#forgotModal').removeClass('show');
    });

    // ===== 点击弹窗外关闭 =====
    $('#forgotModal').click(function(e) {
        if (e.target === this) {
            $(this).removeClass('show');
        }
    });

    // ===== 登录按钮：直接跳转到后台主页（不校验账号密码） =====
    $('#loginBtn').click(function() {
        window.location.href = '/backstage';
    });

    // ===== 按回车键也可以登录 =====
    $('#password, #username').keydown(function(e) {
        if (e.key === 'Enter') {
            $('#loginBtn').click();
        }
    });
});