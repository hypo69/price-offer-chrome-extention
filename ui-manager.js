// ui-manager.js
// \file ui-manager.js
// -*- coding: utf-8 -*-

/**
 * Модуль управления UI-элементами расширения
 * ==========================================
 * Централизованное управление индикаторами, модальными окнами и уведомлениями
 */

class UIManager {
    /**
     * Отображение индикатора загрузки
     * Функция создает визуальный индикатор на странице
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст сообщения для отображения
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
        }, async () => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка отображения индикатора', {
                    error: chrome.runtime.lastError.message,
                    tabId: tabId
                });
            }
        });
    }

    /**
     * Скрытие индикатора загрузки
     * Функция удаляет индикатор со страницы
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
        }, async () => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка скрытия индикатора', {
                    error: chrome.runtime.lastError.message,
                    tabId: tabId
                });
            }
        });
    }

    /**
     * Отображение уведомления с автоскрытием
     * Функция показывает цветное уведомление на заданное время
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст уведомления
     *     timeout (number): Время отображения в миллисекундах (по умолчанию 4000)
     *     isError (boolean): Флаг ошибки для изменения цвета (по умолчанию false)
     */
    static showError(tabId, message, timeout = 4000, isError = false) {
        logger.info('Отображение уведомления', {
            tabId: tabId,
            message: message,
            timeout: timeout,
            isError: isError
        });

        this.showNotificationWithColor(tabId, message, isError);
        setTimeout(() => this.hideIndicator(tabId), timeout);
    }

    /**
     * Отображение цветного уведомления
     * Функция создает уведомление с цветом в зависимости от типа
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст уведомления
     *     isError (boolean): Флаг ошибки для выбора цвета (по умолчанию false)
     */
    static showNotificationWithColor(tabId, message, isError = false) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg, isErr) => {
                let el = document.getElementById('__gemini_indicator__');
                if (el) el.remove();

                el = document.createElement('div');
                el.id = '__gemini_indicator__';
                const backgroundColor = isErr ? '#db4437' : '#4285f4';
                el.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: ${backgroundColor};
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
                    animation: slideIn 0.3s ease-out;
                `;
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(400px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                `;
                if (!document.querySelector('style[data-gemini-animations]')) {
                    style.setAttribute('data-gemini-animations', 'true');
                    document.head.appendChild(style);
                }
                el.textContent = msg;
                document.body.appendChild(el);
            },
            args: [message, isError]
        }, async () => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка отображения цветного уведомления', {
                    error: chrome.runtime.lastError.message,
                    tabId: tabId
                });
            }
        });
    }

    /**
     * Отображение модального окна
     * Функция создает модальное окно для отображения результатов
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     content (string): Содержимое для отображения
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
                    white-space: pre-wrap;
                    word-break: break-word;
                `;
                modal.textContent = text;
                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                const close = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                };
                overlay.onclick = (e) => { if (e.target === overlay) close(); };
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
            },
            args: [content]
        }, async () => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка отображения модального окна', {
                    error: chrome.runtime.lastError.message,
                    tabId: tabId
                });
            }
        });
    }

    /**
     * Отображение системного уведомления
     * Функция создает нативное уведомление браузера
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
        }, async (notificationId) => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка создания системного уведомления', {
                    error: chrome.runtime.lastError.message,
                    title: title
                });
            }
        });
    }
}