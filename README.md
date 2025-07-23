# ChatSaver Browser Extension

A universal browser extension for saving ChatGPT conversations as Markdown, Plain Text, or JSON files.

## ✨ Features

- **Universal Compatibility**: Works on Chrome, Edge, and Firefox
- **One-Click Save**: Simple save button integrated into ChatGPT interface
- **Multiple Formats**: Export as PDF (полный), Markdown (.md), Plain Text (.txt), or JSON (.json)
- **PDF Full Copy**: Complete conversation copy with images, code formatting, tables, and text styling
- **Smart Collection**: Automatically scrolls and collects all messages
- **Image Preservation**: Saves screenshots and images directly in PDF format
- **Code Formatting**: Preserves syntax highlighting and structure in exported files
- **Table Support**: Maintains table formatting and structure
- **Progress Tracking**: Real-time progress bar with detailed status updates
- **Clean Output**: Removes UI elements and formats content properly
- **Timestamp Support**: Includes export timestamps and metadata
- **Offline Processing**: All processing happens locally for privacy

## 🚀 Installation

### Chrome/Edge (Chromium-based browsers)

1. **Download the Extension**
   - Clone or download this repository
   - Extract the files to a folder

2. **Enable Developer Mode**
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode" toggle in the top right
   
3. **Load the Extension**
   - Click "Load unpacked"
   - Select the ChatSaver folder
   - The extension should now appear in your extensions list

### Firefox

1. **Download the Extension**
   - Clone or download this repository
   
2. **Temporary Installation** (for testing)
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

3. **Permanent Installation** (requires signing)
   - Submit to Firefox Add-ons for review
   - Or use Firefox Developer Edition for unsigned extensions

## 📁 Required Files Setup

### Icons

You need to provide icon files in the `icons/` directory:

- `icon16.png` (16x16 pixels)
- `icon32.png` (32x32 pixels) 
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

**Creating Icons:**

You can create simple icons using any image editor. Recommended design:
- Simple download arrow symbol
- Chat bubble or message icon
- Primary color: #10a37f (teal green)
- Background: white or transparent
- Style: minimal, flat design

**Quick Icon Creation:**
```bash
# If you have ImageMagick installed, you can create simple placeholder icons:
convert -size 16x16 xc:#10a37f icons/icon16.png
convert -size 32x32 xc:#10a37f icons/icon32.png
convert -size 48x48 xc:#10a37f icons/icon48.png
convert -size 128x128 xc:#10a37f icons/icon128.png
```

Or use online tools like:
- [Favicon.io](https://favicon.io/)
- [Icon Generator](https://www.icon-generator.com/)
- [Canva](https://www.canva.com/)

## 📖 Usage

1. **Navigate to ChatGPT**
   - Go to [chatgpt.com](https://chatgpt.com) or [chat.openai.com](https://chat.openai.com)
   - Start or open a conversation

2. **Find the Save Button**
   - Look for the ChatSaver save button in the interface
   - It should appear near the top of the page or in the sidebar

3. **Choose Format and Save**
   - Select your preferred format from the dropdown (Markdown, Text, or JSON)
   - Click the "Save Chat" button
   - The extension will automatically scroll to collect all messages
   - Your file will be downloaded to your Downloads folder

## 📄 Export Formats

### PDF (Полный) - **НОВОЕ!**
- **Best for**: Complete archive, sharing, professional documentation
- **Features**: 
  - Полная копия чата с изображениями и скриншотами
  - Сохранение форматирования кода с цветами
  - Корректное отображение таблиц
  - Структурированный JSON код
  - Жирный и курсивный текст
  - Профессиональный дизайн документа
- **Example**: Полноценный PDF документ со всеми элементами беседы

### Markdown (.md)
- **Best for**: Reading, sharing, documentation
- **Features**: Headers, formatting, role indicators
- **Example**: 
  ```markdown
  # ChatGPT Conversation
  
  ## 👤 **You**
  Hello, how are you?
  
  ## 🤖 **ChatGPT**
  I'm doing well, thank you for asking!
  ```

### Plain Text (.txt)
- **Best for**: Simple text processing, legacy systems
- **Features**: Clean text, basic role indicators
- **Example**:
  ```
  ChatGPT Conversation
  [You]
  Hello, how are you?
  
  [ChatGPT]
  I'm doing well, thank you for asking!
  ```

### JSON (.json)
- **Best for**: Data processing, API integration
- **Features**: Structured data with metadata
- **Example**:
  ```json
  {
    "title": "ChatGPT Conversation",
    "exported": "2024-01-20T10:30:00Z",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?",
        "timestamp": "2024-01-20T10:30:00Z"
      }
    ]
  }
  ```

## 🛠️ Development

### File Structure
```
ChatSaver/
├── manifest.json          # Extension configuration
├── content.js             # Main content script - UI injection & message collection
├── downloader.js          # File download handling
├── background.js          # Service worker - lifecycle management
├── style.css              # UI styling
├── CHANGELOG.md           # Version history
├── README.md              # This file
└── icons/                 # Extension icons (you need to add these)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Key Components

**Content Script (`content.js`)**
- Injects save button into ChatGPT interface
- Handles message collection and scrolling
- Manages format selection and user interaction

**Downloader (`downloader.js`)**
- Handles file creation and downloads
- Supports multiple output formats
- Manages browser download APIs

**Background Script (`background.js`)**
- Extension lifecycle management
- Settings storage and retrieval
- Download coordination

### Testing

1. **Manual Testing**
   - Load the extension in developer mode
   - Navigate to ChatGPT
   - Test save functionality with different formats
   - Verify files are downloaded correctly

2. **Debug Mode**
   - Open browser developer tools
   - Check console for ChatSaver log messages
   - Monitor network and storage activity

## 🔒 Privacy & Security

- **No Data Collection**: The extension does not collect or transmit any user data
- **Local Processing**: All message processing happens locally in your browser
- **Minimal Permissions**: Only requests necessary permissions for functionality
- **Open Source**: Full source code is available for inspection

## 🐛 Troubleshooting

### Common Issues

**Save button not appearing:**
- Refresh the ChatGPT page
- Check if the extension is enabled
- Verify you're on a supported ChatGPT domain

**No messages saved:**
- Ensure you're on a conversation page with messages
- Try scrolling to load all messages manually first
- Check browser console for error messages

**Download not working:**
- Check if downloads are blocked in browser settings
- Verify Downloads folder permissions
- Try using a different export format

### Browser-Specific Issues

**Chrome/Edge:**
- Ensure Manifest V3 compatibility
- Check extension permissions in chrome://extensions/

**Firefox:**
- Verify WebExtensions API compatibility
- Check about:debugging for error messages

## 📝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

### Planned Features
- Automatic conversation detection
- Bulk export for multiple conversations
- Custom formatting templates
- Cloud storage integration
- Conversation filtering and search

## 📄 License

This project is open source. See the license file for details.

## 🔗 Links

- **ChatGPT**: [chatgpt.com](https://chatgpt.com)
- **Chrome Extensions**: [Chrome Web Store](https://chrome.google.com/webstore)
- **Firefox Add-ons**: [Mozilla Add-ons](https://addons.mozilla.org)

---

**Version**: 1.0.0  
**Last Updated**: January 2024 