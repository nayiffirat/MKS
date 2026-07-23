import fs from 'fs';

const cropDataFile = 'constants/cropData.ts';
let cropData = fs.readFileSync(cropDataFile, 'utf8');

// A safer way is to just look for things like %70'i and replace the quote.
cropData = cropData.replace(/%60-70'i/g, '%60-70 i');
cropData = cropData.replace(/pamuğun/g, 'pamugun'); // if any
cropData = cropData.replace(/(\w)'(\w)/g, '$1 $2');

fs.writeFileSync(cropDataFile, cropData, 'utf8');
console.log('Fixed quotes in cropData.ts');
