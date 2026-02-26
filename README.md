# Subtitle to Gemini 🚀

[English](#english) | [中文](#中文)

---

<h2 id="english">English</h2>

**Subtitle to Gemini** is a lightweight browser extension that lets you extract subtitles from YouTube and Bilibili videos with a single click and seamlessly send them to Google Gemini for summarization.

### Features
✨ **One-Click Summarization**: Adds a beautiful floating action button (FAB) to the bottom right of supported video pages.  
📺 **YouTube Support**: Grabs the current video URL directly and sends it to Gemini (since Gemini natively supports YouTube links).  
⚡ **Bilibili Support**: Automatically extracts CC subtitles (prioritizing Chinese/English) directly from Bilibili's APIs without needing to log in for most videos.  
⏸️ **Auto-Pause**: Automatically pauses the video when you click the button so you don't miss anything.  
📋 **Smart Clipboard**: Copies the subtitles (or URL) along with the prompt `Summarize video content` to your clipboard.  
🤖 **Gemini Auto-Paste**: Automatically opens Gemini and attempts to paste the prompt for you!

### Installation
Currently, the extension is not published to the web stores. You can install it manually:

#### Chrome / Edge (use source folder)
1. Download or clone this repository.
2. Open your browser and go to `chrome://extensions/` (or `edge://extensions/`).
3. Toggle **Developer mode** on (top right corner).
4. Click **Load unpacked** and select the `subtitle-to-gemini` folder.
5. To update: after pulling latest code, click the **refresh** icon on the extension card.

#### Firefox (use .zip from Releases)
1. Go to the [Releases page](https://github.com/restinnotes/subtitle-to-gemini/releases) and download the latest `.zip` file.
2. Open Firefox and go to `about:addons` → ⚙️ gear icon → **Install Add-on From File...**
3. Select the downloaded `.zip` file.

> **Note**: You can also load temporarily via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on...** → select `manifest.json`, but this will be removed when Firefox restarts.

### Usage
1. Open any YouTube (`youtube.com/watch*`) or Bilibili (`bilibili.com/video/*`) video.
2. Look for the purple-blue gradient button in the bottom right corner.
3. Click it! The video will pause, the data will be copied, and Gemini will open.
4. If Gemini doesn't auto-paste (due to browser security restrictions), just press `Ctrl+V` (or `Cmd+V` on Mac) and hit Enter!

---

<h2 id="中文">中文</h2>

**Subtitle to Gemini** 是一个轻量级的浏览器扩展插件。它能让你一键提取 YouTube 和 Bilibili (B站) 的视频字幕或链接，并无缝跳转到 Google Gemini 进行内容总结。

### 功能特色
✨ **一键总结**：在支持的视频页面右下角添加一个美观的渐变色悬浮按钮。  
📺 **YouTube 支持**：直接获取当前视频链接（Gemini 原生支持解析 YouTube 内容），快速精准。  
⚡ **Bilibili 支持**：调用 B 站 API 自动提取视频的 CC 字幕（优先提取中文/英文），大多数视频无需登录。  
⏸️ **自动暂停**：点击按钮瞬间自动暂停当前视频，防止错过精彩内容。  
📋 **智能剪贴板**：自动将字幕内容（或视频链接）加上 `总结视频内容` 的提示词复制到剪贴板。  
🤖 **Gemini 自动粘贴**：自动在新标签页打开 Gemini 并尝试为你自动填写和提交！

### 安装指南
本插件目前尚未上架扩展商店，请通过以下方式本地安装：

#### Chrome / Edge 浏览器（使用源码文件夹）
1. 下载或克隆本仓库代码。
2. 在浏览器地址栏输入 `chrome://extensions/`（或 `edge://extensions/`）。
3. 打开右上角的 **开发者模式**。
4. 点击左上角的 **加载已解压的扩展程序**，选择 `subtitle-to-gemini` 文件夹。
5. 更新方法：拉取最新代码后，在扩展卡片上点击 **刷新** 图标即可。

#### Firefox 浏览器（使用 Release 的 .zip 包）
1. 前往 [Releases 页面](https://github.com/restinnotes/subtitle-to-gemini/releases) 下载最新的 `.zip` 文件。
2. 打开 Firefox，进入 `about:addons` → 点击 ⚙️ 齿轮图标 → **从文件安装附加组件...**。
3. 选择下载好的 `.zip` 文件即可。

> **提示**：也可以通过 `about:debugging#/runtime/this-firefox` → **临时载入附加组件...** → 选择 `manifest.json`，但此方式在 Firefox 重启后会失效。

### 使用方法
1. 打开任意 YouTube (`youtube.com/watch*`) 或 Bilibili (`bilibili.com/video/*`) 视频页面。
2. 页面右下角会出现一个蓝紫色渐变的悬浮按钮。
3. 点击该按钮！视频会自动暂停，数据会复制到剪贴板，随后会自动打开 Gemini。
4. 如果因浏览器安全限制导致 Gemini 页面未自动粘贴，请直接按下 `Ctrl+V` (Mac下为 `Cmd+V`) 粘贴，按回车即可获得总结！

---
*Disclaimer: This project is not affiliated with Google, YouTube, or Bilibili.*
