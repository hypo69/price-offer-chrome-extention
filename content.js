// content.js
window.__gemini_content_script_loaded = true;

let __geminiIndicator = null;

function showIndicator(text) {
    hideIndicator();
    __geminiIndicator = document.createElement("div");
    __geminiIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 16px;
    `;
    __geminiIndicator.textContent = text;
    document.body.appendChild(__geminiIndicator);
}

function hideIndicator() {
    if (__geminiIndicator && __geminiIndicator.parentNode) {
        __geminiIndicator.parentNode.removeChild(__geminiIndicator);
        __geminiIndicator = null;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "generateOffer" || request.action === "generateOfferAll") {
        showIndicator("Формируется предложение...");

        setTimeout(() => {
            hideIndicator();
            alert("Предложение сформировано!");
        }, 2000);
    }
});

console.log("🟢 Content script loaded");


// content.js

// Маркер загрузки
window.__gemini_content_script_loaded = true;

let __geminiIndicator = null;
let __geminiModal = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showIndicator") {
        showIndicator(request.message || "Обрабатываю...");
        sendResponse({ status: "shown" });
    } else if (request.action === "hideIndicator") {
        hideIndicator();
        sendResponse({ status: "hidden" });
    } else if (request.action === "showSummary") {
        showSummary(request.summary);
        sendResponse({ status: "shown" });
    } else if (request.action === "showError") {
        showError(request.message);
        sendResponse({ status: "shown" });
    }
});

function showIndicator(text) {
    hideIndicator();
    __geminiIndicator = document.createElement("div");
    __geminiIndicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.88);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 320px;
    text-align: center;
    pointer-events: none;
  `;
    __geminiIndicator.textContent = text;
    document.body.appendChild(__geminiIndicator);
}

function hideIndicator() {
    if (__geminiIndicator && __geminiIndicator.parentNode) {
        __geminiIndicator.parentNode.removeChild(__geminiIndicator);
        __geminiIndicator = null;
    }
}

function showError(message) {
    showIndicator(message);
    setTimeout(hideIndicator, 4000);
}

function showSummary(summary) {
    if (__geminiModal) return;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    z-index: 2147483646;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    box-sizing: border-box;
  `;

    const modal = document.createElement("div");
    modal.style.cssText = `
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    overflow: hidden;
  `;

    const header = document.createElement("div");
    header.style.cssText = `
    padding: 16px 20px;
    background: #f8f9fa;
    font-weight: bold;
    font-size: 18px;
    color: #212529;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
    header.innerHTML = `<span>Короче!</span><button id="__gemini_close__" style="background:none;border:none;font-size:24px;cursor:pointer;color:#6c757d;">&times;</button>`;

    // Тело — конвертируем Markdown в HTML
    const body = document.createElement("div");
    body.style.cssText = `
    padding: 20px;
    font-family: system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: #212529;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  `;

    // Простая конвертация Markdown → HTML
    const html = markdownToHtml(summary);

    // Вставляем HTML
    body.innerHTML = html;

    // Кнопка "Больше"
    const moreButton = document.createElement("button");
    moreButton.textContent = "Больше";
    moreButton.style.cssText = `
    margin-top: 15px;
    padding: 10px 20px;
    background: #34a853;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 15px;
    align-self: flex-end;
  `;
    moreButton.onclick = () => {
        chrome.runtime.sendMessage({ action: "openChat" });
    };

    // Сборка
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(moreButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    __geminiModal = overlay;

    // Закрытие по крестику
    document.getElementById("__gemini_close__").onclick = closeSummary;
    // Закрытие по фону
    overlay.onclick = (e) => { if (e.target === overlay) closeSummary(); };
    // Закрытие по Esc
    const handleEsc = (e) => { if (e.key === "Escape") closeSummary(); };
    document.addEventListener("keydown", handleEsc);

    function closeSummary() {
        if (__geminiModal && __geminiModal.parentNode) {
            __geminiModal.parentNode.removeChild(__geminiModal);
            __geminiModal = null;
            document.removeEventListener("keydown", handleEsc);
        }
    }
}

// Простой конвертер Markdown → HTML (поддерживает код, списки, заголовки)
function markdownToHtml(md) {
    let html = md;

    // Заголовки
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Жирный шрифт
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Курсив
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Код (одиночные ` и блоки ``` )
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Списки
    html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/<li>([\s\S]*?)<\/li>/g, '<ul>$&</ul>');
    html = html.replace(/<ul>\s*<li>/g, '<ul><li>');
    html = html.replace(/<\/li>\s*<\/ul>/g, '</li></ul>');

    // Параграфы
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = `<p>${html}</p>`;

    // Убираем лишние теги
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p><\/p>/g, '');

    return html;
}