const fs = require('fs');
let content = fs.readFileSync('services/db.ts', 'utf8');

content = content.replace(/account\.balance \+= (.*?);/g, 'account.balance = Math.round((account.balance + $1 + Number.EPSILON) * 100) / 100;');
content = content.replace(/account\.balance -= (.*?);/g, 'account.balance = Math.round((account.balance - $1 + Number.EPSILON) * 100) / 100;');
content = content.replace(/oldAccount\.balance \+= (.*?);/g, 'oldAccount.balance = Math.round((oldAccount.balance + $1 + Number.EPSILON) * 100) / 100;');
content = content.replace(/oldAccount\.balance -= (.*?);/g, 'oldAccount.balance = Math.round((oldAccount.balance - $1 + Number.EPSILON) * 100) / 100;');
content = content.replace(/newAccount\.balance \+= (.*?);/g, 'newAccount.balance = Math.round((newAccount.balance + $1 + Number.EPSILON) * 100) / 100;');
content = content.replace(/newAccount\.balance -= (.*?);/g, 'newAccount.balance = Math.round((newAccount.balance - $1 + Number.EPSILON) * 100) / 100;');

fs.writeFileSync('services/db.ts', content);
