// chat.js

let tabId = null;
let chatHistory = [];
let model = 'gemini-2.5-flash';
let apiKey = '';

async function init() {
    const params = new URLSearchParams(window.location.search);
    tabId = parseInt(params.get('tabId'));
    const pageUrl = decodeURIComponent(params.get('url') || '');

    const settings = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
    apiKey = settings.geminiApiKey;
    model = settings.geminiModel || 'gemini-2.5-flash';

    if (!apiKey) {
        alert('Сначала сохраните API-ключ в настройках!');
        window.close();
        return;
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => document.body.innerText || document.documentElement.innerText
    });

    const pageText = results?.[0]?.result || '';
    if (!pageText) {
        addMessage('Не удалось получить текст страницы.', 'ai');
        return;
    }

    addMessage('Анализирую страницу...', 'ai');
    setStatus('Генерация подробного анализа...');

    try {
        const prompt = `Проанализируй следующий текст подробно, выдели ключевые идеи, аргументы и выводы. Структурируй ответ:\n\n${pageText.substring(0, 10000)}`;
        const response = await callGemini(prompt);
        addMessage(response, 'ai');
        chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
        chatHistory.push({ role: 'model', parts: [{ text: response }] });
    } catch (error) {
        addMessage(`Ошибка: ${error.message}`, 'ai');
    } finally {
        setStatus('');
    }
}

async function callGemini(prompt) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [...chatHistory, { role: 'user', parts: [{ text: prompt }] }]
            })
        }
    );

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || 'Ошибка API');
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Без ответа';
}

function addMessage(text, role) {
    const chat = document.getElementById('chat');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.innerHTML = text; // ← используем innerHTML, если нужно HTML
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

function setStatus(text) {
    document.getElementById('status').textContent = text;
}

document.getElementById('send').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';
    setStatus('Думаю...');

    try {
        const response = await callGemini(text);
        addMessage(response, 'ai');
        chatHistory.push({ role: 'user', parts: [{ text }] });
        chatHistory.push({ role: 'model', parts: [{ text: response }] });
    } catch (error) {
        addMessage(`Ошибка: ${error.message}`, 'ai');
    } finally {
        setStatus('');
    }
}

init();