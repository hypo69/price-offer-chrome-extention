chrome.storage.local.get(['lastOffer'], (res) => {
    const data = res.lastOffer || { error: "Нет данных" };
    document.getElementById('result').textContent = JSON.stringify(data, null, 2);
});

document.getElementById('copy').addEventListener('click', () => {
    const el = document.getElementById('result');
    navigator.clipboard.writeText(el.textContent).then(() => {
        const btn = document.getElementById('copy');
        const original = btn.textContent;
        btn.textContent = 'Скопировано!';
        setTimeout(() => btn.textContent = original, 1500);
    });
});