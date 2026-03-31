const https = require('https');
https.get('https://esm.sh/@google/genai@^1.37.0', (res) => {
  console.log(res.statusCode);
  console.log(res.headers.location);
});
