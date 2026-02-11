# Create your views here.
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponse, FileResponse, Http404, JsonResponse
from django.urls import reverse
from django.contrib import messages
import os
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from .models import Music
from .utils import get_music_file_path, get_content_type
from django.conf import settings

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

def play_music(request, music_id):
    """
    播放音乐文件
    现在使用流式响应，支持音频播放器的进度条和缓冲
    """
    try:
        music = Music.objects.get(id=music_id)
    except Music.DoesNotExist:
        raise Http404("音乐不存在")
    
    # 先解析真实文件路径（支持相对/绝对路径修复）
    file_path = get_music_file_path(music)

    if not file_path:
        return JsonResponse({'error': '文件不存在或路径无效'}, status=404)

    # 获取文件大小
    file_size = os.path.getsize(file_path)

    # 根据文件名获取 MIME 类型
    content_type = get_content_type(file_path)
    
    # 处理范围请求（支持进度条和跳转）
    range_header = request.headers.get('Range', '').strip()
    range_bytes = range_header.startswith('bytes=')

    if range_bytes:
        # 解析范围请求，支持单段 range（不支持多段）并处理后缀范围
        try:
            raw = range_header[6:]
            # 不支持多段 Range
            if ',' in raw:
                return HttpResponse('Multiple ranges not supported', status=400)

            start_str, end_str = raw.split('-', 1)

            if start_str == '' and end_str:
                # 后缀范围 bytes=-N 表示最后 N 个字节
                suffix_len = int(end_str)
                if suffix_len <= 0:
                    return HttpResponse(status=416)
                if suffix_len >= file_size:
                    range_start = 0
                else:
                    range_start = file_size - suffix_len
                range_end = file_size - 1
            else:
                # 正常范围 start-end，其中 end 可省略
                range_start = int(start_str) if start_str else 0
                range_end = int(end_str) if end_str else file_size - 1

            # 验证范围
            if range_start >= file_size or range_start < 0:
                return HttpResponse(status=416)
            if range_end >= file_size:
                range_end = file_size - 1
            if range_start > range_end:
                return HttpResponse(status=416)

        except ValueError:
            # Range 格式错误
            return HttpResponse('Invalid Range header', status=400)

        length = range_end - range_start + 1

        # 打开文件并跳转到指定位置
        with open(file_path, 'rb') as fh:
            fh.seek(range_start)
            chunk = fh.read(length)

        # 创建部分响应
        response = HttpResponse(
            chunk,
            status=206,
            content_type=content_type
        )
        response['Content-Length'] = str(length)
        response['Content-Range'] = f'bytes {range_start}-{range_end}/{file_size}'
        response['Accept-Ranges'] = 'bytes'
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(file_path)}"'
    else:
        # 完整文件响应：使用 FileResponse 能更高效地流式传输并正确关闭文件句柄
        file = open(file_path, 'rb')
        response = FileResponse(file, content_type=content_type)
        response['Content-Length'] = str(file_size)
        response['Accept-Ranges'] = 'bytes'
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(file_path)}"'
    
    return response

def check_file_exists(request, music_id):
    """检查文件是否存在（AJAX调用）"""
    try:
        music = Music.objects.get(id=music_id)
        file_path = get_music_file_path(music)
        exists = bool(file_path and os.path.exists(file_path))
        return JsonResponse({'exists': exists, 'path': file_path or ''})
    except Music.DoesNotExist:
        return JsonResponse({'exists': False}, status=404)

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