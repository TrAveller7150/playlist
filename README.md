# TrAveller7150's Playlist

一个以动态夏日封面为入口的个人博客，用来记录碎碎念、长文章、音乐，以及旅途中收集的小物件。

网站当前是一个不依赖前端框架的静态站点：内容由本地 Markdown 构建，动态封面、播放器和藏品检视由浏览器端 JavaScript 负责。它优先服务于个人写作与展示，不提供账号、评论或后台管理功能。

## 当前内容

- 动态封面：基于已整理的 Wallpaper Engine 场景资源制作。人物、花朵和背景保留独立层次；桌面端标题会位于人物与花朵之后，移动端使用独立排版。
- 内容区：包含固定的“关于我”文章、最新碎碎念、长文章列表，以及两类独立归档。
- 音乐播放器：默认播放本地 `summer-playlist.mp3`，支持播放、进度、音量、静音、切歌和临时加入本地音频。封面与内容区使用不同形态的播放器，但播放不会中断。
- 营地：内容页底部的像素风营地包含站外链接与收藏箱。
- 旅途收藏：目前收录短剑｜大马士革钢、Ghostpia Season One NS 实体版与《あの夏ぼくは天使を見た》诗画集。模型可在物品栏中预览，进入检视后可拖拽旋转，并可用右键或返回按钮回到物品栏。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm start
```

打开 <http://127.0.0.1:5187>。`npm start` 会先构建 Markdown 内容，再启动本地静态服务器；端口已被占用时，先停止已有服务器或调整 `server.mjs` 中的端口。

只检查内容构建时运行：

```bash
npm run build
```

该命令等同于 `npm run build:content`，会生成 `site/data/content.js` 并把文章引用的本地图片复制到 `site/media/content/`。这两个输出均由脚本管理，不建议直接编辑。

## 写作

`content/` 可以直接作为 Obsidian Vault 打开，也可以使用任意 Markdown 编辑器。

```text
content/
  about.md                 固定的“关于我”文章
  notes/                   碎碎念
  posts/                   长文章
  assets/covers/           正文图片与固定文章头图
  templates/               Obsidian 模板
```

写作格式、frontmatter 字段和模板使用方式见 [content/README.md](content/README.md)。保存内容后执行 `npm run build` 或重新执行 `npm start`，即可更新本地预览。

## 目录

```text
site/                      可部署的静态网站根目录
  index.html               页面结构
  assets/                  动态封面图层、字体和图标
  data/                    Markdown 构建结果
  media/                   音乐、文章图片、营地和收藏品资源
  scripts/                 页面交互、播放器、内容与 Three.js 模型查看器
  styles/                  页面样式
  vendor/three/            随项目保存的 Three.js 运行时

content/                   Markdown 内容源
tools/build-content.mjs    内容构建脚本
tools/wallpaper-engine/    动态封面资源解析工具
tools/knife/               短剑模型与贴图生成工具
tools/ghostpia/            Ghostpia 套装贴图与模型生成工具
tools/summer-book/         《あの夏ぼくは天使を見た》模型生成工具
server.mjs                 本地静态服务器
```

## 收藏品与模型

网页实际加载的模型位于 `site/media/inventory/`，并随 Git 提交。收藏品信息和模型参数定义在 `site/scripts/inventory.js`；模型加载、自动旋转和详细检视交互位于 `site/scripts/model-viewer.js`。

`blender/` 被 Git 忽略，用于保存参考图、Blender 源文件、渲染预览和中间贴图。短剑工具保留的 `.blend` 备份与贴图位于 `tools/knife/assets/`，生成产物位于被忽略的 `tools/knife/output/`。需要重新生成现有模型时，可使用 `tools/knife/` 或 `tools/ghostpia/` 中的脚本；Ghostpia 脚本依赖放在本机 `blender/` 下的参考照片，因此全新克隆不会自动具备这些输入素材。

## 技术说明

- 内容构建：Node.js、`gray-matter` 与 `marked`。
- 3D 藏品检视：Three.js、GLTFLoader 与 TrackballControls。
- 样式与页面交互：原生 HTML、CSS 和 JavaScript。
- 动态封面：WebGL 2；浏览器不支持或启用“减少动态效果”时会降级为静态画面。

## 部署到 EdgeOne Pages

本站是纯静态站点。`server.mjs` 只用于本地预览，EdgeOne 不需要运行它；部署时由构建命令生成内容，再发布 `site/` 目录。

在 EdgeOne Pages 创建项目并关联 GitHub 仓库 `TrAveller7150/playlist` 后，使用以下构建设置：

```text
框架预设：Other / Static
根目录：./
安装命令：npm ci
构建命令：npm run build
输出目录：site
Node.js：20.x
```

首次部署成功后，使用 Pages 项目提供的临时域名检查首页、音乐播放、文章图片和收藏品模型。接入自定义域名时，在 EdgeOne 控制台添加域名，并按页面显示的记录值配置 DNS；不要预先猜测 CNAME 地址。本站使用 hash 路由，不需要额外配置单页应用重写规则。

之后的发布流程是：修改 `content/` 或网站资源，执行 `npm run build` 本地检查，提交并推送到 `main`。EdgeOne 会自动拉取并重新部署。若上线后文章更新未及时出现，在 EdgeOne 中对 `index.html` 与 `data/content.js` 刷新或清除缓存即可。

## 素材说明

动态封面的原始美术作者为 EB十。Wallpaper Engine 场景、游戏角色与各类参考图片的权利仍归各自作者或权利人所有；本项目仅用于个人站点展示，不将原始场景包或未获授权的素材作为通用资源再分发。
