// 全局工具函数
document.addEventListener('DOMContentLoaded', function () {
    // 消息提示框自动消失（3秒后）
    const messages = document.querySelectorAll('.message');
    messages.forEach(function (msg) {
        setTimeout(function () {
            msg.style.opacity = '0';
            msg.style.transition = 'opacity 0.5s';
            setTimeout(function () {
                msg.remove();
            }, 500);
        }, 3000);
    });
});