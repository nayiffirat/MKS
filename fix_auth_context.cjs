const fs = require('fs');
let content = fs.readFileSync('context/AuthContext.tsx', 'utf8');

content = content.replace(
    'if (lastUid && lastUid !== user.uid) {\n                    console.log("Farklı bir kullanıcı algılandı. Veritabanı adı \'lastUserId\' ile izole edilecek.");\n                }',
    'if (lastUid && lastUid !== user.uid) {\n                    console.log("Farklı bir kullanıcı algılandı. Yerel veriler temizleniyor.");\n                    // Use fire-and-forget clear since we can\'t easily await here in the snapshot callback without blocking UI state, though actually it is async but inside onAuthStateChanged we can just let it run.\n                    dbService.clearLocalData().catch(e => console.error("Kullanıcı değişimi temizlik hatası:", e));\n                }'
);
fs.writeFileSync('context/AuthContext.tsx', content);
