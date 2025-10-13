// preview-offer.js
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    try {
        // Получаем компоненты для отображения
        const storageResult = await chrome.storage.local.get('componentsForOffer');
        const componentsForOffer = storageResult.componentsForOffer ?? [];

        console.log('Loaded componentsForOffer:', componentsForOffer); // для отладки

        if (!componentsForOffer.length) {
            container.innerHTML = '<p>Нет компонентов для отображения.</p>';
            return;
        }

        // Выводим каждый компонент
        componentsForOffer.forEach(c => {
            // Преобразуем объект в JSON для alert
            alert(JSON.stringify(c, null, 2));

            const div = document.createElement('div');
            div.className = 'component';

            const title = document.createElement('h3');
            title.textContent = c.name ?? 'Без имени';

            const description = document.createElement('p');
            description.textContent = c.data?.description ?? 'Описание отсутствует';

            div.appendChild(title);
            div.appendChild(description);
            container.appendChild(div);
        });
    } catch (ex) {
        console.error('Ошибка при загрузке компонентов', ex);
        container.innerHTML = '<p>Произошла ошибка при загрузке компонентов.</p>';
    }
});
