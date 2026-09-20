/**
 * ShortsSound Studio - Express Server & Media Processing Engine
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, execFile, execSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories (uses /tmp in Vercel/serverless environments where root is read-only)
const isVercel = Boolean(process.env.VERCEL);
const STORAGE_BASE = isVercel ? '/tmp' : __dirname;

const BIN_DIR = path.join(STORAGE_BASE, 'bin');
const UPLOADS_DIR = path.join(STORAGE_BASE, 'uploads');
const DOWNLOADS_DIR = path.join(STORAGE_BASE, 'downloads');
const PUBLIC_DIR = path.join(__dirname, 'public');

[BIN_DIR, UPLOADS_DIR, DOWNLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Setup FFmpeg
const ffmpegPath = ffmpegStatic;
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`[FFmpeg] Loaded static binary at: ${ffmpegPath}`);
} else {
  console.warn('[FFmpeg] Warning: ffmpeg-static did not return a binary path.');
}

// Setup yt-dlp binary
const isWin = process.platform === 'win32';
const ytDlpFilename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(BIN_DIR, ytDlpFilename);

let isYtDlpReady = false;
let isInitializing = true;
let initMessage = 'Initializing media tools...';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// Multer Storage Configuration for Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitized}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max video file
});

// Task Management State
const tasks = new Map();
const sessionHistory = [];

/**
 * Download a file following HTTP 301/302 redirects
 */
function downloadFileWithRedirects(url, destPath) {
  return new Promise((resolve, reject) => {
    // Try curl.exe first on Windows as it handles github CDN redirects reliably
    if (isWin) {
      try {
        console.log(`[Binary Manager] Downloading yt-dlp via curl: ${url}`);
        execSync(`curl.exe -L -o "${destPath}" "${url}"`, { stdio: 'inherit', timeout: 120000 });
        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000000) {
          return resolve(destPath);
        }
      } catch (err) {
        console.warn(`[Binary Manager] curl download failed, falling back to node https: ${err.message}`);
      }
    }

    // Node.js https fallback
    function get(currentUrl, redirectCount = 0) {
      if (redirectCount > 10) {
        return reject(new Error('Too many redirects while downloading yt-dlp'));
      }

      https.get(currentUrl, {
        headers: { 'User-Agent': 'ShortsSound-Downloader/1.0' }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            if (!isWin) {
              fs.chmodSync(destPath, 0o755);
            }
            resolve(destPath);
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    }

    get(url);
  });
}

/**
 * Initialize yt-dlp binary
 */
async function ensureYtDlp() {
  if (fs.existsSync(ytDlpPath)) {
    try {
      const stats = fs.statSync(ytDlpPath);
      if (stats.size > 5000000) { // Should be ~15-30MB
        isYtDlpReady = true;
        isInitializing = false;
        initMessage = 'Media engine ready.';
        console.log(`[Binary Manager] yt-dlp verified at: ${ytDlpPath}`);
        return;
      }
    } catch (e) {}
  }

  try {
    initMessage = 'Downloading latest yt-dlp engine...';
    console.log('[Binary Manager] yt-dlp binary not found. Downloading latest release from GitHub...');
    const downloadUrl = isWin 
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    await downloadFileWithRedirects(downloadUrl, ytDlpPath);
    console.log('[Binary Manager] yt-dlp successfully downloaded!');
    isYtDlpReady = true;
    isInitializing = false;
    initMessage = 'Media engine ready.';
  } catch (err) {
    console.error('[Binary Manager] Error downloading yt-dlp:', err);
    initMessage = `Engine setup error: ${err.message}`;
    isInitializing = false;
  }
}

// Kick off binary verification
ensureYtDlp();

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /api/status - Engine health & readiness
 */
app.get('/api/status', (req, res) => {
  res.json({
    ready: isYtDlpReady && !!ffmpegPath,
    initializing: isInitializing,
    message: initMessage,
    ffmpeg: !!ffmpegPath,
    ytDlp: isYtDlpReady
  });
});

/**
 * GET /api/info - Fetch metadata for YouTube Shorts or URL
 */
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  if (!isYtDlpReady) {
    return res.status(503).json({ error: 'Media engine is still initializing. Please retry in a few moments.' });
  }

  try {
    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      '--ignore-errors',
      '--skip-download',
      url
    ];

    execFile(ytDlpPath, args, { maxBuffer: 10 * 1024 * 1024, timeout: 45000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[yt-dlp info error]', stderr || error.message);
        return res.status(400).json({
          error: 'Failed to fetch video details. The link may be private, restricted, or invalid.'
        });
      }

      try {
        const data = JSON.parse(stdout);
        const durationSec = data.duration || 0;
        const isShorts = url.includes('/shorts/') || (durationSec > 0 && durationSec <= 60);

        res.json({
          title: data.title || 'Untitled Media',
          thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[data.thumbnails.length - 1].url : null),
          duration: durationSec,
          durationFormatted: formatDuration(durationSec),
          uploader: data.uploader || data.channel || 'Creator',
          channelUrl: data.channel_url || null,
          viewCount: data.view_count || null,
          isShort: isShorts,
          webpageUrl: data.webpage_url || url
        });
      } catch (parseErr) {
        console.error('[JSON parse error]', parseErr);
        res.status(500).json({ error: 'Failed to parse metadata from media engine.' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/download-url - Download YouTube Shorts/URL as MP4 or extract MP3
 */
app.post('/api/download-url', async (req, res) => {
  const { url, mode, audioFormat = 'mp3', quality = '320', title } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  if (!isYtDlpReady) {
    return res.status(503).json({ error: 'Media engine is initializing. Please wait a moment.' });
  }

  const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const isAudio = mode === 'audio';
  const outExt = isAudio ? audioFormat : 'mp4';
  const filePrefix = taskId;
  const outTemplate = path.join(DOWNLOADS_DIR, `${filePrefix}-%(title).60s.%(ext)s`);

  // Initialize task state
  const task = {
    id: taskId,
    status: 'processing',
    progress: 5,
    message: 'Starting download process...',
    mediaType: isAudio ? 'audio' : 'video',
    format: outExt,
    createdAt: Date.now()
  };
  tasks.set(taskId, task);

  // Return taskId immediately
  res.json({ taskId });

  // Prepare arguments for yt-dlp
  const args = [
    '--newline',
    '--no-playlist',
    '--ffmpeg-location', ffmpegPath,
    '-o', outTemplate
  ];

  if (isAudio) {
    args.push(
      '-x',
      '--audio-format', audioFormat,
      '--audio-quality', quality === '320' ? '0' : quality === '192' ? '2' : '4'
    );
  } else {
    // Best MP4 video + audio
    args.push(
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
      '--merge-output-format', 'mp4'
    );
  }

  args.push(url);

  console.log(`[Download URL] Executing: ${ytDlpPath} ${args.join(' ')}`);

  const proc = spawn(ytDlpPath, args);

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    // Parse progress e.g. [download]  45.2% of ~ 15.00MiB
    const match = text.match(/\[download\]\s+(\d+\.?\d*)%/);
    if (match) {
      const pct = parseFloat(match[1]);
      task.progress = Math.min(Math.round(pct * 0.85), 85); // download is up to 85%
      task.message = `Downloading media stream: ${pct.toFixed(1)}%`;
    } else if (text.includes('[ExtractAudio]') || text.includes('[ffmpeg]')) {
      task.progress = 90;
      task.message = 'Extracting and encoding audio stream...';
    } else if (text.includes('[Merger]')) {
      task.progress = 90;
      task.message = 'Merging video and audio streams...';
    }
  });

  proc.stderr.on('data', (data) => {
    console.warn(`[yt-dlp stderr] ${data.toString()}`);
  });

  proc.on('close', (code) => {
    if (code === 0) {
      // Find output file in DOWNLOADS_DIR with filePrefix
      const files = fs.readdirSync(DOWNLOADS_DIR);
      const targetFile = files.find(f => f.startsWith(filePrefix));

      if (targetFile) {
        const fullPath = path.join(DOWNLOADS_DIR, targetFile);
        const stats = fs.statSync(fullPath);

        task.status = 'completed';
        task.progress = 100;
        task.message = 'Conversion complete!';
        task.result = {
          filename: targetFile,
          downloadUrl: `/api/download/${encodeURIComponent(targetFile)}`,
          streamUrl: `/api/stream/${encodeURIComponent(targetFile)}`,
          mediaType: isAudio ? 'audio' : 'video',
          title: title || cleanFileName(targetFile.replace(filePrefix + '-', '')),
          size: stats.size,
          format: outExt
        };

        addToSessionHistory(task.result);
      } else {
        task.status = 'error';
        task.error = 'Download completed but output file could not be located.';
      }
    } else {
      task.status = 'error';
      task.error = `Download failed with exit code ${code}. Please ensure the URL is valid.`;
    }
  });

  proc.on('error', (err) => {
    console.error('[Download proc error]', err);
    task.status = 'error';
    task.error = `Process error: ${err.message}`;
  });
});

/**
 * POST /api/extract-upload - Upload video file and extract audio
 */
app.post('/api/extract-upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided.' });
  }

  const { audioFormat = 'mp3', bitrate = '320k' } = req.body;
  const taskId = 'task_upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const originalName = req.file.originalname;
  const baseName = path.parse(originalName).name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outFilename = `${taskId}-${baseName}.${audioFormat}`;
  const outPath = path.join(DOWNLOADS_DIR, outFilename);

  const task = {
    id: taskId,
    status: 'processing',
    progress: 10,
    message: 'Extracting audio from uploaded video...',
    mediaType: 'audio',
    format: audioFormat,
    originalName: originalName,
    createdAt: Date.now()
  };
  tasks.set(taskId, task);

  res.json({ taskId });

  // Execute FFmpeg extraction
  const cmd = ffmpeg(req.file.path)
    .noVideo()
    .audioBitrate(bitrate.replace('k', ''))
    .on('progress', (progress) => {
      if (progress && progress.percent) {
        task.progress = Math.min(Math.round(progress.percent), 98);
        task.message = `Extracting audio: ${task.progress}%`;
      }
    })
    .on('end', () => {
      // Remove temporary uploaded video file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {}

      if (fs.existsSync(outPath)) {
        const stats = fs.statSync(outPath);
        task.status = 'completed';
        task.progress = 100;
        task.message = 'Audio extraction complete!';
        task.result = {
          filename: outFilename,
          downloadUrl: `/api/download/${encodeURIComponent(outFilename)}`,
          streamUrl: `/api/stream/${encodeURIComponent(outFilename)}`,
          mediaType: 'audio',
          title: originalName,
          size: stats.size,
          format: audioFormat
        };

        addToSessionHistory(task.result);
      } else {
        task.status = 'error';
        task.error = 'Audio extraction failed: output file not created.';
      }
    })
    .on('error', (err) => {
      console.error('[FFmpeg error]', err);
      // Clean up upload file
      try {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (e) {}

      task.status = 'error';
      task.error = `FFmpeg error: ${err.message}`;
    });

  // Set codec according to requested format
  if (audioFormat === 'mp3') {
    cmd.audioCodec('libmp3lame');
  } else if (audioFormat === 'wav') {
    cmd.audioCodec('pcm_s16le');
  } else if (audioFormat === 'aac') {
    cmd.audioCodec('aac');
  } else if (audioFormat === 'm4a') {
    cmd.audioCodec('aac').format('mp4');
  }

  cmd.save(outPath);
});

/**
 * GET /api/task/:taskId - Poll task status
 */
app.get('/api/task/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  res.json(task);
});

/**
 * GET /api/download/:filename - Download completed media file
 */
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(DOWNLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or expired.' });
  }

  res.download(filePath, filename, (err) => {
    if (err && !res.headersSent) {
      console.error('[Download error]', err);
      res.status(500).send('Error downloading file.');
    }
  });
});

/**
 * GET /api/stream/:filename - HTTP 206 partial content streaming for media players
 */
app.get('/api/stream/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(DOWNLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Media not found.');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.aac') contentType = 'audio/aac';
  else if (ext === '.m4a') contentType = 'audio/mp4';
  else if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.webm') contentType = 'video/webm';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * GET /api/history - Return session conversion history
 */
app.get('/api/history', (req, res) => {
  res.json(sessionHistory);
});

// Helper functions
function addToSessionHistory(item) {
  sessionHistory.unshift(item);
  if (sessionHistory.length > 25) sessionHistory.pop();
}

function cleanFileName(name) {
  return name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Start Server (only when not handled by Vercel serverless launcher)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` ShortsSound Studio is running at: http://localhost:${PORT}`);
    console.log(` Static FFmpeg Path: ${ffmpegPath}`);
    console.log(` yt-dlp Path:        ${ytDlpPath}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
