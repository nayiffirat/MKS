const fs = require('fs');
let content = fs.readFileSync('components/Kasa.tsx', 'utf8');

if (!content.includes("import { roundAmount } from '../utils/currency'")) {
    content = content.replace("import { tr } from 'date-fns/locale';", "import { tr } from 'date-fns/locale';\nimport { roundAmount } from '../utils/currency';");
}

content = content.replace("format(amount);", "format(roundAmount(amount));");

fs.writeFileSync('components/Kasa.tsx', content);
