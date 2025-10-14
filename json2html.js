// json2html.js
// \file json2html.js
// -*- coding: utf-8 -*-

/**
 * Вспомогательные функции для отображения JSON в HTML
 */

function json2html(json, level = 0, showKeys = true) {
    const indent = level * 20;

    if (json === null) return '<span class="json-null">null</span>';
    if (typeof json === 'boolean') return `<span class="json-boolean">${json}</span>`;
    if (typeof json === 'number') return `<span class="json-number">${json}</span>`;
    if (typeof json === 'string') {
        const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
