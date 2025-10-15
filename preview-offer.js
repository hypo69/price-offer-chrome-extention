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

// Функции showLoadingState, showError, syntaxHighlightJSON остаются без изменений...
// (Я их скрыл для краткости, но они должны присутствовать в файле)

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

function showLoadingState(container) {
    container.innerHTML = '';
    const loadingWrapper = document.createElement('div');
    loadingWrapper.style.cssText = `display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 20px;`;
    const spinner = document.createElement('div');
    spinner.style.cssText = `width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #4285f4; border-radius: 50%; animation: spin 1s linear infinite;`;
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    const message = document.createElement('p');
    message.textContent = 'Отправка запроса к Gemini API...';
    message.style.cssText = `color: #5f6368; font-size: 16px; margin: 0;`;
    const statusText = document.createElement('p');
    statusText.id = 'loading-status';
    statusText.textContent = 'Пожалуйста, подождите';
    statusText.style.cssText = `color: #80868b; font-size: 14px; margin: 0;`;
    loadingWrapper.appendChild(spinner);
    loadingWrapper.appendChild(message);
    loadingWrapper.appendChild(statusText);
    container.appendChild(loadingWrapper);
}

function updateLoadingStatus(statusText) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) statusElement.textContent = statusText;
}

function showError(container, errorMessage) {
    container.innerHTML = '';
    const errorWrapper = document.createElement('div');
    errorWrapper.style.cssText = `background-color: #fce8e6; border: 1px solid #db4437; border-radius: 8px; padding: 20px; margin: 20px 0;`;
    const errorTitle = document.createElement('h3');
    errorTitle.textContent = 'Ошибка получения данных';
    errorTitle.style.cssText = `color: #db4437; margin: 0 0 10px 0; font-size: 18px;`;
    const errorText = document.createElement('p');
    errorText.textContent = errorMessage;
    errorText.style.cssText = `color: #5f6368; margin: 0; line-height: 1.6;`;
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Повторить попытку';
    retryButton.style.cssText = `margin-top: 15px; padding: 10px 20px; background-color: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;`;
    retryButton.addEventListener('click', () => window.location.reload());
    errorWrapper.appendChild(errorTitle);
    errorWrapper.appendChild(errorText);
    errorWrapper.appendChild(retryButton);
    container.appendChild(errorWrapper);
}

// ============================================================================
// ФУНКЦИИ РАБОТЫ С GEMINI API --- УДАЛЕНЫ, ТЕПЕРЬ ИСПОЛЬЗУЕТСЯ GEMINI.JS
// ============================================================================

// ============================================================================
// ФУНКЦИЯ ОТОБРАЖЕНИЯ РЕЗУЛЬТАТА
// ============================================================================

/**
 * ДОБАВЛЕНО: Функция для создания футера
 * @param {string} mainHtml - HTML, сгенерированный json2html
 * @returns {string} - Полный HTML с добавленным футером
 */
function addFooterToHtml(mainHtml) {
    // Список случайных изображений для футера
    const images = [
        'assets/images/footer/image1.jpg',
        'assets/images/footer/image2.jpg',
        'assets/images/footer/image3.png'
    ];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imageUrl = chrome.runtime.getURL(randomImage);

    const footerHtml = `
        <footer class="offer-footer">
            <div class="footer-info">
                <p>Предложение сгенерировано с помощью Gemini. Дата: ${new Date().toLocaleDateString()}</p>
                <p>Это предложение является предварительным и требует подтверждения.</p>
            </div>
            <div class="footer-image">
                <img src="${imageUrl}" alt="Decorative image">
            </div>
        </footer>
    `;

    return mainHtml + footerHtml;
}


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
    // (Код кнопок без изменений)
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.cssText = `display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;`;
    const regenerateBtn = document.createElement('button');
    regenerateBtn.textContent = 'Regenerate';
    regenerateBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#4285f4;color:white;cursor:pointer;`;
    regenerateBtn.addEventListener('click', () => window.location.reload());
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#fbbc05;color:black;cursor:pointer;`;
    copyBtn.addEventListener('click', () => { try { navigator.clipboard.writeText(cleanedData); alert('Скопировано в буфер обмена!'); } catch (e) { alert('Ошибка копирования'); } });
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = `padding:8px 12px;border:none;border-radius:4px;background-color:#34a853;color:white;cursor:pointer;`;
    saveBtn.addEventListener('click', () => { const blob = new Blob([cleanedData], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'offer.json'; link.click(); });
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
    // (Код JSON-редактора без изменений)
    const editorWrapper = document.createElement('pre');
    editorWrapper.style.cssText = `background-color:#f6f8fa; padding:15px; border-radius:6px; max-height:400px; overflow:auto; font-family:monospace; font-size:14px; margin-bottom:20px;`;
    editorWrapper.innerHTML = syntaxHighlightJSON(isJSON ? JSON.stringify(parsedData, null, 2) : String(parsedData));
    container.appendChild(editorWrapper);

    // --- HTML preview ---
    const htmlPreviewWrapper = document.createElement('div');
    htmlPreviewWrapper.style.cssText = `border-top:1px solid #ddd;padding-top:20px;`;

    let htmlContent;
    try {
        // Шаг 3: Парсим ответ в HTML
        htmlContent = isJSON ? window.parseResponseToHtml(parsedData) : window.parseResponseToHtml(String(parsedData));

        // ИЗМЕНЕНО: Шаг 4: Добавляем футер к полученному HTML
        htmlContent = addFooterToHtml(htmlContent);

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

        // ИЗМЕНЕНО: Шаг 2: Используем GeminiAPI из gemini.js
        const pageText = componentsData.map(c => JSON.stringify(c.data, null, 2)).join('\n\n');
        const offerData = await GeminiAPI.getFullPriceOffer(pageText, apiKey, model);

        await chrome.storage.local.set({
            previewOfferData: offerData,
            lastOffer: offerData
        });

        displayOffer(container, offerData);

    } catch (ex) {
        showError(container, `Произошла ошибка: ${ex.message}`);
    }
});