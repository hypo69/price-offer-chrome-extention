// preview-offer.js
// \file preview-offer.js
// -*- coding: utf-8 -*-

/**
 * Модуль отображения сформированного предложения
 * ==============================================
 * Загрузка и отображение данных от Gemini API
 */

import './json2html.js'; // подключаем внешний модуль json2html

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    console.info('[Preview Offer] Начало инициализации страницы');

    try {
        const storageResult = await chrome.storage.local.get(['previewOfferData', 'lastOffer', 'componentsForOffer']);

        console.info('[Preview Offer] Данные из storage:', {
            hasPreviewOfferData: !!storageResult.previewOfferData,
            hasLastOffer: !!storageResult.lastOffer,
            hasComponentsForOffer: !!storageResult.componentsForOffer,
            previewOfferDataLength: storageResult.previewOfferData?.length,
            lastOfferLength: storageResult.lastOffer?.length
        });

        let offerData = storageResult.previewOfferData || storageResult.lastOffer;

        if (!offerData) {
            container.innerHTML = '<p style="color: #db4437; padding: 20px;">Нет данных для отображения. Сначала сформируйте предложение из компонентов.</p>';
            console.warn('[Preview Offer] Данные предложения отсутствуют в storage');
            return;
        }

        console.info('[Preview Offer] Данные предложения загружены', { dataLength: offerData.length });

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
            wasMarkdown: offerData !== cleanedData,
            preview: cleanedData.substring(0, 100)
        });

        try {
            parsedData = JSON.parse(cleanedData);
            isJSON = true;
            console.info('[Preview Offer] Данные успешно распарсены как JSON');
        } catch (parseError) {
            console.warn('[Preview Offer] Данные не являются JSON, отображение как текст', { error: parseError.message });
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

        viewToggle.appendChild(htmlViewBtn);
        viewToggle.appendChild(jsonViewBtn);

        const dataContainer = document.createElement('div');

        let currentView = 'html';

        const renderView = (viewType) => {
            if (!isJSON) return;

            currentView = viewType;

            if (viewType === 'html') {
                const jsonHTML = json2html(parsedData, 0, true); // выводим только значения
                dataContainer.innerHTML = jsonHTML;
                dataContainer.style.cssText = `
                    background-color: #ffffff;
                    padding: 20px;
                    border-radius: 8px;
                    overflow-x: auto;
                    font-family: 'Segoe UI', sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    border: 1px solid #e0e0e0;
                `;
                htmlViewBtn.classList.add('active');
                jsonViewBtn.classList.remove('active');
            } else {
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
                htmlViewBtn.classList.remove('active');
                jsonViewBtn.classList.add('active');
            }
        };

        if (isJSON) {
            renderView('html');
            htmlViewBtn.addEventListener('click', () => renderView('html'));
            jsonViewBtn.addEventListener('click', () => renderView('json'));
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
                await navigator.clipboard.writeText(formattedData);
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
        buttonContainer.appendChild(clearButton);

        container.innerHTML = '';
        container.appendChild(header);
        if (isJSON) container.appendChild(viewToggle);
        container.appendChild(dataContainer);
        container.appendChild(buttonContainer);

        console.info('[Preview Offer] Интерфейс отображения готов');

    } catch (ex) {
        console.error('[Preview Offer] Ошибка при загрузке данных предложения:', ex);
        container.innerHTML = `<p style="color: #db4437; padding: 20px;">Произошла ошибка при загрузке данных предложения: ${ex.message}</p>`;
    }
});
