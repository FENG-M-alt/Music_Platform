# Music_Platform（音乐播放平台）
- 这是我的一个django5项目
# 注意事项
- 我的媒体文件在我的d盘中，我在**setting.py**中设置了我的媒体文件路径
- 数据库使用的是mysql，并且在**setting.py**中配置好了接口，需要的话请自行更改
- 我的数据库是在本地，所以有关数据库的配置我并没有修改
# 使用说明
- 你得有一个本地的音乐库并在**setting.py**中配置你的媒体路径
- 编辑**import_music_file.py**中有关你的本地音乐库相关内容，让其把信息同步到你的数据库中
- 如果想要分享给你的好友，请看一下方法
  * 首先你的进入**setting.py**修改`ALLOWED_HOSTS = ['*']`,确保可以被其他人访问
  * 访问[Ngrok]([https://ngrok.com "Ngrok官网")，可以免费注册
  * 在[Ngrok]([https://ngrok.com "Ngrok官网")上找到**Your Authtoken**获取你的令牌
  * 下载Ngrok，启动终端运行`ngrok config add-authtoken 你的令牌`
  * 在本地运行你的项目后，打开ngrok运行`ngrok http 8000`
  * 注意首次用内网穿透访问的话可能需要你同意一些事项，直接继续访问就可以了
# 呈现效果
<img width="1231" height="847" alt="屏幕截图 2026-02-11 201028" src="https://github.com/user-attachments/assets/5d2005d7-62be-447f-8a1b-da84f61e790d" />

# 免责声明
- 项目纯属整活，没有任何价值
