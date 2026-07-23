import fs from 'fs';

let content = `export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {\n`;
fs.writeFileSync('generated_db.ts', content, 'utf8');
console.log('Created generated_db.ts');
