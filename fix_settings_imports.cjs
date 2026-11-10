const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf8');
content = content.replace("Database, Type,", "Database, Download, Upload, Type,");
fs.writeFileSync('components/Settings.tsx', content);
