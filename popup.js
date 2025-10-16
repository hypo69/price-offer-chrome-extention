// popup.js
// \file popup.js
// -*- coding: utf-8 -*-

/**
 * Модуль управления настройками расширения
 * =========================================
 * Интерфейс для установки API ключа и выбора модели
 */

/**
 * Инициализация popup при загрузке
 * Функция загружает сохраненные настройки
 */
document.addEventListener('DOMContentLoaded', async () => {
    const { geminiModel, geminiApiKey } = await chrome.storage.sync.get(['geminiModel', 'geminiApiKey']);

    if (geminiModel) {
        document.getElementById('model').value = geminiModel;
    }

    if (geminiApiKey) {
        document.getElementById('apiKey').value = geminiApiKey;
    }

    // Обработчик для кнопки логов
    document.getElementById('openLogs').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
    });

    // Обработчик сохранения настроек
    document.getElementById('save').addEventListener('click', async () => {
        const apiKey = document.getElementById('apiKey').value.trim();
        const model = document.getElementById('model').value;

        if (!apiKey) {
            alert('Пожалуйста, введите API ключ');
            return;
        }

        await chrome.storage.sync.set({ geminiApiKey: apiKey, geminiModel: model });

        const saveButton = document.getElementById('save');
        saveButton.textContent = 'Сохранено!';

        setTimeout(() => {
            saveButton.textContent = 'Сохранить';
            window.close();
        }, 1000);
    });
});