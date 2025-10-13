// execute_locators.js

/**
 * ! Извлекает значение элемента по локатору
 *
 * @param {Object} locator - Один локатор из JSON
 * @param {string} locator.by - Стратегия поиска: XPATH, ID, CLASS, CSS_SELECTOR
 * @param {string} locator.selector - Селектор элемента
 * @param {string} locator.attribute - Атрибут для извлечения (innerText, value и т.д.)
 * @param {string} locator.if_list - "first" или "all" для множественных элементов
 * @param {boolean} locator.mandatory - Обязательный элемент или нет
 * @param {string} locator.locator_description - Описание локатора для логов
 *
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
 * ! Возвращает объект с title, description, specification и image_url
 *
 * @param {Object} locators - JSON с локаторами
 * @returns {Object} - { title, description, specification, image_url }
 */
function executeLocators(locators) {
    const result = {};
    for (const key of ["title", "description", "specification", "image_url"]) {
        if (locators[key]) {
            result[key] = getElementValue(locators[key]);
        } else {
            result[key] = null;
        }
    }
    return result;
}
