// execute-locators.js

/**
 * ! Извлекает значение элемента по локатору
 *
 * @param {Object} locator - Один локатор из JSON
 * @returns {string|string[]|null} - Значение элемента или массив значений
 */
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

/**
 * ! Возвращает объект со всеми извлеченными данными
 *
 * @param {Object} locators - JSON с локаторами
 * @returns {Object} - Объект с извлеченными данными
 */
function executeLocators(locators) {
    const result = {};
    // --- ИСПРАВЛЕНИЕ: Перебираем все ключи, а не только предопределенные ---
    for (const key in locators) {
        // Проверяем, что это ключ самого объекта, а не прототипа
        if (Object.prototype.hasOwnProperty.call(locators, key)) {
            result[key] = getElementValue(locators[key]);
        }
    }
    return result;
}