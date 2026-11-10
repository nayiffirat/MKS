const fs = require('fs');
let content = fs.readFileSync('context/AppContext.tsx', 'utf8');

content = content.replace(/farmerDebts\[p\.farmerId\] = \(farmerDebts\[p\.farmerId\] \|\| 0\) \+ netAmt;/g, 'farmerDebts[p.farmerId] = Math.round(((farmerDebts[p.farmerId] || 0) + netAmt + Number.EPSILON) * 100) / 100;');
content = content.replace(/farmerDebts\[d\.farmerId\] = \(farmerDebts\[d\.farmerId\] \|\| 0\) \+ amt;/g, 'farmerDebts[d.farmerId] = Math.round(((farmerDebts[d.farmerId] || 0) + amt + Number.EPSILON) * 100) / 100;');
content = content.replace(/farmerDebts\[pay\.farmerId\] = \(farmerDebts\[pay\.farmerId\] \|\| 0\) - amt;/g, 'farmerDebts[pay.farmerId] = Math.round(((farmerDebts[pay.farmerId] || 0) - amt + Number.EPSILON) * 100) / 100;');
content = content.replace(/farmerDebts\[f\.id\] \|\| 0/g, 'Math.round(((farmerDebts[f.id] || 0) + Number.EPSILON) * 100) / 100');

fs.writeFileSync('context/AppContext.tsx', content);
