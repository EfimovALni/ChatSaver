/**
 * ChatSaver - Content Script
 * Injects save functionality into ChatGPT interface
 * Version: 1.0.0
 */

class ChatSaver {
  constructor() {
    this.saveButton = null;
    this.formatDropdown = null;
    this.isProcessing = false;
    this.init();
  }

  /**
   * Initialize the extension
   */
  init() {
    // Clean up any leftover PDF containers from previous sessions
    this.cleanupPDFArtifacts();
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectUI());
    } else {
      this.injectUI();
    }

    // Also try to inject after a delay to handle dynamic loading
    setTimeout(() => this.injectUI(), 2000);
    
    // Listen for navigation changes in single-page app
    this.observePageChanges();
  }

  /**
   * Clean up any PDF generation artifacts
   */
  cleanupPDFArtifacts() {
    try {
      // Remove any stuck PDF containers
      const pdfContainers = document.querySelectorAll('#chatsaver-pdf-container, [id^="chatsaver-pdf"]');
      pdfContainers.forEach(container => {
        try {
          container.remove();
        } catch (e) {
          console.warn('ChatSaver: Could not remove PDF artifact:', e);
        }
      });
    } catch (error) {
      console.warn('ChatSaver: Error during PDF cleanup:', error);
    }
  }

  /**
   * Observe page changes for SPA navigation
   */
  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Debounce UI injection
          clearTimeout(this.injectTimeout);
          this.injectTimeout = setTimeout(() => this.injectUI(), 1000);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Inject the save button and dropdown into the ChatGPT interface
   */
  injectUI() {
    // Avoid duplicate injection
    if (this.saveButton && document.contains(this.saveButton)) {
      return;
    }

    // Find the target location for injection
    const targetContainer = this.findInjectionPoint();
    if (!targetContainer) {
      console.log('ChatSaver: Injection point not found, retrying...');
      setTimeout(() => this.injectUI(), 1000);
      return;
    }

    this.createSaveButton(targetContainer);
    console.log('ChatSaver: UI injected successfully');
  }

  /**
   * Find the best injection point in the ChatGPT interface
   */
  findInjectionPoint() {
    // Try multiple selectors to find the best injection point
    const selectors = [
      'nav[aria-label="Chat history"]', // Sidebar navigation
      '.flex.h-full.max-w-full.flex-1.flex-col', // Main container
      '[data-testid="conversation-turn-0"]', // Near first message
      '.sticky.top-0', // Top navigation area
      'main' // Fallback to main content
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  /**
   * Create and inject the save button with dropdown
   */
  createSaveButton(container) {
    // Create the main container
    const saveContainer = document.createElement('div');
    saveContainer.className = 'chatsaver-container';
    saveContainer.id = 'chatsaver-main';

    // Create format dropdown
    const formatSelect = document.createElement('select');
    formatSelect.className = 'chatsaver-format-select';
    formatSelect.innerHTML = `
      <option value="pdf">PDF (Полный)</option>
      <option value="markdown">Markdown</option>
      <option value="text">Plain Text</option>
      <option value="json">JSON</option>
    `;

    // Add warning tooltip for PDF
    formatSelect.title = 'PDF: Полная копия с изображениями и форматированием (может занять время)';

    // Create save button
    const saveButton = document.createElement('button');
    saveButton.className = 'chatsaver-save-btn';
    saveButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      Save Chat
    `;

    // Create loading indicator with progress bar
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'chatsaver-loading-container';
    loadingContainer.style.display = 'none';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'chatsaver-progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'chatsaver-progress-fill';
    progressBar.appendChild(progressFill);
    
    const loadingText = document.createElement('span');
    loadingText.className = 'chatsaver-loading-text';
    loadingText.textContent = 'Подготовка...';
    
    loadingContainer.appendChild(progressBar);
    loadingContainer.appendChild(loadingText);

    // Assemble the container
    saveContainer.appendChild(formatSelect);
    saveContainer.appendChild(saveButton);
    saveContainer.appendChild(loadingContainer);

    // Add event listener
    saveButton.addEventListener('click', () => this.handleSaveClick(formatSelect, saveButton, loadingContainer));

    // Inject into the page
    if (container.firstChild) {
      container.insertBefore(saveContainer, container.firstChild);
    } else {
      container.appendChild(saveContainer);
    }

    this.saveButton = saveButton;
    this.formatDropdown = formatSelect;
  }

  /**
   * Handle save button click
   */
  async handleSaveClick(formatSelect, saveButton, loadingContainer) {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.currentOperation = 'starting';
    saveButton.style.display = 'none';
    loadingContainer.style.display = 'block';

    const progressFill = loadingContainer.querySelector('.chatsaver-progress-fill');
    const loadingText = loadingContainer.querySelector('.chatsaver-loading-text');

    // Add cancel functionality for long operations
    const cancelTimeout = setTimeout(() => {
      if (this.isProcessing && this.currentOperation === 'pdf') {
        console.warn('ChatSaver: PDF generation taking too long, offering cancel option');
        if (confirm('Генерация PDF занимает много времени. Отменить и попробовать Markdown формат?')) {
          this.cancelCurrentOperation();
          return;
        }
      }
    }, 20000); // 20 seconds timeout (reduced for faster feedback)

    try {
      // Step 1: Scroll to top and load all messages
      this.currentOperation = 'scrolling';
      this.updateProgress(progressFill, loadingText, 10, 'Прокрутка страницы...');
      await this.scrollToLoadAllMessages();
      
      // Step 2: Collect all messages
      this.currentOperation = 'collecting';
      this.updateProgress(progressFill, loadingText, 30, 'Сбор сообщений...');
      
      console.log('ChatSaver: Starting message collection...');
      console.log('ChatSaver: Current URL:', window.location.href);
      console.log('ChatSaver: Page title:', document.title);
      
      const messages = this.collectMessages();
      
      console.log(`ChatSaver: Collection completed - found ${messages.length} messages`);
      
      if (messages.length === 0) {
        console.error('ChatSaver: No messages found - debugging DOM structure...');
        
        // Debug DOM structure for troubleshooting
        const bodyClasses = document.body.className;
        const mainElements = document.querySelectorAll('main').length;
        const divCount = document.querySelectorAll('div').length;
        
        console.error('ChatSaver Debug Info:', {
          bodyClasses: bodyClasses,
          mainElements: mainElements,
          totalDivs: divCount,
          currentUrl: window.location.href
        });
        
        alert('Сообщения не найдены. Убедитесь, что вы находитесь на странице беседы ChatGPT.\n\nПроверьте консоль браузера (F12) для подробной информации об ошибке.');
        return;
      }
      
      console.log(`ChatSaver: Successfully collected ${messages.length} messages for ${formatSelect.value} export`);

      // Step 3: Process images for PDF (if needed)
      const format = formatSelect.value;
      if (format === 'pdf') {
        this.currentOperation = 'images';
        this.updateProgress(progressFill, loadingText, 50, 'Подготовка к PDF...');
        await this.processImagesForPDF(messages);
      }

      // Step 4: Format the content
      this.currentOperation = 'formatting';
      this.updateProgress(progressFill, loadingText, 70, 'Форматирование содержимого...');
      const formattedContent = this.formatContent(messages, format);
      
      // Step 5: Generate filename
      this.currentOperation = 'filename';
      this.updateProgress(progressFill, loadingText, 85, 'Подготовка файла...');
      const filename = this.generateFilename(format);
      
      // Step 6: Download the file
      this.currentOperation = format === 'pdf' ? 'pdf' : 'download';
      this.updateProgress(progressFill, loadingText, 95, 
        format === 'pdf' ? 'Создание PDF (упрощенный формат)...' : 'Загрузка файла...');
      
      await this.downloadFile(formattedContent, filename, format);
      
      this.updateProgress(progressFill, loadingText, 100, 'Завершено!');
      
      console.log(`ChatSaver: Successfully saved ${messages.length} messages as ${format}`);
      
      // Show completion briefly
      setTimeout(() => {
        this.resetProgress(progressFill, loadingText);
      }, 1000);
      
    } catch (error) {
      console.error('ChatSaver: Error saving chat:', error);
      
      let errorMessage = 'Ошибка при сохранении чата.';
      if (this.currentOperation === 'pdf') {
        // Offer alternative format for PDF failures
        const tryAlternative = confirm(
          'Ошибка создания PDF. Это может происходить из-за большого размера беседы или проблем с изображениями.\n\n' +
          'Попробовать сохранить как Markdown вместо PDF?'
        );
        
        if (tryAlternative) {
          try {
            // Quick fallback to Markdown
            this.updateProgress(progressFill, loadingText, 80, 'Сохранение как Markdown...');
            const messages = this.collectMessages(); // Re-collect if needed
            const markdownContent = this.formatAsMarkdown(messages, this.getConversationTitle(), new Date().toISOString());
            const markdownFilename = this.generateFilename('markdown');
            await this.downloadFile(markdownContent, markdownFilename, 'markdown');
            this.updateProgress(progressFill, loadingText, 100, 'Сохранено как Markdown!');
            return; // Success - don't show error
          } catch (fallbackError) {
            console.error('ChatSaver: Fallback to Markdown also failed:', fallbackError);
            errorMessage = 'Не удалось сохранить в любом формате. Попробуйте обновить страницу.';
          }
        } else {
          errorMessage = 'Создание PDF отменено. Попробуйте выбрать другой формат.';
        }
      }
      
      alert(errorMessage);
      this.resetProgress(progressFill, loadingText);
    } finally {
      clearTimeout(cancelTimeout);
      this.currentOperation = null;
      this.isProcessing = false;
      saveButton.style.display = 'inline-flex';
      setTimeout(() => {
        loadingContainer.style.display = 'none';
      }, 1500);
    }
  }

  /**
   * Cancel current operation safely
   */
  cancelCurrentOperation() {
    console.log('ChatSaver: Cancelling current operation');
    this.isProcessing = false;
    this.currentOperation = null;
    
    // Remove any PDF containers that might be stuck
    const pdfContainer = document.getElementById('chatsaver-pdf-container');
    if (pdfContainer) {
      try {
        document.body.removeChild(pdfContainer);
      } catch (e) {
        console.warn('ChatSaver: Could not remove PDF container during cancel:', e);
      }
    }
  }

  /**
   * Update progress bar and text
   */
  updateProgress(progressFill, loadingText, percent, text) {
    progressFill.style.width = `${percent}%`;
    loadingText.textContent = text;
  }

  /**
   * Reset progress bar
   */
  resetProgress(progressFill, loadingText) {
    progressFill.style.width = '0%';
    loadingText.textContent = 'Подготовка...';
  }

  /**
   * Process images for PDF conversion (simplified - just count them)
   */
  async processImagesForPDF(messages) {
    // Simplified: we're not converting images to base64 anymore
    // Just noting their presence for faster processing
    console.log('ChatSaver: Processing images for PDF (simplified approach)');
    
    let totalImages = 0;
    messages.forEach(message => {
      if (message.richContent && message.richContent.images) {
        totalImages += message.richContent.images.length;
      }
    });
    
    console.log(`ChatSaver: Found ${totalImages} images in conversation`);
    // No actual processing needed - much faster!
  }

  /**
   * Scroll to top and ensure all messages are loaded
   */
  async scrollToLoadAllMessages() {
    return new Promise((resolve) => {
      const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      // Initial scroll to top
      scrollToTop();

      // Wait for any lazy loading to complete
      setTimeout(() => {
        // Try to trigger any lazy loading by scrolling
        let scrollAttempts = 0;
        const maxAttempts = 10;
        
        const tryScroll = () => {
          if (scrollAttempts >= maxAttempts) {
            resolve();
            return;
          }
          
          scrollToTop();
          scrollAttempts++;
          setTimeout(tryScroll, 300);
        };
        
        tryScroll();
      }, 1000);
    });
  }

  /**
   * Collect all messages from the chat
   */
  collectMessages() {
    console.log('ChatSaver: Starting to collect messages...');
    const messages = [];
    
    // Modern selectors for current ChatGPT interface (2024)
    const messageSelectors = [
      // Most specific - direct message containers
      'article[data-testid^="conversation-turn"]',
      '[data-testid^="conversation-turn"]',
      
      // Alternative selectors for message containers
      'div[class*="group"][class*="text-gray"]',
      '.group.w-full.text-gray-800',
      
      // Fallback selectors
      'div[class*="w-full"][class*="group"]',
      '.markdown',
      
      // Very broad fallback
      'main article',
      'main > div > div > div'
    ];

    let messageElements = [];
    
    // Try each selector to find messages
    for (const selector of messageSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`ChatSaver: Selector "${selector}" found ${elements.length} elements`);
        
        if (elements.length > 0) {
          // Filter elements to ensure they contain substantial text
          const validElements = Array.from(elements).filter(el => {
            const text = el.textContent.trim();
            const hasText = text.length > 20;
            
            // Exclude elements that are likely UI components
            const isUIElement = el.querySelector('button.chatsaver-button') || 
                               el.classList.contains('chatsaver-container') ||
                               el.closest('.chatsaver-container');
            
            return hasText && !isUIElement;
          });
          
          if (validElements.length > 0) {
            messageElements = validElements;
            console.log(`ChatSaver: Using selector "${selector}" with ${messageElements.length} valid messages`);
            break;
          }
        }
      } catch (error) {
        console.warn(`ChatSaver: Error with selector "${selector}":`, error);
        continue;
      }
    }

    // If still no messages found, try a different approach
    if (messageElements.length === 0) {
      console.log('ChatSaver: No messages found with standard selectors, trying alternative approach...');
      
      // Look for conversation container
      const conversationContainers = [
        'main[class*="conversation"]',
        'div[class*="conversation"]',
        '.conversation',
        'main',
        '#__next main'
      ];
      
      for (const containerSelector of conversationContainers) {
        const container = document.querySelector(containerSelector);
        if (container) {
          // Find all divs within the conversation that have substantial text
          const allDivs = container.querySelectorAll('div');
          const potentialMessages = Array.from(allDivs).filter(div => {
            const text = div.textContent.trim();
            const hasSubstantialText = text.length > 50;
            const isNotUIElement = !div.querySelector('button, input, select, svg') &&
                                  !div.classList.contains('chatsaver-container') &&
                                  !div.closest('.chatsaver-container');
            
            // Check if it looks like a message (has paragraph-like content)
            const looksLikeMessage = text.includes('.') || text.includes('?') || text.includes('!') || text.length > 100;
            
            return hasSubstantialText && isNotUIElement && looksLikeMessage;
          });
          
          if (potentialMessages.length > 0) {
            messageElements = potentialMessages;
            console.log(`ChatSaver: Found ${messageElements.length} potential messages in container`);
            break;
          }
        }
      }
    }

    console.log(`ChatSaver: Processing ${messageElements.length} message elements`);

    if (messageElements.length === 0) {
      console.error('ChatSaver: No message elements found! The page structure may have changed.');
      return [];
    }

    // Process each message element
    messageElements.forEach((element, index) => {
      try {
        const text = this.extractTextContent(element);
        if (text && text.length > 20) { // Increased minimum length
          // Better role determination
          const role = this.determineMessageRole(element, index);
          
                     // Extract rich content for PDF
           const richContent = this.extractRichContentForPDF(element);
           
           // Try to extract HTML content for richer PDF generation
           const htmlContent = this.extractHTMLContent(element);
           
           console.log(`ChatSaver: Message ${index + 1} - Role: ${role}, Length: ${text.length}, Images: ${richContent.hasImages ? 'Yes' : 'No'}, HTML: ${htmlContent ? 'Yes' : 'No'}`);
           
           messages.push({
             role: role,
             content: text,
             htmlContent: htmlContent, // Add HTML content if available
             richContent: richContent,
             timestamp: new Date(),
             index: index,
             htmlElement: element // Keep reference for debugging
           });
        }
      } catch (error) {
        console.warn(`ChatSaver: Error processing message ${index}:`, error);
      }
    });

    // Remove duplicates and very short messages
    const cleanedMessages = this.deduplicateMessages(messages);
    console.log(`ChatSaver: Collected ${cleanedMessages.length} unique messages (from ${messages.length} total)`);
    
    // Debug: log first few messages
    if (cleanedMessages.length > 0) {
      console.log('ChatSaver: First message preview:', cleanedMessages[0].content.substring(0, 100) + '...');
      if (cleanedMessages.length > 1) {
        console.log('ChatSaver: Second message preview:', cleanedMessages[1].content.substring(0, 100) + '...');
      }
    }
    
    return cleanedMessages;
  }

  /**
   * Extract clean text content from an element
   */
  extractTextContent(element) {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'button', 'svg', '.sr-only', '[aria-hidden="true"]',
      '.chatsaver-container', 'script', 'style'
    ];
    
    unwantedSelectors.forEach(selector => {
      const unwanted = clone.querySelectorAll(selector);
      unwanted.forEach(el => el.remove());
    });
    
    return clone.textContent.trim();
  }

  /**
   * Extract HTML content with images and formatting preserved
   */
  extractHTMLContent(element) {
    if (!element) return null;
    
    try {
      // Clone the element to avoid modifying original
      const clone = element.cloneNode(true);
      
      // Remove unwanted UI elements but keep content structure
      const unwantedSelectors = [
        'button:not(.copy-button)', // Keep copy buttons but remove other buttons
        'svg:not(.icon)', // Remove icons but keep essential SVGs
        '.sr-only',
        '[aria-hidden="true"]',
        '.chatsaver-container',
        '.chatsaver-button',
        'script',
        'style',
        '[role="button"]',
        '.cursor-pointer:not(img):not([data-testid*="image"])', // Remove clickable elements but keep images
        '.hover\\:bg-' // Remove hover elements
      ];
      
      unwantedSelectors.forEach(selector => {
        try {
          const unwanted = clone.querySelectorAll(selector);
          unwanted.forEach(el => {
            // Instead of removing completely, try to preserve text content
            if (el.textContent.trim().length > 0 && !el.querySelector('img')) {
              // Replace with text node
              const textNode = document.createTextNode(el.textContent);
              if (el.parentNode) {
                el.parentNode.insertBefore(textNode, el);
              }
            }
            el.remove();
          });
        } catch (e) {
          console.warn('ChatSaver: Could not remove selector:', selector, e);
        }
      });
      
      // Clean up empty elements
      const emptyElements = clone.querySelectorAll('div:empty, span:empty, p:empty');
      emptyElements.forEach(el => {
        if (!el.querySelector('img, svg, canvas')) {
          el.remove();
        }
      });
      
      // Preserve and enhance image elements
      const images = clone.querySelectorAll('img');
      images.forEach(img => {
        // Ensure images have proper attributes
        if (!img.alt) {
          img.alt = 'Image from ChatGPT conversation';
        }
        
        // Add loading and display attributes
        img.setAttribute('loading', 'lazy');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        
        // Wrap images in a container for better PDF rendering
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        imageContainer.style.margin = '10px 0';
        imageContainer.style.textAlign = 'center';
        
        if (img.parentNode) {
          img.parentNode.insertBefore(imageContainer, img);
          imageContainer.appendChild(img);
        }
      });
      
      // Enhance code blocks
      const codeBlocks = clone.querySelectorAll('pre, code');
      codeBlocks.forEach(code => {
        code.style.backgroundColor = '#f4f4f4';
        code.style.padding = '8px';
        code.style.borderRadius = '4px';
        code.style.fontFamily = 'monospace';
        code.style.fontSize = '14px';
        code.style.border = '1px solid #ddd';
        code.style.whiteSpace = 'pre-wrap';
        code.style.wordWrap = 'break-word';
      });
      
      // Enhance tables
      const tables = clone.querySelectorAll('table');
      tables.forEach(table => {
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '10px 0';
        
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.style.border = '1px solid #ddd';
          cell.style.padding = '8px';
          cell.style.textAlign = 'left';
        });
        
        const headers = table.querySelectorAll('th');
        headers.forEach(th => {
          th.style.backgroundColor = '#f9f9f9';
          th.style.fontWeight = 'bold';
        });
      });
      
      // Enhance lists
      const lists = clone.querySelectorAll('ul, ol');
      lists.forEach(list => {
        list.style.marginLeft = '20px';
        list.style.marginBottom = '10px';
      });
      
      // Clean up and return HTML
      let html = clone.innerHTML;
      
      // Remove excessive whitespace and empty paragraphs
      html = html
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
        .replace(/<div>\s*<\/div>/g, '') // Remove empty divs
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .trim();
      
      // Validate that we have substantial HTML content
      if (html && html.length > 50) {
        console.log(`ChatSaver: Extracted HTML content (${html.length} chars)`);
        return html;
      } else {
        console.warn('ChatSaver: HTML content too short, falling back to text');
        return null; // Fall back to text content
      }
      
    } catch (error) {
      console.error('ChatSaver: Error extracting HTML content:', error);
      return null; // Fall back to text content
    }
  }

  /**
   * Extract rich content for PDF generation
   */
  extractRichContentForPDF(element) {
    const content = {
      text: '',
      hasImages: false,
      hasCode: false,
      hasTables: false
    };

    // Get text content
    content.text = this.extractTextContent(element);
    
    // Check for rich content types - look more thoroughly for images
    const images = element.querySelectorAll('img, [role="img"], .image, [data-testid*="image"]');
    content.hasImages = images.length > 0;
    
    // Also check for image upload indicators
    const imageIndicators = element.querySelectorAll('[aria-label*="image"], [title*="image"], [alt*="image"]');
    if (imageIndicators.length > 0) {
      content.hasImages = true;
    }
    
    // Check for file upload elements that might indicate images
    const fileElements = element.querySelectorAll('[data-testid*="file"], .file-upload, .attachment');
    if (fileElements.length > 0) {
      // Check if any mention images or have image-related classes
      for (const fileEl of fileElements) {
        const text = fileEl.textContent.toLowerCase();
        const classes = fileEl.className.toLowerCase();
        if (text.includes('image') || text.includes('картинк') || text.includes('изображен') || 
            classes.includes('image') || classes.includes('img')) {
          content.hasImages = true;
          break;
        }
      }
    }
    
    content.hasCode = element.querySelectorAll('pre, code, .code-block').length > 0;
    content.hasTables = element.querySelectorAll('table').length > 0;
    
    // Extract code blocks separately
    const codeBlocks = element.querySelectorAll('pre');
    content.codeBlocks = Array.from(codeBlocks).map(block => {
      return {
        language: this.detectCodeLanguage(block),
        content: block.textContent.trim()
      };
    });

    // Extract images info with more details
    content.images = Array.from(images).map(img => ({
      src: img.src || img.getAttribute('data-src') || '',
      alt: img.alt || img.getAttribute('aria-label') || 'Image',
      width: img.width || img.getAttribute('width') || 'auto',
      height: img.height || img.getAttribute('height') || 'auto'
    }));

    // Debug logging for image detection
    if (content.hasImages) {
      console.log('ChatSaver: Found images in message:', {
        imageCount: content.images.length,
        imageIndicators: imageIndicators.length,
        fileElements: fileElements.length
      });
    }

    return content;
  }

  /**
   * Detect code language from element
   */
  detectCodeLanguage(element) {
    const classList = element.className;
    if (classList.includes('python')) return 'python';
    if (classList.includes('javascript')) return 'javascript';
    if (classList.includes('json')) return 'json';
    if (classList.includes('html')) return 'html';
    if (classList.includes('css')) return 'css';
    return 'code';
  }



  /**
   * Determine message role (user/assistant) with improved logic for current ChatGPT interface
   */
  determineMessageRole(element, index) {
    // Check for data attributes first (most reliable)
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr === 'user') return 'user';
    if (roleAttr === 'assistant') return 'assistant';
    
    // Check parent elements for role attributes
    let parent = element.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const parentRoleAttr = parent.getAttribute('data-message-author-role');
      if (parentRoleAttr === 'user') return 'user';
      if (parentRoleAttr === 'assistant') return 'assistant';
      parent = parent.parentElement;
    }
    
    // Check for testid attributes
    const testId = element.getAttribute('data-testid') || '';
    if (testId.includes('user')) return 'user';
    if (testId.includes('assistant')) return 'assistant';
    
    // Check classes for modern ChatGPT patterns
    const classList = element.className;
    const classStr = classList.toString();
    
    // Look for user indicators
    if (classStr.includes('user') || 
        classStr.includes('human') ||
        classStr.includes('bg-gray-50') ||
        classStr.includes('ml-auto')) {
      return 'user';
    }
    
    // Look for assistant indicators  
    if (classStr.includes('assistant') || 
        classStr.includes('ai') ||
        classStr.includes('gpt') ||
        classStr.includes('bg-white') ||
        classStr.includes('mr-auto')) {
      return 'assistant';
    }
    
    // Check for avatar or profile indicators in the element or nearby
    const avatarElements = element.querySelectorAll('img[alt*="User"], img[alt*="user"], [aria-label*="user"], [title*="user"]');
    if (avatarElements.length > 0) return 'user';
    
    const botElements = element.querySelectorAll('img[alt*="ChatGPT"], img[alt*="Assistant"], [aria-label*="ChatGPT"], [title*="ChatGPT"]');
    if (botElements.length > 0) return 'assistant';
    
    // Check text content for patterns (less reliable but sometimes helpful)
    const textContent = element.textContent.toLowerCase();
    
    // Look for typical user question patterns
    if (textContent.includes('please') || 
        textContent.includes('можешь') || 
        textContent.includes('помоги') ||
        textContent.includes('как ') ||
        textContent.includes('что ') ||
        textContent.includes('?')) {
      // This might be a user message
      if (textContent.length < 500 && (textContent.match(/\?/g) || []).length > 0) {
        return 'user';
      }
    }
    
    // Look for typical assistant response patterns
    if (textContent.includes('i can help') ||
        textContent.includes('here\'s') ||
        textContent.includes('конечно') ||
        textContent.includes('давайте') ||
        textContent.includes('рассмотрим') ||
        textContent.includes('я помогу')) {
      return 'assistant';
    }
    
    // Position-based fallback - check position relative to siblings
    const parent_elem = element.parentElement;
    if (parent_elem) {
      const siblings = Array.from(parent_elem.children);
      const elementIndex = siblings.indexOf(element);
      const totalSiblings = siblings.length;
      
      // If it's one of the first few elements, more likely to be user
      if (elementIndex < totalSiblings / 2) {
        return 'user';
      } else {
        return 'assistant';
      }
    }
    
    // Final fallback: alternate based on index
    return index % 2 === 0 ? 'user' : 'assistant';
  }

  /**
   * Remove duplicate messages
   */
  deduplicateMessages(messages) {
    const seen = new Set();
    return messages.filter(message => {
      const key = `${message.role}:${message.content.substring(0, 100)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Format content based on selected format
   */
  formatContent(messages, format) {
    const title = this.getConversationTitle();
    const timestamp = new Date().toISOString();

    switch (format) {
      case 'pdf':
        return this.formatAsPDF(messages, title, timestamp);
      case 'markdown':
        return this.formatAsMarkdown(messages, title, timestamp);
      case 'json':
        return this.formatAsJSON(messages, title, timestamp);
      case 'text':
      default:
        return this.formatAsText(messages, title, timestamp);
    }
  }

  /**
   * Get conversation title from the page
   */
  getConversationTitle() {
    const titleSelectors = [
      'h1', '.text-lg', '.font-medium', 'title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return 'ChatGPT Conversation';
  }

  /**
   * Format messages as Markdown
   */
  formatAsMarkdown(messages, title, timestamp) {
    let markdown = `# ${title}\n\n`;
    markdown += `**Exported:** ${new Date(timestamp).toLocaleString()}\n\n`;
    markdown += `**Total Messages:** ${messages.length}\n\n---\n\n`;

    messages.forEach((message, index) => {
      const roleLabel = message.role === 'user' ? '👤 **You**' : '🤖 **ChatGPT**';
      markdown += `## ${roleLabel}\n\n`;
      
      // Add image indication for user messages
      if (message.role === 'user' && message.richContent && message.richContent.hasImages) {
        const imageCount = message.richContent.images ? message.richContent.images.length : 1;
        markdown += `📷 *[Изображение отправлено (${imageCount} шт.)]*\n\n`;
      }
      
      markdown += `${message.content}\n\n`;
      
      // Add code blocks if present
      if (message.richContent && message.richContent.codeBlocks && message.richContent.codeBlocks.length > 0) {
        message.richContent.codeBlocks.forEach(block => {
          markdown += `\`\`\`${block.language || 'text'}\n${block.content}\n\`\`\`\n\n`;
        });
      }
      
      // Add image indication for assistant messages (if any)
      if (message.role === 'assistant' && message.richContent && message.richContent.hasImages) {
        const imageCount = message.richContent.images ? message.richContent.images.length : 1;
        markdown += `📷 *[Изображение в ответе (${imageCount} шт.)]*\n\n`;
      }
      
      markdown += `---\n\n`;
    });

    return markdown;
  }

  /**
   * Format messages as plain text
   */
  formatAsText(messages, title, timestamp) {
    let text = `${title}\n`;
    text += `Exported: ${new Date(timestamp).toLocaleString()}\n`;
    text += `Total Messages: ${messages.length}\n\n`;
    text += '='.repeat(50) + '\n\n';

    messages.forEach((message, index) => {
      const roleLabel = message.role === 'user' ? 'You' : 'ChatGPT';
      text += `[${roleLabel}]\n${message.content}\n\n${'='.repeat(30)}\n\n`;
    });

    return text;
  }

  /**
   * Format messages as JSON
   */
  formatAsJSON(messages, title, timestamp) {
    const data = {
      title: title,
      exported: timestamp,
      messageCount: messages.length,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }))
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Format messages as PDF HTML
   */
  formatAsPDF(messages, title, timestamp) {
    const htmlContent = this.createFullHTMLCopy(messages, title, timestamp);
    return htmlContent;
  }

  /**
   * Create ULTRA-SIMPLIFIED HTML for PDF generation (Senior dev approach)
   */
  createFullHTMLCopy(messages, title, timestamp) {
    console.log('ChatSaver: Creating ULTRA-SIMPLIFIED HTML for PDF with', messages.length, 'messages');
    console.log('ChatSaver: Title:', title);
    console.log('ChatSaver: Sample message roles:', messages.slice(0, 3).map(m => m.role));
    
    // Validate messages
    if (!messages || messages.length === 0) {
      console.error('ChatSaver: No messages to convert to PDF');
      return `<html><head><meta charset="UTF-8"></head><body style="font-family:Arial;padding:20px;"><h1>Ошибка: нет сообщений</h1><p>Обновите страницу ChatGPT и попробуйте снова</p></body></html>`;
    }
    
    // ULTRA-SIMPLE HTML - NO CSS CLASSES, ONLY INLINE STYLES (Senior dev solution)
    console.log('ChatSaver: Building ultra-simple HTML without CSS classes...');
    
    let html = `<html>
<head>
<meta charset="UTF-8">
<title>${this.escapeHtml(title)}</title>
</head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:white;color:black;font-size:14px;line-height:1.4;">

<div style="border-bottom:2px solid black;padding-bottom:10px;margin-bottom:20px;">
<h1 style="margin:0 0 10px 0;font-size:20px;color:black;">${this.escapeHtml(title)}</h1>
<p style="margin:0;font-size:12px;color:gray;">Экспортировано: ${new Date(timestamp).toLocaleString('ru-RU')} | Сообщений: ${messages.length}</p>
</div>`;

    let processedMessages = 0;
    messages.forEach((message, index) => {
      if (!message || !message.content) {
        console.warn('ChatSaver: Skipping empty message at index', index);
        return;
      }
      
      console.log(`ChatSaver: Processing message ${index + 1}/${messages.length} - Role: ${message.role}, Length: ${message.content.length}`);
      
      // Ultra-simple styling based on role
      const isUser = message.role === 'user';
      const bgColor = isUser ? '#f0f0f0' : '#ffffff';
      const borderColor = isUser ? '#0066cc' : '#00aa44';
      const roleText = isUser ? 'ПОЛЬЗОВАТЕЛЬ' : 'CHATGPT';
      
      // Always use text content for maximum compatibility
      let content = this.escapeHtml(message.content || '');
      console.log(`ChatSaver: Using text content for message ${index + 1}`);
      
      // Add image indication with ultra-simple styling
      if (message.role === 'user' && message.richContent && message.richContent.hasImages) {
        const imageCount = message.richContent.images ? message.richContent.images.length : 1;
        content = `<div style="background:#eeeeee;padding:10px;margin:5px 0;border:1px solid #cccccc;">📷 Изображение отправлено (${imageCount} шт.)</div>` + content;
        console.log(`ChatSaver: Added ${imageCount} image(s) to user message ${index + 1}`);
      }
      
      // Add code blocks with ultra-simple styling
      if (message.richContent && message.richContent.codeBlocks && message.richContent.codeBlocks.length > 0) {
        console.log(`ChatSaver: Adding ${message.richContent.codeBlocks.length} code block(s) to message ${index + 1}`);
        message.richContent.codeBlocks.forEach(block => {
          content += `<div style="background:#f5f5f5;padding:8px;margin:5px 0;border:1px solid #dddddd;font-family:monospace;font-size:12px;">${block.language || 'код'}:<br>${this.escapeHtml(block.content)}</div>`;
        });
      }
      
      // Add assistant image indication
      if (message.role === 'assistant' && message.richContent && message.richContent.hasImages) {
        const imageCount = message.richContent.images ? message.richContent.images.length : 1;
        content += `<div style="background:#eeeeee;padding:10px;margin:5px 0;border:1px solid #cccccc;">🖼️ Изображение в ответе (${imageCount} шт.)</div>`;
        console.log(`ChatSaver: Added ${imageCount} image(s) to assistant message ${index + 1}`);
      }
      
      // Ensure we have content
      if (!content.trim()) {
        content = 'Пустое сообщение';
        console.warn(`ChatSaver: Message ${index + 1} appears to be empty`);
      }
      
      // Ultra-simple message structure
      html += `
<div style="margin:15px 0;padding:15px;background:${bgColor};border-left:4px solid ${borderColor};">
<div style="font-weight:bold;font-size:14px;margin-bottom:8px;color:#333333;">${roleText}</div>
<div style="font-size:14px;line-height:1.4;color:#000000;">${content}</div>
</div>`;
    
      processedMessages++;
    });

    html += `
<div style="margin-top:30px;text-align:center;color:#666666;font-size:12px;">
Обработано сообщений: ${processedMessages} | ChatSaver
</div>
</body>
</html>`;

    console.log('ChatSaver: HTML generated successfully');
    console.log('ChatSaver: HTML length:', html.length);
    console.log('ChatSaver: Processed messages:', processedMessages);
    console.log('ChatSaver: HTML preview (first 1000 chars):', html.substring(0, 1000));
    console.log('ChatSaver: HTML preview (last 500 chars):', html.substring(html.length - 500));
    
    // Validate HTML before returning
    if (html.length < 1000) {
      console.warn('ChatSaver: Generated HTML seems too short, length:', html.length);
      console.warn('ChatSaver: Full HTML:', html);
    }
    
    // Count actual message elements
    const messageCount = (html.match(/<div class="message/g) || []).length;
    console.log('ChatSaver: HTML contains', messageCount, 'message elements');
    
    // Ensure HTML is valid and contains actual content
    if (!html.includes('<div class="message') || messageCount === 0) {
      console.error('ChatSaver: HTML does not contain message elements');
      console.error('ChatSaver: Full HTML for debugging:', html);
      
      const debugHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отладочная информация</title>
  <style>body { font-family: Arial, sans-serif; padding: 20px; }</style>
</head>
<body>
  <h1>Ошибка генерации HTML</h1>
  <p>Обработано сообщений: ${processedMessages}</p>
  <p>Общая длина HTML: ${html.length}</p>
  <p>Найдено элементов сообщений: ${messageCount}</p>
  <p>Проблема: HTML не содержит элементов сообщений</p>
  <h2>Исходный HTML:</h2>
  <pre style="background: #f5f5f5; padding: 10px; white-space: pre-wrap;">${this.escapeHtml(html)}</pre>
</body>
</html>`;
      return debugHtml;
    }
    
    // Test HTML validity
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      console.log('ChatSaver: HTML validation passed');
    } catch (htmlError) {
      console.error('ChatSaver: HTML validation failed:', htmlError);
    }
    
    return html;
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }



  /**
   * Generate filename with timestamp
   */
  generateFilename(format) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    let extension;
    
    switch (format) {
      case 'pdf':
        extension = 'pdf';
        break;
      case 'json':
        extension = 'json';
        break;
      case 'markdown':
        extension = 'md';
        break;
      default:
        extension = 'txt';
    }
    
    return `chatgpt-conversation-${dateStr}-${timeStr}.${extension}`;
  }

  /**
   * Download file using the downloader module
   */
  async downloadFile(content, filename, format) {
    if (window.ChatSaverDownloader) {
      await window.ChatSaverDownloader.download(content, filename, format);
    } else {
      console.error('ChatSaver: Downloader not available');
      throw new Error('Download functionality not available');
    }
  }
}

// Initialize ChatSaver when the script loads
const chatSaver = new ChatSaver();
console.log('ChatSaver: Extension loaded successfully'); 