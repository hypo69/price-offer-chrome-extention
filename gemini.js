// gemini.js
// \file gemini.js
// -*- coding: utf-8 -*-

const GeminiAPI = {};

const MAX_PROMPT_LENGTH = 10000;

/**
 * Открывает новую вкладку с содержимым промпта для отладки.
 * @param {string} promptContent Содержимое полного промпта.
 */
function _openDebugTab(promptContent) {
    logger.info('[GEMINI] Открытие отладочной вкладки с промптом.');

    // Эскейпим HTML-теги для безопасного отображения в браузере
    const escapedContent = promptContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>'); // Заменяем переносы строк на <br>

    // Создаем минимальный HTML-документ
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Gemini Prompt Debug</title>
            <style>
                body { white-space: pre-wrap; font-family: monospace; padding: 20px; background-color: #f5f5f5; color: #333; }
                h1 { color: #cc0000; }
                .prompt-content { background-color: white; border: 1px solid #ccc; padding: 15px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>Gemini Full Prompt (DEBUG)</h1>
            <div class="prompt-content">${escapedContent}</div>
        </body>
        </html>
    `;

    // Создаем data URL
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);

    // Открываем новую вкладку с этим data URL
    chrome.tabs.create({ url: dataUrl })
        .catch(error => {
            logger.error('[GEMINI] Ошибка открытия отладочной вкладки:', { error: error.message });
        });
}


/**
 * Загружает промпт с четкой иерархией приоритетов.
 * @returns {Promise<string|null>} Текст промпта или null при ошибке.
 */
async function loadPriceOfferPrompt() {

    const tryLoad = async (locale) => {
        if (!locale) return null;
        const path = `_locales/${locale}/price_offer_prompt.txt`;
        try {
            const url = chrome.runtime.getURL(path);
            const res = await fetch(url);
            if (res.ok) {
                logger.info(`[GEMINI] Успешно загружен промпт для локали: "${locale}"`);
                return await res.text();
            }
            return null;
        } catch (ex) {
            logger.warn(`[GEMINI] Ошибка при загрузке промпта: ${path}`, { error: ex.message });
            return null;
        }
    };

    let promptText = null;
    const defaultLocale = 'ru';

    // --- Приоритет 1: Язык из URL-параметра '?lang=...' ---
    // ВНИМАНИЕ: Предполагается, что этот код выполняется в контексте страницы (например, preview-offer.html),
    // где window.location.search ссылается на параметры этой страницы.
    if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        const langFromUrl = urlParams.get('lang');

        if (langFromUrl) {
            logger.info(`[GEMINI] Обнаружен язык в URL: "${langFromUrl}". Попытка загрузки.`);
            promptText = await tryLoad(langFromUrl);
        }
    }


    // --- Резервный вариант: Язык по умолчанию ---
    if (!promptText) {
        logger.info(`[GEMINI] Промпт для языка из URL не найден или не указан. Загрузка промпта по умолчанию: "${defaultLocale}".`);
        promptText = await tryLoad(defaultLocale);
    }

    if (!promptText) {
        logger.error('[GEMINI] КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить промпт даже для языка по умолчанию.');
    }

    return promptText;
}

async function _sendRequestToGemini(fullPrompt, apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });
        const data = await response.json();
        if (data.error) { const error = new Error(data.error.message || 'Неизвестная ошибка Gemini API'); error.details = data.error; throw error; }
        if (!data.candidates || data.candidates.length === 0) { const blockReason = data.promptFeedback?.blockReason || 'Неизвестная причина'; const error = new Error(`Ответ от модели заблокирован. Причина: ${blockReason}`); error.details = data.promptFeedback; throw error; }
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) { throw new Error('Пустой ответ от модели'); }
        return resultText;
    } catch (ex) {
        logger.error('[GEMINI] Ошибка запроса к API', { error: ex.message, stack: ex.stack });
        throw new Error(`Ошибка соединения с Gemini API: ${ex.message}`);
    }
}

GeminiAPI.getFullPriceOffer = async (pageText, apiKey, model) => {
    const instructions = await loadPriceOfferPrompt();
    if (!instructions) {
        throw new Error('Не удалось загрузить инструкции для модели');
    }
    const truncatedText = pageText.substring(0, MAX_PROMPT_LENGTH);
    const fullPrompt = `${instructions}\n\n${truncatedText}`;

    // ▼▼▼ ЛОГИКА ОТЛАДКИ: ОТКРЫТИЕ ВКЛАДКИ С ПРОМПТОМ (ЗАКОММЕНТИРОВАНО) ▼▼▼
    // _openDebugTab(fullPrompt);
    // ▲▲▲ КОНЕЦ ЛОГИКИ ОТЛАДКИ ▲▲▲

    return await _sendRequestToGemini(fullPrompt, apiKey, model);
};

GeminiAPI.getModelResponseJSON = async (pageText, apiKey, model) => {
    const modelResponse = await GeminiAPI.getFullPriceOffer(pageText, apiKey, model);
    try {
        return JSON.parse(modelResponse);
    } catch (ex) {
        logger.error('[GEMINI] Ошибка парсинга JSON', { error: ex.message });
        throw new Error(`Не удалось распарсить ответ модели как JSON: ${ex.message}`);
    }
};

// Условный экспорт для preview-offer.html
if (typeof window !== 'undefined') {
    window.GeminiAPI = GeminiAPI;
}