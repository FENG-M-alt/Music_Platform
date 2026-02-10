// static/js/header_player.js
document.addEventListener('DOMContentLoaded', function () {
    // 眉页播放器显示/隐藏控制
    let headerPlayer = document.getElementById('header-audio-player');
    let hideTimeout;

    // 如果没有找到播放器元素，退出
    if (!headerPlayer) return;

    // 鼠标移入页面顶部时显示播放器
    document.addEventListener('mousemove', function (e) {
        if (e.clientY < 80) { // 距离顶部80px范围内
            clearTimeout(hideTimeout);
            headerPlayer.classList.add('visible');
        } else if (e.clientY > 120) { // 离开区域超过120px时
            hideTimeout = setTimeout(() => {
                headerPlayer.classList.remove('visible');
            }, 1000); // 延迟1秒隐藏
        }
    });

    // 保持播放器在鼠标移入时显示
    headerPlayer.addEventListener('mouseenter', function () {
        clearTimeout(hideTimeout);
        headerPlayer.classList.add('visible');
    });

    // 鼠标移出播放器时开始隐藏倒计时
    headerPlayer.addEventListener('mouseleave', function () {
        hideTimeout = setTimeout(() => {
            headerPlayer.classList.remove('visible');
        }, 2000); // 延迟2秒隐藏
    });
});