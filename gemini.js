// gemini.js

const GeminiAPI = {};

/**
 * Внутренняя функция для загрузки содержимого промпта для текущей локали
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
    return promptText;
}

/**
 * Внутренняя функция для отправки запроса к Gemini API
 * @param {string} fullPrompt - Полный текст промпта для отправки
 * @param {string} apiKey - API ключ
 * @param {string} model - Название модели
 * @returns {Promise<string>} - Текстовый результат от модели
 */
async function _sendRequestToGemini(fullPrompt, apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
        })
    });

    const data = await response.json();

    if (data.error) {
        console.error("Gemini API Error Response:", data.error);
        const error = new Error(data.error.message || "Неизвестная ошибка Gemini API");
        error.details = data.error;
        throw error;
    }

    if (!data.candidates || data.candidates.length === 0) {
        const blockReason = data.promptFeedback?.blockReason || "Неизвестная причина";
        console.error("Gemini API Blocked Response:", data.promptFeedback);
        const error = new Error(`Ответ от модели пуст или заблокирован. Причина: ${blockReason}`);
        error.details = data.promptFeedback || { message: "Кандидаты отсутствуют в ответе" };
        throw error;
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
        throw new Error("Пустой ответ от модели, хотя кандидаты присутствуют.");
    }

    return resultText;
}


/**
 * Главная функция: формирует предложение цены, инкапсулируя всю логику
 * @param {string} pageText - Текст со страницы для анализа
 * @param {string} apiKey - API ключ
 * @param {string} model - Название модели
 * @returns {Promise<string>} - Готовый JSON в виде строки
 */
GeminiAPI.getFullPriceOffer = async (pageText, apiKey, model) => {
    // 1. Загружаем инструкции (промпт)
    const instructions = await loadPriceOfferPrompt();
    if (!instructions) {
        throw new Error("Не удалось загрузить инструкции для модели.");
    }

    // 2. Формируем полный промпт, обрезая текст страницы, чтобы избежать превышения лимитов
    const fullPrompt = `${instructions}\n\n${pageText.substring(0, 10000)}`;

    // 3. Отправляем запрос и возвращаем результат
    return await _sendRequestToGemini(fullPrompt, apiKey, model);
};