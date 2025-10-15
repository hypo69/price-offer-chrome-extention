// json2html.js
// -*- coding: utf-8 -*-

async function parseResponseToHtml(rawData) {
    if (!rawData) {
        return '<p class="error-message">Ошибка: пустой ответ.</p>';
    }
    let dataObject;
    if (typeof rawData === 'object' && rawData !== null) {
        dataObject = rawData;
    } else if (typeof rawData === 'string') {
        let cleanedString = rawData.trim().replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try {
            dataObject = JSON.parse(cleanedString);
        } catch (e) {
            return `<p class="error-message">Ошибка: не удалось обработать данные как JSON. ${e.message}</p>`;
        }
    } else {
        return `<p class="error-message">Ошибка: неподдерживаемый формат данных.</p>`;
    }
    return await renderPcBuildHtml(dataObject);
}

async function renderPcBuildHtml(data) {
    if (typeof data !== 'object' || data === null) {
        return '<p class="error-message">Ошибка: данные для рендеринга не являются объектом.</p>';
    }

    let mainContentHtml = '';

    if (data.title) {
        mainContentHtml += `<h1>${escapeHtml(data.title)}</h1>`;
    }
    if (data.description) {
        mainContentHtml += `<div class="description">${escapeHtml(data.description)}</div>`;
    }
    if (Array.isArray(data.components)) {
        let componentsHtml = '';
        data.components.forEach((product, index) => {
            const name = product.component_name || 'Компонент';
            const desc = product.component_description || '';
            const specArray = product.component_specification || [];
            const imgUrl = product.component_image || 'https://via.placeholder.com/180';
            componentsHtml += `
                <article class="component" id="component-${index + 1}">
                    <h2>${escapeHtml(name)}</h2>
                    <div class="component-row">
                        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)}">
                        <div class="component-body">
                            <p>${escapeHtml(desc)}</p>
                            ${renderSpecGridFromArray(specArray)}
                        </div>
                    </div>
                </article>`;
        });
        mainContentHtml += `<section aria-label="Components">${componentsHtml}</section>`;
    }

    const footerHtml = await generateServiceFooterHtml();

    const priceDisplayValue = data.price ? `${escapeHtml(data.price)} ₪` : '...';
    const priceDisplayHtml = `
        <div class="offer-price-display">
            <strong>Итоговая цена:</strong>
            <span id="price-display-value">${priceDisplayValue}</span>
        </div>
    `;

    // ▼▼▼ ИЗМЕНЕНИЕ ЗДЕСЬ: Поменял местами две кнопки ▼▼▼
    const priceBlockHtml = `
        <div class="price-block">
            <label for="price-input">Цена (₪):</label>
            <input type="text" id="price-input" placeholder="Введите цену" value="${escapeHtml(data.price || '')}">
            <button id="save-offer-button">Сохранить предложение</button>
            <button id="change-image-button">Изменить картинку</button>
        </div>
    `;

    return mainContentHtml + footerHtml + priceDisplayHtml + priceBlockHtml;
}

async function generateServiceFooterHtml() {
    try {
        let locale = 'en';
        try {
            const currentLocale = chrome.i18n.getUILanguage();
            if (currentLocale.startsWith('ru')) locale = 'ru';
            else if (currentLocale.startsWith('he')) locale = 'he';
        } catch (ex) {
            console.warn('Ошибка определения локали для футера, используется "en"', ex);
        }

        const messageUrl = chrome.runtime.getURL(`_locales/${locale}/footer-message.md`);
        let textContent = '';
        try {
            const response = await fetch(messageUrl);
            if (!response.ok) {
                const fallbackUrl = chrome.runtime.getURL('_locales/en/footer-message.md');
                const fallbackResponse = await fetch(fallbackUrl);
                if (!fallbackResponse.ok) throw new Error('Не удалось загрузить файл футера.');
                textContent = await fallbackResponse.text();
            } else {
                textContent = await response.text();
            }
        } catch (fetchError) {
            console.error("Ошибка загрузки файла футера:", fetchError);
            return `<p class="error-message">Не удалось загрузить служебную информацию.</p>`;
        }

        let htmlContent = textContent.split('\n').map(line => line.trim()).filter(Boolean)
            .map(line => line.match(/^\d+\.\s*.+/) ? `<h3>${escapeHtml(line)}</h3>` : `<p>${escapeHtml(line)}</p>`)
            .join('');

        const imageUrl = await getRandomImageUrl();

        return `
            <footer class="service-footer">
                <div class="footer-text">${htmlContent}</div>
                <div class="footer-image"><img id="footer-random-image" src="${imageUrl}" alt="Service Illustration"></div>
            </footer>`;

    } catch (error) {
        console.error("Ошибка генерации футера:", error);
        return `<p class="error-message">Не удалось сгенерировать служебную информацию.</p>`;
    }
}

async function getRandomImageUrl() {
    let imageUrl = 'https://via.placeholder.com/300x200';
    try {
        const manifestUrl = chrome.runtime.getURL('image-manifest.json');
        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) throw new Error('Не удалось загрузить image-manifest.json');
        const imageList = await manifestResponse.json();

        if (Array.isArray(imageList) && imageList.length > 0) {
            const randomImagePath = imageList[Math.floor(Math.random() * imageList.length)];
            imageUrl = chrome.runtime.getURL(randomImagePath);
        }
    } catch (imgError) {
        console.error("Ошибка загрузки манифеста изображений:", imgError);
    }
    return imageUrl;
}

function renderSpecGridFromArray(specArray) {
    if (!Array.isArray(specArray) || specArray.length === 0) return '';
    let gridHtml = '<div class="spec-grid">';
    specArray.forEach(item => {
        const colonIndex = item.indexOf(':');
        if (colonIndex > -1) {
            const key = item.substring(0, colonIndex).trim();
            const value = item.substring(colonIndex + 1).trim();
            gridHtml += `<div>${escapeHtml(key)}</div><div>${escapeHtml(value)}</div>`;
        } else {
            gridHtml += `<div class="spec-full-row">${escapeHtml(item)}</div>`;
        }
    });
    gridHtml += '</div>';
    return gridHtml;
}

function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

window.parseResponseToHtml = parseResponseToHtml;
window.getRandomImageUrl = getRandomImageUrl;