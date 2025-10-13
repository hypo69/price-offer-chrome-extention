// chat.js
# -* - coding: utf - 8 -* -
#! .pyenv / bin / python3

/**
 * Модуль чата с Gemini
 * ====================
 * Реализует интерактивный диалог с моделью Gemini
 * на основе содержимого текущей страницы
 */

// Состояние чата
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
}

/**
 * Установка текста