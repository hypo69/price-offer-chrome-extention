// gemini.js
// \file gemini.js
// -*- coding: utf-8 -*-

/**
 * Модуль взаимодействия с Gemini API
 * ==================================
 * Функции для отправки запросов к Gemini и получения ответов
 */

const GeminiAPI = {};

/**
 * Загрузка промпта для текущей локали
 * Функция определяет язык интерфейса и загружает соответствующий файл инструкций
 * 
 * Returns:
 *     Promise<string|null>: Текст промпта или null при ошибке
 */
async function loadPriceOfferPrompt() {
    let locale = 'en';

    try {
        const currentLocale = chrome.i18n.getUILanguage();
        if (currentLocale.startsWith('ru')) {
            locale = 'ru';
        } else if (currentLocale.startsWith('he')) {
            locale = 'he';
        }
        await logger.debug(`Определена локаль: ${locale}`);
    } catch (ex) {
        await logger.warn('Ошибка определения локали, используется en по умолчанию', { error: ex.message });
    }

    const tryLoad = async (path) => {
        try {
            const url = chrome.runtime.getURL(path);
            const res = await fetch(url);
            if (res.ok) {
                await logger.debug(`Успешно загружен промпт: ${path}`);
                return await res.text();
            }
            await logger.warn(`Не удалось загрузить промпт: ${path} (статус: ${res.status})`);
        } catch (ex) {
            await logger.warn(`Ошибка загрузки промпта: ${path}`, { error: ex.message });
        }
        return null;
    };

    let promptText = await tryLoad(`instructions/${locale}/price_offer_prompt.txt`);
    if (!promptText) {
        await logger.info('Загрузка промпта на английском языке как резервный вариант');
        promptText = await tryLoad(`instructions/en/price_offer_prompt.txt`);
    }

    if (!promptText) {
        await logger.error('Не удалось загрузить промпт ни для одной локали');
    }

    return promptText;
};

/**
 * Отправка запроса к Gemini API
 */
async function _sendRequestToGemini(fullPrompt, apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    await logger.info('Отправка запроса к Gemini API', { model: model, promptLength: fullPrompt.length });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });

        const data = await response.json();

        if (data.error) {
            await logger.error('Ошибка Gemini API', { code: data.error.code, message: data.error.message, status: data.error.status });
            const error = new Error(data.error.message || 'Неизвестная ошибка Gemini API');
            error.details = data.error;
            throw error;
        }

        if (!data.candidates || data.candidates.length === 0) {
            const blockReason = data.promptFeedback?.blockReason || 'Неизвестная причина';
            await logger.error('Ответ Gemini заблокирован или пуст', { blockReason, promptFeedback: data.promptFeedback });
            const error = new Error(`Ответ от модели заблокирован. Причина: ${blockReason}`);
            error.details = data.promptFeedback || { message: 'Кандидаты отсутствуют в ответе' };
            throw error;
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) {
            await logger.error('Пустой текст в ответе модели', { candidates: data.candidates });
            throw new Error('Пустой ответ от модели, хотя кандидаты присутствуют');
        }

        await logger.info('Успешно получен ответ от Gemini API', { responseLength: resultText.length, finishReason: data.candidates[0]?.finishReason });

        return resultText;
    } catch (ex) {
        if (ex.details) throw ex;
        await logger.error('Ошибка сетевого запроса к Gemini API', { error: ex.message, stack: ex.stack });
        throw new Error(`Ошибка соединения с Gemini API: ${ex.message}`);
    }
}

/**
 * Формирование полного предложения цены
 */
GeminiAPI.getFullPriceOffer = async (pageText, apiKey, model) => {
    await logger.info('Начало формирования предложения цены', { model, textLength: pageText.length });

    const instructions = await loadPriceOfferPrompt();
    if (!instructions) {
        await logger.error('Не удалось загрузить инструкции для модели');
        throw new Error('Не удалось загрузить инструкции для модели');
    }

    const truncatedText = pageText.substring(0, 10000);
    const fullPrompt = `${instructions}\n\n${truncatedText}`;

    // --- Логируем полный промпт через твой Logger ---
    await logger.info('Полный промпт отправляется в Gemini', { fullPrompt });

    return await _sendRequestToGemini(fullPrompt, apiKey, model);
};

/**
 * Получение ответа модели с логированием и парсингом JSON
 */
GeminiAPI.getModelResponseJSON = async (pageText, apiKey, model) => {
    await logger.info('Запрос полного ответа от модели (JSON)', { model, textLength: pageText.length });

    const instructions = await loadPriceOfferPrompt();
    if (!instructions) {
        await logger.error('Не удалось загрузить инструкции для модели');
        throw new Error('Не удалось загрузить инструкции для модели');
    }

    const truncatedText = pageText.substring(0, 10000);
    const fullPrompt = `${instructions}\n\n${truncatedText}`;

    await logger.info('Промпт отправляется для получения JSON', { fullPrompt });

    const modelResponse = await _sendRequestToGemini(fullPrompt, apiKey, model);

    // --- Логируем текст ответа ---
    await logger.info('Ответ модели получен', { response: modelResponse });

    let parsedJSON = null;
    try {
        parsedJSON = JSON.parse(modelResponse);
        await logger.info('Ответ модели успешно распарсен как JSON', { parsedJSON });
    } catch (ex) {
        await logger.error('Ошибка парсинга JSON из ответа модели', { error: ex.message });
        throw new Error(`Не удалось распарсить ответ модели как JSON: ${ex.message}`);
    }

    return parsedJSON;
};
