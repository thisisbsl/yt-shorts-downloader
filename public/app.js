/**
 * ShortsSound Studio - Client Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const engineStatusBadge = document.getElementById('engineStatusBadge');
  const engineStatusText = document.getElementById('engineStatusText');

  // Tabs
  const tabBtnUrl = document.getElementById('tabBtnUrl');
  const tabBtnUpload = document.getElementById('tabBtnUpload');
  const tabPanelUrl = document.getElementById('tabPanelUrl');
  const tabPanelUpload = document.getElementById('tabPanelUpload');

  // Tab 1: URL & Shorts
  const urlInput = document.getElementById('urlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const fetchBtn = document.getElementById('fetchBtn');
  const videoInfoCard = document.getElementById('videoInfoCard');
  const infoThumbnail = document.getElementById('infoThumbnail');
  const infoDurationBadge = document.getElementById('infoDurationBadge');
  const infoShortBadge = document.getElementById('infoShortBadge');
  const infoTitle = document.getElementById('infoTitle');
  const infoAuthor = document.getElementById('infoAuthor');
  const pillAudioOption = document.getElementById('pillAudioOption');
  const pillVideoOption = document.getElementById('pillVideoOption');
  const audioFormatOptions = document.getElementById('audioFormatOptions');
  const urlAudioFormatSelect = document.getElementById('urlAudioFormatSelect');
  const urlAudioQualitySelect = document.getElementById('urlAudioQualitySelect');
  const startUrlDownloadBtn = document.getElementById('startUrlDownloadBtn');
  const downloadBtnLabel = document.getElementById('downloadBtnLabel');

  // Tab 2: Upload Video
  const dropZone = document.getElementById('dropZone');
  const videoFileInput = document.getElementById('videoFileInput');
  const uploadDetailsCard = document.getElementById('uploadDetailsCard');
  const uploadFileName = document.getElementById('uploadFileName');
  const uploadFileSize = document.getElementById('uploadFileSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const uploadVideoPreview = document.getElementById('uploadVideoPreview');
  const uploadAudioFormat = document.getElementById('uploadAudioFormat');
  const uploadAudioBitrate = document.getElementById('uploadAudioBitrate');
  const startUploadExtractBtn = document.getElementById('startUploadExtractBtn');

  // Progress Tracker
  const progressContainer = document.getElementById('progressContainer');
  const progressStatusText = document.getElementById('progressStatusText');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');
  const progressDetailText = document.getElementById('progressDetailText');

  // Results & Player
  const resultContainer = document.getElementById('resultContainer');
  const resultTitle = document.getElementById('resultTitle');
  const resultFormatBadge = document.getElementById('resultFormatBadge');
  const resultSize = document.getElementById('resultSize');
  const resultDuration = document.getElementById('resultDuration');
  const audioPlayerBox = document.getElementById('audioPlayerBox');
  const videoPlayerBox = document.getElementById('videoPlayerBox');
  const mediaAudioPlayer = document.getElementById('mediaAudioPlayer');
  const mediaVideoPlayer = document.getElementById('mediaVideoPlayer');
  const directDownloadLink = document.getElementById('directDownloadLink');
  const convertAnotherBtn = document.getElementById('convertAnotherBtn');

  // History
  const historyList = document.getElementById('historyList');
  const emptyHistoryNotice = document.getElementById('emptyHistoryNotice');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastContainer = document.getElementById('toastContainer');

  // --- State Variables ---
  let currentVideoInfo = null;
  let selectedUploadFile = null;
  let activeTaskId = null;
  let pollInterval = null;
  let downloadHistory = [];

  // --- Initialize ---
  checkEngineStatus();
  loadHistory();

  // Poll status occasionally
  setInterval(checkEngineStatus, 15000);

  // --- Engine Status Check ---
  async function checkEngineStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Status check failed');
      const data = await res.json();
      
      const indicator = engineStatusBadge.querySelector('.status-indicator');
      if (data.ready) {
        indicator.className = 'status-indicator online';
        engineStatusText.textContent = 'Engine: Ready';
      } else if (data.initializing) {
        indicator.className = 'status-indicator busy';
        engineStatusText.textContent = data.message || 'Engine: Preparing tools...';
      } else {
        indicator.className = 'status-indicator busy';
        engineStatusText.textContent = 'Engine: Checking...';
      }
    } catch (e) {
      const indicator = engineStatusBadge.querySelector('.status-indicator');
      indicator.className = 'status-indicator busy';
      engineStatusText.textContent = 'Engine: Offline';
    }
  }

  // --- Tab Switching ---
  tabBtnUrl.addEventListener('click', () => switchTab('url'));
  tabBtnUpload.addEventListener('click', () => switchTab('upload'));

  function switchTab(tab) {
    if (tab === 'url') {
      tabBtnUrl.classList.add('active');
      tabBtnUrl.setAttribute('aria-selected', 'true');
      tabBtnUpload.classList.remove('active');
      tabBtnUpload.setAttribute('aria-selected', 'false');

      tabPanelUrl.classList.add('active');
      tabPanelUpload.classList.remove('active');
    } else {
      tabBtnUpload.classList.add('active');
      tabBtnUpload.setAttribute('aria-selected', 'true');
      tabBtnUrl.classList.remove('active');
      tabBtnUrl.setAttribute('aria-selected', 'false');

      tabPanelUpload.classList.add('active');
      tabPanelUrl.classList.remove('active');
    }
  }

  // --- Toast Notification Helper ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    
    const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- Tab 1: Paste & Fetch URL Info ---
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        fetchVideoInfo();
      } else {
        showToast('Clipboard is empty', 'info');
      }
    } catch (err) {
      showToast('Please allow clipboard permission or paste manually with Ctrl+V', 'info');
    }
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchVideoInfo();
    }
  });

  fetchBtn.addEventListener('click', fetchVideoInfo);

  async function fetchVideoInfo() {
    const url = urlInput.value.trim();
    if (!url) {
      showToast('Please enter a YouTube Shorts or video link', 'error');
      urlInput.focus();
      return;
    }

    fetchBtn.disabled = true;
    fetchBtn.innerHTML = `<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div><span>Fetching...</span>`;

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to retrieve video info');
      }

      currentVideoInfo = data;
      renderVideoInfoCard(data);
      showToast('Video information loaded!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not fetch video info. Check link and try again.', 'error');
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = `<span>Fetch Info</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
    }
  }

  function renderVideoInfoCard(info) {
    infoThumbnail.src = info.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" fill="%23222"></svg>';
    infoDurationBadge.textContent = info.durationFormatted || (info.duration ? formatDuration(info.duration) : '0:00');
    infoTitle.textContent = info.title || 'YouTube Video';
    infoAuthor.textContent = info.uploader || info.channel || 'YouTube';

    if (info.isShort || (info.duration && info.duration <= 60)) {
      infoShortBadge.classList.remove('hidden');
    } else {
      infoShortBadge.classList.add('hidden');
    }

    videoInfoCard.classList.remove('hidden');
    videoInfoCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Format selection toggle (Audio vs Video)
  const radioInputs = document.querySelectorAll('input[name="urlDownloadMode"]');
  radioInputs.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'audio') {
        pillAudioOption.classList.add('active');
        pillVideoOption.classList.remove('active');
        audioFormatOptions.classList.remove('hidden');
        downloadBtnLabel.textContent = `Download & Extract ${urlAudioFormatSelect.value.toUpperCase()}`;
      } else {
        pillVideoOption.classList.add('active');
        pillAudioOption.classList.remove('active');
        audioFormatOptions.classList.add('hidden');
        downloadBtnLabel.textContent = 'Download Full Video (MP4)';
      }
    });
  });

  urlAudioFormatSelect.addEventListener('change', () => {
    const selectedMode = document.querySelector('input[name="urlDownloadMode"]:checked').value;
    if (selectedMode === 'audio') {
      downloadBtnLabel.textContent = `Download & Extract ${urlAudioFormatSelect.value.toUpperCase()}`;
    }
  });

  // Start URL Download & Extraction
  startUrlDownloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showToast('Please enter a URL first', 'error');
      return;
    }

    const mode = document.querySelector('input[name="urlDownloadMode"]:checked').value;
    const audioFormat = urlAudioFormatSelect.value;
    const quality = urlAudioQualitySelect.value;

    startUrlDownloadBtn.disabled = true;
    showProgress('Starting download and extraction engine...', 5);

    try {
      const res = await fetch('/api/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mode,
          audioFormat,
          quality,
          title: currentVideoInfo ? currentVideoInfo.title : null
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to start download');
      }

      activeTaskId = data.taskId;
      trackProgress(data.taskId);
    } catch (err) {
      hideProgress();
      showToast(err.message, 'error');
      startUrlDownloadBtn.disabled = false;
    }
  });

  // --- Tab 2: Upload Video File ---
  dropZone.addEventListener('click', () => videoFileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleSelectedVideoFile(files[0]);
    }
  });

  videoFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectedVideoFile(e.target.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', () => {
    selectedUploadFile = null;
    videoFileInput.value = '';
    uploadDetailsCard.classList.add('hidden');
    dropZone.classList.remove('hidden');
    if (uploadVideoPreview.src) {
      URL.revokeObjectURL(uploadVideoPreview.src);
      uploadVideoPreview.src = '';
    }
  });

  function handleSelectedVideoFile(file) {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      showToast('Please select a valid video file (.mp4, .mov, .webm, .mkv, .avi)', 'error');
      return;
    }

    selectedUploadFile = file;
    uploadFileName.textContent = file.name;
    uploadFileSize.textContent = formatBytes(file.size);

    // Create object URL for instant preview
    const videoUrl = URL.createObjectURL(file);
    uploadVideoPreview.src = videoUrl;

    dropZone.classList.add('hidden');
    uploadDetailsCard.classList.remove('hidden');
    uploadDetailsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Start Upload & Audio Extraction
  startUploadExtractBtn.addEventListener('click', () => {
    if (!selectedUploadFile) {
      showToast('Please select a video file first', 'error');
      return;
    }

    const audioFormat = uploadAudioFormat.value;
    const bitrate = uploadAudioBitrate.value;

    startUploadExtractBtn.disabled = true;
    showProgress('Uploading video file to extraction engine...', 10);

    const formData = new FormData();
    formData.append('video', selectedUploadFile);
    formData.append('audioFormat', audioFormat);
    formData.append('bitrate', bitrate);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/extract-upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 45); // Upload is first 45%
        updateProgress(percent, 'Uploading video to server...');
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          activeTaskId = res.taskId;
          updateProgress(50, 'Extracting audio stream with FFmpeg...');
          trackProgress(res.taskId);
        } catch (e) {
          hideProgress();
          showToast('Failed to parse server response', 'error');
          startUploadExtractBtn.disabled = false;
        }
      } else {
        hideProgress();
        showToast('Video upload failed. Check server status.', 'error');
        startUploadExtractBtn.disabled = false;
      }
    };

    xhr.onerror = () => {
      hideProgress();
      showToast('Network error during upload', 'error');
      startUploadExtractBtn.disabled = false;
    };

    xhr.send(formData);
  });

  // --- Task Progress Polling ---
  function trackProgress(taskId) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`);
        if (!res.ok) throw new Error('Failed to query task status');
        const task = await res.json();

        if (task.status === 'processing') {
          updateProgress(task.progress || 50, task.message || 'Processing media with FFmpeg...');
        } else if (task.status === 'completed') {
          clearInterval(pollInterval);
          updateProgress(100, 'Finished!');
          setTimeout(() => {
            hideProgress();
            renderResult(task.result);
            saveToHistory(task.result);
            showToast('Conversion completed successfully!', 'success');
            startUrlDownloadBtn.disabled = false;
            startUploadExtractBtn.disabled = false;
          }, 600);
        } else if (task.status === 'error') {
          clearInterval(pollInterval);
          hideProgress();
          showToast(task.error || 'Processing encountered an error', 'error');
          startUrlDownloadBtn.disabled = false;
          startUploadExtractBtn.disabled = false;
        }
      } catch (err) {
        console.error('Progress poll error:', err);
      }
    }, 900);
  }

  function showProgress(message, percent = 5) {
    progressStatusText.textContent = message;
    progressDetailText.textContent = 'Please wait while we extract and process your media...';
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    progressContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateProgress(percent, message) {
    const clamped = Math.min(Math.max(percent, 0), 100);
    progressBar.style.width = `${clamped}%`;
    progressPercent.textContent = `${clamped}%`;
    if (message) progressStatusText.textContent = message;
  }

  function hideProgress() {
    progressContainer.classList.add('hidden');
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // --- Render Result & Media Player ---
  function renderResult(result) {
    resultTitle.textContent = result.title || result.originalName || 'Extracted Media';
    resultFormatBadge.textContent = (result.format || 'MP3').toUpperCase();
    resultSize.textContent = formatBytes(result.size || 0);
    resultDuration.textContent = result.duration ? formatDuration(result.duration) : '';

    directDownloadLink.href = result.downloadUrl;
    directDownloadLink.setAttribute('download', result.filename);

    // Audio or Video player setup
    if (result.mediaType === 'audio') {
      videoPlayerBox.classList.add('hidden');
      audioPlayerBox.classList.remove('hidden');
      mediaAudioPlayer.src = result.streamUrl || result.downloadUrl;
      mediaAudioPlayer.load();
    } else {
      audioPlayerBox.classList.add('hidden');
      videoPlayerBox.classList.remove('hidden');
      mediaVideoPlayer.src = result.streamUrl || result.downloadUrl;
      mediaVideoPlayer.load();
    }

    resultContainer.classList.remove('hidden');
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  convertAnotherBtn.addEventListener('click', () => {
    resultContainer.classList.add('hidden');
    if (mediaAudioPlayer) mediaAudioPlayer.pause();
    if (mediaVideoPlayer) mediaVideoPlayer.pause();
    window.scrollTo({ top: 120, behavior: 'smooth' });
  });

  // --- History & Storage ---
  function saveToHistory(item) {
    if (!item) return;
    const record = {
      id: item.filename || Date.now().toString(),
      title: item.title || item.originalName || 'Converted Media',
      format: (item.format || 'MP3').toUpperCase(),
      size: item.size || 0,
      downloadUrl: item.downloadUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mediaType: item.mediaType || 'audio'
    };

    downloadHistory.unshift(record);
    if (downloadHistory.length > 15) downloadHistory.pop();

    try {
      localStorage.setItem('shortssound_history', JSON.stringify(downloadHistory));
    } catch (e) {}

    renderHistory();
  }

  function loadHistory() {
    try {
      const stored = localStorage.getItem('shortssound_history');
      if (stored) {
        downloadHistory = JSON.parse(stored);
      }
    } catch (e) {
      downloadHistory = [];
    }
    renderHistory();
  }

  function renderHistory() {
    if (!downloadHistory || downloadHistory.length === 0) {
      emptyHistoryNotice.classList.remove('hidden');
      historyList.innerHTML = '';
      historyList.appendChild(emptyHistoryNotice);
      return;
    }

    emptyHistoryNotice.classList.add('hidden');
    historyList.innerHTML = '';

    downloadHistory.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      const icon = item.mediaType === 'video' ? '🎬' : '🎵';
      
      el.innerHTML = `
        <div class="history-item-info">
          <div class="history-type-icon">${icon}</div>
          <div class="history-item-text">
            <h4 class="history-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
            <div class="history-item-meta">
              <span>${item.format}</span>
              <span>•</span>
              <span>${formatBytes(item.size)}</span>
              <span>•</span>
              <span>${item.timestamp}</span>
            </div>
          </div>
        </div>
        <div class="history-actions">
          <a href="${item.downloadUrl}" download class="history-dl-btn" title="Download">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download</span>
          </a>
        </div>
      `;
      historyList.appendChild(el);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    downloadHistory = [];
    try {
      localStorage.removeItem('shortssound_history');
    } catch (e) {}
    renderHistory();
    showToast('Session history cleared', 'info');
  });

  // --- Utility Functions ---
  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
