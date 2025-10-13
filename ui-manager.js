// ui-manager.js

/**
 * Модуль управления UI-элементами расширения
 * ==========================================
 * Централизованное управление индикаторами, модальными окнами и уведомлениями
 */

class UIManager {
    /**
     * Внутренний логгер для UI-операций
     */
    static _logger = null;

    /**
     * Получение экземпляра логгера
     * 
     * Returns:
     *     Logger: Экземпляр логгера
     */
    static _getLogger() {
        if (!UIManager._logger) {
            UIManager._logger = new Logger('__kazarinov_logs__', 100);
        }
        return UIManager._logger;
    }

    /**
     * Отображение индикатора загрузки на странице
     * Функция создает визуальный индикатор в правом верхнем углу страницы
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст сообщения для отображения
     */
    static showIndicator(tabId, message) {
        const logger = UIManager._getLogger();

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg) => {
                let el = document.getElementById('__gemini_indicator__');
                if (el) {
                    el.remove();
                }

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
            } else {
                await logger.debug('Индикатор отображен', { tabId: tabId, message: message });
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
        const logger = UIManager._getLogger();

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const el = document.getElementById('__gemini_indicator__');
                if (el) {
                    el.remove();
                }
            }
        }, async () => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка скрытия индикатора', {
                    error: chrome.runtime.lastError.message,
                    tabId: tabId
                });
            } else {
                await logger.debug('Индикатор скрыт', { tabId: tabId });
            }
        });
    }

    /**
     * Отображение сообщения с автоматическим скрытием
     * Функция показывает уведомление с цветом в зависимости от типа сообщения
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст сообщения
     *     timeout (number): Время отображения в миллисекундах (по умолчанию 4000)
     *     isError (boolean): Флаг ошибки для выбора цвета (по умолчанию false)
     */
    static showError(tabId, message, timeout = 4000, isError = false) {
        const logger = UIManager._getLogger();

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
     * Отображение цветного уведомления на странице
     * Функция создает уведомление с цветом в зависимости от типа
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     message (string): Текст сообщения
     *     isError (boolean): true для красного (ошибка), false для голубого (инфо)
     */
    static showNotificationWithColor(tabId, message, isError = false) {
        const logger = UIManager._getLogger();

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg, isErr) => {
                let el = document.getElementById('__gemini_indicator__');
                if (el) {
                    el.remove();
                }

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
            } else {
                await logger.debug('Цветное уведомление отображено', {
                    tabId: tabId,
                    message: message,
                    isError: isError
                });
            }
        });
    }

    /**
     * Отображение модального окна с контентом
     * Функция создает полноэкранное модальное окно с содержимым
     * 
     * Args:
     *     tabId (number): ID вкладки
     *     content (string): Контент для отображения в модальном окне
     */
    static showModal(tabId, content) {
        const logger = UIManager._getLogger();

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (text) => {
                const old = document.getElementById('__gemini_modal_fallback__');
                if (old) {
                    old.remove();
                }

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
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                };

                overlay.onclick = (e) => {
                    if (e.target === overlay) {
                        close();
                    }
                };

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        close();
                    }
                });
            },
            args: [content]
        }, async () => {
            if (chrome.runtime.lastError) {
                await logger.error('Ошибка отображения модального окна', {
                    error: chrome.runtime.lastError.message,
                    tabId: tabId
                });
            } else {
                await logger.info('Модальное окно отображено', {
                    tabId: tabId,
                    contentLength: content.length
                });
            }
        });
    }

    /**
     * Отображение системного уведомления Chrome
     * Функция создает нативное уведомление операционной системы
     * 
     * Args:
     *     title (string): Заголовок уведомления
     *     message (string): Текст уведомления
     */
    static showNotification(title, message) {
        const logger = UIManager._getLogger();

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
            } else {
                await logger.debug('Системное уведомление создано', {
                    notificationId: notificationId,
                    title: title
                });
            }
        });
    }
}