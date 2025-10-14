// preview-offer.js
// \file preview-offer.js
// -*- coding: utf-8 -*-

/**
 * Модуль отображения сформированного предложения
 * ==============================================
 * Загрузка и отображение данных от Gemini API
 */

/**
 * Инициализация страницы предложения
 * Функция загружает данные из storage и отображает их
 */
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
                const jsonHTML = json2html(parsedData);
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
        if (isJSON) {
            container.appendChild(viewToggle);
        }
        container.appendChild(dataContainer);
        container.appendChild(buttonContainer);

        console.info('[Preview Offer] Интерфейс отображения готов');

    } catch (ex) {
        console.error('[Preview Offer] Ошибка при загрузке данных предложения:', ex);
        container.innerHTML = `<p style="color: #db4437; padding: 20px;">Произошла ошибка при загрузке данных предложения: ${ex.message}</p>`;
    }
});

/**
 * Подсветка синтаксиса JSON
 * Функция добавляет HTML-разметку для цветной подсветки JSON
 * 
 * Args:
 *     json (string): JSON строка для подсветки
 * 
 * Returns:
 *     string: HTML с подсветкой синтаксиса
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
        return `<span class="${cls}">${match}</span>`;
    });
}

/**
 * Конвертация JSON в HTML
 * Функция преобразует JSON объект в читаемую HTML-структуру
 * 
 * Args:
 *     json (Object|Array|string|number|boolean|null): JSON данные для конвертации
 *     level (number): Уровень вложенности (по умолчанию 0)
 * 
 * Returns:
 *     string: HTML представление JSON
 */
function json2html(json, level = 0) {
    const indent = level * 20;

    if (json === null) {
        return `<span class="json-null">null</span>`;
    }

    if (typeof json === 'boolean') {
        return `<span class="json-boolean">${json}</span>`;
    }

    if (typeof json === 'number') {
        return `<span class="json-number">${json}</span>`;
    }

    if (typeof json === 'string') {
        const escaped = json.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        return `<span class="json-string">"${escaped}"</span>`;
    }

    if (Array.isArray(json)) {
        if (json.length === 0) {
            return '<span class="json-bracket">[]</span>';
        }

        let html = '<div class="json-array">';
        html += '<span class="json-bracket">[</span>';

        json.forEach((item, index) => {
            html += `<div class="json-item" style="margin-left: ${indent + 20}px;">`;
            html += json2html(item, level + 1);
            if (index < json.length - 1) {
                html += '<span class="json-comma">,</span>';
            }
            html += '</div>';
        });

        html += `<div style="margin-left: ${indent}px;"><span class="json-bracket">]</span></div>`;
        html += '</div>';

        return html;
    }

    if (typeof json === 'object') {
        const keys = Object.keys(json);

        if (keys.length === 0) {
            return '<span class="json-bracket">{}</span>';
        }

        let html = '<div class="json-object">';
        html += '<span class="json-bracket">{</span>';

        keys.forEach((key, index) => {
            html += `<div class="json-property" style="margin-left: ${indent + 20}px;">`;
            html += `<span class="json-key">"${key}"</span>`;
            html += '<span class="json-colon">: </span>';
            html += json2html(json[key], level + 1);
            if (index < keys.length - 1) {
                html += '<span class="json-comma">,</span>';
            }
            html += '</div>';
        });

        html += `<div style="margin-left: ${indent}px;"><span class="json-bracket">}</span></div>`;
        html += '</div>';

        return html;
    }

    return String(json);
}

const style = document.createElement('style');
style.textContent = `
    .json-key { 
        color: #881391; 
        font-weight: 600; 
    }
    .json-string { 
        color: #1A1AA6; 
    }
    .json-number { 
        color: #164; 
        font-weight: 500;
    }
    .json-boolean { 
        color: #219; 
        font-weight: 600; 
    }
    .json-null { 
        color: #900; 
        font-weight: 600; 
    }
    .json-bracket {
        color: #333;
        font-weight: 600;
    }
    .json-colon {
        color: #666;
    }
    .json-comma {
        color: #666;
    }
    .json-object,
    .json-array {
        margin: 2px 0;
    }
    .json-property,
    .json-item {
        margin: 4px 0;
        padding: 2px 0;
    }
    .json-property:hover,
    .json-item:hover {
        background-color: #f8f9fa;
        margin-left: -4px !important;
        padding-left: 4px;
        border-radius: 3px;
    }
    
    .view-toggle-btn {
        padding: 8px 16px;
        border: 1px solid #dadce0;
        background-color: #ffffff;
        color: #5f6368;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
    }
    
    .view-toggle-btn:hover {
        background-color: #f8f9fa;
        border-color: #4285f4;
    }
    
    .view-toggle-btn.active {
        background-color: #4285f4;
        color: #ffffff;
        border-color: #4285f4;
    }
`;
document.head.appendChild(style);