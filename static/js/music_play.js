// static/js/music_play.js
/**
 * 音乐播放器核心功能
 * 负责音频播放、控制、进度管理等功能
 */

class MusicPlayer {
    constructor() {
        console.log('MusicPlayer 初始化');
        this.audio = document.getElementById('global-audio');
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.volume = 100;
        this.currentMusicId = null;
        this.isSeeking = false;
        this.autoHideTimer = null;

        // 确保只有一个播放器实例
        if (window.musicPlayerInstance) {
            console.warn('音乐播放器已存在，返回现有实例');
            return window.musicPlayerInstance;
        }

        this.initElements();
        this.initFromDOM();
        this.bindEvents();
        this.loadVolumeSetting();

        window.musicPlayerInstance = this;
    }

    initElements() {
        // 眉页播放器元素
        this.elements = {
            playBtn: document.getElementById('header-play-pause-btn'),
            prevBtn: document.getElementById('header-prev-btn'),
            nextBtn: document.getElementById('header-next-btn'),
            progressBar: document.getElementById('header-progress-bar'),
            volumeBar: document.getElementById('header-volume-bar'),
            currentTime: document.getElementById('header-current-time'),
            duration: document.getElementById('header-duration'),
            nowPlayingName: document.getElementById('now-playing-name'),
            nowPlayingSinger: document.getElementById('now-playing-singer'),
            headerPlayer: document.getElementById('header-audio-player')
        };
    }

    initFromDOM() {
        // 从DOM中获取音乐列表
        const musicItems = document.querySelectorAll('.music-item');
        this.playlist = Array.from(musicItems).map((item, index) => ({
            id: item.dataset.musicId,
            src: item.dataset.musicSrc,
            name: item.dataset.musicName,
            singer: item.dataset.musicSinger,
            album: item.dataset.musicAlbum,
            element: item,
            index: index
        }));
        console.log(`加载了 ${this.playlist.length} 首歌曲到播放列表`);
    }

    bindEvents() {
        console.log('绑定事件监听器');

        // 移除可能存在的重复事件监听器
        this.removeEventListeners();

        // 音频事件
        if (this.audio) {
            this.audio.addEventListener('timeupdate', this.updateProgress.bind(this));
            this.audio.addEventListener('loadedmetadata', this.updateDuration.bind(this));
            this.audio.addEventListener('ended', this.handleEnded.bind(this));
            this.audio.addEventListener('play', this.onPlay.bind(this));
            this.audio.addEventListener('pause', this.onPause.bind(this));
            this.audio.addEventListener('error', this.onError.bind(this));
        }

        // 控制按钮事件
        if (this.elements.playBtn) {
            this.elements.playBtn.addEventListener('click', this.togglePlay.bind(this));
        }

        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', this.playPrev.bind(this));
        }

        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', this.playNext.bind(this));
        }

        // 进度条事件
        if (this.elements.progressBar) {
            this.elements.progressBar.addEventListener('input', this.handleProgressChange.bind(this));
            this.elements.progressBar.addEventListener('mousedown', () => this.isSeeking = true);
            this.elements.progressBar.addEventListener('mouseup', () => this.isSeeking = false);
        }

        // 音量控制事件
        if (this.elements.volumeBar) {
            this.elements.volumeBar.addEventListener('input', this.handleVolumeChange.bind(this));
        }

        // 键盘快捷键支持
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // 页面可见性变化处理
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // 绑定音乐行点击事件（使用事件委托提高性能）
        document.addEventListener('click', this.handleDocumentClick.bind(this));
    }

    removeEventListeners() {
        // 清除所有可能存在的旧事件监听器
        if (this.audio) {
            this.audio.removeEventListener('timeupdate', this.updateProgress);
            this.audio.removeEventListener('loadedmetadata', this.updateDuration);
            this.audio.removeEventListener('ended', this.handleEnded);
            this.audio.removeEventListener('play', this.onPlay);
            this.audio.removeEventListener('pause', this.onPause);
            this.audio.removeEventListener('error', this.onError);
        }
    }

    handleDocumentClick(event) {
        // 点击播放链接
        if (event.target.classList.contains('play-link')) {
            event.preventDefault();
            const row = event.target.closest('.music-item');
            if (row) {
                this.playByElement(row);
            }
        }
        // 点击音乐行（非播放链接）
        else if (event.target.closest('.music-item')) {
            const row = event.target.closest('.music-item');
            if (row && !event.target.classList.contains('play-link')) {
                this.playByElement(row);
            }
        }
    }

    // 播放指定音乐
    playMusic(musicData, index = -1) {
        if (!this.audio) {
            console.error('音频元素未找到');
            return false;
        }

        // 检查文件是否存在标记
        const row = document.querySelector(`[data-music-id="${musicData.musicId}"]`);
        if (row && row.dataset.fileExists === 'false') {
            this.showError('文件不存在，无法播放');
            return false;
        }

        // 获取文件URL
        const fileSrc = musicData.musicSrc;

        if (!fileSrc) {
            console.error('没有有效的文件路径');
            this.showError('无法获取音乐文件');
            return false;
        }

        console.log('播放音乐:', musicData.musicName, 'URL:', fileSrc);

        // 如果已经在播放同一首歌，直接返回
        if (this.currentMusicId === musicData.musicId && !this.audio.paused) {
            console.log('已在播放同一首歌');
            return true;
        }

        try {
            // 更新当前播放信息
            this.currentMusicId = musicData.musicId;

            // 查找索引
            if (index === -1) {
                this.currentIndex = this.findIndexById(musicData.musicId);
            } else {
                this.currentIndex = index;
            }

            console.log(`播放索引: ${this.currentIndex}`);

            // 停止当前播放
            this.audio.pause();
            this.isPlaying = false;

            // 设置音频源
            this.audio.src = fileSrc;
            this.audio.dataset.currentId = musicData.musicId;

            // 更新显示信息
            this.updateDisplay({
                name: musicData.musicName,
                singer: musicData.musicSinger
            });

            // 高亮当前播放项
            this.highlightCurrentItem();

            // 显示播放器
            this.showPlayer();

            // 播放音频
            return this.audio.play().then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
                console.log('播放成功');
                return true;
            }).catch(error => {
                console.error('播放失败:', error);

                // 尝试重新加载
                setTimeout(() => {
                    this.audio.load();
                    this.audio.play().catch(e => {
                        console.error('重试播放失败:', e);
                        this.showError('播放失败，请检查网络或文件');
                    });
                }, 500);

                return false;
            });
        } catch (error) {
            console.error('播放音乐时出错:', error);
            this.showError('播放失败，音频文件可能已损坏');
            return false;
        }
    }

    // 通过ID查找索引
    findIndexById(musicId) {
        return this.playlist.findIndex(item => item.id === musicId);
    }

    // 通过音乐数据播放
    playByData(musicData) {
        const music = {
            id: musicData.musicId || musicData.id,
            src: musicData.musicSrc || musicData.src,
            name: musicData.musicName || musicData.name,
            singer: musicData.musicSinger || musicData.singer,
            album: musicData.musicAlbum || musicData.album || '未知专辑'
        };
        return this.playMusic(music);
    }

    // 通过元素播放
    playByElement(element) {
        if (element && element.classList.contains('music-item')) {
            this.playByData(element.dataset);
        }
    }

    // 播放/暂停切换
    togglePlay() {
        if (!this.audio || !this.audio.src) {
            // 如果没有音乐在播放，播放第一首
            if (this.playlist.length > 0) {
                this.playMusic(this.playlist[0], 0);
            } else {
                console.warn('播放列表为空');
            }
            return;
        }

        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    // 播放
    play() {
        if (this.audio && this.audio.src) {
            this.audio.play().then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
            }).catch(error => {
                console.error('播放失败:', error);
                this.showError('播放失败');
            });
        }
    }

    // 暂停
    pause() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }

    // 播放上一首
    playPrev() {
        if (this.playlist.length === 0) {
            console.warn('播放列表为空');
            return;
        }

        let prevIndex;
        if (this.currentIndex === -1 || this.currentIndex === 0) {
            prevIndex = this.playlist.length - 1; // 循环到最后一首
        } else {
            prevIndex = this.currentIndex - 1;
        }

        console.log(`播放上一首，从索引 ${this.currentIndex} 到 ${prevIndex}`);
        this.playMusic(this.playlist[prevIndex], prevIndex);
    }

    // 播放下一首
    playNext() {
        if (this.playlist.length === 0) {
            console.warn('播放列表为空');
            return;
        }

        let nextIndex;
        if (this.currentIndex === -1 || this.currentIndex === this.playlist.length - 1) {
            nextIndex = 0; // 循环到第一首
        } else {
            nextIndex = this.currentIndex + 1;
        }

        console.log(`播放下一首，从索引 ${this.currentIndex} 到 ${nextIndex}`);
        this.playMusic(this.playlist[nextIndex], nextIndex);
    }

    // 处理播放结束
    handleEnded() {
        console.log('歌曲播放结束');
        this.playNext();
    }

    // 进度条变化处理
    handleProgressChange(e) {
        if (!this.audio || !this.audio.duration) return;
        const time = (this.audio.duration * e.target.value) / 100;
        this.audio.currentTime = time;
    }

    // 音量变化处理
    handleVolumeChange(e) {
        if (!this.audio) return;
        this.volume = parseInt(e.target.value);
        this.audio.volume = this.volume / 100;
        localStorage.setItem('music-player-volume', this.volume);
    }

    // 更新进度显示
    updateProgress() {
        if (!this.audio || !this.audio.duration || this.isSeeking) return;

        const current = this.audio.currentTime;
        const duration = this.audio.duration;
        const percent = (current / duration) * 100;

        // 更新进度条
        if (this.elements.progressBar) {
            this.elements.progressBar.value = percent;
        }

        // 更新时间显示
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(current);
        }
    }

    // 更新时长显示
    updateDuration() {
        if (!this.audio || !this.audio.duration) return;

        if (this.elements.duration) {
            this.elements.duration.textContent = this.formatTime(this.audio.duration);
        }
    }

    // 更新播放按钮状态
    updatePlayButton() {
        if (!this.elements.playBtn) return;

        if (this.isPlaying) {
            this.elements.playBtn.textContent = '⏸';
            this.elements.playBtn.title = '暂停';
            this.elements.playBtn.classList.add('playing');
        } else {
            this.elements.playBtn.textContent = '▶';
            this.elements.playBtn.title = '播放';
            this.elements.playBtn.classList.remove('playing');
        }
    }

    // 更新显示信息
    updateDisplay(musicData) {
        if (this.elements.nowPlayingName) {
            this.elements.nowPlayingName.textContent = musicData.name || '未知歌曲';
        }
        if (this.elements.nowPlayingSinger) {
            this.elements.nowPlayingSinger.textContent = musicData.singer || '未知歌手';
        }
    }

    // 高亮当前播放项
    highlightCurrentItem() {
        // 移除所有高亮
        document.querySelectorAll('.music-item.playing').forEach(item => {
            item.classList.remove('playing');
        });

        // 高亮当前播放项
        const currentItem = document.querySelector(`[data-music-id="${this.currentMusicId}"]`);
        if (currentItem) {
            currentItem.classList.add('playing');

            // 滚动到可见区域（但不要太频繁）
            if (!this.scrollTimeout) {
                this.scrollTimeout = setTimeout(() => {
                    this.scrollToElement(currentItem);
                    this.scrollTimeout = null;
                }, 300);
            }
        }
    }

    // 滚动到元素
    scrollToElement(element) {
        if (!element) return;

        const elementRect = element.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const middle = absoluteElementTop - (window.innerHeight / 2) + (elementRect.height / 2);

        window.scrollTo({
            top: middle,
            behavior: 'smooth'
        });
    }

    // 显示播放器
    showPlayer() {
        if (this.elements.headerPlayer) {
            this.elements.headerPlayer.classList.add('visible');

            // 重置自动隐藏计时器
            this.resetAutoHideTimer();
        }
    }

    // 重置自动隐藏计时器
    resetAutoHideTimer() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }

        // 5秒后开始检查是否需要隐藏
        this.autoHideTimer = setTimeout(() => {
            if (this.elements.headerPlayer && !this.elements.headerPlayer.matches(':hover')) {
                this.elements.headerPlayer.classList.remove('visible');
            }
        }, 5000);
    }

    // 键盘快捷键处理
    handleKeyboardShortcuts(e) {
        // 避免在输入框中触发快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        switch (e.key.toLowerCase()) {
            case ' ': // 空格键
                e.preventDefault();
                this.togglePlay();
                break;
            case 'arrowleft':
                if (e.ctrlKey) this.playPrev();
                break;
            case 'arrowright':
                if (e.ctrlKey) this.playNext();
                break;
            case 'arrowup':
                if (e.ctrlKey) {
                    e.preventDefault();
                    const newVolume = Math.min(this.volume + 10, 100);
                    this.setVolume(newVolume);
                }
                break;
            case 'arrowdown':
                if (e.ctrlKey) {
                    e.preventDefault();
                    const newVolume = Math.max(this.volume - 10, 0);
                    this.setVolume(newVolume);
                }
                break;
            case 'm': // 静音/取消静音
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.audio.muted = !this.audio.muted;
                }
                break;
        }
    }

    // 页面可见性变化处理
    handleVisibilityChange() {
        if (document.hidden && this.isPlaying) {
            // 页面隐藏时暂停播放
            this.audio.pause();
        } else if (!document.hidden && !this.audio.paused && this.isPlaying) {
            // 页面恢复显示时继续播放
            this.audio.play().catch(e => {
                console.error('恢复播放失败:', e);
            });
        }
    }

    // 设置音量
    setVolume(percent) {
        if (!this.audio) return;
        this.volume = parseInt(percent);
        this.audio.volume = this.volume / 100;
        if (this.elements.volumeBar) {
            this.elements.volumeBar.value = this.volume;
        }
        localStorage.setItem('music-player-volume', this.volume);
    }

    // 时间格式化
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // 加载音量设置
    loadVolumeSetting() {
        const savedVolume = localStorage.getItem('music-player-volume');
        if (savedVolume !== null) {
            this.setVolume(parseInt(savedVolume));
        }
    }

    // 错误处理
    onError(error) {
        console.error('音频播放错误:', error);
        this.showError('音频播放错误');

        // 延迟一下再尝试播放下一首，避免立即重复错误
        setTimeout(() => {
            this.playNext();
        }, 1000);
    }

    // 显示错误消息
    showError(message) {
        // 如果已经存在错误提示，先移除
        const existingError = document.querySelector('.music-player-error');
        if (existingError) {
            existingError.remove();
        }

        // 创建临时错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'music-player-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 9999;
            animation: fadeInOut 3s ease;
            box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    // 播放事件处理
    onPlay() {
        this.isPlaying = true;
        this.updatePlayButton();
    }

    // 暂停事件处理
    onPause() {
        this.isPlaying = false;
        this.updatePlayButton();
    }

    // 获取当前播放状态
    getCurrentState() {
        return {
            isPlaying: this.isPlaying,
            currentTime: this.audio ? this.audio.currentTime : 0,
            duration: this.audio ? this.audio.duration : 0,
            volume: this.volume,
            currentMusic: this.currentMusicId ? this.playlist[this.currentIndex] : null
        };
    }

    // 销毁播放器
    destroy() {
        this.removeEventListeners();

        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
        }

        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }

        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        this.playlist = [];
        this.currentIndex = -1;
        this.currentMusicId = null;

        window.musicPlayerInstance = null;
    }
}

// 初始化播放器
function initMusicPlayer() {
    console.log('初始化音乐播放器');

    // 确保只初始化一次
    if (window.musicPlayerInstance) {
        console.log('播放器已存在，跳过初始化');
        return window.musicPlayerInstance;
    }

    if (document.getElementById('global-audio')) {
        try {
            const player = new MusicPlayer();

            // 全局导出，方便调试
            window.musicPlayer = player;
            console.log('音乐播放器初始化完成');

            return player;
        } catch (error) {
            console.error('音乐播放器初始化失败:', error);
            return null;
        }
    } else {
        console.warn('未找到音频元素，跳过播放器初始化');
        return null;
    }
}

// 全局辅助函数
function playMusic(musicData) {
    const player = window.musicPlayerInstance || initMusicPlayer();
    if (player) {
        return player.playByData(musicData);
    }
    return false;
}

function playMusicById(musicId) {
    const player = window.musicPlayerInstance || initMusicPlayer();
    if (player) {
        const musicItem = document.querySelector(`[data-music-id="${musicId}"]`);
        if (musicItem) {
            return player.playByData(musicItem.dataset);
        }
    }
    return false;
}

function togglePlayback() {
    const player = window.musicPlayerInstance || initMusicPlayer();
    if (player) {
        player.togglePlay();
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initMusicPlayer, 100); // 延迟一点确保DOM完全加载
    });
} else {
    setTimeout(initMusicPlayer, 100);
}

// 导出到全局作用域
window.MusicPlayer = MusicPlayer;
window.playMusic = playMusic;
window.playMusicById = playMusicById;
window.togglePlayback = togglePlayback;

// 在卸载页面时清理资源
window.addEventListener('beforeunload', () => {
    if (window.musicPlayerInstance) {
        window.musicPlayerInstance.destroy();
    }
});

// 添加CSS样式
if (!document.getElementById('music-player-styles')) {
    const style = document.createElement('style');
    style.id = 'music-player-styles';
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
        
        .play-pause-btn.playing {
            background: rgba(255, 255, 255, 0.3) !important;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
    `;
    document.head.appendChild(style);
}