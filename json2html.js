// json2html.js
// -*- coding: utf-8 -*-
/**
 * Универсальный парсер ответа от модели.
 * Поддерживает чистый JSON, чистый HTML и блоки ```json / ```html.
 */

/**
 * Основная функция
 */
function parseResponseToHtml(rawString) {
    if (!rawString || typeof rawString !== 'string') {
        return '<p>Ошибка: пустой ответ.</p>';
    }

    // Удаляем обёртки ```json, ```html, ```
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
        return cleaned;
    }

    // Проверяем: это JSON?
    try {
        const data = JSON.parse(cleaned);
        return renderPcBuildHtml(data);
    } catch (e) {
        // Не JSON → выводим как текст
        const div = document.createElement('div');
        div.textContent = cleaned;
        return div.innerHTML;
    }
}

/**
 * Рендерит сборку ПК по шаблону
 */
function renderPcBuildHtml(data) {
    let html = '';

    if (data.title) {
        html += `<h1 class="offer-title">${escapeHtml(data.title)}</h1>`;
    }

    if (data.description) {
        html += `<div class="description"><p>${escapeHtml(data.description)}</p></div>`;
    }

    if (Array.isArray(data.components)) {
        data.components.forEach(component => {
            const name = component.component_name || 'Компонент';
            const desc = component.component_description || '';
            const spec = component.component_specification || [];
            const imgUrl = (component.component_image || 'https://www.ivory.co.il/files/catalog/org/1722153921d21Qx.webp').trim();

            html += `<article class="component">`;
            html += `<h2>${escapeHtml(name)}</h2>`;
            html += `<div class="component-row">`;
            html += `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(name)}">`;
            html += `<div class="component-body">`;
            html += `<p>${escapeHtml(desc)}</p>`;

            if (Array.isArray(spec) && spec.length > 0) {
                html += parseSpecGridFromArray(spec);
            }

            html += `</div></div></article>`;
        });
    }

    return html;
}

/**
 * Парсит массив строк ["Ключ: Значение;", ...] → .spec-grid
 */
function parseSpecGridFromArray(specArray) {
    let grid = '<div class="spec-grid">';
    specArray.forEach(item => {
        let pair = item.trim().replace(/;$/, '');
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

// Экспорт
window.parseResponseToHtml = parseResponseToHtml;

// Старая функция для отладки (остаётся)
function json2html(json, level = 0, showKeys = true) {
    const indent = level * 20;
    if (json === null) return '<span class="json-null">null</span>';
    if (typeof json === 'boolean') return `<span class="json-boolean">${json}</span>`;
    if (typeof json === 'number') return `<span class="json-number">${json}</span>`;
    if (typeof json === 'string') {
        const escaped = json.replace(/&/g, '&amp;').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '&quot;');
        return `<span class="json-string">"${escaped}"</span>`;
    }
    if (Array.isArray(json)) {
        if (json.length === 0) return '<span class="json-bracket">[]</span>';
        let html = '<div class="json-array"><span class="json-bracket">[</span>';
        json.forEach((item, index) => {
            html += `<div class="json-item" style="margin-left:${indent + 20}px;">`;
            html += json2html(item, level + 1, showKeys);
            if (index < json.length - 1) html += '<span class="json-comma">,</span>';
            html += '</div>';
        });
        html += `<div style="margin-left:${indent}px;"><span class="json-bracket">]</span></div></div>`;
        return html;
    }
    if (typeof json === 'object') {
        const keys = Object.keys(json);
        if (keys.length === 0) return '<span class="json-bracket">{}</span>';
        let html = '<div class="json-object"><span class="json-bracket">{</span>';
        keys.forEach((key, index) => {
            html += `<div class="json-property" style="margin-left:${indent + 20}px;">`;
            if (showKeys) html += `<span class="json-key">"${key}"</span><span class="json-colon">: </span>`;
            html += json2html(json[key], level + 1, showKeys);
            if (index < keys.length - 1) html += '<span class="json-comma">,</span>';
            html += '</div>';
        });
        html += `<div style="margin-left:${indent}px;"><span class="json-bracket">}</span></div></div>`;
        return html;
    }
    return String(json);
}
window.json2html = json2html;