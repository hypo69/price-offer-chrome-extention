let chatHistory = [];
let model = 'gemini-1.5-flash';
let apiKey = '';

async function init() {
    const settings = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
    apiKey = settings.geminiApiKey;
    model = settings.geminiModel || 'gemini-1.5-flash';

    if (!apiKey) {
        addMessage("API ключ не задан. Открываю настройки...", 'ai');
        setTimeout(() => chrome.runtime.openOptionsPage(), 1500);
        return;
    }

    addMessage('Готов генерировать детальный анализ. Задайте вопрос.', 'ai');
}

async function callGemini(prompt, history) {
    const contents = [
        ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
    ];

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        }
    );

    const data = await response.json();
    if (!response.ok || data.error) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Нет ответа';
}

function addMessage(text, role) {
    const chat = document.getElementById('chat');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
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
    addMessage("Думаю...", 'ai loading');

    try {
        const responseText = await callGemini(text, chatHistory);

        // Удаляем "Думаю..."
        document.querySelector('.loading')?.remove();

        addMessage(responseText, 'ai');
        chatHistory.push({ role: 'user', text });
        chatHistory.push({ role: 'model', text: responseText });
    } catch (e) {
        document.querySelector('.loading')?.remove();
        addMessage(`Ошибка: ${e.message}`, 'ai');
    }
}

init();