const fs = require('fs');
let content = fs.readFileSync('context/AuthContext.tsx', 'utf8');

content = content.replace(
    'const unsubscribe = onAuthStateChanged(auth, (user) => {',
    'const unsubscribe = onAuthStateChanged(auth, async (user) => {'
);
content = content.replace(
    'dbService.clearLocalData().catch(e => console.error("Kullanıcı değişimi temizlik hatası:", e));',
    'await dbService.clearLocalData().catch(e => console.error("Kullanıcı değişimi temizlik hatası:", e));'
);

fs.writeFileSync('context/AuthContext.tsx', content);
