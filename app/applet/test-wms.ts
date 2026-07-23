import fetch from 'node-fetch';

async function testIt() {
  const url = "https://megsiswms.tkgm.gov.tr/tkgm.mahalli/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&FORMAT=image/png&TRANSPARENT=true&QUERY_LAYERS=TKGM.MAHALLI.PARSEL&LAYERS=TKGM.MAHALLI.PARSEL&INFO_FORMAT=application/json&X=50&Y=50&WIDTH=100&HEIGHT=100&SRS=EPSG:4326&BBOX=34.0,38.0,35.0,39.0";
  try {
     const res = await fetch(url, {
       headers: {
         'User-Agent': 'Mozilla/5.0'
       }
     });
     console.log(res.status, await res.text());
  } catch (e) {
     console.error(e);
  }
}
testIt();
