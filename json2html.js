// html2json.js
// -*- coding: utf-8 -*-
/**
 * Парсит строку от модели и возвращает HTML:
 * - Если строка содержит JSON → рендерит сборку ПК по шаблону
 * - Если строка содержит HTML → возвращает как есть
 */

/**
 * Основная функция: обрабатывает входную строку и возвращает готовый HTML
 * @param {string} rawString — строка от Gemini (может быть в блоке ```json или ```html)
 * @returns {string} — HTML для вставки в DOM
 */
function parseResponseToHtml(rawString) {
    if (!rawString || typeof rawString !== 'string') {
        return '<p>Ошибка: пустой ответ.</p>';
    }

    // Удаляем markdown fencing: ```json, ```html, ```
    let cleaned = rawString.trim();
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

    // Проверяем: это JSON?
    try {
        const data = JSON.parse(cleaned);
        return renderPcBuildHtml(data);
    } catch (e) {
        // Не JSON и не HTML → выводим как текст
        const div = document.createElement('div');
        div.textContent = cleaned;
        return div.innerHTML;
    }
}

/**
 * Рендерит HTML-сборку ПК из JSON-объекта
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

    // Компоненты (components)
    if (Array.isArray(data.components)) {
        data.components.forEach(component => {
            const name = component.component_name || 'Компонент';
            const desc = component.component_description || '';
            const spec = component.component_specification || '';
            // Используем component_image, убираем лишние пробелы
            const imgUrl = (component.component_image || 'https://www.ivory.co.il/files/catalog/org/1722153921d21Qx.webp').trim();

            html += `<article class="component">`;
            html += `<h2>${escapeHtml(name)}</h2>`;
            html += `<div class="component-row">`;
            html += `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)}">`;
            html += `<div class="component-body">`;
            html += `<p>${escapeHtml(desc)}</p>`;

            if (spec) {
                html += parseSpecGrid(spec);
            }

            html += `</div></div></article>`;
        });
    }

    return html;
}

/**
 * Парсит строку спецификаций вида "Ключ: Значение; ..." → HTML .spec-grid
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
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return String(text);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Экспорт в глобальную область
window.parseResponseToHtml = parseResponseToHtml;