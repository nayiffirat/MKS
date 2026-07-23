import fs from 'fs';

const cropDataFile = 'constants/cropData.ts';
let cropData = fs.readFileSync(cropDataFile, 'utf8');

cropData = cropData.replace(/%50'ye/g, '%50 ye');
cropData = cropData.replace(/%70'e/g, '%70 e');
cropData = cropData.replace(/Tuta'ya/g, 'Tutaya');

fs.writeFileSync(cropDataFile, cropData, 'utf8');
console.log('Fixed quotes in cropData.ts');
