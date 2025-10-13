// gemini.js

/**
 * Модуль взаимодействия с Gemini API
 * ==================================
 * Функции для отправки запросов к Gemini и получения ответов
 */

const GeminiAPI = {};

/**
 * Внутренний логгер для модуля Gemini
 * Инициализация происходит при первом использовании
 */
let _logger = null;

/**
 * Инициализация логгера для модуля
 * 
 * Returns:
 *     Logger: Экземпляр логгера
 */
function _getLogger() {
    if (!_logger) {
        _logger = new Logger('__kazarinov_logs__', 100);
    }
    return _logger;
}

/**
 * Загрузка промпта для текущей локали
 * Функция пытается загрузить инструкции на языке интерфейса,
 * при неудаче используется английский язык по умолчанию
 * 
 * Returns:
 *     Promise<string|null>: Текст промпта или null при ошибке
 */
async function loadPriceOfferPrompt() {
    const logger = _getLogger();
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

    /**
     * Попытка загрузки файла промпта
     * 
     * Args:
     *     path (string): Путь к файлу
     * 
     * Returns:
     *     Promise<string|null>: Содержимое файла или null
     */
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

    let promptText = await tryLoad(`instructions/${locale}/component_recognizer.txt`);
    if (!promptText) {
        await logger.info('Загрузка промпта на английском языке как резервный вариант');
        promptText = await tryLoad(`instructions/en/component_recognizer.txt`);
    }

    if (!promptText) {
        await logger.error('Не удалось загрузить промпт ни для одной локали');
    }

    return promptText;
}

/**
 * Отправка запроса к Gemini API
 * Функция выполняет HTTP-запрос к API и обрабатывает ответ
 * 
 * Args:
 *     fullPrompt (string): Полный текст промпта для отправки
 *     apiKey (string): API ключ для аутентификации
 *     model (string): Название модели Gemini
 * 
 * Returns:
 *     Promise<string>: Текстовый результат от модели
 * 
 * Raises:
 *     Error: При ошибках API или пустом ответе
 */
async function _sendRequestToGemini(fullPrompt, apiKey, model) {
    const logger = _getLogger();
    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    await logger.info('Отправка запроса к Gemini API', { model: model, promptLength: fullPrompt.length });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            await logger.error('Ошибка Gemini API', {
                code: data.error.code,
                message: data.error.message,
                status: data.error.status
            });
            const error = new Error(data.error.message || 'Неизвестная ошибка Gemini API');
            error.details = data.error;
            throw error;
        }

        if (!data.candidates || data.candidates.length === 0) {
            const blockReason = data.promptFeedback?.blockReason || 'Неизвестная причина';
            await logger.error('Ответ Gemini заблокирован или пуст', {
                blockReason: blockReason,
                promptFeedback: data.promptFeedback
            });
            const error = new Error(`Ответ от модели заблокирован. Причина: ${blockReason}`);
            error.details = data.promptFeedback || { message: 'Кандидаты отсутствуют в ответе' };
            throw error;
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) {
            await logger.error('Пустой текст в ответе модели', { candidates: data.candidates });
            throw new Error('Пустой ответ от модели, хотя кандидаты присутствуют');
        }

        await logger.info('Успешно получен ответ от Gemini API', {
            responseLength: resultText.length,
            finishReason: data.candidates[0]?.finishReason
        });

        return resultText;
    } catch (ex) {
        if (ex.details) {
            throw ex;
        }
        await logger.error('Ошибка сетевого запроса к Gemini API', {
            error: ex.message,
            stack: ex.stack
        });
        throw new Error(`Ошибка соединения с Gemini API: ${ex.message}`);
    }
}

/**
 * Формирование полного предложения цены
 * Главная функция модуля: загружает инструкции, формирует промпт
 * и отправляет запрос к Gemini API
 * 
 * Args:
 *     pageText (string): Текст со страницы для анализа
 *     apiKey (string): API ключ Gemini
 *     model (string): Название модели Gemini
 * 
 * Returns:
 *     Promise<string>: Готовый JSON в виде строки
 * 
 * Raises:
 *     Error: При ошибках загрузки инструкций или работы с API
 */
GeminiAPI.getFullPriceOffer = async (pageText, apiKey, model) => {
    const logger = _getLogger();

    await logger.info('Начало формирования предложения цены', {
        model: model,
        textLength: pageText.length
    });

    const instructions = await loadPriceOfferPrompt();
    if (!instructions) {
        await logger.error('Не удалось загрузить инструкции для модели');
        throw new Error('Не удалось загрузить инструкции для модели');
    }

    const truncatedText = pageText.substring(0, 10000);
    const fullPrompt = `${instructions}\n\n${truncatedText}`;

    await logger.debug('Промпт сформирован', {
        promptLength: fullPrompt.length,
        truncated: pageText.length > 10000
    });

    return await _sendRequestToGemini(fullPrompt, apiKey, model);
};