/**
 * ChatSaver - Downloader Module
 * Handles file downloads and saving functionality
 * Version: 1.0.0
 */

class ChatSaverDownloader {
  constructor() {
    this.init();
  }

  /**
   * Initialize the downloader
   */
  init() {
    // Make the downloader globally available
    window.ChatSaverDownloader = this;
    console.log('ChatSaver: Downloader module initialized');
  }

  /**
   * Download content as a file
   * @param {string} content - The content to download
   * @param {string} filename - The filename for the downloaded file
   * @param {string} format - The format (pdf, markdown, text, json)
   */
  async download(content, filename, format) {
    try {
      if (format === 'pdf') {
        await this.downloadAsPDF(content, filename);
      } else {
        // Determine MIME type based on format
        const mimeType = this.getMimeType(format);
        
        // Check if we're in a browser extension context
        if (typeof chrome !== 'undefined' && chrome.downloads) {
          await this.downloadViaExtensionAPI(content, filename, mimeType);
        } else {
          // Fallback to browser download
          this.downloadViaBrowserAPI(content, filename, mimeType);
        }
      }
      
      console.log(`ChatSaver: Successfully downloaded ${filename}`);
    } catch (error) {
      console.error('ChatSaver: Download failed:', error);
      // Fallback to browser download if extension API fails
      if (format !== 'pdf') {
        this.downloadViaBrowserAPI(content, filename, this.getMimeType(format));
      }
    }
  }

  /**
   * Download content as PDF
   * @param {string} htmlContent - The HTML content to convert to PDF
   * @param {string} filename - The filename for the PDF
   */
  async downloadAsPDF(htmlContent, filename) {
    try {
      // Check if html2pdf is available
      if (typeof html2pdf === 'undefined') {
        throw new Error('PDF library not loaded');
      }

      console.log('ChatSaver: Starting PDF generation with multiple fallback methods...');

      // Try alternative method first (HTML string)
      try {
        console.log('ChatSaver: Trying Method 1 - HTML string approach...');
        await this.generatePDFFromHTMLString(htmlContent, filename);
        console.log('ChatSaver: Method 1 (HTML string) succeeded!');
        return;
      } catch (method1Error) {
        console.warn('ChatSaver: Method 1 (HTML string) failed:', method1Error.message);
      }

      // Fallback to DOM element method
      try {
        console.log('ChatSaver: Trying Method 2 - DOM element approach...');
        await this.generatePDFSafely(htmlContent, filename);
        console.log('ChatSaver: Method 2 (DOM element) succeeded!');
        return;
      } catch (method2Error) {
        console.error('ChatSaver: Method 2 (DOM element) also failed:', method2Error.message);
        throw new Error(`All PDF generation methods failed. Method 1: ${method1Error?.message || 'Unknown error'}. Method 2: ${method2Error.message}`);
      }

    } catch (error) {
      console.error('ChatSaver: PDF generation completely failed:', error);
      throw error;
    }
  }

  /**
   * Safely generate PDF without blocking the main UI
   */
  async generatePDFSafely(htmlContent, filename) {
    let tempContainer = null;
    
    try {
      // Validate HTML content first
      if (!htmlContent || htmlContent.length < 100) {
        throw new Error(`Invalid HTML content for PDF generation. Length: ${htmlContent ? htmlContent.length : 0}`);
      }
      
      console.log('ChatSaver: Starting PDF generation...');
      console.log('ChatSaver: HTML content length:', htmlContent.length);
      
      // Configure PDF options for speed and reliability
      const options = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { 
          type: 'jpeg', 
          quality: 0.9,
          timeout: 10000
        },
        html2canvas: { 
          scale: 1.5, // Higher scale for better text quality
          useCORS: false, // Disable CORS for simplicity  
          allowTaint: true, // Allow cross-origin content
          logging: true, // Keep logging for debugging
          backgroundColor: '#ffffff', // White background
          width: 794, // A4 width in pixels (210mm at 96 DPI)
          height: 1123, // A4 height in pixels (297mm at 96 DPI)
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          windowHeight: 1123,
          onclone: function(clonedDoc) {
            // Ensure text wrapping in cloned document
            const style = clonedDoc.createElement('style');
            style.textContent = `
              * { word-wrap: break-word !important; overflow-wrap: break-word !important; }
              body { max-width: 190mm !important; }
            `;
            clonedDoc.head.appendChild(style);
          }
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true,
          precision: 16 // Higher precision for better text rendering
        },
        pagebreak: { 
          mode: ['css', 'legacy'],
          avoid: ['tr', '.message', '.code-block']
        }
      };

      console.log('ChatSaver: Creating PDF container...');
      
      // Create a visible but isolated container that html2canvas can properly render
      tempContainer = document.createElement('div');
      tempContainer.id = 'chatsaver-pdf-container-' + Date.now();
      
      // Optimized container for better PDF rendering
      tempContainer.style.cssText = `
        position: fixed;
        top: 50px;
        left: 50px;
        width: 210mm;
        min-height: 297mm;
        max-width: 210mm;
        background: white;
        z-index: 999999;
        border: 1px solid #ccc;
        padding: 0;
        font-family: Arial, sans-serif;
        font-size: 13px;
        color: black;
        overflow: visible;
        box-sizing: border-box;
      `;
      
      // Clean and validate the HTML content before insertion
      console.log('ChatSaver: Cleaning HTML content for PDF...');
      const cleanedContent = this.cleanHTMLForPDF(htmlContent);
      
      if (!cleanedContent || cleanedContent.length < 100) {
        throw new Error('HTML cleaning resulted in empty content');
      }
      
      // Wrap content in a proper HTML structure
      const wrappedContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          ${cleanedContent}
        </div>
      `;
      
      tempContainer.innerHTML = wrappedContent;
      
      console.log('ChatSaver: PDF content length after cleaning:', cleanedContent.length);
      
      // Add to body temporarily - user will see the container during generation
      document.body.appendChild(tempContainer);
      
      // Simple notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: green;
        color: white;
        padding: 10px;
        z-index: 1000000;
        font-family: Arial;
        font-size: 14px;
        border: 2px solid black;
      `;
      notification.textContent = 'PDF генерация... Контейнер видим';
      document.body.appendChild(notification);

      // Wait for content to render properly
      console.log('ChatSaver: Waiting for content to render...');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Longer delay for proper rendering
      
      // Validate container has rendered content
      const containerText = tempContainer.textContent || tempContainer.innerText || '';
      const containerHTML = tempContainer.innerHTML || '';
      
      console.log('ChatSaver: Container text length:', containerText.length);
      console.log('ChatSaver: Container HTML length:', containerHTML.length);
      console.log('ChatSaver: Container first 200 chars:', containerText.substring(0, 200));
      console.log('ChatSaver: Container HTML preview:', containerHTML.substring(0, 500));
      console.log('ChatSaver: Container element info:', {
        tagName: tempContainer.tagName,
        className: tempContainer.className,
        id: tempContainer.id,
        children: tempContainer.children.length,
        offsetWidth: tempContainer.offsetWidth,
        offsetHeight: tempContainer.offsetHeight,
        scrollWidth: tempContainer.scrollWidth,
        scrollHeight: tempContainer.scrollHeight
      });
      
      if (!containerText.trim()) {
        throw new Error('Container appears to be empty after rendering');  
      }
      
      if (containerHTML.length < 500) {
        console.error('ChatSaver: Container HTML seems too short. Full HTML:', containerHTML);
        throw new Error('Container HTML content seems too short');
      }

      // Check if html2pdf is available
      if (typeof html2pdf === 'undefined') {
        throw new Error('html2pdf library is not loaded');
      }

      // Test html2pdf with ultra-simple content (Senior dev approach)
      console.log('ChatSaver: Testing html2pdf with ultra-simple content...');
      const testContainer = document.createElement('div');
      testContainer.innerHTML = '<div style="font-family:Arial;padding:10px;color:black;background:white;"><h1 style="color:black;">TEST</h1><p style="color:black;">This is a rendering test</p></div>';
      testContainer.style.cssText = 'position:fixed;top:50px;left:50px;width:400px;height:200px;background:white;border:1px solid black;z-index:999999;';
      document.body.appendChild(testContainer);
      
      try {
        console.log('ChatSaver: Test container added, waiting for render...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for render
        
        await new Promise((resolveTest, rejectTest) => {
          const testTimeout = setTimeout(() => rejectTest(new Error('Test timeout')), 10000);
          
          // Ultra-simple test options
          html2pdf(testContainer, {
            margin: 5,
            filename: 'chatsaver-test.pdf',
            html2canvas: { 
              scale: 1, 
              logging: true,
              useCORS: false,
              allowTaint: true,
              backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          }).then(() => {
            console.log('ChatSaver: ✅ html2pdf RENDER TEST PASSED');
            clearTimeout(testTimeout);
            resolveTest();
          }).catch((testError) => {
            console.error('ChatSaver: ❌ html2pdf RENDER TEST FAILED:', testError);
            clearTimeout(testTimeout);
            rejectTest(testError);
          });
        });
      } catch (testError) {
        console.error('ChatSaver: html2pdf render test failed:', testError);
        throw new Error(`html2pdf cannot render content: ${testError.message}`);
      } finally {
        // Clean up test container
        document.body.removeChild(testContainer);
      }

      // Generate PDF with proper error handling
      console.log('ChatSaver: Starting html2pdf conversion with actual content...');
      
      const pdfPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PDF generation timeout (45s) - conversation might be too large'));
        }, 45000);

        try {
          console.log('ChatSaver: Creating html2pdf worker...');
          console.log('ChatSaver: PDF options:', JSON.stringify(options, null, 2));
          
          // Try the simplest possible approach first
          console.log('ChatSaver: Starting PDF generation with simple approach...');
          
          html2pdf(tempContainer, options).then(() => {
            console.log('ChatSaver: PDF generation completed successfully with simple approach!');
            clearTimeout(timeout);
            resolve();
          }).catch((simpleError) => {
            console.warn('ChatSaver: Simple approach failed, trying advanced approach:', simpleError);
            
            // If simple approach fails, try the advanced approach
            try {
              const worker = html2pdf();
              
              worker
                .set(options)
                .from(tempContainer)
                .save()
                .then(() => {
                  console.log('ChatSaver: PDF generation completed with advanced approach!');
                  clearTimeout(timeout);
                  resolve();
                })
                .catch((advancedError) => {
                  console.error('ChatSaver: Advanced approach also failed:', advancedError);
                  
                  // Last resort: try to get PDF data manually
                  worker
                    .set(options)
                    .from(tempContainer)
                    .toPdf()
                    .get('pdf')
                    .then((pdfDoc) => {
                      console.log('ChatSaver: Got PDF document object manually');
                      console.log('ChatSaver: PDF pages:', pdfDoc.internal?.getNumberOfPages() || 'unknown');
                      
                      // Check PDF size
                      const pdfData = pdfDoc.output('datauristring');
                      console.log('ChatSaver: PDF data length:', pdfData.length);
                      
                      if (pdfData.length < 1000) {
                        console.error('ChatSaver: PDF data seems too small:', pdfData.length);
                        console.error('ChatSaver: PDF data preview:', pdfData.substring(0, 200));
                      }
                      
                      // Try to save manually
                      pdfDoc.save(filename);
                      
                      console.log('ChatSaver: PDF saved manually!');
                      clearTimeout(timeout);
                      resolve();
                    })
                    .catch((manualError) => {
                      console.error('ChatSaver: Manual approach also failed:', manualError);
                      console.error('ChatSaver: All PDF generation methods failed');
                      clearTimeout(timeout);
                      reject(new Error(`All PDF generation methods failed. Last error: ${manualError.message}`));
                    });
                });
            } catch (workerError) {
              console.error('ChatSaver: Could not create html2pdf worker:', workerError);
              clearTimeout(timeout);
              reject(new Error(`PDF worker creation failed: ${workerError.message}`));
            }
          });
            
        } catch (syncError) {
          console.error('ChatSaver: Synchronous PDF error:', syncError);
          console.error('ChatSaver: Sync error details:', syncError.stack);
          clearTimeout(timeout);
          reject(new Error(`PDF setup failed: ${syncError.message}`));
        }
      });

      await pdfPromise;

    } catch (error) {
      console.error('ChatSaver: PDF generation error details:', {
        message: error.message,
        stack: error.stack,
        containerExists: !!tempContainer,
        html2pdfAvailable: typeof html2pdf !== 'undefined'
      });
      throw error;
    } finally {
      // Always clean up, even if there's an error
      if (tempContainer && tempContainer.parentNode) {
        try {
          document.body.removeChild(tempContainer);
          console.log('ChatSaver: Cleaned up temporary container');
        } catch (e) {
          console.warn('ChatSaver: Could not remove temp container:', e);
        }
      }
      
      // Remove notification
      const notifications = document.querySelectorAll('div[style*="background: green"], div[style*="background:green"]');
      notifications.forEach(notification => {
        if (notification.textContent && notification.textContent.includes('PDF генерация')) {
          try {
            document.body.removeChild(notification);
            console.log('ChatSaver: Removed notification');
          } catch (e) {
            console.warn('ChatSaver: Could not remove notification:', e);
          }
        }
      });
    }
  }

  /**
   * Alternative PDF generation method - create PDF directly from HTML string
   */
  async generatePDFFromHTMLString(htmlContent, filename) {
    try {
      console.log('ChatSaver: Trying alternative method - PDF from HTML string');
      console.log('ChatSaver: HTML string length:', htmlContent.length);
      
      // Clean HTML content
      const cleanedHTML = this.cleanHTMLForPDF(htmlContent);
      console.log('ChatSaver: Cleaned HTML length:', cleanedHTML.length);
      
      if (cleanedHTML.length < 200) {
        throw new Error('HTML content too short after cleaning');
      }
      
             // Ultra-simple options (Senior dev: less is more)
       const options = {
         margin: 10,
         filename: filename,
         html2canvas: { 
           scale: 1,
           backgroundColor: '#ffffff',
           logging: true
         },
         jsPDF: { 
           unit: 'mm', 
           format: 'a4', 
           orientation: 'portrait' 
         }
       };
      
      console.log('ChatSaver: Attempting to create PDF from HTML string...');
      
      // Try creating PDF directly from HTML string
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('HTML string PDF generation timeout'));
        }, 30000);
        
        try {
          // Create a worker and use fromHTML method if available
          const worker = html2pdf();
          
          // Try different approaches
          if (worker.from && typeof worker.from === 'function') {
            // Method 1: Use from() with HTML string
            console.log('ChatSaver: Using worker.from() method...');
            worker
              .set(options)
              .from(cleanedHTML)  // Pass HTML string directly
              .save()
              .then(() => {
                console.log('ChatSaver: PDF created successfully from HTML string!');
                clearTimeout(timeout);
                resolve();
              })
              .catch((error) => {
                console.error('ChatSaver: worker.from() failed:', error);
                reject(error);
              });
          } else {
            // Method 2: Create temporary element and use it
            console.log('ChatSaver: Creating temporary element for HTML string...');
            const tempEl = document.createElement('div');
            tempEl.innerHTML = cleanedHTML;
            tempEl.style.cssText = `
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 210mm !important;
              background: white !important;
              padding: 10mm !important;
              font-family: Arial, sans-serif !important;
              font-size: 14px !important;
              line-height: 1.6 !important;
              z-index: 999999 !important;
            `;
            
            document.body.appendChild(tempEl);
            
            // Wait a bit for rendering
            setTimeout(() => {
              html2pdf(tempEl, options)
                .then(() => {
                  console.log('ChatSaver: PDF created successfully from temporary element!');
                  document.body.removeChild(tempEl);
                  clearTimeout(timeout);
                  resolve();
                })
                .catch((error) => {
                  console.error('ChatSaver: Temporary element method failed:', error);
                  if (tempEl.parentNode) {
                    document.body.removeChild(tempEl);
                  }
                  reject(error);
                });
            }, 500);
          }
        } catch (error) {
          console.error('ChatSaver: HTML string method setup failed:', error);
          clearTimeout(timeout);
          reject(error);
        }
      });
      
    } catch (error) {
      console.error('ChatSaver: Alternative PDF generation failed:', error);
      throw error;
    }
  }

  /**
   * Clean HTML content for safer PDF generation
   */
  cleanHTMLForPDF(htmlContent) {
    if (!htmlContent) {
      console.error('ChatSaver: No HTML content to clean');
      return '';
    }

    console.log('ChatSaver: Starting HTML cleaning process...');
    
    // Remove any scripts, iframes, or other potentially problematic elements
    let cleaned = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '') // Remove external links
      .replace(/<meta[^>]*>/gi, '') // Remove meta tags
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .replace(/on\w+='[^']*'/gi, '') // Remove event handlers with single quotes
      .replace(/javascript:/gi, '') // Remove javascript: links
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '<span>[SVG Icon]</span>') // Replace SVGs with text
      .replace(/<canvas[^>]*>[\s\S]*?<\/canvas>/gi, '<span>[Canvas Content]</span>'); // Replace canvas

    // Fix broken HTML tags and entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Ensure proper HTML structure
    if (!cleaned.includes('<html>')) {
      // Extract body content if it exists, otherwise use all content
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : cleaned;
      
      cleaned = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>ChatGPT Conversation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
    .message { margin-bottom: 20px; page-break-inside: avoid; }
    .code-block { background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
    }

    // Validate final HTML
    if (cleaned.length < 200) {
      console.warn('ChatSaver: Cleaned HTML seems very short:', cleaned.length, 'chars');
    }

    console.log('ChatSaver: HTML cleaning completed, final length:', cleaned.length);
    return cleaned;
  }

  /**
   * Get MIME type based on format
   * @param {string} format - The file format
   * @returns {string} - The MIME type
   */
  getMimeType(format) {
    switch (format) {
      case 'pdf':
        return 'application/pdf';
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
   * Download using Chrome Extension Downloads API
   * @param {string} content - The content to download
   * @param {string} filename - The filename
   * @param {string} mimeType - The MIME type
   */
  async downloadViaExtensionAPI(content, filename, mimeType) {
    return new Promise((resolve, reject) => {
      // Create a blob with the content
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Use Chrome Downloads API
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false, // Save directly to Downloads folder
        conflictAction: 'uniquify' // Add number if file exists
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          // Clean up the object URL after download starts
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 100);
          resolve(downloadId);
        }
      });
    });
  }

  /**
   * Download using browser API (fallback)
   * @param {string} content - The content to download
   * @param {string} filename - The filename
   * @param {string} mimeType - The MIME type
   */
  downloadViaBrowserAPI(content, filename, mimeType) {
    // Create a blob with the content
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Create a temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';

    // Add to DOM, click, and remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up the object URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Check if downloads API is available
   * @returns {boolean} - True if downloads API is available
   */
  isExtensionDownloadAvailable() {
    return typeof chrome !== 'undefined' && 
           chrome.downloads && 
           typeof chrome.downloads.download === 'function';
  }

  /**
   * Sanitize filename to ensure it's valid for the file system
   * @param {string} filename - The original filename
   * @returns {string} - The sanitized filename
   */
  sanitizeFilename(filename) {
    // Remove or replace invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars with dash
      .replace(/\s+/g, '-') // Replace spaces with dash
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  }

  /**
   * Get file size in a human-readable format
   * @param {string} content - The content to measure
   * @returns {string} - Formatted file size
   */
  getFileSizeString(content) {
    const bytes = new Blob([content]).size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    
    return `${size} ${sizes[i]}`;
  }

  /**
   * Validate content before download
   * @param {string} content - The content to validate
   * @param {string} format - The format type
   * @returns {boolean} - True if content is valid
   */
  validateContent(content, format) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    if (content.trim().length === 0) {
      return false;
    }

    // Format-specific validation
    if (format === 'json') {
      try {
        JSON.parse(content);
      } catch (e) {
        console.warn('ChatSaver: Invalid JSON content');
        return false;
      }
    }

    return true;
  }

  /**
   * Create a backup download method for emergency cases
   * @param {string} content - The content to download
   * @param {string} filename - The filename
   */
  emergencyDownload(content, filename) {
    try {
      // Use data URL as last resort
      const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();
    } catch (error) {
      console.error('ChatSaver: Emergency download failed:', error);
      // Show content in new window as absolute last resort
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<pre>${content}</pre>`);
        newWindow.document.title = filename;
      }
    }
  }
}

// Initialize the downloader
const chatSaverDownloader = new ChatSaverDownloader(); 