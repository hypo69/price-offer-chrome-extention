// content.js
if (window.__gemini_content_script_loaded) return;
window.__gemini_content_script_loaded = true;

// Используем var, чтобы избежать SyntaxError при повторном внедрении скрипта
var __geminiIndicator = null;
var __geminiModal = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showSummary") {
        showSummary(request.summary);
    }
});

function showSummary(summary) {
    if (__geminiModal) return;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.6);
        z-index: 2147483646;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        width: 100%;
        max-width: 600px;
        max-height: 80vh;
        padding: 20px;
        font-family: system-ui, sans-serif;
        overflow: auto;
    `;
    modal.textContent = summary;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        if (__geminiModal.parentNode) __geminiModal.parentNode.removeChild(__geminiModal);
        __geminiModal = null;
    };

    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    __geminiModal = overlay;

    overlay.onclick = (e) => { if (e.target === overlay) closeBtn.click(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBtn.click(); });
}