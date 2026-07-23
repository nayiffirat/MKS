import fetch from 'node-fetch';

async function testIt() {
  const url = "https://cbsservis.tkgm.gov.tr/megsiswebapi.v3/api/parsel/15/19326/12431";
  try {
     const res = await fetch(url, {
       headers: {
         'User-Agent': 'Mozilla/5.0'
       }
     });
     console.log('cbsservis.tkgm.gov.tr:', res.status);
  } catch (e) {
     console.error(e.message);
  }
}
testIt();
