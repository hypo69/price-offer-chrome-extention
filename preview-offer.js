// preview-offer.js

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('componentsContainer');

    try {
        const storageResult = await chrome.storage.local.get('componentsForOffer');
        const componentsForOffer = storageResult.componentsForOffer ?? [];

        if (!componentsForOffer.length) {
            container.innerHTML = '<p>Нет компонентов для отображения.</p>';
            return;
        }

        // Собираем все компоненты в один JSON
        const combinedJSON = componentsForOffer.map(c => ({
            id: c.id ?? null,
            name: c.name ?? 'Без имени',
            data: c.data ?? {}
        }));

        // Для отладки выводим весь JSON
        console.log('Combined JSON:', combinedJSON);
        alert(JSON.stringify(combinedJSON, null, 2));

        // Выводим компоненты на страницу
        componentsForOffer.forEach(c => {
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
