// preview-offer.js

let currentOfferData = null;

async function displayOfferWithTabs(container, offerDataString) {
    container.innerHTML = '';
    let cleanedData = offerDataString.trim().replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
        currentOfferData = JSON.parse(cleanedData);
    } catch (e) {
        showError(container, 'Не удалось распознать ответ от модели как JSON. Отображаем как текст.');
        container.innerHTML += `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(offerDataString)}</pre>`;
        return;
    }

    const tabControls = document.createElement('div');
    tabControls.className = 'tab-controls';
    const htmlViewBtn = document.createElement('button');
    htmlViewBtn.className = 'tab-button active';
    htmlViewBtn.textContent = 'HTML View';
    const jsonEditBtn = document.createElement('button');
    jsonEditBtn.className = 'tab-button';
    jsonEditBtn.textContent = 'JSON Edit';
    const htmlViewContent = document.createElement('div');
    htmlViewContent.id = 'html-view-content';
    htmlViewContent.className = 'tab-content active';
    const jsonEditContent = document.createElement('div');
    jsonEditContent.id = 'json-editor-container';
    jsonEditContent.className = 'tab-content';

    function switchTab(activeTab) {
        if (activeTab === 'html') {
            htmlViewBtn.classList.add('active');
            jsonEditBtn.classList.remove('active');
            htmlViewContent.classList.add('active');
            jsonEditContent.classList.remove('active');
        } else {
            htmlViewBtn.classList.remove('active');
            jsonEditBtn.classList.add('active');
            htmlViewContent.classList.remove('active');
            jsonEditContent.classList.add('active');
        }
    }

    htmlViewBtn.addEventListener('click', () => switchTab('html'));
    jsonEditBtn.addEventListener('click', () => switchTab('json'));

    async function renderHtmlView() {
        try {
            htmlViewContent.innerHTML = await window.parseResponseToHtml(currentOfferData);
            setupPriceSaveButton();
            setupChangeImageButton();
            setupSavePdfButton();
        } catch (e) {
            htmlViewContent.innerHTML = `<p class="error-message">Ошибка рендеринга HTML: ${e.message}</p>`;
        }
    }

    const jsonEditor = document.createElement('textarea');
    jsonEditor.id = 'json-editor';
    jsonEditor.value = JSON.stringify(currentOfferData, null, 2);
    const saveJsonButton = document.createElement('button');
    saveJsonButton.id = 'save-json-button';
    saveJsonButton.textContent = 'Save Changes';

    saveJsonButton.addEventListener('click', async () => {
        try {
            const newJsonString = jsonEditor.value;
            currentOfferData = JSON.parse(newJsonString);
            await chrome.storage.local.set({
                previewOfferData: newJsonString,
                lastOffer: newJsonString
            });
            await renderHtmlView();
            switchTab('html');
            alert('Изменения сохранены и применены!');
        } catch (e) {
            alert(`Ошибка в JSON-синтаксисе: ${e.message}\n\nИзменения не сохранены.`);
        }
    });

    tabControls.appendChild(htmlViewBtn);
    tabControls.appendChild(jsonEditBtn);
    jsonEditContent.appendChild(jsonEditor);
    jsonEditContent.appendChild(saveJsonButton);
    container.appendChild(tabControls);
    container.appendChild(htmlViewContent);
    container.appendChild(jsonEditContent);

    await renderHtmlView();
}

function setupPriceSaveButton() {
    const saveButton = document.getElementById('save-offer-button');
    const priceInput = document.getElementById('price-input');
    const priceDisplay = document.getElementById('price-display-value');

    if (!saveButton || !priceInput || !priceDisplay) {
        return;
    }

    saveButton.addEventListener('click', async () => {
        const price = priceInput.value.trim();
        if (!price) {
            alert('Пожалуйста, введите цену.');
            return;
        }

        currentOfferData.price = price;
        const updatedOfferString = JSON.stringify(currentOfferData, null, 2);

        try {
            await chrome.storage.local.set({
                previewOfferData: updatedOfferString,
                lastOffer: updatedOfferString
            });
            priceDisplay.textContent = `${escapeHtml(price)} ₪`;
            const jsonEditor = document.getElementById('json-editor');
            if (jsonEditor) {
                jsonEditor.value = updatedOfferString;
            }
            saveButton.textContent = 'Сохранено!';
            saveButton.classList.add('saved');
            setTimeout(() => {
                saveButton.textContent = 'Сохранить предложение';
                saveButton.classList.remove('saved');
            }, 2000);
        } catch (e) {
            alert('Не удалось сохранить предложение. ' + e.message);
        }
    });
}

function setupChangeImageButton() {
    const changeButton = document.getElementById('change-image-button');
    const imageElement = document.getElementById('footer-random-image');

    if (!changeButton || !imageElement) {
        return;
    }

    changeButton.addEventListener('click', async () => {
        const newImageUrl = await window.getRandomImageUrl();
        imageElement.src = newImageUrl;
    });
}

function setupSavePdfButton() {
    const pdfButton = document.getElementById('save-pdf-button');
    if (!pdfButton) {
        return;
    }
    pdfButton.addEventListener('click', () => {
        window.print();
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

function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    const rtlLanguages = ['he', 'ar', 'fa', 'ur'];
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');

    if (lang && rtlLanguages.includes(lang)) {
        container.dir = 'rtl';
    }

    try {
        const storageResult = await chrome.storage.local.get(['previewOfferData', 'lastOffer', 'componentsForOffer', 'geminiApiKey', 'geminiModel', 'forceNewRequest']);
        const shouldForceNewRequest = storageResult.forceNewRequest === true;
        if (shouldForceNewRequest) {
            await chrome.storage.local.remove('forceNewRequest');
        } else {
            const existingOfferData = storageResult.previewOfferData || storageResult.lastOffer;
            if (existingOfferData) {
                await displayOfferWithTabs(container, existingOfferData);
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
        const pageText = componentsData.map(c => JSON.stringify(c.data, null, 2)).join('\n\n');
        const offerData = await GeminiAPI.getFullPriceOffer(pageText, apiKey, model);
        if (!offerData) {
            throw new Error('Получен пустой ответ от модели.');
        }
        await chrome.storage.local.set({
            previewOfferData: offerData,
            lastOffer: offerData
        });
        await displayOfferWithTabs(container, offerData);
    } catch (ex) {
        showError(container, `Произошла критическая ошибка: ${ex.message}`);
    }
});