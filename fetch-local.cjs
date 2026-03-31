const http = require('http');
http.get('http://localhost:3000/components/AiDiagnosis.tsx', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data.split('\n').filter(line => line.includes('ENV_INFO')).join('\n'));
  });
});
