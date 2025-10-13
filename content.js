// content.js

/**
 * Модуль content script расширения
 * ================================
 * Внедряется на все страницы для отображения UI-элементов
 */

if (window.__gemini_content_script_loaded) {
    console.debug('[Content Script] Скрипт уже загружен, прерывание повторной инициализации');
} else {
    window.__gemini_content_script_loaded = true;
    console.info('[Content Script] Инициализация content script');
}

var __geminiIndicator = null;
var __geminiModal = null;

/**
 * Обработчик сообщений от background script
 * Функция получает команды на отображение UI-элементов
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.debug('[Content Script] Получено сообщение', { action: request.action });

    if (request.action === 'showSummary') {
        showSummary(request.summary);
        sendResponse({ success: true });
    }

    return true;
});

/**
 * Отображение модального окна с контентом
 * Функция создает полноэкранное модальное окно для отображения результатов
 * 
 * Args:
 *     summary (string): Текст для отображения в модальном окне
 */
function showSummary(summary) {
    if (__geminiModal) {
        console.debug('[Content Script] Модальное окно уже отображено');
        return;
    }

    console.info('[Content Script] Отображение модального окна с результатом', {
        summaryLength: summary.length
    });

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.6);
        z-index: 2147483646;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        width: 100%;
        max-width: 700px;
        max-height: 85vh;
        padding: 24px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        overflow: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        position: relative;
    `;

    const contentWrapper = document.createElement('pre');
    contentWrapper.style.cssText = `
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        line-height: 1.6;
        color: #333;
        font-family: 'Courier New', monospace;
    `;
    contentWrapper.textContent = summary;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 12px;
        right: 15px;
        background: #f1f3f4;
        border: none;
        font-size: 28px;
        line-height: 1;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        color: #5f6368;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    `;

    closeBtn.onmouseover = () => {
        closeBtn.style.background = '#e8eaed';
        closeBtn.style.color = '#202124';
    };

    closeBtn.onmouseout = () => {
        closeBtn.style.background = '#f1f3f4';
        closeBtn.style.color = '#5f6368';
    };

    /**
     * Закрытие модального окна
     * Функция удаляет модальное окно из DOM
     */
    const closeModal = () => {
        if (__geminiModal && __geminiModal.parentNode) {
            __geminiModal.parentNode.removeChild(__geminiModal);
            __geminiModal = null;
            console.info('[Content Script] Модальное окно закрыто');
        }
    };

    closeBtn.onclick = closeModal;

    modal.appendChild(closeBtn);
    modal.appendChild(contentWrapper);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    __geminiModal = overlay;

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };

    document.addEventListener('keydown', handleEscape);

    console.debug('[Content Script] Модальное окно успешно создано и отображено');
}

console.info('[Content Script] Content script полностью загружен и готов к работе');