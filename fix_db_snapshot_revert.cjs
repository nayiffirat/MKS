const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

content = content.replace("if (db.objectStoreNames.contains(col)) {\n        if (auth.currentUser?.uid !== uid) return;\n        const tx = db.transaction(col, 'readwrite');", "if (db.objectStoreNames.contains(col)) {\n        const tx = db.transaction(col, 'readwrite');");

fs.writeFileSync('services/db.ts', content);
