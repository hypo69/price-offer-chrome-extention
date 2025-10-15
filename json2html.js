// json2html.js
// -*- coding: utf-8 -*-
/**
 * Парсит строку от модели и возвращает HTML:
 * - Если строка содержит JSON → рендерит сборку ПК по шаблону
 * - Если строка содержит HTML → возвращает как есть
 */

/**
 * Основная функция: обрабатывает входные данные и возвращает готовый HTML
 * @param {string|Object} rawData — строка от Gemini или уже распарсенный JSON-объект
 * @returns {string} — HTML для вставки в DOM
 */
function parseResponseToHtml(rawData) {
    // ИСПРАВЛЕНО: Теперь функция может принимать и строки, и объекты.
    if (!rawData) {
        return '<p>Ошибка: пустой ответ.</p>';
    }

    let cleaned;
    let data;

    // Если на вход пришла строка, обрабатываем ее
    if (typeof rawData === 'string') {
        // Удаляем markdown fencing: ```json, ```html, ```
        cleaned = rawData.trim();
        if (cleaned.startsWith('```')) {
            const firstNewline = cleaned.indexOf('\n');
            if (firstNewline !== -1) {
                cleaned = cleaned.substring(firstNewline + 1);
            }
            cleaned = cleaned.replace(/```$/, '').trim();
        }

        // Проверяем: это HTML?
        if (/<[a-z][\s\S]*>/i.test(cleaned)) {
            return cleaned; // Возвращаем как есть
        }

        // Пытаемся распарсить как JSON
        try {
            data = JSON.parse(cleaned);
        } catch (e) {
            // Не JSON и не HTML → выводим как текст
            const div = document.createElement('div');
            div.textContent = cleaned;
            return div.innerHTML;
        }
    } else if (typeof rawData === 'object') {
        // Если на вход сразу пришел объект, используем его
        data = rawData;
    } else {
        return '<p>Ошибка: неверный формат данных.</p>';
    }

    // Если у нас есть объект `data`, рендерим его в HTML
    return renderPcBuildHtml(data);
}

/**
 * Рендерит HTML-сборку ПК из JSON-объекта
 * @param {Object} data — JSON объект с полями title, description, products
 * @returns {string} — HTML сборки
 */
function renderPcBuildHtml(data) {
    let html = '';

    // Заголовок
    if (data.title) {
        html += `<h1 class="offer-title">${escapeHtml(data.title)}</h1>`;
    }

    // Описание
    if (data.description) {
        html += `<div class="description"><p>${escapeHtml(data.description)}</p></div>`;
    }

    // Компоненты (products)
    if (Array.isArray(data.products)) {
        data.products.forEach(product => {
            const name = product.product_name || 'Компонент';
            const desc = product.product_description || '';
            const spec = product.product_specification || '';
            // Используем изображение из данных, если оно есть, иначе заглушку
            const imgUrl = product.component_image || 'https://www.ivory.co.il/files/catalog/org/1722153921d21Qx.webp';

            html += `<article class="component">`;
            html += `<h2>${escapeHtml(name)}</h2>`;
            html += `<div class="component-row">`;
            html += `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)}">`;
            html += `<div class="component-body">`;
            html += `<p>${escapeHtml(desc)}</p>`;

            if (spec) {
                // ИСПРАВЛЕНО: Спецификации теперь могут быть массивом
                const specString = Array.isArray(spec) ? spec.join('; ') : spec;
                html += parseSpecGrid(specString);
            }

            html += `</div></div></article>`;
        });
    }

    return html;
}

/**
 * Парсит строку спецификаций вида "Ключ: Значение; ..." → HTML .spec-grid
 * @param {string} specString — строка спецификаций
 * @returns {string} — HTML сетка спецификаций
 */
function parseSpecGrid(specString) {
    const pairs = specString
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (pairs.length === 0) return '';

    let grid = '<div class="spec-grid">';
    pairs.forEach(pair => {
        const colonIndex = pair.indexOf(':');
        if (colonIndex === -1) {
            grid += `<div>—</div><div>${escapeHtml(pair)}</div>`;
        } else {
            const key = pair.substring(0, colonIndex).trim();
            const value = pair.substring(colonIndex + 1).trim();
            grid += `<div>${escapeHtml(key)}</div><div>${escapeHtml(value)}</div>`;
        }
    });
    grid += '</div>';
    return grid;
}

/**
 * Экранирование HTML (безопасно!)
 * @param {string} text — исходный текст
 * @returns {string} — безопасный HTML
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

// Экспорт в глобальную область
window.parseResponseToHtml = parseResponseToHtml;