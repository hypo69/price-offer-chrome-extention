document.addEventListener('DOMContentLoaded', async () => {
    const { componentsForOffer = [] } = await chrome.storage.local.get('componentsForOffer');
    const container = document.getElementById('componentsContainer');

    container.innerHTML = '';
    componentsForOffer.forEach(c => {
        const div = document.createElement('div');
        div.textContent = c.name;
        container.appendChild(div);
    });
});
