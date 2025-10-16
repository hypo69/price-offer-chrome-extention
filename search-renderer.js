// search-renderer.js
// \file search-renderer.js
// -*- coding: utf-8 -*-

/**
 * Модуль рендеринга результатов поиска (search-result.html)
 * =========================================================
 * Загружает данные из chrome.storage.local и отображает их.
 */

const container = document.getElementById('resultsContainer');
const queryDisplay = document.getElementById('queryDisplay');

/**
 * Отображает результат поиска, форматируя JSON.
 * @param {Object} data - Объект с данными, полученными от Gemini.
 */
function renderResults(data) {
    if (!data) {
        container.innerHTML = '<p class="error-message">Ошибка: Не удалось загрузить данные поиска.</p>';
        return;
    }

    let html = '<h2>Ответ от Gemini (JSON)</h2>';

    // Форматирование JSON для удобного чтения
    html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';

    // Если ответ содержит ключевые поля (например, list)
    if (data.list && Array.isArray(data.list) && data.list.length > 0) {
        html += '<h2>Найденные компоненты</h2>';
        data.list.forEach(item => {
            html += `<div class="result-block">`;
            html += `<h3>${item.title || 'Компонент без названия'}</h3>`;
            html += `<p><strong>Категория:</strong> ${item.category || 'N/A'}</p>`;
            html += `<p><strong>Релевантность:</strong> ${item.relevance_score || 'N/A'}</p>`;
            if (item.short_description) {
                html += `<p><strong>Описание:</strong> ${item.short_description}</p>`;
            }
            html += `</div>`;
        });
    } else if (data.list && data.list.length === 0) {
        html += '<p>Поиск не дал результатов. Проверьте запрос.</p>';
    } else if (data.error_message) {
        html += `<p class="error-message">Сообщение об ошибке: ${data.error_message}</p>`;
    }

    container.innerHTML = html;
}

/**
 * Инициализация страницы. Загружает данные из storage.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await chrome.storage.local.get(['latestSearchResult', 'searchQuery']);

        const query = result.searchQuery || 'Неизвестный запрос';
        const searchData = result.latestSearchResult;

        queryDisplay.textContent = `Запрос: "${query}"`;

        if (searchData) {
            renderResults(searchData);
        } else {
            container.innerHTML = '<p class="error-message">Не удалось найти последние результаты поиска в хранилище.</p>';
        }

        // Очистка временных данных
        await chrome.storage.local.remove(['latestSearchResult', 'searchQuery']);

    } catch (ex) {
        container.innerHTML = `<p class="error-message">Критическая ошибка загрузки данных: ${ex.message}</p>`;
    }
});