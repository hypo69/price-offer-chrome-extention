// create-image-manifest.js
// Этот скрипт нужно запускать через Node.js (команда: node create-image-manifest.js)

const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'assets', 'images');
const manifestPath = path.join(__dirname, 'image-manifest.json');
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

let imageFiles = [];

// Функция для рекурсивного поиска всех файлов изображений
function findImageFiles(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            findImageFiles(fullPath); // Ищем в подпапках
        } else if (imageExtensions.includes(path.extname(file).toLowerCase())) {
            // Добавляем путь, относительный к корню проекта (используя /)
            const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
            imageFiles.push(relativePath);
        }
    }
}

try {
    console.log(`Сканирую папку ${imagesDir}...`);
    findImageFiles(imagesDir);

    // Записываем найденные пути в JSON-файл
    fs.writeFileSync(manifestPath, JSON.stringify(imageFiles, null, 2));

    console.log(`✅ Успешно создан image-manifest.json с ${imageFiles.length} изображениями.`);
} catch (error) {
    console.error('❌ Ошибка при создании манифеста изображений:', error);
}