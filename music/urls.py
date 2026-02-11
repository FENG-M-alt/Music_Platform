from django.urls import path
from . import views

urlpatterns = [
    path('', views.music_list, name='music_list'),  # 音乐列表页
    path('import/', views.import_music, name='import_music'),  # 批量导入
    path('play/<int:music_id>/', views.play_music, name='play_music'),
    path('check-file/<int:music_id>/', views.check_file_exists, name='check_file_exists'),
]