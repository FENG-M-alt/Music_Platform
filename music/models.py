from django.db import models
from django.utils import timezone
import os
from .utils import get_music_file_path
# Create your models here.

class Music(models.Model):
    """音乐模型"""
    name = models.CharField(max_length=100, verbose_name="歌曲名")
    singer = models.CharField(max_length=100, verbose_name="歌手")
    album = models.CharField(max_length=100, blank=True, null=True, verbose_name="专辑")
    file_path = models.CharField(max_length=500, blank=True, null=True, verbose_name="文件路径")
    created_at = models.DateTimeField(
        default=timezone.now,
        blank=True,
        verbose_name="添加时间"
    )

    class Meta:
        verbose_name = "音乐"
        verbose_name_plural = "音乐"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.singer} - {self.name}"
    
    @property
    def file_size(self):
        """获取文件大小(MB)"""
        try:
            if not self.file_path:
                return 0
            size = os.path.getsize(self.file_path) / (1024 * 1024)
            return round(size, 2)
        except Exception:
            return 0

    @property
    def file_exists(self):
        """返回文件是否存在（用于模板判断）"""
        try:
            path = get_music_file_path(self)
            return bool(path and os.path.exists(path))
        except Exception:
            return False