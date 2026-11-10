const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

content = content.replace('async exportData() {', 'async exportData() {');
content = content.replace('const exportObj = {};', 'const exportObj: Record<string, any> = {};');
content = content.replace('exportObj[store] = await db.getAll(store);', 'exportObj[store] = await db.getAll(store as StoreNames<MyDB>);');

content = content.replace('async importData(jsonData) {', 'async importData(jsonData: string) {');
content = content.replace("stores.filter(store => db.objectStoreNames.contains(store));", "stores.filter(store => db.objectStoreNames.contains(store)) as StoreNames<MyDB>[];");
content = content.replace("tx.objectStore(store);", "tx.objectStore(store as StoreNames<MyDB>);");
content = content.replace("backgroundSync(store, item)", "backgroundSync(store as StoreNames<MyDB>, item)");

fs.writeFileSync('services/db.ts', content);
