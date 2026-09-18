# Obsidian 写作目录

用 Obsidian 打开本 `content` 文件夹作为仓库。启用核心插件“模板”，模板目录选择 `templates`。

- `about.md`：首页固定的“关于我”文章。
- `posts/`：长文章，一篇一个 Markdown 文件。
- `notes/`：碎碎念，一条一个 Markdown 文件。
- `assets/`：正文图片和固定“关于我”文章的头图。插入图片时使用标准 Markdown 链接。

写作时保留 `draft: true`，完成后改为 `draft: false`。运行 `npm run build:content` 生成网站数据，运行 `npm start` 会先自动构建一次。

长文章不使用封面，文章列表统一采用类似音乐歌单的文字排布。正文图片使用标准语法 `![图片说明](../assets/image.jpg)`，网页中会自动与正文栏保持相同宽度。

只有 `about.md` 保留固定头图。它的 `coverPosition` 用来控制裁剪焦点，例如人物偏右时可写 `70% 50%`。
