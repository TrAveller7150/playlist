# 日光之间

以动态壁纸作为入口的个人博客。首页沿用用户提供的 Wallpaper Engine 场景 `2700262458`，内容区采用暖白和橄榄绿的简洁阅读布局。原画作者为 EB十。运行时资源保留在 `site/assets/`；原始场景包已移出仓库并单独归档。

## 运行

需要 Node.js。首次运行先执行 `npm install`，之后运行 `npm start`，打开 <http://127.0.0.1:5187>。启动时会先把 Markdown 内容构建为网站数据。

## 目录

```text
site/                       当前可运行的静态网站
  assets/                   壁纸图层、模型、字体和图标
  data/content.js           由 Markdown 自动生成的内容数据
  media/                    回退图片、本地音乐和构建后的文章图片
  scripts/                  页面、播放器和 WebGL 代码
  styles/                   页面样式
content/                    Obsidian 仓库和 Markdown 内容源
  about.md                  SIDE A 固定的“关于我”文章
  posts/                    长文章
  notes/                    碎碎念
  assets/covers/            文章封面与正文图片
  templates/                Obsidian 文章和碎碎念模板
tools/build-content.mjs     Markdown 内容构建脚本
tools/wallpaper-engine/     从原始文件重建网页资源的工具
docs/architecture.md        后续博客重建的架构决策
server.mjs                  本地静态服务器
```

- 首页：WebGL 2 实时绘制原包图层；加载中或不支持时显示原图。
- SIDE A：固定的“关于我”文章与最新碎碎念；SIDE B：带封面的长文章。两个区域都至少占满一个视口，不使用额外的区间过渡装饰。
- 碎碎念和长文章拥有各自独立的归档页；正文保留下一篇和阅读进度。
- 播放器默认加载 `site/media/summer-playlist.mp3`，支持播放、暂停和拖动进度；浏览器限制自动播放时需点击播放。封面底部整排展示，内容区变为可拖动的右下角卡片，可收起为音乐球，播放不中断；也可选择本地音乐，所选文件不会上传。
- 封面使用约半屏且距离一致的双向滚动阈值，内容上滑到顶部后固定不动，继续上滑填满顶部圆环才返回封面；两者不会同时露出。标题采用两行左对齐的本地 Inter Bold：桌面端位于人物及花朵图层之后形成真实遮挡，移动端使用上层纯白字避免内容被大面积遮住。播放器在各自位置淡出、淡入。减少动态效果偏好会禁用压暗与播放器动画。
- 音量滑杆采用柔和线性范围：默认显示 50%，对应实际音量 14%；滑杆 100% 对应实际音量 28%。
- 播放栏支持音量、静音、上一首和下一首；加号可以一次添加多首本地歌曲，仅有一首时切歌会重新播放当前曲目。
- 文章使用 `content/` 中的本地 Markdown 编写。用 Obsidian 打开该目录作为仓库，启用核心插件“模板”，并将模板目录设为 `templates`；详细写作格式见 `content/README.md`。
- `npm run build:content` 会读取 frontmatter、转换 Markdown，并把引用的本地图片复制到 `site/media/content/`。生成文件不要手工编辑。当前转换结果只面向可信的本地内容，不应直接接入未经清洗的公开投稿。
- 长文章不显示封面，列表采用类似音乐歌单的固定列排布；正文中插入的 Markdown 图片与文字使用相同阅读宽度。只有 SIDE A 的固定“关于我”文章保留头图。文章封面素材存放在 `content/assets/covers/`。
- 检测到减少动态效果偏好时显示静止画面；首页离开视口、进入正文或切换后台时停止动态绘制。
- 播放上限为 30 FPS，使用 GPU fence 防止高负载下渲染队列积压。实际帧率取决于显卡与浏览器。
- 已移除原型的对照、调参、性能统计和快捷键界面。实验设计记录仍被 Git 忽略，最终架构记录在 `docs/architecture.md`。

## 已迁移

- 从 PKGV0015 场景提取 78 个文件，转换 21 张图层 / 遮罩纹理。
- 人物 MDLV0013 网格：2814 个顶点、18 根骨骼、6 秒原始动画。
- 花朵网格：2990 个顶点、12 根骨骼、24 秒原始动画。
- 原始权重、层次、绑定矩阵、平移 / Z 旋转 / XY 缩放关键帧和线性插值。
- 使用原始纹理空间遮罩与参数重写 foliage sway、water waves、shake blink、iris、opacity 效果。
- 按原场景图层顺序、位置和尺寸合成，使用透明混合。

## 还原边界

这是针对这一份 2D 场景的移植，不是通用 Wallpaper Engine 播放器。骨骼数据中此场景使用的二维变换得以保留；没有实现通用三维骨骼旋转。

场景包引用的引擎内置噪声贴图和光束粒子资源没有包含在包内。当前用程序噪声近似花叶风场，以角向光束近似 God Rays / Light Shafts，并使用轻量胶片噪点。以上效果不是原引擎的逐像素还原。

固定使用原始分辨率：场景 2560×1440，效果按原始纹理尺寸运行，GPU 负载较大。输出画布匹配设备像素比。浏览器使用 cover 裁切保持比例，竖屏会裁去两侧花田；不会凭空增加原始素材的细节。

## 资源重建

生成的网页资源已经包含在 `site/assets/`，正常预览无需 Python。

如需从原包重建，先从外部归档恢复 `source/wallpaper-engine/2700262458/`，再安装 Pillow 与 lz4 并运行 `npm run extract`。三个脚本分别负责包提取、无损纹理格式转换与模型解析。输出写入 `site/assets/`，不写回原包。

格式参考：

- https://github.com/notscuffed/repkg （TEX 容器 / mipmap 布局）
- https://github.com/Almamu/linux-wallpaperengine/blob/main/docs/rendering/MDL_FILES.md （MDL 网格 / 骨骼布局）

特效数学依据用户提供的包内 shader 文件移植。素材及原 shader 的权利归原作者；这份实验不附带其再发布授权。
