import fs from 'fs';

let content = fs.readFileSync('constants/cropData.ts', 'utf8');

content = content.replace(/activeIngredients:\s*\[(.*?)\]/g, (match, arrayStr) => {
    let items;
    try {
        items = eval(`[${arrayStr}]`);
    } catch (e) {
        console.error('Failed to eval:', arrayStr);
        return match;
    }

    let commercialNames: string[] = [];
    let activeIngs: string[] = [];

    for (let item of items) {
        if (item.includes('- Aktif:')) {
            let parts = item.split('- Aktif:');
            commercialNames.push(parts[0].trim());
            activeIngs.push(parts[1].trim());
        } else if (item.includes(' - ')) {
            let parts = item.split(' - ');
            commercialNames.push(parts[0].trim());
            activeIngs.push(parts[1].trim());
        } else {
            if (item.includes('(')) {
                commercialNames.push(item.trim());
            } else {
                activeIngs.push(item.trim());
            }
        }
    }

    // Deduplicate
    activeIngs = [...new Set(activeIngs)];
    commercialNames = [...new Set(commercialNames)];

    let commStr = commercialNames.length > 0 ? `commercialNames: ${JSON.stringify(commercialNames)}` : 'commercialNames: []';
    let actStr = activeIngs.length > 0 ? `activeIngredients: ${JSON.stringify(activeIngs)}` : 'activeIngredients: []';

    return `${commStr}, ${actStr}`;
});

fs.writeFileSync('constants/cropData.ts', content, 'utf8');
console.log('Done');
