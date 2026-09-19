# 天空单词闯关

适配 iPad 的英语单词闯关网页。题库由外部 Word 文档构建，当前版本包含 16 关，每关固定 20 题。

## 功能

- 关卡顺序解锁，每关题目随机打乱
- 点击英文单词播放 `en-US` 英语发音
- 所有交互按钮带轻量按键音效
- 自动保存积分、已解锁关卡、历史最高分和错题
- 错题复习后，答对的单词自动移出错题集
- 500 分与 2000 分奖励提醒
- iPad 横屏、竖屏和安全区域适配

## 本地运行

```bash
pnpm install
pnpm dev
```

## 生产构建

```bash
pnpm build
```

静态文件输出至 `dist/`，可部署到 GitHub Pages、Netlify 或任意静态托管服务。

## 更新题库

把 Word 题库放在桌面后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\work\parse_wordbank.ps1
```

脚本读取 Word 中连续的英文与中文行，去重并按每 20 题生成关卡。
