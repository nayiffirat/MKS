const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

const exportImportCode = `
  async exportData() {
    const db = await initDB();
    const stores = ['farmers', 'visits', 'prescriptions', 'notifications', 'reminders', 'inventory', 'payments', 'manualDebts', 'suppliers', 'supplierPurchases', 'supplierPayments', 'myPayments', 'expenses', 'accounts', 'transactions', 'teamMembers', 'messages', 'plants'];
    const exportObj = {};
    for (const store of stores) {
        exportObj[store] = await db.getAll(store);
    }
    return JSON.stringify(exportObj);
  },

  async importData(jsonData) {
    const data = JSON.parse(jsonData);
    const db = await initDB();
    const stores = Object.keys(data);
    
    // Begin transaction for all stores that exist in both DB and JSON
    const validStores = stores.filter(store => db.objectStoreNames.contains(store));
    const tx = db.transaction(validStores, 'readwrite');
    
    for (const store of validStores) {
        const os = tx.objectStore(store);
        await os.clear();
        for (const item of data[store]) {
            await os.put(item);
        }
    }
    await tx.done;
    
    // Also trigger background sync for all imported items so it persists to cloud if logged in
    for (const store of validStores) {
        for (const item of data[store]) {
            backgroundSync(store, item).catch(console.error);
        }
    }
  },
`;

if (!content.includes('async exportData()')) {
    content = content.replace(/async clearLocalUserData\(\) \{/, exportImportCode + '\n  async clearLocalUserData() {');
    fs.writeFileSync('services/db.ts', content);
}
