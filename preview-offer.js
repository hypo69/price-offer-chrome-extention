// preview-offer.js
// \file preview-offer.js
// -*- coding: utf-8 -*-

/**
 * Модуль отображения сформированного предложения
 * ==============================================
 * Загрузка данных через AJAX запрос к Gemini API
 */



/**
 * Преобразование JSON в читаемый HTML документ
 * Функция создает структурированный HTML из данных предложения
 * Отображаются только значения, без названий ключей
 * 
 * Args:
 *     data (Object): JSON данные предложения
 * 
 * Returns:
 *     string: HTML разметка
 */
function jsonToHtmlDocument(data) {
    let html = '<div class="offer-document">';

    // Заголовок
    if (data.title) {
        html += `<h1 class="offer-title">${escapeHtml(data.title)}</h1>`;
    }

    // Описание
    if (data.description) {
        html += `<div class="offer-description">`;
        html += `<p>${escapeHtml(data.description)}</p>`;
        html += `</div>`;
    }

    // Обработка всех остальных полей
    const processedKeys = ['title', 'description'];

    for (const [key, value] of Object.entries(data)) {
        if (processedKeys.includes(key)) continue;

        html += `<div class="field-section">`;
        html += renderValueOnly(value);
        html += `</div>`;
    }

    html += '</div>';

    return html;
}

/**
 * Рендеринг только значений без ключей
 */
function renderValueOnly(value, level = 0) {
    if (value === null) return '<p class="null-value">null</p>';
    if (value === undefined) return '<p class="undefined-value">undefined</p>';

    if (typeof value === 'boolean') {
        return `<p class="boolean-value">${value}</p>`;
    }

    if (typeof value === 'number') {
        return `<p class="number-value">${value}</p>`;
    }

    if (typeof value === 'string') {
        return `<p class="string-value">${escapeHtml(value)}</p>`;
    }

    if (Array.isArray(value)) {
        let html = `<div class="list-container">`;
        for (const item of value) {
            html += `<div class="list-item">`;
            html += renderValueOnly(item, level + 1);
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    if (typeof value === 'object') {
        let html = `<div class="object-container">`;
        for (const val of Object.values(value)) {
            html += renderValueOnly(val, level + 1);
        }
        html += `</div>`;
        return html;
    }

    return `<p>${escapeHtml(String(value))}</p>`;
}

/**
 * Рендеринг объекта в HTML
 */
function renderObject(obj, level = 0) {
    if (!obj || typeof obj !== 'object') {
        return `<p>${escapeHtml(String(obj))}</p>`;
    }

    if (Array.isArray(obj)) {
        let html = `<ul class="list-level-${level}">`;
        for (const item of obj) {
            html += `<li>`;
            if (typeof item === 'object') {
                html += renderObject(item, level + 1);
            } else {
                html += escapeHtml(String(item));
            }
            html += `</li>`;
        }
        html += `</ul>`;
        return html;
    }

    let html = `<dl class="properties-level-${level}">`;
    for (const [key, value] of Object.entries(obj)) {
        html += `<dt>${formatFieldName(key)}</dt>`;
        html += `<dd>`;
        html += renderValue(value, level + 1);
        html += `</dd>`;
    }
    html += `</dl>`;

    return html;
}

/**
 * Рендеринг значения
 */
function renderValue(value, level = 0) {
    if (value === null) return '<span class="null-value">null</span>';
    if (value === undefined) return '<span class="undefined-value">undefined</span>';

    if (typeof value === 'boolean') {
        return `<span class="boolean-value">${value}</span>`;
    }

    if (typeof value === 'number') {
        return `<span class="number-value">${value}</span>`;
    }

    if (typeof value === 'string') {
        return `<p class="string-value">${escapeHtml(value)}</p>`;
    }

    if (typeof value === 'object') {
        return renderObject(value, level);
    }

    return escapeHtml(String(value));
}

/**
 * Форматирование имени поля
 */
function formatFieldName(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
 /** 
 * Args:
 * json(string): JSON строка для подсветки
    * 
 * Returns:
 * string: HTML строка с подсветкой синтаксиса
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
 * Функция создает UI элементы для индикации процесса загрузки
 * 
 * Args:
 *     container (HTMLElement): Контейнер для размещения элементов
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
 * Функция изменяет текст статуса во время загрузки
 * 
 * Args:
 *     statusText (string): Новый текст статуса
 */
function updateLoadingStatus(statusText) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
        statusElement.textContent = statusText;
    }
}

/**
 * Отображение ошибки
 * Функция создает UI для отображения сообщения об ошибке
 * 
 * Args:
 *     container (HTMLElement): Контейнер для размещения элементов
 *     errorMessage (string): Текст сообщения об ошибке
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

/**
 * Загрузка промпта для текущей локали
 * Функция определяет язык интерфейса и загружает соответствующий файл инструкций
 * 
 * Returns:
 *     Promise<string|null>: Текст промпта или null при ошибке
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
        console.warn('[loadPriceOfferPrompt] ⚠️ Ошибка определения локали, используется en по умолчанию', ex);
    }

    const tryLoad = async (path) => {
        console.log(`[loadPriceOfferPrompt] Попытка загрузки: ${path}`);
        try {
            const url = chrome.runtime.getURL(path);
            console.log(`[loadPriceOfferPrompt] Полный URL: ${url}`);

            const res = await fetch(url);
            console.log(`[loadPriceOfferPrompt] Fetch завершен:`, {
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                contentType: res.headers.get('content-type')
            });

            if (res.ok) {
                const text = await res.text();
                console.log(`[loadPriceOfferPrompt] ✅ Промпт загружен успешно:`, {
                    path: path,
                    length: text.length,
                    preview: text.substring(0, 100) + '...'
                });
                return text;
            }

            console.warn(`[loadPriceOfferPrompt] ⚠️ Не удалось загрузить промпт: ${path} (статус: ${res.status})`);
        } catch (ex) {
            console.warn(`[loadPriceOfferPrompt] ⚠️ Ошибка загрузки промпта: ${path}`, {
                error: ex.message,
                stack: ex.stack
            });
        }
        return null;
    };

    console.log('[loadPriceOfferPrompt] Попытка загрузки для локали:', locale);
    let promptText = await tryLoad(`instructions/${locale}/price_offer_prompt.txt`);

    if (!promptText) {
        console.log('[loadPriceOfferPrompt] Загрузка промпта на английском языке как резервный вариант');
        promptText = await tryLoad(`instructions/en/price_offer_prompt.txt`);
    }

    if (!promptText) {
        console.error('[loadPriceOfferPrompt] ❌ Не удалось загрузить промпт ни для одной локали');
    } else {
        console.log('[loadPriceOfferPrompt] ✅ Промпт загружен:', {
            length: promptText.length,
            linesCount: promptText.split('\n').length
        });
    }

    console.log('───────────────────────────────────────────────────────────');

    return promptText;
}

/**
 * Отправка запроса к Gemini API
 * Функция выполняет AJAX запрос к API и обрабатывает ответ
 * 
 * Args:
 *     componentsData (Array): Массив компонентов для обработки
 *     apiKey (string): API ключ для аутентификации
 *     model (string): Название модели Gemini
 * 
 * Returns:
 *     Promise<string>: Текст ответа от модели
 * 
 * Raises:
 *     Error: При ошибке API или сетевой ошибке
 */
async function sendRequestToGemini(componentsData, apiKey, model) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[Preview Offer] НАЧАЛО sendRequestToGemini');
    console.log('Параметры запроса:', {
        componentsCount: componentsData.length,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'ОТСУТСТВУЕТ',
        model: model
    });
    console.log('═══════════════════════════════════════════════════════════');

    const MAX_PROMPT_LENGTH = 10000;

    try {
        updateLoadingStatus('Загрузка инструкций...');
        console.log('[Preview Offer] Этап 1: Загрузка промпта');

        const instructions = await loadPriceOfferPrompt();

        console.log('[Preview Offer] Промпт загружен:', {
            loaded: !!instructions,
            length: instructions?.length || 0,
            preview: instructions ? instructions.substring(0, 100) + '...' : 'НЕТ'
        });

        if (!instructions) {
            console.error('[Preview Offer] ❌ ОШИБКА: Промпт не загружен');
            throw new Error('Не удалось загрузить инструкции для модели');
        }

        updateLoadingStatus('Формирование промпта...');
        console.log('[Preview Offer] Этап 2: Формирование полного промпта');

        const pageText = componentsData.map(c => JSON.stringify(c.data, null, 2)).join('\n\n');
        console.log('[Preview Offer] Данные компонентов объединены:', {
            originalLength: pageText.length,
            componentsCount: componentsData.length
        });

        const truncatedText = pageText.substring(0, MAX_PROMPT_LENGTH);
        console.log('[Preview Offer] Текст обрезан до максимальной длины:', {
            maxLength: MAX_PROMPT_LENGTH,
            actualLength: truncatedText.length,
            wasTruncated: pageText.length > MAX_PROMPT_LENGTH
        });

        const fullPrompt = `${instructions}\n\n${truncatedText}`;
        console.log('[Preview Offer] Полный промпт сформирован:', {
            totalLength: fullPrompt.length,
            instructionsLength: instructions.length,
            dataLength: truncatedText.length
        });

        updateLoadingStatus('Отправка запроса к Gemini API...');
        console.log('[Preview Offer] Этап 3: Подготовка URL и тела запроса');

        const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        console.log('[Preview Offer] URL сформирован:', {
            baseUrl: 'https://generativelanguage.googleapis.com/v1/models/',
            model: model,
            hasKey: !!apiKey
        });

        const requestBody = {
            contents: [{ parts: [{ text: fullPrompt }] }]
        };

        console.log('[Preview Offer] Тело запроса подготовлено:', {
            contentsLength: requestBody.contents.length,
            partsLength: requestBody.contents[0].parts.length,
            textLength: requestBody.contents[0].parts[0].text.length
        });

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[Preview Offer] 🚀 ОТПРАВКА FETCH ЗАПРОСА');
        console.log('═══════════════════════════════════════════════════════════');

        const fetchStartTime = Date.now();

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const fetchEndTime = Date.now();
        const fetchDuration = fetchEndTime - fetchStartTime;

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[Preview Offer] ✅ FETCH ЗАВЕРШЕН');
        console.log('Время выполнения:', fetchDuration, 'мс');
        console.log('Статус ответа:', response.status, response.statusText);
        console.log('Headers:', {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
        });
        console.log('═══════════════════════════════════════════════════════════');

        if (!response.ok) {
            console.error('[Preview Offer] ❌ HTTP ошибка:', response.status);
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        updateLoadingStatus('Обработка ответа...');
        console.log('[Preview Offer] Этап 4: Парсинг JSON ответа');

        const data = await response.json();

        console.log('[Preview Offer] JSON распарсен успешно');
        console.log('Структура ответа:', {
            hasError: !!data.error,
            hasCandidates: !!data.candidates,
            candidatesLength: data.candidates?.length || 0,
            hasPromptFeedback: !!data.promptFeedback
        });

        if (data.error) {
            console.error('═══════════════════════════════════════════════════════════');
            console.error('[Preview Offer] ❌ ОШИБКА GEMINI API');
            console.error('Код ошибки:', data.error.code);
            console.error('Сообщение:', data.error.message);
            console.error('Статус:', data.error.status);
            console.error('Полный объект ошибки:', data.error);
            console.error('═══════════════════════════════════════════════════════════');
            throw new Error(data.error.message || 'Неизвестная ошибка Gemini API');
        }

        if (!data.candidates || data.candidates.length === 0) {
            const blockReason = data.promptFeedback?.blockReason || 'Неизвестная причина';
            console.error('═══════════════════════════════════════════════════════════');
            console.error('[Preview Offer] ❌ ОТВЕТ ЗАБЛОКИРОВАН');
            console.error('Причина блокировки:', blockReason);
            console.error('Prompt Feedback:', data.promptFeedback);
            console.error('═══════════════════════════════════════════════════════════');
            throw new Error(`Ответ от модели заблокирован. Причина: ${blockReason}`);
        }

        console.log('[Preview Offer] Этап 5: Извлечение текста из ответа');
        console.log('Candidate 0:', {
            hasContent: !!data.candidates[0]?.content,
            hasParts: !!data.candidates[0]?.content?.parts,
            partsLength: data.candidates[0]?.content?.parts?.length || 0,
            finishReason: data.candidates[0]?.finishReason
        });

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            console.error('═══════════════════════════════════════════════════════════');
            console.error('[Preview Offer] ❌ ПУСТОЙ ТЕКСТ В ОТВЕТЕ');
            console.error('Candidates:', data.candidates);
            console.error('═══════════════════════════════════════════════════════════');
            throw new Error('Пустой ответ от модели');
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[Preview Offer] ✅ УСПЕШНО ПОЛУЧЕН ОТВЕТ');
        console.log('Длина текста:', resultText.length);
        console.log('Превью ответа (первые 200 символов):', resultText.substring(0, 200));
        console.log('Finish Reason:', data.candidates[0]?.finishReason);
        console.log('═══════════════════════════════════════════════════════════');

        return resultText;

    } catch (ex) {
        console.error('═══════════════════════════════════════════════════════════');
        console.error('[Preview Offer] ❌ КРИТИЧЕСКАЯ ОШИБКА В sendRequestToGemini');
        console.error('Тип ошибки:', ex.constructor.name);
        console.error('Сообщение:', ex.message);
        console.error('Stack trace:', ex.stack);
        console.error('═══════════════════════════════════════════════════════════');
        throw ex;
    }
}

/**
 * Отображение результата предложения
 * Функция создает UI для отображения полученных данных
 * 
 * Args:
 *     container (HTMLElement): Контейнер для размещения элементов
 *     offerData (string): Данные предложения от Gemini
 */
function displayOffer(container, offerData) {
    container.innerHTML = '';

    let parsedData;
    let isJSON = false;

    let cleanedData = offerData.trim();
    cleanedData = cleanedData.replace(/^```json\s*/i, '');
    cleanedData = cleanedData.replace(/^```\s*/, '');
    cleanedData = cleanedData.replace(/\s*```\s*$/, '');
    cleanedData = cleanedData.trim();

    console.info('[Preview Offer] Данные после очистки markdown', {
        originalLength: offerData.length,
        cleanedLength: cleanedData.length,
        wasMarkdown: offerData !== cleanedData
    });

    try {
        parsedData = JSON.parse(cleanedData);
        isJSON = true;
        console.info('[Preview Offer] Данные успешно распарсены как JSON');
    } catch (parseError) {
        console.warn('[Preview Offer] Данные не являются JSON, отображение как текст', parseError);
        parsedData = cleanedData;
    }

    const formattedData = isJSON
        ? JSON.stringify(parsedData, null, 2)
        : parsedData;

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

        // Снять активность со всех кнопок
        htmlViewBtn.classList.remove('active');
        jsonViewBtn.classList.remove('active');
        editViewBtn.classList.remove('active');

        if (viewType === 'html') {
            const htmlDocument = jsonToHtmlDocument(parsedData);
            dataContainer.innerHTML = htmlDocument;
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
                transition: background-color 0.2s;
            `;

            saveButton.addEventListener('click', () => {
                try {
                    const newParsedData = JSON.parse(editedData);
                    parsedData = newParsedData;
                    formattedData = JSON.stringify(parsedData, null, 2);

                    saveButton.textContent = '✓ Сохранено!';
                    saveButton.style.backgroundColor = '#0f9d58';

                    console.info('[Preview Offer] Данные успешно обновлены');

                    setTimeout(() => {
                        saveButton.textContent = 'Применить изменения';
                    }, 2000);

                } catch (ex) {
                    alert('Ошибка парсинга JSON: ' + ex.message);
                    console.error('[Preview Offer] Ошибка парсинга отредактированных данных:', ex);
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
                transition: background-color 0.2s;
            `;

            resetButton.addEventListener('click', () => {
                if (confirm('Отменить все изменения?')) {
                    editedData = formattedData;
                    textarea.value = formattedData;
                    console.info('[Preview Offer] Изменения отменены');
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
                transition: background-color 0.2s;
            `;

            formatButton.addEventListener('click', () => {
                try {
                    const parsed = JSON.parse(textarea.value);
                    const formatted = JSON.stringify(parsed, null, 2);
                    textarea.value = formatted;
                    editedData = formatted;
                    console.info('[Preview Offer] JSON отформатирован');
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
        transition: background-color 0.2s;
    `;

    copyButton.addEventListener('mouseover', () => {
        copyButton.style.backgroundColor = '#3367d6';
    });

    copyButton.addEventListener('mouseout', () => {
        if (copyButton.textContent === 'Копировать в буфер обмена') {
            copyButton.style.backgroundColor = '#4285f4';
        }
    });

    copyButton.addEventListener('click', async () => {
        try {
            // Копируем актуальные отредактированные данные
            const dataToCopy = currentView === 'edit' ? editedData : formattedData;
            await navigator.clipboard.writeText(dataToCopy);
            copyButton.textContent = '✓ Скопировано!';
            copyButton.style.backgroundColor = '#0f9d58';
            console.info('[Preview Offer] Данные скопированы в буфер обмена');

            setTimeout(() => {
                copyButton.textContent = 'Копировать в буфер обмена';
                copyButton.style.backgroundColor = '#4285f4';
            }, 2000);
        } catch (ex) {
            console.error('[Preview Offer] Ошибка копирования в буфер обмена:', ex);
            copyButton.textContent = '✗ Ошибка копирования';
            copyButton.style.backgroundColor = '#db4437';

            setTimeout(() => {
                copyButton.textContent = 'Копировать в буфер обмена';
                copyButton.style.backgroundColor = '#4285f4';
            }, 2000);
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
        transition: background-color 0.2s;
    `;

    regenerateButton.addEventListener('click', async () => {
        if (!confirm('Отправить новый запрос к Gemini API для получения обновленного предложения?')) {
            return;
        }

        console.log('[Preview Offer] Пользователь запросил регенерацию предложения');

        try {
            const storageResult = await chrome.storage.local.get([
                'componentsForOffer',
                'geminiApiKey',
                'geminiModel'
            ]);

            if (!storageResult.componentsForOffer || !storageResult.geminiApiKey) {
                alert('Не удалось загрузить данные для регенерации. Попробуйте создать предложение заново.');
                return;
            }

            // Очищаем старые данные
            await chrome.storage.local.remove(['previewOfferData', 'lastOffer']);

            // Перезагружаем страницу для нового запроса
            window.location.reload();

        } catch (ex) {
            console.error('[Preview Offer] Ошибка регенерации:', ex);
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
        transition: background-color 0.2s;
    `;

    saveToStorageButton.addEventListener('click', async () => {
        try {
            // Проверяем, что данные валидны
            const dataToSave = currentView === 'edit' ? editedData : formattedData;
            JSON.parse(dataToSave); // Проверка валидности JSON

            await chrome.storage.local.set({
                previewOfferData: dataToSave,
                lastOffer: dataToSave
            });

            saveToStorageButton.textContent = '✓ Сохранено!';
            saveToStorageButton.style.backgroundColor = '#0f9d58';
            console.info('[Preview Offer] Изменения сохранены в storage');

            setTimeout(() => {
                saveToStorageButton.textContent = 'Сохранить изменения';
            }, 2000);

        } catch (ex) {
            alert('Ошибка сохранения: ' + ex.message);
            console.error('[Preview Offer] Ошибка сохранения в storage:', ex);
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
        transition: background-color 0.2s;
    `;

    clearButton.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите очистить данные предложения?')) {
            await chrome.storage.local.remove(['previewOfferData', 'lastOffer']);
            container.innerHTML = '<p style="color: #5f6368; padding: 20px;">Данные очищены. Закройте эту вкладку и сформируйте новое предложение.</p>';
            console.info('[Preview Offer] Данные предложения очищены');
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

    console.info('[Preview Offer] Интерфейс отображения готов');
}

/**
 * Инициализация страницы и загрузка данных через AJAX
 */
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[Preview Offer] 🚀 ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ');
    console.log('Время:', new Date().toISOString());
    console.log('═══════════════════════════════════════════════════════════');

    try {
        console.log('[Preview Offer] Чтение данных из chrome.storage...');
        const storageResult = await chrome.storage.local.get([
            'previewOfferData',
            'lastOffer',
            'componentsForOffer',
            'geminiApiKey',
            'geminiModel'
        ]);

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[Preview Offer] ДАННЫЕ ИЗ STORAGE:');
        console.log('previewOfferData:', {
            exists: !!storageResult.previewOfferData,
            length: storageResult.previewOfferData?.length || 0
        });
        console.log('lastOffer:', {
            exists: !!storageResult.lastOffer,
            length: storageResult.lastOffer?.length || 0
        });
        console.log('componentsForOffer:', {
            exists: !!storageResult.componentsForOffer,
            length: storageResult.componentsForOffer?.length || 0
        });
        console.log('═══════════════════════════════════════════════════════════');

        // Проверка: есть ли уже готовые данные предложения
        const existingOfferData = storageResult.previewOfferData || storageResult.lastOffer;

        if (existingOfferData) {
            console.log('═══════════════════════════════════════════════════════════');
            console.log('[Preview Offer] ✅ НАЙДЕНЫ СОХРАНЕННЫЕ ДАННЫЕ');
            console.log('Длина данных:', existingOfferData.length);
            console.log('Источник:', storageResult.previewOfferData ? 'previewOfferData' : 'lastOffer');
            console.log('═══════════════════════════════════════════════════════════');

            console.log('[Preview Offer] Отображение сохраненных данных без запроса к API');
            displayOffer(container, existingOfferData);
            return;
        }

        console.log('[Preview Offer] ⚠️ Сохраненные данные не найдены, требуется запрос к API');
        showLoadingState(container);

        // Проверка наличия компонентов и API ключа
        if (!storageResult.componentsForOffer || storageResult.componentsForOffer.length === 0) {
            console.error('[Preview Offer] ❌ Компоненты отсутствуют или пусты');
            showError(container, 'Нет компонентов для формирования предложения. Добавьте компоненты через контекстное меню.');
            return;
        }

        if (!storageResult.geminiApiKey) {
            console.error('[Preview Offer] ❌ API ключ отсутствует');
            showError(container, 'API ключ не установлен. Откройте настройки расширения и добавьте ключ Gemini API.');
            return;
        }

        const componentsData = storageResult.componentsForOffer;
        const apiKey = storageResult.geminiApiKey;
        const model = storageResult.geminiModel || 'gemini-2.5-flash';

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[Preview Offer] 🚀 ОТПРАВКА НОВОГО ЗАПРОСА К GEMINI');
        console.log('Компонентов:', componentsData.length);
        console.log('Модель:', model);
        console.log('═══════════════════════════════════════════════════════════');

        updateLoadingStatus('Подготовка данных...');

        const offerData = await sendRequestToGemini(componentsData, apiKey, model);

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[Preview Offer] ✅ ОТВЕТ ОТ sendRequestToGemini ПОЛУЧЕН');
        console.log('Длина данных:', offerData.length);
        console.log('═══════════════════════════════════════════════════════════');

        console.log('[Preview Offer] Сохранение данных в storage...');
        await chrome.storage.local.set({
            previewOfferData: offerData,
            lastOffer: offerData
        });
        console.log('[Preview Offer] Данные сохранены в storage');

        displayOffer(container, offerData);

    } catch (ex) {
        console.error('═══════════════════════════════════════════════════════════');
        console.error('[Preview Offer] ❌ КРИТИЧЕСКАЯ ОШИБКА В DOMContentLoaded');
        console.error('Тип ошибки:', ex.constructor.name);
        console.error('Сообщение:', ex.message);
        console.error('Stack trace:', ex.stack);
        console.error('═══════════════════════════════════════════════════════════');
        showError(container, `Произошла ошибка: ${ex.message}`);
    }
});