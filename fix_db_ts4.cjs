const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

content = content.replace("db.objectStoreNames.contains(store)", "db.objectStoreNames.contains(store as any)");
fs.writeFileSync('services/db.ts', content);
