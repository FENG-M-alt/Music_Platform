from django.urls import path
from . import views

urlpatterns = [
    path('', views.music_list, name='music_list'),  # 音乐列表页
    path('import/', views.import_music, name='import_music'),  # 批量导入
    path('music/<int:music_id>/file/', views.serve_music, name='serve_music'),
]