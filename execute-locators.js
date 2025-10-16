// execute-locators.js

/**
    * Вспомогательные функции для извлечения данных по локаторам
*/

function getElementValue(locator) {
    const { by, selector, attribute, if_list, mandatory, locator_description } = locator;
    let elements = [];

    try {
        if (by === 'XPATH') {
            const iterator = document.evaluate(
                selector,
                document,
                null,
                XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                null
            );
            let node = iterator.iterateNext();
            while (node) {
                elements.push(node);
                node = iterator.iterateNext();
            }
        } else if (by === 'ID') {
            const el = document.getElementById(selector);
            if (el) elements.push(el);
        } else if (by === 'CLASS') {
            elements = Array.from(document.getElementsByClassName(selector));
        } else if (by === 'CSS_SELECTOR') {
            elements = Array.from(document.querySelectorAll(selector));
        }

        if (!elements.length) {
            if (mandatory) console.error(`Обязательный локатор не найден: ${locator_description}`);
            return if_list === 'all' ? [] : null;
        }

        if (if_list === 'all') {
            return elements.map(el => el[attribute] ?? el.getAttribute(attribute));
        } else {
            return elements[0][attribute] ?? elements[0].getAttribute(attribute);
        }

    } catch (ex) {
        console.error(`Ошибка извлечения локатора ${locator_description}:`, ex);
        return if_list === 'all' ? [] : null;
    }
}

function executeLocators(locators) {
    const result = {};
    for (const key in locators) {
        result[key] = getElementValue(locators[key]);
    }
    return result;
}

// Делаем доступными в глобальной области для background.js
window.executeLocators = executeLocators;
window.getElementValue = getElementValue;