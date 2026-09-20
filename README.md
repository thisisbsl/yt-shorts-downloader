# ShortsSound — YouTube Shorts Downloader & Audio Extractor

> A high-performance, studio-grade web application to download YouTube Shorts in HD MP4 or crystal-clear MP3, and extract sound from uploaded video files or pasted media URLs.

![Node.js](https://img.shields.io/badge/Node.js-v26+-brightgreen.svg)
![FFmpeg](https://img.shields.io/badge/FFmpeg-Static_Bundled-blue.svg)
![yt--dlp](https://img.shields.io/badge/yt--dlp-Active-red.svg)
![License](https://img.shields.io/badge/License-MIT-purple.svg)

---

## ✨ Features

- **🎬 YouTube Shorts & Video Downloader**:
  - Automatically identifies YouTube Shorts (`youtube.com/shorts/...`, `youtu.be/...`, `youtube.com/watch?...`).
  - Fetches high-resolution thumbnails, creator handle, title, and duration before downloading.
  - Download high-definition vertical video (`MP4`) with merged audio.

- **🎵 Studio Audio Extractor**:
  - Extract sound directly from YouTube Shorts into **MP3** (up to 320 kbps studio quality).
  - Also supports **WAV** (lossless uncompressed PCM), **AAC** (crisp modern audio), and **M4A**.
  - Choice of bitrates: 320 kbps (Studio), 192 kbps (High), 128 kbps (Standard).

- **📁 Local Video File Sound Extraction**:
  - Drag-and-drop or select any video file (`.mp4`, `.mov`, `.webm`, `.mkv`, `.avi`).
  - In-browser video player preview of uploaded content.
  - Fast local sound extraction powered by static `ffmpeg`.

- **🎧 In-Browser Audio & Video Preview**:
  - Listen to extracted audio or preview videos right in your browser with stream buffering before downloading.

- **📜 Session Download Shelf**:
  - Quick access library of converted files during your browsing session.

- **💎 Modern Dark Glassmorphic Design**:
  - Crafted with pure CSS3: glowing gradient orbs, animated soundwaves, reactive hover states, and modern typography (*Outfit* & *Plus Jakarta Sans*).

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the application:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🏗️ Architecture

```
yt-shorts-downloader/
├── bin/                 # Auto-managed yt-dlp binary
├── downloads/           # Converted MP3 / MP4 files ready for streaming/download
├── uploads/             # Temporary storage for uploaded videos during extraction
├── public/
│   ├── index.html       # Semantic frontend structure
│   ├── style.css        # Glassmorphic dark UI system
│   └── app.js           # Client controller & state management
├── server.js            # Express API server, binary manager & FFmpeg pipeline
├── package.json         # Project configuration & dependencies
└── README.md            # Documentation
```

---

## 🛠️ Tech Stack

- **Server**: Node.js & Express
- **Audio Extraction & Transcoding**: `ffmpeg-static` & `fluent-ffmpeg`
- **YouTube Downloader Engine**: `yt-dlp`
- **File Uploads**: `multer`
- **Frontend**: Vanilla HTML5, Modern Vanilla CSS3, Vanilla ES6+ JavaScript
