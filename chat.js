// chat.js

/**
 * Модуль чата с Gemini
 * ====================
 * Реализация интерактивного диалога с моделью Gemini
 * на основе содержимого текущей страницы
 */

const logger = new Logger('__kazarinov_logs__', 100);

/**
 * Состояние чата
 * Хранит историю сообщений и конфигурацию
 */
let chatState = {
    tabId: null,
    chatHistory: [],
    model: 'gemini-2.5-flash',
    apiKey: '',
    pageUrl: '',
    pageText: ''
};

/**
 * Добавление сообщения в чат
 * Функция создает DOM-элемент сообщения и добавляет его в контейнер чата
 * 
 * Args:
 *     text (string): Текст сообщения
 *     role (string): Роль отправителя ('user' или 'ai')
 */
function addMessage(text, role) {
    const chat = document.getElementById('chat');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;

    logger.debug(`Сообщение добавлено в чат`, { role: role, length: text.length });
}

/**
 * Установка текста статуса
 * Функция обновляет текст в элементе статуса
 * 
 * Args:
 *     text (string): Текст статуса
 *     isError (boolean): Флаг ошибки для изменения стиля
 */
function setStatus(text, isError = false) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.style.color = isError ? '#db4437' : '#5f6368';

    logger.debug(`Статус обновлен: ${text}`, { isError: isError });
}

/**
 * Инициализация чата
 * Функция загружает настройки и содержимое текущей страницы
 */
async function initializeChat() {
    try {
        setStatus('Инициализация чата...');

        const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);

        if (!geminiApiKey) {
            setStatus('API ключ не установлен. Откройте настройки расширения.', true);
            logger.error('Попытка инициализации чата без API ключа');
            return;
        }

        chatState.apiKey = geminiApiKey;
        chatState.model = geminiModel || 'gemini-2.5-flash';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chatState.tabId = tab.id;
        chatState.pageUrl = tab.url;

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText
        });

        chatState.pageText = results[0]?.result || '';

        setStatus('Готов к диалогу');
        logger.info('Чат инициализирован', {
            model: chatState.model,
            pageUrl: chatState.pageUrl,
            textLength: chatState.pageText.length
        });

        addMessage('Здравствуйте! Я готов ответить на ваши вопросы о содержимом этой страницы.', 'ai');

    } catch (ex) {
        setStatus('Ошибка инициализации чата', true);
        logger.error('Ошибка инициализации чата', {
            error: ex.message,
            stack: ex.stack
        });
    }
}

/**
 * Отправка сообщения пользователя
 * Функция обрабатывает ввод пользователя, отправляет запрос к Gemini
 * и отображает ответ
 */
async function sendMessage() {
    const input = document.getElementById('user-input');
    const userMessage = input.value.trim();

    if (!userMessage) {
        logger.warn('Попытка отправки пустого сообщения');
        return;
    }

    input.value = '';
    addMessage(userMessage, 'user');
    setStatus('Обработка запроса...');

    chatState.chatHistory.push({
        role: 'user',
        content: userMessage
    });

    logger.info('Отправка сообщения пользователя', { message: userMessage });

    try {
        const contextPrompt = `Контекст страницы:\nURL: ${chatState.pageUrl}\nСодержимое: ${chatState.pageText.substring(0, 5000)}\n\nИстория диалога:\n${formatChatHistory()}\n\nВопрос пользователя: ${userMessage}`;

        const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(chatState.model)}:generateContent?key=${encodeURIComponent(chatState.apiKey)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: contextPrompt }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Ошибка Gemini API');
        }

        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiResponse) {
            throw new Error('Пустой ответ от модели');
        }

        chatState.chatHistory.push({
            role: 'ai',
            content: aiResponse
        });

        addMessage(aiResponse, 'ai');
        setStatus('');

        logger.info('Получен ответ от Gemini', { responseLength: aiResponse.length });

    } catch (ex) {
        setStatus('Ошибка при получении ответа', true);
        addMessage(`Ошибка: ${ex.message}`, 'ai');

        logger.error('Ошибка при отправке сообщения в чат', {
            error: ex.message,
            userMessage: userMessage,
            stack: ex.stack
        });
    }
}

/**
 * Форматирование истории чата для промпта
 * Функция преобразует историю сообщений в текстовый формат
 * 
 * Returns:
 *     string: Отформатированная история диалога
 */
function formatChatHistory() {
    return chatState.chatHistory
        .map(msg => `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}`)
        .join('\n');
}

/**
 * Обработка нажатия Enter в поле ввода
 * 
 * Args:
 *     event (KeyboardEvent): Событие