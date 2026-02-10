# music/utils.py
import os
import mimetypes
from django.conf import settings

def get_music_file_path(music):
    """获取音乐文件的真实路径"""
    if not music.file_path:
        return None
    
    # file_path是绝对路径
    file_path = music.file_path
    
    # 如果路径不存在，尝试一些常见的修复
    if not os.path.exists(file_path):
        # 尝试在MEDIA_ROOT下查找
        if settings.MEDIA_ROOT and not os.path.isabs(music.file_path):
            possible_path = os.path.join(settings.MEDIA_ROOT, music.file_path)
            if os.path.exists(possible_path):
                return possible_path
        
        # 如果是Windows路径但使用了错误的分隔符
        if '\\' in file_path:
            file_path = file_path.replace('\\', '/')
        elif '/' in file_path and ':' in file_path:
            # 尝试修复Windows路径
            if file_path.startswith('/'):
                # 类似 /D:/music/xxx.mp3 的格式
                drive = file_path[1:3]  # 获取 D:
                rest = file_path[3:]
                file_path = f"{drive}{rest}"
        
        # 再次检查
        if not os.path.exists(file_path):
            return None
    
    return file_path

def get_content_type(filename):
    """根据文件名获取Content-Type"""
    content_type, encoding = mimetypes.guess_type(filename)
    if content_type:
        return content_type
    
    # 根据扩展名设置默认类型
    ext = os.path.splitext(filename)[1].lower()
    audio_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.wma': 'audio/x-ms-wma',
    }
    
    return audio_types.get(ext, 'application/octet-stream')