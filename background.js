/**
 * ChatSaver - Background Service Worker
 * Handles extension lifecycle and background tasks
 * Version: 1.0.0
 */

// Extension installation and update handling
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ChatSaver: Extension installed/updated', details);
  
  if (details.reason === 'install') {
    // First time installation
    console.log('ChatSaver: First time installation');
    
    // Set default settings
    chrome.storage.sync.set({
      defaultFormat: 'markdown',
      autoScroll: true,
      includeTimestamps: true,
      version: '1.0.0'
    });
    
    // Show welcome notification (optional)
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ChatSaver Installed!',
      message: 'You can now save your ChatGPT conversations. Look for the save button on ChatGPT pages.'
    });
    
  } else if (details.reason === 'update') {
    // Extension update
    console.log(`ChatSaver: Updated from ${details.previousVersion} to ${chrome.runtime.getManifest().version}`);
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('ChatSaver: Extension started');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('ChatSaver: Received message:', request);
  
  switch (request.action) {
    case 'download':
      handleDownload(request.data, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'getSettings':
      getSettings(sendResponse);
      return true;
      
    case 'saveSettings':
      saveSettings(request.settings, sendResponse);
      return true;
      
    default:
      console.warn('ChatSaver: Unknown message action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Handle file download requests
 * @param {Object} data - Download data containing content, filename, format
 * @param {Function} sendResponse - Response callback
 */
async function handleDownload(data, sendResponse) {
  try {
    const { content, filename, format } = data;
    
    // Validate input
    if (!content || !filename) {
      throw new Error('Missing content or filename');
    }
    
    // Create blob and download
    const blob = new Blob([content], { 
      type: getContentType(format) 
    });
    const url = URL.createObjectURL(blob);
    
    // Use downloads API
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    
    // Clean up blob URL after download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    console.log(`ChatSaver: Download initiated with ID ${downloadId}`);
    sendResponse({ success: true, downloadId });
    
  } catch (error) {
    console.error('ChatSaver: Download failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get content type for different formats
 * @param {string} format - File format
 * @returns {string} - MIME type
 */
function getContentType(format) {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'markdown':
      return 'text/markdown';
    case 'text':
    default:
      return 'text/plain';
  }
}

/**
 * Get extension settings
 * @param {Function} sendResponse - Response callback
 */
async function getSettings(sendResponse) {
  try {
    const settings = await chrome.storage.sync.get({
      defaultFormat: 'markdown',
      autoScroll: true,
      includeTimestamps: true,
      version: '1.0.0'
    });
    
    sendResponse({ success: true, settings });
  } catch (error) {
    console.error('ChatSaver: Failed to get settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Save extension settings
 * @param {Object} settings - Settings to save
 * @param {Function} sendResponse - Response callback
 */
async function saveSettings(settings, sendResponse) {
  try {
    await chrome.storage.sync.set(settings);
    console.log('ChatSaver: Settings saved:', settings);
    sendResponse({ success: true });
  } catch (error) {
    console.error('ChatSaver: Failed to save settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle download completion (for tracking/analytics)
chrome.downloads?.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log('ChatSaver: Download completed:', downloadDelta.id);
  }
});

// Keep service worker alive (Chrome extension best practice)
let keepAliveInterval;

function keepAlive() {
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // This keeps the service worker active
    });
  }, 20000); // Every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep alive when extension starts
keepAlive();

// Clean up on suspend
chrome.runtime.onSuspend?.addListener(() => {
  console.log('ChatSaver: Service worker suspending');
  stopKeepAlive();
});

console.log('ChatSaver: Background script loaded successfully'); 