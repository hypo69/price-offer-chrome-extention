// json2html.js
// -*- coding: utf-8 -*-
/**
 * Парсит JSON-объект и возвращает HTML по заданному шаблону.
 */

/**
 * Основная функция: обрабатывает входные данные и возвращает готовый HTML.
 * @param {string|Object} rawData — строка от Gemini или уже распарсенный JSON-объект.
 * @returns {string} — HTML для вставки в DOM.
 */
function parseResponseToHtml(rawData) {
    if (!rawData) {
        return '<p class="error-message">Ошибка: пустой ответ.</p>';
    }

    let dataObject;

    if (typeof rawData === 'object' && rawData !== null) {
        dataObject = rawData;
    } else if (typeof rawData === 'string') {
        let cleanedString = rawData.trim();
        if (cleanedString.startsWith('```')) {
            cleanedString = cleanedString.substring(cleanedString.indexOf('\n') + 1).replace(/```$/, '').trim();
        }
        try {
            dataObject = JSON.parse(cleanedString);
        } catch (e) {
            return `<p class="error-message">Ошибка: не удалось обработать данные как JSON. ${e.message}</p>`;
        }
    } else {
        return `<p class="error-message">Ошибка: неподдерживаемый формат данных (тип: ${typeof rawData}).</p>`;
    }

    return renderPcBuildHtml(dataObject);
}

/**
 * Рендерит HTML-сборку ПК из JSON-объекта по заданному шаблону.
 * @param {Object} data — JSON объект.
 * @returns {string} — HTML сборки.
 */
function renderPcBuildHtml(data) {
    if (typeof data !== 'object' || data === null) {
        return '<p class="error-message">Ошибка: данные для рендеринга не являются объектом.</p>';
    }

    let html = '';

    // 1. Название сборки (title) -> H1
    if (data.title) {
        html += `<h1>${escapeHtml(data.title)}</h1>`;
    }

    // 2. description -> div.description
    if (data.description) {
        html += `<div class="description">${escapeHtml(data.description)}</div>`;
    }

    // 3. Компоненты -> section > article.component
    // ▼▼▼▼▼ ИЗМЕНЕНИЕ ЗДЕСЬ ▼▼▼▼▼
    if (Array.isArray(data.components)) { // БЫЛО: data.products
        let componentsHtml = '';
        data.components.forEach((product, index) => { // БЫЛО: data.products
            const name = product.component_name || 'Компонент';
            const desc = product.component_description || '';
            const spec = product.component_specification || '';
            const imgUrl = product.component_image || 'https://via.placeholder.com/180';

            // ИСПРАВЛЕНО: Спецификации теперь могут быть объектом, преобразуем в строку
            let specString = '';
            if (typeof spec === 'object' && spec !== null) {
                specString = Object.entries(spec)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('; ');
            } else if (spec) {
                specString = Array.isArray(spec) ? spec.join('; ') : String(spec);
            }

            componentsHtml += `
                <article class="component" id="component-${index + 1}">
                    <h2>${escapeHtml(name)}</h2>
                    <div class="component-row">
                        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)}">
                        <div class="component-body">
                            <p>${escapeHtml(desc)}</p>
                            <div class="spec">${escapeHtml(specString)}</div>
                        </div>
                    </div>
                </article>
            `;
        });
        html += `<section aria-label="Components">${componentsHtml}</section>`;
    }
    // ▲▲▲▲▲ КОНЕЦ ИЗМЕНЕНИЯ ▲▲▲▲▲

    return html;
}

/**
 * Безопасное экранирование HTML-тегов.
 * @param {string} text — исходный текст.
 * @returns {string} — безопасный HTML.
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.parseResponseToHtml = parseResponseToHtml;