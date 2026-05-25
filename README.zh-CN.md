# Tiger AI Bookmark Chrome Extension

一个面向 Chrome 的 AI 书签扩展，支持快速弹窗收藏、后台 AI 富化、层级标签、分类树、截图预览和死链检测。

[English](./README.md) | [简体中文](./README.zh-CN.md)

> 当前扩展界面的部分文案仍然使用 `TIGERMARKIII` 这个产品标签。

## 项目概览

Tiger AI Bookmark Chrome Extension 用来保存、分析和维护书签。
它会在弹窗里快速保存当前页面、抓取截图预览、提取 SEO 与正文信号，然后把 AI 分析放到后台执行，生成摘要、分类、关键词和层级标签。

这是一个标准的 Chrome Extension 项目，不是普通独立网页应用。

## 核心能力

- 弹窗快速保存，AI 分析在后台继续运行
- AI 自动生成摘要、关键词、分类路径和层级标签
- 支持整页截图采集与预览刷新
- 支持页面正文提取和 SEO 元数据兜底
- 支持死链检测与恢复流程
- 支持 Chrome 书签导入、导出和同步
- 支持卡片/列表视图、搜索、筛选和批量操作
<img width="1097" height="913" alt="image" src="https://github.com/user-attachments/assets/ab0620ed-942c-4458-b725-1baa38231803" />

## 功能说明

### 1. 收藏与采集

- 在弹窗里保存当前标签页
- 保存备注、评分、favicon 和截图预览
- 保持弹窗关闭足够快，把 AI 任务交给后台处理
<img width="482" height="602" alt="image" src="https://github.com/user-attachments/assets/30d4d0e4-8227-451f-8f12-cf08bf5024ca" />

### 2. AI 富化

- 通过 OpenAI 兼容接口分析页面内容
- 生成摘要、关键词、分类路径和标签建议
- 优先复用已有分类树，而不是随意新建目录
- 支持对已有书签执行批量 AI 归档

### 3. 书签管理

- 按标题、URL、描述、AI 摘要搜索
- 按标签、分类、状态筛选
- 在主界面编辑、归档、评分、删除书签
- 支持批量截图、批量归档和清理流程

### 4. 稳定性工具

- 检测失效链接
- 刷新缺失或过期的截图
- 用检查点恢复中断的 AI 归档流程

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Chrome Extension Manifest V3 API
- OpenAI 兼容 AI Provider

## 从源码安装

```bash
git clone https://github.com/tigermkiiiddd/tiger-ai-bookmark-chrome-extension.git
cd tiger-ai-bookmark-chrome-extension
npm install
npm run build
```

然后在 Chrome 中加载扩展：

1. 打开 `chrome://extensions/`
2. 打开 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择 `dist/` 目录

## 配置项

在扩展设置页中配置：

- `AI API Key`
- `AI API Base URL`
- `AI Model`

当前 AI 接入层基于 OpenAI 兼容的 Chat Completions 接口，因此可以接不同的兼容服务商，只要接口格式兼容即可。

## 使用方式

### 弹窗快速添加

1. 打开普通网页
2. 点击扩展图标
3. 检查草稿书签和截图
4. 选择直接保存或 AI 保存

### 在主管理页处理书签

- 搜索书签元数据和 AI 结果
- 按分类、标签、状态筛选
- 编辑、归档、评分或删除书签
- 导入或同步 Chrome 书签

### 对已有书签补跑 AI

你也可以在主界面对已有书签单独或批量执行 AI 归档。

## 项目结构

```text
.
├── popup/          # 弹窗采集界面
├── options/        # 主管理界面和设置
├── src/
│   ├── background.ts
│   ├── content.ts
│   ├── components/
│   ├── core/
│   ├── services/
│   ├── store/
│   ├── types/
│   └── utils/
├── public/
└── manifest.json
```

## 开发与验证

这个项目优先用下面两条命令做验证：

```bash
npm run type-check
npm run build
```

其他常用命令：

```bash
npm run dev
npm run test
npm run lint
```

## 常见问题

### 弹窗能保存基础信息，但看不到 AI 结果

- 在 `chrome://extensions/` 里重新加载扩展
- 确认当前页面不是 `chrome://` 之类的受限页面
- 检查 AI 的 key、base URL 和 model 配置
- 查看 background service worker 控制台是否有 provider 或网络错误

### Content Script 连接失败

- 刷新当前网页
- 重新打开弹窗
- 避免浏览器系统页或受限页
- 如果扩展上下文失效，重新加载扩展

## 贡献

欢迎提 Issue 和 Pull Request。

如果你要提交代码，建议流程是：

1. Fork 仓库
2. 新建功能分支
3. 运行 `npm run type-check` 和 `npm run build`
4. 提交带清晰说明和验证结果的 PR

## 仓库地址

- Repo: [tigermkiiiddd/tiger-ai-bookmark-chrome-extension](https://github.com/tigermkiiiddd/tiger-ai-bookmark-chrome-extension)
- Issues: [GitHub Issues](https://github.com/tigermkiiiddd/tiger-ai-bookmark-chrome-extension/issues)

## 许可证

本项目采用 MIT License。
完整协议内容请查看仓库根目录下的 `LICENSE` 文件。
