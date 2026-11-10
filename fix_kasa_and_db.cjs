const fs = require('fs');

let kasa = fs.readFileSync('components/Kasa.tsx', 'utf8');
kasa = kasa.replace("import { Account, Transaction } from '../types';", "import { Account, Transaction } from '../types';\nimport { roundAmount } from '../utils/currency';");
fs.writeFileSync('components/Kasa.tsx', kasa);

let dbTs = fs.readFileSync('services/db.ts', 'utf8');
dbTs = dbTs.replace("exportObj[store] = await db.getAll(store);", "exportObj[store] = await db.getAll(store as any);");
fs.writeFileSync('services/db.ts', dbTs);
