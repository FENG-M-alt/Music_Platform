# Create your views here.
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponse, FileResponse
from django.urls import reverse
from django.contrib import messages
import os
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from .models import Music
from .utils import get_music_file_path, get_content_type

# 支持的音频格式
SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma']

def music_list(request):
    # 1. 查询所有音乐数据（按添加时间倒序）
    music_list = Music.objects.all().order_by('-created_at')
    
    # 2. 初始化分页器：每页50条
    paginator = Paginator(music_list, 50)
    
    # 3. 获取当前页码（从请求参数中获取，默认第1页）
    page = request.GET.get('page', 1)
    
    try:
        # 4. 获取当前页的音乐数据
        musics = paginator.page(page)
    except PageNotAnInteger:
        # 如果页码不是整数，返回第一页
        musics = paginator.page(1)
    except EmptyPage:
        # 如果页码超出范围，返回最后一页
        musics = paginator.page(paginator.num_pages)
    
    context = {
        'musics': musics,
        'paginator': paginator
    }
    
    # 5. 传递分页数据到模板
    return render(request, 'music/music_list.html', context)

def serve_music(request, music_id):
    """提供音乐文件服务 - 处理绝对路径"""
    music = get_object_or_404(Music, id=music_id)
    
    # 获取真实文件路径
    file_path = get_music_file_path(music)
    
    if not file_path:
        # 尝试从数据库中直接获取路径
        if music.file_path and os.path.exists(music.file_path):
            file_path = music.file_path
        else:
            return HttpResponse(f'文件不存在或路径错误: {music.file_path}', status=404)
    
    try:
        # 使用FileResponse，支持大文件
        response = FileResponse(
            open(file_path, 'rb'),
            content_type=get_content_type(file_path)
        )
        
        # 设置文件名
        filename = os.path.basename(file_path)
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        # 添加CORS头，允许跨域请求（如果需要）
        response['Access-Control-Allow-Origin'] = '*'
        
        return response
        
    except PermissionError:
        return HttpResponse('没有权限访问文件', status=403)
    except FileNotFoundError:
        return HttpResponse('文件不存在', status=404)
    except Exception as e:
        return HttpResponse(f'读取文件失败: {str(e)}', status=500)

def import_music(request):
    """批量导入本地音乐文件"""
    if request.method == 'POST':
        music_folder = request.POST.get('music_folder', '')
        
        if not os.path.exists(music_folder):
            messages.error(request, '文件夹路径不存在！')
            return HttpResponseRedirect(reverse('import_music'))
        
        imported_count = 0
        skipped_count = 0
        
        for filename in os.listdir(music_folder):
            file_path = os.path.join(music_folder, filename)
            
            if os.path.isdir(file_path):
                continue
            
            # 获取文件扩展名
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma']:
                skipped_count += 1
                continue
            
            # 解析文件名
            name_without_ext = os.path.splitext(filename)[0]
            name_parts = name_without_ext.split('-', 1)
            
            if len(name_parts) == 2:
                singer = name_parts[0].strip()
                name = name_parts[1].strip()
            else:
                singer = '未知歌手'
                name = name_without_ext.strip()
            
            # 检查是否已存在
            if Music.objects.filter(singer=singer, name=name).exists():
                skipped_count += 1
                continue
            
            try:
                # 直接存储绝对路径
                music = Music(
                    name=name,
                    singer=singer,
                    album='未知专辑',
                    file_path=file_path  # 存储绝对路径
                )
                music.save()
                
                imported_count += 1
                
            except Exception as e:
                print(f"导入文件 {filename} 时出错: {e}")
                skipped_count += 1
                continue
        
        messages.success(request, f'导入成功！新增 {imported_count} 首，跳过 {skipped_count} 首')
        return HttpResponseRedirect(reverse('music_list'))
    
    return render(request, 'music/import_music.html')