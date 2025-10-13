// popup.js

document.addEventListener("DOMContentLoaded", async () => {
    // Загружаем сохраненную модель
    const { geminiModel, geminiApiKey } = await chrome.storage.sync.get(['geminiModel', 'geminiApiKey']);
    if (geminiModel) {
        document.getElementById('model').value = geminiModel;
    }
    // Загружаем сохраненный ключ
    if (geminiApiKey) {
        document.getElementById('apiKey').value = geminiApiKey;
    }

    // НОВЫЙ ОБРАБОТЧИК для кнопки логов
    document.getElementById('openLogs').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
    });
});

document.getElementById('save').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;
    if (!apiKey) {
        alert("Пожалуйста, введите API ключ");
        return;
    }
    await chrome.storage.sync.set({ geminiApiKey: apiKey, geminiModel: model });

    // Сообщаем пользователю об успехе
    const saveButton = document.getElementById('save');
    saveButton.textContent = 'Сохранено!';
    setTimeout(() => {
        saveButton.textContent = 'Сохранить';
        window.close();
    }, 1000);
});
// popup.js
import './execute_locators.js';

document.getElementById('extractBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const hostname = url.hostname.replace(/^www\./, "");
    const locatorPath = `locators/${hostname}.json`;

    try {
        const response = await fetch(chrome.runtime.getURL(locatorPath));
        if (!response.ok) throw new Error(`Cannot load locators for ${hostname}`);
        const locators = await response.json();

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (locators) => {
                // вставляем сюда функцию executeLocators из execute_locators.js
                function getElementValue(locator) {
                    const { by, selector, attribute, if_list, mandatory, locator_description } = locator;
                    let elements = [];

                    try {
                        if (by === "XPATH") {
                            const iterator = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                            let node = iterator.iterateNext();
                            while (node) {
                                elements.push(node);
                                node = iterator.iterateNext();
                            }
                        } else if (by === "ID") {
                            const el = document.getElementById(selector);
                            if (el) elements.push(el);
                        } else if (by === "CLASS") {
                            const els = document.getElementsByClassName(selector);
                            elements = Array.from(els);
                        } else if (by === "CSS_SELECTOR") {
                            const els = document.querySelectorAll(selector);
                            elements = Array.from(els);
                        }

                        if (!elements.length) {
                            if (mandatory) console.error(`Mandatory locator not found: ${locator_description}`);
                            return if_list === "all" ? [] : null;
                        }

                        if (if_list === "all") {
                            return elements.map(el => el[attribute] ?? el.getAttribute(attribute));
                        } else {
                            const el = elements[0];
                            return el[attribute] ?? el.getAttribute(attribute);
                        }
                    } catch (e) {
                        console.error(`Error extracting locator ${locator_description}:`, e);
                        return if_list === "all" ? [] : null;
                    }
                }

                function executeLocators(locators) {
                    const result = {};
                    for (const key in locators) {
                        result[key] = getElementValue(locators[key]);
                    }
                    return result;
                }

                return executeLocators(locators);
            },
            args: [locators]
        }, (results) => {
            if (results && results[0]?.result) {
                const data = results[0].result;

                //// Форматированный alert
                //let message = '';
                //for (const key in data) {
                //    if (Array.isArray(data[key])) {
                //        message += `${key}: ${data[key].join(', ')}\n`;
                //    } else {
                //        message += `${key}: ${data[key]}\n`;
                //    }
                //}
                //alert(message);

                // Также выводим в div
                document.getElementById('output').textContent = JSON.stringify(data, null, 2);
            } else {
                document.getElementById('output').textContent = 'No elements found';
            }
        });

    } catch (e) {
        console.error(e);
        document.getElementById('output').textContent = `Error loading locators: ${e.message}`;
    }
});
