// gemini.js
// \file gemini.js
// -*- coding: utf-8 -*-

const GeminiAPI = {};

const MAX_PROMPT_LENGTH = 10000;

/**
 * ▼▼▼ ИСПРАВЛЕНО: Функция теперь читает язык из URL-параметра ▼▼▼
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
    const urlParams = new URLSearchParams(window.location.search);
    const langFromUrl = urlParams.get('lang');

    if (langFromUrl) {
        logger.info(`[GEMINI] Обнаружен язык в URL: "${langFromUrl}". Попытка загрузки.`);
        promptText = await tryLoad(langFromUrl);
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