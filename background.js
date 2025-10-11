async function saveAssembly(assembly) {
    try {
        await chrome.storage.local.set({ assembly });
        console.log("Assembly saved", assembly);
    } catch (e) {
        console.error("Failed to save assembly", e);
    }
}

chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.removeAll();

    const title = chrome.i18n.getMessage('contextMenuTitle') || 'Generate Price Offer';

    chrome.contextMenus.create({
        id: "generate-offer",
        title,
        contexts: ["page"]
    });

    let assembly = { products: [] };
    try {
        const stored = await chrome.storage.local.get("assembly");
        if (stored.assembly) {
            assembly = stored.assembly;
        } else {
            await saveAssembly(assembly);
        }
    } catch (e) {
        console.error("Failed to access assembly", e);
        await saveAssembly(assembly);
    }

    let products = [];
    try {
        const resp = await fetch(chrome.runtime.getURL('data/products.json'));
        const data = await resp.json();
        products = data.ru?.products || [];
    } catch (e) {
        console.warn('products.json is missing or invalid', e);
    }

    for (const product of products) {
        chrome.contextMenus.create({
            id: `product-${product.product_id}`,
            parentId: "generate-offer",
            title: product.product_name,
            contexts: ["page"]
        });

        chrome.contextMenus.create({
            id: `delete-${product.product_id}`,
            parentId: `product-${product.product_id}`,
            title: '❌ Remove',
            contexts: ["page"]
        });
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('file://')) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Price Offer Generator',
            message: 'This action is not supported on internal or local pages.'
        });
        return;
    }

    const id = info.menuItemId;

    if (id.startsWith('delete-')) {
        const productId = id.replace('delete-', '');
        chrome.storage.local.get("assembly", (stored) => {
            let assembly = stored.assembly || { products: [] };
            assembly.products = assembly.products.filter(p => p.product_id !== productId);
            chrome.storage.local.set({ assembly }, () => {
                console.log(`Product ${productId} removed from assembly`);
            });
        });
    } else if (id.startsWith('product-')) {
        chrome.tabs.sendMessage(tab.id, { action: "generateOffer", productId: id.replace('product-', '') }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Content script not available:", chrome.runtime.lastError.message);
            }
        });
    } else if (id === 'generate-offer') {
        chrome.tabs.sendMessage(tab.id, { action: "generateOfferAll" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Content script not available:", chrome.runtime.lastError.message);
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openChat") {
        chrome.tabs.create({ url: chrome.runtime.getURL("chat.html") });
    } else if (request.action === "openResult") {
        chrome.tabs.create({ url: chrome.runtime.getURL("result.html") });
    }
});

// Открытие popup как вкладки по клику на иконку
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});