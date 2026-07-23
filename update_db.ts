import fs from 'fs';

const cropDataFile = 'constants/cropData.ts';
let cropData = fs.readFileSync(cropDataFile, 'utf8');

// Find where PROBLEM_DATABASE starts
const pbIndex = cropData.indexOf('export const PROBLEM_DATABASE');
if (pbIndex === -1) {
    console.error('PROBLEM_DATABASE not found!');
    process.exit(1);
}

// Keep the top part
const topPart = cropData.substring(0, pbIndex);

// Read the new DBs
const newDbContent = fs.readFileSync('generated_db.ts', 'utf8');

// Write the combined content
fs.writeFileSync(cropDataFile, topPart + newDbContent, 'utf8');
console.log('Successfully updated constants/cropData.ts');
