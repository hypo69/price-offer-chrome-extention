// json2html.js
// -*- coding: utf-8 -*-

let currentLocalizedMessages = null;

async function getLocalizedMessages(locale) {
    const defaultLocale = 'ru';
    const finalLocale = locale || defaultLocale;

    // Если уже загружено и локаль совпадает, возвращаем кэшированное значение
    if (currentLocalizedMessages && currentLocalizedMessages.locale === finalLocale) {
        return currentLocalizedMessages.messages;
    }

    const path = `_locales/${finalLocale}/messages.json`;
    try {
        const url = chrome.runtime.getURL(path);
        const res = await fetch(url);
        if (!res.ok) {
            // Если для нужной локали нет файла, пытаемся загрузить русский
            if (finalLocale !== defaultLocale) {
                return getLocalizedMessages(defaultLocale);
            }
            throw new Error(`Не удалось загрузить messages.json для локали: ${finalLocale}`);
        }

        const messages = await res.json();
        currentLocalizedMessages = { locale: finalLocale, messages: messages };
        return messages;

    } catch (e) {
        console.error(`Ошибка загрузки локализации: ${e.message}`);
        // Возвращаем пустой объект, чтобы избежать ошибок при попытке обращения к ключам
        return {};
    }
}

function getMessage(messages, key, fallback = '') {
    if (messages && messages[key] && messages[key].message) {
        return messages[key].message;
    }
    return fallback;
}


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

    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');

    // Ручная загрузка сообщений на основе параметра lang
    const messages = await getLocalizedMessages(lang);


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

    // Использование ручной локализации getMessage()
    const totalPriceLabel = getMessage(messages, 'totalPriceLabel', 'Итоговая цена:');
    const priceLabel = getMessage(messages, 'price', 'Цена');
    const saveButtonText = getMessage(messages, 'saveOfferButton', 'Сохранить предложение');
    const changeImageButtonText = getMessage(messages, 'changeImageButton', 'Изменить картинку');

    const priceDisplayValue = data.price ? `${escapeHtml(data.price)} ₪` : '...';
    const priceDisplayHtml = `
        <div class="offer-price-display">
            <strong>${totalPriceLabel}</strong>
            <span id="price-display-value">${priceDisplayValue}</span>
        </div>
    `;

    const priceBlockHtml = `
        <div class="price-block">
            <label for="price-input">${priceLabel} (₪):</label>
            <input type="text" id="price-input" placeholder="${priceLabel}" value="${escapeHtml(data.price || '')}">
            <button id="save-offer-button">${saveButtonText}</button>
            <button id="change-image-button">${changeImageButtonText}</button>
            <button id="save-pdf-button">Сохранить как PDF</button>
        </div>
    `;

    return mainContentHtml + footerHtml + priceDisplayHtml + priceBlockHtml;
}

async function generateServiceFooterHtml() {
    try {
        const defaultLocale = 'ru';
        let locale = defaultLocale;

        const urlParams = new URLSearchParams(window.location.search);
        const langFromUrl = urlParams.get('lang');

        if (langFromUrl) {
            locale = langFromUrl;
        }

        const messageUrl = chrome.runtime.getURL(`_locales/${locale}/footer-message.md`);
        let textContent = '';
        try {
            const response = await fetch(messageUrl);
            if (!response.ok) {
                // Если не удалось найти локализованный файл, пытаемся загрузить русский
                const fallbackUrl = chrome.runtime.getURL(`_locales/${defaultLocale}/footer-message.md`);
                const fallbackResponse = await fetch(fallbackUrl);
                if (!fallbackResponse.ok) throw new Error('Не удалось загрузить файл футера.');
                textContent = await fallbackResponse.text();
            } else {
                textContent = await response.text();
            }
        } catch (fetchError) {
            console.error("Критическая ошибка загрузки файла футера:", fetchError);
            return `<p class="error-message">Не удалось загрузить служебную информацию.</p>`;
        }

        // ▼▼▼ ИСПРАВЛЕНИЕ ЛОГИКИ ПАРСИНГА ФУТЕРА ▼▼▼
        const lines = textContent.split('\n').map(line => line.trim()).filter(Boolean);
        let htmlContent = '';

        lines.forEach(line => {
            // Проверяем на наличие тега <b> в начале и </b> в конце
            // Используем нежадный поиск .*? чтобы убедиться, что он ловит только одну пару <b>
            const boldMatch = line.match(/^<b>(.*?)<\/b>$/i);

            if (boldMatch) {
                // Это заголовок (пункт). Разрешаем HTML (в частности, 🛠️)
                htmlContent += `<h3>${boldMatch[1]}</h3>`;
            } else if (line.match(/^(-{3,}|={3,})$/)) {
                // Горизонтальная линия
                htmlContent += `<hr>`;
            } else if (line.match(/^✅\s*.+/)) {
                // Строка с символом ✅
                htmlContent += `<p class="footer-highlight">${line}</p>`;
            }
            else {
                // Обычный параграф, эскейпим HTML для безопасности, но разрешаем <br> для переносов
                htmlContent += `<p>${escapeHtml(line)}</p>`;
            }
        });

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

/**
 * Функция рендеринга сетки спецификаций
 */
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

function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    // Эскейпим весь HTML по умолчанию
    let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    // Обратное преобразование только для разрешенных тегов (используется только для текста футера)
    // Разрешаем <b> (для заголовков пунктов в футере)
    safeText = safeText.replace(/&lt;b&gt;/gi, '<b>').replace(/&lt;\/b&gt;/gi, '</b>');

    // Если нужно разрешить <br> для переносов внутри параграфов, можно добавить:
    // safeText = safeText.replace(/&lt;br&gt;/gi, '<br>');

    return safeText;
}

window.parseResponseToHtml = parseResponseToHtml;
window.getRandomImageUrl = getRandomImageUrl;