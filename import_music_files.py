import os
import sys
import django
from mutagen import File
from mutagen.id3 import ID3, TIT2, TPE1, TALB

# 初始化 Django 环境
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'music_platform.settings')
django.setup()

from music.models import Music

# 配置项
MUSIC_FOLDER = r'D:\music'  # 你的音乐文件夹路径
SUPPORTED_FORMATS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a']

def get_music_metadata(file_path):
    try:
        audio = File(file_path, easy=True)
        if not audio:
            audio = ID3(file_path)

        metadata = {
            'name': os.path.splitext(os.path.basename(file_path))[0],
            'singer': '未知歌手',
            'album': '未知专辑'
        }

        if isinstance(audio, ID3):
            if TIT2 in audio:
                metadata['name'] = audio[TIT2].text[0]
            if TPE1 in audio:
                metadata['singer'] = audio[TPE1].text[0]
            if TALB in audio:
                metadata['album'] = audio[TALB].text[0]
        elif audio:
            if 'title' in audio:
                metadata['name'] = audio['title'][0]
            if 'artist' in audio:
                metadata['singer'] = audio['artist'][0]
            if 'album' in audio:
                metadata['album'] = audio['album'][0]

        for key in metadata:
            metadata[key] = metadata[key].strip().replace('/', '-').replace('\\', '-')

        return metadata

    except Exception as e:
        print(f"解析文件 {file_path} 元数据失败：{str(e)}")
        return {
            'name': os.path.splitext(os.path.basename(file_path))[0],
            'singer': '未知歌手',
            'album': '未知专辑'
        }

def import_music_to_mysql():
    if not os.path.exists(MUSIC_FOLDER):
        print(f"错误：音乐文件夹 {MUSIC_FOLDER} 不存在！")
        return

    total = 0
    imported = 0
    skipped = 0
    failed = 0

    for root, dirs, files in os.walk(MUSIC_FOLDER):
        for file in files:
            total += 1
            file_path = os.path.join(root, file)
            file_ext = os.path.splitext(file)[1].lower()

            if file_ext not in SUPPORTED_FORMATS:
                skipped += 1
                print(f"跳过非音频文件：{file}")
                continue

            try:
                metadata = get_music_metadata(file_path)
                name = metadata['name']
                singer = metadata['singer']
                album = metadata['album']

                # 检查是否已存在
                if Music.objects.filter(name=name, singer=singer).exists():
                    skipped += 1
                    print(f"跳过已存在的音乐：{singer} - {name}")
                    continue

                # 只写入数据库，不保存文件
                music = Music(
                    name=name,
                    singer=singer,
                    album=album,
                    file_path=file_path  # 把文件路径也存进去
                )
                music.save()

                imported += 1
                print(f"成功导入：{singer} - {name}")

            except Exception as e:
                failed += 1
                print(f"导入失败 {file}:{str(e)}")

    print("\n===== 导入完成 =====")
    print(f"总计文件：{total}")
    print(f"成功导入：{imported}")
    print(f"跳过文件：{skipped}")
    print(f"导入失败：{failed}")

if __name__ == '__main__':
    print(f"开始导入音乐元数据到 MySQL,源目录:{MUSIC_FOLDER}")
    print("------------------------")
    import_music_to_mysql()