// preview-offer.js
// \file preview-offer.js
// -*- coding: utf-8 -*-

/**
 * Модуль отображения сформированного предложения
 * ==============================================
 * Загрузка данных через AJAX запрос к Gemini API
 * Рендеринг HTML делается через json2html.js (функция parseResponseToHtml)
 */

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Подсветка JSON синтаксиса для отображения
 * @param {string} json
 * @returns {string} HTML с подсветкой
 */
function syntaxHighlightJSON(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) cls = 'json-key';
            else cls = 'json-string';
        } else if (/true|false/.test(match)) cls = 'json-boolean';
        else if (/null/.test(match)) cls = 'json-null';
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

/**
 * Показ состояния загрузки
 * @param {HTMLElement} container
 */
function showLoadingState(container) {
    container.innerHTML = '';

    const loadingWrapper = document.createElement('div');
    loadingWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        gap: 20px;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #4285f4;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    const message = document.createElement('p');
    message.textContent = 'Отправка запроса к Gemini API...';
    message.style.cssText = `
        color: #5f6368;
        font-size: 16px;
        margin: 0;
    `;

    const statusText = document.createElement('p');
    statusText.id = 'loading-status';
    statusText.textContent = 'Пожалуйста, подождите';
    statusText.style.cssText = `
        color: #80868b;
        font-size: 14px;
        margin: 0;
    `;

    loadingWrapper.appendChild(spinner);
    loadingWrapper.appendChild(message);
    loadingWrapper.appendChild(statusText);

    container.appendChild(loadingWrapper);
}

/**
 * Обновление текста состояния загрузки
 * @param {string} statusText
 */
function updateLoadingStatus(statusText) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) statusElement.textContent = statusText;
}

/**
 * Отображение ошибки в UI
 * @param {HTMLElement} container
 * @param {string} errorMessage
 */
function showError(container, errorMessage) {
    container.innerHTML = '';

    const errorWrapper = document.createElement('div');
    errorWrapper.style.cssText = `
        background-color: #fce8e6;
        border: 1px solid #db4437;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
    `;

    const errorTitle = document.createElement('h3');
    errorTitle.textContent = 'Ошибка получения данных';
    errorTitle.style.cssText = `
        color: #db4437;
        margin: 0 0 10px 0;
        font-size: 18px;
    `;

    const errorText = document.createElement('p');
    errorText.textContent = errorMessage;
    errorText.style.cssText = `
        color: #5f6368;
        margin: 0;
        line-height: 1.6;
    `;

    const retryButton = document.createElement('button');
    retryButton.textContent = 'Повторить попытку';
    retryButton.style.cssText = `
        margin-top: 15px;
        padding: 10px 20px;
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    retryButton.addEventListener('click', () => window.location.reload());

    errorWrapper.appendChild(errorTitle);
    errorWrapper.appendChild(errorText);
    errorWrapper.appendChild(retryButton);

    container.appendChild(errorWrapper);
}

// ============================================================================
// ФУНКЦИИ РАБОТЫ С GEMINI API
// ============================================================================

/**
 * Загрузка текста промпта для формирования предложения
 * @returns {Promise<string|null>}
 */
async function loadPriceOfferPrompt() {
    let locale = 'en';
    try {
        const currentLocale = chrome.i18n.getUILanguage();
        if (currentLocale.startsWith('ru')) locale = 'ru';
        else if (currentLocale.startsWith('he')) locale = 'he';
    } catch (ex) {
        console.warn('[loadPriceOfferPrompt] Ошибка определения локали', ex);
    }

    const tryLoad = async (path) => {
        try {
            const url = chrome.runtime.getURL(path);
            const res = await fetch(url);
            if (res.ok) return await res.text();
        } catch (ex) {
            console.warn(`[loadPriceOfferPrompt] Ошибка загрузки: ${path}`, ex);
        }
        return null;
    };

    let promptText = await tryLoad(`instructions/${locale}/price_offer_prompt.txt`);
    if (!promptText) promptText = await tryLoad(`instructions/en/price_offer_prompt.txt`);
    return promptText;
}

/**
 * Отправка запроса к Gemini API
 * @param {Array<Object>} componentsData
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<string>}
 */
async function sendRequestToGemini(componentsData, apiKey, model) {
    const MAX_PROMPT_LENGTH = 10000;

    updateLoadingStatus('Загрузка инструкций...');
    const instructions = await loadPriceOfferPrompt();
    if (!instructions) throw new Error('Не удалось загрузить инструкции для модели');

    updateLoadingStatus('Формирование промпта...');
    const pageText = componentsData.map(c => JSON.stringify(c.data, null, 2)).join('\n\n');
    const truncatedText = pageText.substring(0, MAX_PROMPT_LENGTH);
    const fullPrompt = `${instructions}\n\n${truncatedText}`;

    updateLoadingStatus('Отправка запроса к Gemini API...');
    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    updateLoadingStatus('Обработка ответа...');

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Ошибка Gemini API');
    if (!data.candidates || data.candidates.length === 0) throw new Error('Ответ от модели заблокирован');

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof resultText !== 'string') resultText = JSON.stringify(resultText || {});

    return resultText;
}

// ============================================================================
// ФУНКЦИЯ ОТОБРАЖЕНИЯ РЕЗУЛЬТАТА
// ============================================================================

/**
 * Отображение предложения с JSON и HTML preview
 * @param {HTMLElement} container
 * @param {string|Object} offerData
 */
function displayOffer(container, offerData) {
    if (typeof offerData !== 'string') {
        try { offerData = JSON.stringify(offerData, null, 2); }
        catch (e) { offerData = String(offerData); }
    }

    container.innerHTML = '';

    let parsedData;
    let isJSON = false;

    let cleanedData = offerData.trim();
    cleanedData = cleanedData.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```\s*$/, '').trim();

    try {
        parsedData = JSON.parse(cleanedData);
        isJSON = true;
    } catch (parseError) {
        parsedData = cleanedData;
    }

    // --- UI кнопки ---
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.cssText = `display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;`;

    const regenerateBtn = document.createElement('button');
    regenerateBtn.textContent = 'Regenerate';
    regenerateBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#4285f4;color:white;cursor:pointer;`;
    regenerateBtn.addEventListener('click', () => window.location.reload());

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#fbbc05;color:black;cursor:pointer;`;
    copyBtn.addEventListener('click', () => {
        try { navigator.clipboard.writeText(cleanedData); alert('Скопировано в буфер обмена!'); }
        catch (e) { alert('Ошибка копирования'); }
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#34a853;color:white;cursor:pointer;`;
    saveBtn.addEventListener('click', () => {
        const blob = new Blob([cleanedData], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'offer.json';
        link.click();
    });

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#ea4335;color:white;cursor:pointer;`;
    clearBtn.addEventListener('click', () => { container.innerHTML = ''; });

    buttonWrapper.appendChild(regenerateBtn);
    buttonWrapper.appendChild(copyBtn);
    buttonWrapper.appendChild(saveBtn);
    buttonWrapper.appendChild(clearBtn);
    container.appendChild(buttonWrapper);

    // --- JSON редактор ---
    const editorWrapper = document.createElement('pre');
    editorWrapper.style.cssText = `
        background-color:#f6f8fa;
        padding:15px;
        border-radius:6px;
        max-height:400px;
        overflow:auto;
        font-family:monospace;
        font-size:14px;
        margin-bottom:20px;
    `;
    editorWrapper.innerHTML = syntaxHighlightJSON(isJSON ? JSON.stringify(parsedData, null, 2) : String(parsedData));
    container.appendChild(editorWrapper);

    // --- HTML preview ---
    const htmlPreviewWrapper = document.createElement('div');
    htmlPreviewWrapper.style.cssText = `border-top:1px solid #ddd;padding-top:20px;`;

    let htmlContent;
    try {
        htmlContent = isJSON ? window.parseResponseToHtml(parsedData) : window.parseResponseToHtml(String(parsedData));
    } catch (e) {
        htmlContent = `<p>Ошибка рендеринга HTML: ${e.message}</p>`;
    }

    htmlPreviewWrapper.innerHTML = htmlContent;
    container.appendChild(htmlPreviewWrapper);
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    try {
        const storageResult = await chrome.storage.local.get([
            'previewOfferData',
            'lastOffer',
            'componentsForOffer',
            'geminiApiKey',
            'geminiModel',
            'forceNewRequest'
        ]);

        const shouldForceNewRequest = storageResult.forceNewRequest === true;

        if (shouldForceNewRequest) {
            await chrome.storage.local.remove('forceNewRequest');
        } else {
            const existingOfferData = storageResult.previewOfferData || storageResult.lastOffer;
            if (existingOfferData) {
                displayOffer(container, existingOfferData);
                return;
            }
        }

        showLoadingState(container);

        if (!storageResult.componentsForOffer || storageResult.componentsForOffer.length === 0) {
            showError(container, 'Нет компонентов для формирования предложения.');
            return;
        }

        if (!storageResult.geminiApiKey) {
            showError(container, 'API ключ не установлен.');
            return;
        }

        const componentsData = storageResult.componentsForOffer;
        const apiKey = storageResult.geminiApiKey;
        const model = storageResult.geminiModel || 'gemini-2.5-flash';

        updateLoadingStatus('Подготовка данных...');

        const offerData = await sendRequestToGemini(componentsData, apiKey, model);

        await chrome.storage.local.set({
            previewOfferData: offerData,
            lastOffer: offerData
        });

        displayOffer(container, offerData);

    } catch (ex) {
        showError(container, `Произошла ошибка: ${ex.message}`);
    }
});
