<h1 align="center">Tiger AI Bookmark Chrome Extension</h1>

<p align="center">
  AI-powered Chrome bookmark workflow with fast popup capture, background AI enrichment,
  hierarchical tags, category trees, screenshots, and dead-link checks.
</p>

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-4.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-4.1-646CFF?logo=vite&logoColor=white">
</p>

> The current in-product label still uses `TIGERMARKIII` in some UI surfaces.

## Overview

Tiger AI Bookmark Chrome Extension is a Chrome extension for saving, enriching, and maintaining bookmarks with AI.
It captures the current page from the popup, stores a screenshot preview, extracts SEO and page content signals,
then runs AI analysis in the background to generate categories, hierarchical tags, and summaries.

The project is built for the Chrome extension runtime, not as a standalone website.

## Highlights

- Fast popup save flow with background AI processing
- AI-generated summaries, categories, keywords, and hierarchical tags
- Full-page screenshot capture with preview refresh
- Page content extraction and SEO metadata fallback
- Dead-link checking and recovery workflows
- Chrome bookmark import, export, and sync support
- Card and list views with filtering, sorting, and batch actions
- Local storage workflow with React, Zustand, and TypeScript
<img width="1097" height="913" alt="image" src="https://github.com/user-attachments/assets/ab0620ed-942c-4458-b725-1baa38231803" />

## Feature Set

### Capture and Save

- Save the active tab from the popup
- Keep the popup fast by handing AI work to the background
- Store notes, ratings, favicon data, and preview screenshots
<img width="482" height="602" alt="image" src="https://github.com/user-attachments/assets/30d4d0e4-8227-451f-8f12-cf08bf5024ca" />

### AI Enrichment

- Analyze page content through an OpenAI-compatible API endpoint
- Generate a summary, keywords, category path, and tag suggestions
- Reuse or extend existing category trees instead of creating random folders
- Support batch AI archive flows for existing bookmarks

### Bookmark Operations

- Search by title, URL, description, and AI summary
- Filter by category, tag, and status
- Edit bookmarks inline from the main UI
- Run batch operations for archive, screenshot, and cleanup workflows

### Reliability Tools

- Detect dead links
- Refresh screenshots when previews are missing or outdated
- Recover from interrupted archive flows with checkpoints

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Chrome Extension Manifest V3 APIs
- OpenAI-compatible AI providers

## Install from Source

```bash
git clone https://github.com/tigermkiiiddd/tiger-ai-bookmark-chrome-extension.git
cd tiger-ai-bookmark-chrome-extension
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `dist/` folder

## Configuration

Open the extension settings page and configure:

- `AI API Key`
- `AI API Base URL`
- `AI Model`

The AI layer is designed around OpenAI-compatible chat completion endpoints, so you can point it to different providers as long as they support that interface.

## How to Use

### Quick Add from Popup

1. Open any normal web page
2. Click the extension action icon
3. Review the draft bookmark and screenshot
4. Use direct save or AI save

### Manage from the Main UI

- Search across bookmark metadata and AI results
- Filter by tags, categories, and status
- Edit, archive, rate, or delete bookmarks
- Import or sync Chrome bookmarks

### Run AI Later

You can also trigger AI archive flows from the main management UI for existing bookmarks.

## Project Structure

```text
.
├── popup/          # Popup UI for fast capture
├── options/        # Main management UI and settings
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

## Development

Recommended validation commands for this extension project:

```bash
npm run type-check
npm run build
```

Other useful commands:

```bash
npm run dev
npm run test
npm run lint
```

## Troubleshooting

### Popup can capture metadata but AI results do not appear

- Reload the extension in `chrome://extensions/`
- Reopen the popup on a normal web page, not `chrome://` or other restricted pages
- Verify the AI API key, base URL, and model settings
- Check the background service worker console for provider or network errors

### Content script connection issues

- Refresh the active tab
- Reopen the popup
- Avoid restricted browser pages
- Reload the extension if the extension context was invalidated

## Contributing

Issues and pull requests are welcome.

If you plan to contribute code:

1. Fork the repository
2. Create a feature branch
3. Run `npm run type-check` and `npm run build`
4. Open a pull request with a clear summary and test notes

## Repository

- Repo: [tigermkiiiddd/tiger-ai-bookmark-chrome-extension](https://github.com/tigermkiiiddd/tiger-ai-bookmark-chrome-extension)
- Issues: [GitHub Issues](https://github.com/tigermkiiiddd/tiger-ai-bookmark-chrome-extension/issues)
