const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

content = content.replace("const tx = db.transaction(validStores, 'readwrite');", "const tx = db.transaction(validStores as any, 'readwrite');");
fs.writeFileSync('services/db.ts', content);
