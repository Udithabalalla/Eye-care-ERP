const fs = require('fs');
const path = require('path');

const walk = (dir) => {
    try {
        const files = fs.readdirSync(dir);
        files.forEach(f => {
            const fullPath = path.join(dir, f);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('@/src/')) {
                    const newContent = content.replace(/@\/src\//g, '@/');
                    fs.writeFileSync(fullPath, newContent);
                    console.log('Fixed ' + fullPath);
                }
            }
        });
    } catch (e) {
        console.error('Error processing ' + dir + ': ' + e.message);
    }
};

walk('./src/components/ui');
