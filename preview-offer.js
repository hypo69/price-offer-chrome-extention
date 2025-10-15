// preview-offer.js
// \file preview-offer.js
// -*- coding: utf-8 -*-

/**
 * Модуль отображения сформированного предложения
 * ==============================================
 * Загрузка данных через AJAX запрос к Gemini API
 * ВАЖНО: Рендеринг HTML делается через json2html.js (функция parseResponseToHtml)
 */

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Подсветка JSON синтаксиса
 */
function syntaxHighlightJSON(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

/**
 * Отображение экрана загрузки
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
 * Обновление статуса загрузки
 */
function updateLoadingStatus(statusText) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
        statusElement.textContent = statusText;
    }
}

/**
 * Отображение ошибки
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

    retryButton.addEventListener('click', () => {
        window.location.reload();
    });

    errorWrapper.appendChild(errorTitle);
    errorWrapper.appendChild(errorText);
    errorWrapper.appendChild(retryButton);

    container.appendChild(errorWrapper);
}

// ============================================================================
// ФУНКЦИИ РАБОТЫ С GEMINI API
// ============================================================================

/**
 * Загрузка промпта для текущей локали
 */
async function loadPriceOfferPrompt() {
    console.log('───────────────────────────────────────────────────────────');
    console.log('[loadPriceOfferPrompt] Начало загрузки промпта');

    let locale = 'en';

    try {
        const currentLocale = chrome.i18n.getUILanguage();
        console.log('[loadPriceOfferPrompt] Системная локаль:', currentLocale);

        if (currentLocale.startsWith('ru')) {
            locale = 'ru';
        } else if (currentLocale.startsWith('he')) {
            locale = 'he';
        }
        console.log('[loadPriceOfferPrompt] Выбранная локаль:', locale);
    } catch (ex) {
        console.warn('[loadPriceOfferPrompt] ⚠️ Ошибка определения локали', ex);
    }

    const tryLoad = async (path) => {
        console.log(`[loadPriceOfferPrompt] Попытка загрузки: ${path}`);
        try {
            const url = chrome.runtime.getURL(path);
            const res = await fetch(url);

            if (res.ok) {
                const text = await res.text();
                console.log(`[loadPriceOfferPrompt] ✅ Промпт загружен:`, {
                    path: path,
                    length: text.length
                });
                return text;
            }
        } catch (ex) {
            console.warn(`[loadPriceOfferPrompt] ⚠️ Ошибка загрузки: ${path}`, ex);
        }
        return null;
    };

    let promptText = await tryLoad(`instructions/${locale}/price_offer_prompt.txt`);

    if (!promptText) {
        console.log('[loadPriceOfferPrompt] Загрузка английского промпта');
        promptText = await tryLoad(`instructions/en/price_offer_prompt.txt`);
    }

    if (!promptText) {
        console.error('[loadPriceOfferPrompt] ❌ Не удалось загрузить промпт');
    }

    console.log('───────────────────────────────────────────────────────────');
    return promptText;
}

/**
 * Отправка запроса к Gemini API
 */
async function sendRequestToGemini(componentsData, apiKey, model) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[Preview Offer] НАЧАЛО sendRequestToGemini');
    console.log('═══════════════════════════════════════════════════════════');

    const MAX_PROMPT_LENGTH = 10000;

    try {
        updateLoadingStatus('Загрузка инструкций...');
        const instructions = await loadPriceOfferPrompt();

        if (!instructions) {
            throw new Error('Не удалось загрузить инструкции для модели');
        }

        updateLoadingStatus('Формирование промпта...');
        const pageText = componentsData.map(c => JSON.stringify(c.data, null, 2)).join('\n\n');
        const truncatedText = pageText.substring(0, MAX_PROMPT_LENGTH);
        const fullPrompt = `${instructions}\n\n${truncatedText}`;

        updateLoadingStatus('Отправка запроса к Gemini API...');
        const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        updateLoadingStatus('Обработка ответа...');
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Ошибка Gemini API');
        }

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('Ответ от модели заблокирован');
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            throw new Error('Пустой ответ от модели');
        }

        console.log('[Preview Offer] ✅ Ответ получен');
        console.log('═══════════════════════════════════════════════════════════');

        return resultText;

    } catch (ex) {
        console.error('[Preview Offer] ❌ Ошибка:', ex);
        throw ex;
    }
}

// ============================================================================
// ФУНКЦИЯ ОТОБРАЖЕНИЯ РЕЗУЛЬТАТА (использует json2html.js)
// ============================================================================

/**
 * Отображение результата предложения
 * ВАЖНО: HTML рендеринг делегируется функции parseResponseToHtml из json2html.js
 */
function displayOffer(container, offerData) {
    container.innerHTML = '';

    let parsedData;
    let isJSON = false;

    // Очистка markdown
    let cleanedData = offerData.trim();
    cleanedData = cleanedData.replace(/^```json\s*/i, '');
    cleanedData = cleanedData.replace(/^```\s*/, '');
    cleanedData = cleanedData.replace(/\s*```\s*$/, '');
    cleanedData = cleanedData.trim();

    try {
        parsedData = JSON.parse(cleanedData);
        isJSON = true;
        console.info('[Preview Offer] Данные успешно распарсены как JSON');
    } catch (parseError) {
        console.warn('[Preview Offer] Данные не являются JSON', parseError);
        parsedData = cleanedData;
    }

    const formattedData = isJSON ? JSON.stringify(parsedData, null, 2) : parsedData;

    const header = document.createElement('h2');
    header.textContent = 'Сформированное предложение цены';
    header.style.cssText = `
        margin-top: 0;
        color: #202124;
        font-size: 24px;
        margin-bottom: 20px;
    `;

    const viewToggle = document.createElement('div');
    viewToggle.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 10px;
    `;

    const htmlViewBtn = document.createElement('button');
    htmlViewBtn.textContent = 'HTML View';
    htmlViewBtn.className = 'view-toggle-btn active';

    const jsonViewBtn = document.createElement('button');
    jsonViewBtn.textContent = 'JSON View';
    jsonViewBtn.className = 'view-toggle-btn';

    const editViewBtn = document.createElement('button');
    editViewBtn.textContent = 'Edit View';
    editViewBtn.className = 'view-toggle-btn';

    viewToggle.appendChild(htmlViewBtn);
    viewToggle.appendChild(jsonViewBtn);
    viewToggle.appendChild(editViewBtn);

    const dataContainer = document.createElement('div');

    let currentView = 'html';
    let editedData = formattedData;

    const renderView = (viewType) => {
        if (!isJSON && viewType !== 'edit') return;

        currentView = viewType;

        htmlViewBtn.classList.remove('active');
        jsonViewBtn.classList.remove('active');
        editViewBtn.classList.remove('active');

        if (viewType === 'html') {
            // ✅ ИСПОЛЬЗУЕМ parseResponseToHtml из json2html.js
            const htmlContent = window.parseResponseToHtml(cleanedData);
            dataContainer.innerHTML = htmlContent;
            dataContainer.style.cssText = `
                background-color: #ffffff;
                padding: 30px;
                border-radius: 8px;
                overflow-x: auto;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                line-height: 1.8;
                border: 1px solid #e0e0e0;
            `;
            htmlViewBtn.classList.add('active');
        } else if (viewType === 'json') {
            dataContainer.innerHTML = `<pre style="margin: 0;">${syntaxHighlightJSON(formattedData)}</pre>`;
            dataContainer.style.cssText = `
                background-color: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                overflow-x: auto;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.6;
                border: 1px solid #e0e0e0;
            `;
            jsonViewBtn.classList.add('active');
        } else if (viewType === 'edit') {
            dataContainer.innerHTML = '';

            const textarea = document.createElement('textarea');
            textarea.value = editedData;
            textarea.style.cssText = `
                width: 100%;
                min-height: 500px;
                padding: 20px;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.6;
                border: 2px solid #4285f4;
                border-radius: 8px;
                resize: vertical;
                background-color: #ffffff;
                color: #202124;
                box-sizing: border-box;
            `;

            textarea.addEventListener('input', () => {
                editedData = textarea.value;
            });

            const editActions = document.createElement('div');
            editActions.style.cssText = `
                display: flex;
                gap: 10px;
                margin-top: 10px;
            `;

            const saveButton = document.createElement('button');
            saveButton.textContent = 'Применить изменения';
            saveButton.style.cssText = `
                padding: 8px 16px;
                background-color: #0f9d58;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            `;

            saveButton.addEventListener('click', () => {
                try {
                    const newParsedData = JSON.parse(editedData);
                    parsedData = newParsedData;
                    formattedData = JSON.stringify(parsedData, null, 2);
                    cleanedData = formattedData;

                    saveButton.textContent = '✓ Сохранено!';
                    setTimeout(() => {
                        saveButton.textContent = 'Применить изменения';
                    }, 2000);

                } catch (ex) {
                    alert('Ошибка парсинга JSON: ' + ex.message);
                }
            });

            const resetButton = document.createElement('button');
            resetButton.textContent = 'Сбросить изменения';
            resetButton.style.cssText = `
                padding: 8px 16px;
                background-color: #f1f3f4;
                color: #5f6368;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            `;

            resetButton.addEventListener('click', () => {
                if (confirm('Отменить все изменения?')) {
                    editedData = formattedData;
                    textarea.value = formattedData;
                }
            });

            const formatButton = document.createElement('button');
            formatButton.textContent = 'Форматировать JSON';
            formatButton.style.cssText = `
                padding: 8px 16px;
                background-color: #4285f4;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            `;

            formatButton.addEventListener('click', () => {
                try {
                    const parsed = JSON.parse(textarea.value);
                    const formatted = JSON.stringify(parsed, null, 2);
                    textarea.value = formatted;
                    editedData = formatted;
                } catch (ex) {
                    alert('Ошибка форматирования: ' + ex.message);
                }
            });

            editActions.appendChild(saveButton);
            editActions.appendChild(resetButton);
            editActions.appendChild(formatButton);

            dataContainer.appendChild(textarea);
            dataContainer.appendChild(editActions);
            dataContainer.style.cssText = `
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
            `;

            editViewBtn.classList.add('active');
        }
    };

    if (isJSON) {
        renderView('html');
        htmlViewBtn.addEventListener('click', () => renderView('html'));
        jsonViewBtn.addEventListener('click', () => renderView('json'));
        editViewBtn.addEventListener('click', () => renderView('edit'));
    } else {
        viewToggle.style.display = 'none';
        const pre = document.createElement('pre');
        pre.textContent = formattedData;
        pre.style.cssText = `
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid #e0e0e0;
            margin: 0;
        `;
        dataContainer.appendChild(pre);
    }

    // Кнопки управления
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 20px;
    `;

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Копировать в буфер обмена';
    copyButton.style.cssText = `
        padding: 10px 20px;
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    copyButton.addEventListener('click', async () => {
        try {
            const dataToCopy = currentView === 'edit' ? editedData : formattedData;
            await navigator.clipboard.writeText(dataToCopy);
            copyButton.textContent = '✓ Скопировано!';
            copyButton.style.backgroundColor = '#0f9d58';

            setTimeout(() => {
                copyButton.textContent = 'Копировать в буфер обмена';
                copyButton.style.backgroundColor = '#4285f4';
            }, 2000);
        } catch (ex) {
            alert('Ошибка копирования');
        }
    });

    const regenerateButton = document.createElement('button');
    regenerateButton.textContent = 'Обновить предложение';
    regenerateButton.style.cssText = `
        padding: 10px 20px;
        background-color: #f9ab00;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    regenerateButton.addEventListener('click', async () => {
        if (!confirm('Отправить новый запрос к Gemini API?')) {
            return;
        }

        try {
            const storageResult = await chrome.storage.local.get([
                'componentsForOffer',
                'geminiApiKey',
                'geminiModel'
            ]);

            if (!storageResult.componentsForOffer || !storageResult.geminiApiKey) {
                alert('Не удалось загрузить данные для регенерации');
                return;
            }

            await chrome.storage.local.remove(['previewOfferData', 'lastOffer']);
            window.location.reload();

        } catch (ex) {
            alert(`Ошибка: ${ex.message}`);
        }
    });

    const saveToStorageButton = document.createElement('button');
    saveToStorageButton.textContent = 'Сохранить изменения';
    saveToStorageButton.style.cssText = `
        padding: 10px 20px;
        background-color: #0f9d58;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    saveToStorageButton.addEventListener('click', async () => {
        try {
            const dataToSave = currentView === 'edit' ? editedData : formattedData;
            JSON.parse(dataToSave);

            await chrome.storage.local.set({
                previewOfferData: dataToSave,
                lastOffer: dataToSave
            });

            saveToStorageButton.textContent = '✓ Сохранено!';

            setTimeout(() => {
                saveToStorageButton.textContent = 'Сохранить изменения';
            }, 2000);

        } catch (ex) {
            alert('Ошибка сохранения: ' + ex.message);
        }
    });

    const clearButton = document.createElement('button');
    clearButton.textContent = 'Очистить данные';
    clearButton.style.cssText = `
        padding: 10px 20px;
        background-color: #f1f3f4;
        color: #5f6368;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;

    clearButton.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите очистить данные предложения?')) {
            await chrome.storage.local.remove(['previewOfferData', 'lastOffer']);
            container.innerHTML = '<p style="color: #5f6368; padding: 20px;">Данные очищены.</p>';
        }
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(saveToStorageButton);
    buttonContainer.appendChild(regenerateButton);
    buttonContainer.appendChild(clearButton);

    container.appendChild(header);
    if (isJSON) container.appendChild(viewToggle);
    container.appendChild(dataContainer);
    container.appendChild(buttonContainer);
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ (ПОСЛЕДНИЙ БЛОК!)
// ============================================================================

/**
 * Инициализация страницы и загрузка данных через AJAX
 */
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[Preview Offer] 🚀 ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ');
    console.log('═══════════════════════════════════════════════════════════');

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
            console.log('[Preview Offer] 🔄 Принудительный новый запрос');
            await chrome.storage.local.remove('forceNewRequest');
        } else {
            const existingOfferData = storageResult.previewOfferData || storageResult.lastOffer;

            if (existingOfferData) {
                console.log('[Preview Offer] ✅ Найдены сохраненные данные (кеш)');
                displayOffer(container, existingOfferData);
                return;
            }
        }

        console.log('[Preview Offer] ⚠️ Требуется новый запрос к API');
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
        console.error('[Preview Offer] ❌ КРИТИЧЕСКАЯ ОШИБКА:', ex);
        showError(container, `Произошла ошибка: ${ex.message}`);
    }
});