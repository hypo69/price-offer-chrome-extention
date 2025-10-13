// gemini.js

window.GeminiAPI = window.GeminiAPI || {};

/**
 * Загружает содержимое промпта для текущей локали
 */
async function loadPriceOfferPrompt() {
    let locale = 'en';
    try {
        const currentLocale = chrome.i18n.getUILanguage();
        if (currentLocale.startsWith('ru')) locale = 'ru';
        else if (currentLocale.startsWith('he')) locale = 'he';
    } catch (e) {
        console.warn("Не удалось определить локаль, используем en");
    }

    const tryLoad = async (path) => {
        try {
            const url = chrome.runtime.getURL(path);
            const res = await fetch(url);
            if (res.ok) return await res.text();
        } catch (e) {
            console.warn(`Не удалось загрузить ${path}`);
        }
        return null;
    };

    let promptText = await tryLoad(`instructions/${locale}/component_recognizer.txt`);
    if (!promptText) {
        promptText = await tryLoad(`instructions/en/component_recognizer.txt`);
    }
    return promptText || "Анализируйте компоненты компьютера и верните структурированный JSON.";
}

/**
 * Генерирует предложение цены через Gemini API
 */
window.GeminiAPI.generatePriceOffer = async (pageText, apiKey, model) => {
    const instructions = await loadPriceOfferPrompt();
    const prompt = `${instructions}\n\n${pageText.substring(0, 10000)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || "Ошибка Gemini API");
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
        throw new Error("Пустой ответ от модели");
    }

    return resultText;
};