# 天空单词闯关

适配 iPad 的英语闯关网页，包含 60 个随机关卡、角色选项、英文发音、跟读评分、血量、积分、错题集与自动存档。

## 源码结构

- `src/main.jsx`：页面、答题、跟读、积分和存档逻辑
- `src/data/questions.js`：当前中英文题库
- `src/*.css`：页面布局、场景和角色样式
- `public/assets/characters/`：选项角色图片
- `work/parse_wordbank.ps1`：从 Word 重新生成题库
- `work/prepare_character_assets.py`：角色图片转换脚本
- `dist/`：运行 `pnpm build` 后生成的静态网页

## 本地运行

电脑需要安装 Node.js 和 pnpm，然后在项目目录运行：

```powershell
pnpm install
pnpm dev
```

终端会显示本地网址，通常为 `http://localhost:5173/`。

## 更换 Word 题库

Word 文档中的内容需按“英文一行、对应中文下一行”排列。支持 `.doc` 和 `.docx`。

```powershell
powershell -ExecutionPolicy Bypass -File .\work\parse_wordbank.ps1 -SourcePath "D:\题库\新题库.docx"
```

脚本会去除重复英文，并把可用题目写入 `src/data/questions.js`。不足 20 题的尾数不会进入游戏，因为每关固定 20 题。

也可以直接编辑 `src/data/questions.js`，每题格式如下：

```js
{
  "id": 1,
  "word": "apple",
  "meaning": "苹果"
}
```

题库更新后重新运行：

```powershell
pnpm build
```

## 修改常用设置

在 `src/main.jsx` 顶部可以调整：

- `MAX_HEALTH`：每关血量
- `LEVEL_COUNT`：关卡总数
- `QUIZ_CHARACTERS`：随机角色图片数量和路径

跟读积分规则、答题奖励和语音评分阈值也在 `src/main.jsx` 中。

## 数据保存

积分、解锁关卡、错题和奖励状态保存在浏览器 `localStorage` 中。清除浏览器网站数据会重置进度。

## 发布到 GitHub Pages

仓库内的 `.github/workflows/deploy-pages.yml` 会在推送到 `main` 分支后自动构建和发布：

```powershell
git add .
git commit -m "Update quiz"
git push origin main
```
