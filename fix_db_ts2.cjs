const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

content = content.replace(/StoreNames<MyDB>/g, 'any');

fs.writeFileSync('services/db.ts', content);
