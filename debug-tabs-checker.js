// debug-tabs-checker.js
// \file debug-tabs-checker.js
// -*- coding: utf-8 -*-

/
 * Отладочный модуль для диагностики проблемы множественного открытия вкладок
 * ==========================================================================
 * Этот скрипт можно выполнить в консоли background.js для проверки состояния
 */

/
 * Проверка всех открытых вкладок preview-offer.html
 */
async function checkPreviewTabs() {
    const previewUrl = chrome.runtime.getURL('preview-offer.html');
    const tabs = await chrome.tabs.query({ url: previewUrl });

    console.log('=== ПРОВЕРКА ВКЛАДОК PREVIEW-OFFER ===');
    console.log(`Найдено вкладок: ${tabs.length}`);

    if (tabs.length > 0) {
        console.log('Список вкладок:');
        tabs.forEach((tab, index) => {
            console.log(`  ${index + 1}. Tab ID: ${tab.id}, Window ID: ${tab.windowId}, Active: ${tab.active}`);
        });
    }

    return tabs;
}

/
 * Проверка состояния флагов
 */
function checkFlags() {
    console.log('=== ПРОВЕРКА ФЛАГОВ ===');

    if (typeof HandlerState !== 'undefined') {
        console.log('HandlerState:', {
            isOpeningPreviewTab: HandlerState.isOpeningPreviewTab,
            hasPromise: !!HandlerState.previewTabCheckPromise
        });
    } else {
        console.log('HandlerState не определен');
    }

    if (typeof menuClickInProgress !== 'undefined') {
        console.log('menuClickInProgress:', menuClickInProgress);
    } else {
        console.log('menuClickInProgress не определен');
    }
}

/
 * Проверка слушателей событий
 */
function checkEventListeners() {
    console.log('=== ПРОВЕРКА СЛУШАТЕЛЕЙ СОБЫТИЙ ===');

    // Проверка количества слушателей contextMenus.onClicked
    if (chrome.contextMenus.onClicked.hasListeners()) {
        console.log('✓ contextMenus.onClicked имеет слушателей');
    } else {
        console.log('✗ contextMenus.onClicked НЕ имеет слушателей');
    }
}

/
 * Закрытие всех дублирующих вкладок preview-offer
 */
async function closeAllPreviewTabs() {
    const tabs = await checkPreviewTabs();

    if (tabs.length <= 1) {
        console.log('Дублирующих вкладок не найдено');
        return;
    }

    console.log(`Закрытие ${tabs.length - 1} дублирующих вкладок...`);

    for (let i = 1; i < tabs.length; i++) {
        await chrome.tabs.remove(tabs[i].id);
        console.log(`Закрыта вкладка ${tabs[i].id}`);
    }

    console.log('Все дублирующие вкладки закрыты');
}

/
 * Полная диагностика
 */
async function fullDiagnostic() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ПОЛНАЯ ДИАГНОСТИКА РАСШИРЕНИЯ           ║');
    console.log('╚════════════════════════════════════════════╝\n');

    await checkPreviewTabs();
    console.log('');
    checkFlags();
    console.log('');
    checkEventListeners();
    console.log('');

    // Проверка storage
    const storage = await chrome.storage.local.get([
        'addedComponents',
        'componentsForOffer',
        'previewOfferTabId'
    ]);

    console.log('=== ПРОВЕРКА STORAGE ===');
    console.log('addedComponents:', storage.addedComponents?.length || 0);
    console.log('componentsForOffer:', storage.componentsForOffer?.length || 0);
    console.log('previewOfferTabId:', storage.previewOfferTabId);

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ДИАГНОСТИКА ЗАВЕРШЕНА                   ║');
    console.log('╚════════════════════════════════════════════╝\n');
}

/
 * Сброс всех флагов принудительно
 */
function resetAllFlags() {
    console.log('Принудительный сброс всех флагов...');

    if (typeof HandlerState !== 'undefined') {
        HandlerState.isOpeningPreviewTab = false;
        HandlerState.previewTabCheckPromise = null;
        console.log('✓ HandlerState сброшен');
    }

    if (typeof menuClickInProgress !== 'undefined') {
        menuClickInProgress = false;
        console.log('✓ menuClickInProgress сброшен');
    }

    console.log('Все флаги сброшены');
}

// Экспорт функций для использования в консоли
console.log('\n╔════════════════════════════════════════════╗');
console.log('║   ОТЛАДОЧНЫЕ КОМАНДЫ ДОСТУПНЫ             ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');
console.log('Доступные команды:');
console.log('  - fullDiagnostic()      : Полная диагностика');
console.log('  - checkPreviewTabs()    : Проверка вкладок preview-offer');
console.log('  - checkFlags()          : Проверка флагов');
console.log('  - closeAllPreviewTabs() : Закрыть все дублирующие вкладки');
console.log('  - resetAllFlags()       : Сброс всех флагов');
console.log('');