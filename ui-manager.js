// ui-manager.js

/**
 * Модуль для управления UI элементами расширения
 * ================================================
 * Централизованное управление индикаторами, модальными окнами и уведомлениями
 */

class UIManager {
    /**
     * Отображение индикатора на странице
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст сообщения
     */
    static showIndicator(tabId, message) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg) => {
                let el = document.getElementById('__gemini_indicator__');
                if (el) el.remove();

                el = document.createElement('div');
                el.id = '__gemini_indicator__';
                el.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: rgba(0,0,0,0.88);
                    color: white;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-family: system-ui, sans-serif;
                    font-size: 14px;
                    z-index: 2147483647;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    max-width: 320px;
                    text-align: center;
                    pointer-events: none;
                `;
                el.textContent = msg;
                document.body.appendChild(el);
            },
            args: [message]
        });
    }

    /**
     * Скрытие индикатора на странице
     * 
     * Args:
     *     tabId (number): ID вкладки
     */
    static hideIndicator(tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const el = document.getElementById('__gemini_indicator__');
                if (el) el.remove();
            }
        });
    }

    /**
     * Отображение ошибки с автоскрытием
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст ошибки
     *     timeout (number): Время отображения в мс
     */
    static showError(tabId, message, timeout = 4000) {
        this.showIndicator(tabId, message);
        setTimeout(() => this.hideIndicator(tabId), timeout);
    }

    /**
     * Отображение модального окна с результатом
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     content (string): Контент для отображения
     */
    static showModal(tabId, content) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (text) => {
                const old = document.getElementById('__gemini_modal_fallback__');
                if (old) old.remove();

                const overlay = document.createElement('div');
                overlay.id = '__gemini_modal_fallback__';
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
                `;

                const modal = document.createElement('div');
                modal.style.cssText = `
                    background: white;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 600px;
                    max-height: 80vh;
                    padding: 20px;
                    font-family: system-ui, sans-serif;
                    overflow: auto;
                `;
                modal.textContent = text;
                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                const close = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                };

                overlay.onclick = close;
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') close();
                });
            },
            args: [content]
        });
    }

    /**
     * Отображение системного уведомления
     * 
     * Args:
     *     title (string): Заголовок уведомления
     *     message (string): Текст уведомления
     */
    static showNotification(title, message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: title,
            message: message
        });
    }
}