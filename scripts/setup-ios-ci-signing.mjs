import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function requiredEnv(name) {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val.replace(/\\n/g, '\n').trim() + '\n';
}

function makeAscJwt(keyId, issuerId, privateKeyPem) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 900,
      aud: 'appstoreconnect-v1',
    })
  ).toString('base64url');
  const signature = crypto
    .sign('sha256', Buffer.from(`${header}.${payload}`), {
      key: privateKeyPem,
      dsaEncoding: 'ieee-p1363',
    })
    .toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function ascFetch(urlPath, token, options = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`App Store Connect API ${res.status} on ${urlPath}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function downloadIntermediateCerts(tempDir, keychainPath) {
  const urls = [
    ['AppleWWDRCAG3.cer', 'https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer'],
    ['AppleWWDRCAG4.cer', 'https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer'],
  ];
  for (const [filename, url] of urls) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
    }
    const der = Buffer.from(await res.arrayBuffer());
    const dest = path.join(tempDir, filename);
    fs.writeFileSync(dest, der);
    execFileSync('security', ['import', dest, '-k', keychainPath, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'], {
      stdio: 'inherit',
    });
  }
}

async function main() {
  const tempDir = process.env.RUNNER_TEMP;
  if (!tempDir) {
    throw new Error('RUNNER_TEMP is not set');
  }

  const keyId = process.env.APP_STORE_CONNECT_KEY_ID?.trim();
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID?.trim();
  if (!keyId || !issuerId) {
    throw new Error('Missing APP_STORE_CONNECT_KEY_ID or APP_STORE_CONNECT_ISSUER_ID');
  }

  const ascPrivateKey = requiredEnv('APP_STORE_CONNECT_PRIVATE_KEY');
  const certPrivateKey = requiredEnv('APPLE_CERT_PRIVATE_KEY');

  const keyPath = path.join(tempDir, 'ci_signing.key');
  const csrPath = path.join(tempDir, 'ci_signing.csr');
  fs.writeFileSync(keyPath, certPrivateKey, { mode: 0o600 });

  execFileSync(
    'openssl',
    ['req', '-new', '-key', keyPath, '-out', csrPath, '-subj', '/CN=Nayif FIRAT CI/O=Nayif FIRAT/C=TR'],
    { stdio: 'inherit' }
  );
  const csrContent = fs.readFileSync(csrPath, 'utf8');
  const expectedSpkiPem = crypto.createPublicKey(certPrivateKey).export({ type: 'spki', format: 'pem' }).toString();

  const token = makeAscJwt(keyId, issuerId, ascPrivateKey);
  const existingList = await ascFetch('/v1/certificates?limit=100', token);
  const existingCerts = existingList.data || [];

  const certTypes = ['DEVELOPMENT', 'DISTRIBUTION'];
  const certDers = {};

  for (const certType of certTypes) {
    let matched = null;
    for (const cert of existingCerts) {
      if (cert.attributes?.certificateType !== certType || !cert.attributes?.certificateContent) {
        continue;
      }
      const der = Buffer.from(cert.attributes.certificateContent, 'base64');
      const x509 = new crypto.X509Certificate(der);
      const certSpkiPem = x509.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      if (certSpkiPem === expectedSpkiPem) {
        matched = { id: cert.id, name: cert.attributes.name, der };
        break;
      }
    }

    if (matched) {
      console.log(`Reusing existing ${certType} certificate ${matched.id} (${matched.name})`);
      certDers[certType] = matched.der;
    } else {
      console.log(`Creating new ${certType} certificate in App Store Connect...`);
      const created = await ascFetch('/v1/certificates', token, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'certificates',
            attributes: {
              certificateType: certType,
              csrContent,
            },
          },
        }),
      });
      const b64 = created?.data?.attributes?.certificateContent;
      if (!b64) {
        throw new Error(`No certificateContent returned for ${certType}`);
      }
      console.log(`Created ${certType} certificate ${created.data.id} (${created.data.attributes.name})`);
      certDers[certType] = Buffer.from(b64, 'base64');
    }
  }

  const keychainPath = path.join(tempDir, 'build.keychain-db');
  const keychainPass = 'mks_ci_keychain_pass';
  const p12Pass = 'mks_ci_p12_pass';

  if (fs.existsSync(keychainPath)) {
    try {
      execFileSync('security', ['delete-keychain', keychainPath]);
    } catch {
      fs.rmSync(keychainPath, { force: true });
    }
  }

  execFileSync('security', ['create-keychain', '-p', keychainPass, keychainPath], { stdio: 'inherit' });
  execFileSync('security', ['set-keychain-settings', '-lut', '21600', keychainPath], { stdio: 'inherit' });
  execFileSync('security', ['unlock-keychain', '-p', keychainPass, keychainPath], { stdio: 'inherit' });

  const listOut = execFileSync('security', ['list-keychains', '-d', 'user'], { encoding: 'utf8' });
  const existingKeychains = listOut
    .split('\n')
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .filter((line) => line && line !== keychainPath);
  execFileSync('security', ['list-keychains', '-d', 'user', '-s', keychainPath, ...existingKeychains], {
    stdio: 'inherit',
  });
  execFileSync('security', ['default-keychain', '-d', 'user', '-s', keychainPath], { stdio: 'inherit' });

  await downloadIntermediateCerts(tempDir, keychainPath);

  const sslVer = execFileSync('openssl', ['version'], { encoding: 'utf8' });
  const useLegacyFlag = sslVer.includes('OpenSSL 3');

  for (const certType of certTypes) {
    const cerPath = path.join(tempDir, `${certType}.cer`);
    const pemPath = path.join(tempDir, `${certType}.pem`);
    const p12Path = path.join(tempDir, `${certType}.p12`);
    fs.writeFileSync(cerPath, certDers[certType]);

    execFileSync('openssl', ['x509', '-inform', 'DER', '-in', cerPath, '-out', pemPath], { stdio: 'inherit' });
    const pkcs12Args = [
      'pkcs12',
      '-export',
      ...(useLegacyFlag ? ['-legacy'] : []),
      '-out',
      p12Path,
      '-inkey',
      keyPath,
      '-in',
      pemPath,
      '-passout',
      `pass:${p12Pass}`,
    ];
    execFileSync('openssl', pkcs12Args, { stdio: 'inherit' });
    execFileSync(
      'security',
      [
        'import',
        p12Path,
        '-k',
        keychainPath,
        '-P',
        p12Pass,
        '-T',
        '/usr/bin/codesign',
        '-T',
        '/usr/bin/security',
        '-T',
        '/usr/bin/productbuild',
      ],
      { stdio: 'inherit' }
    );
  }

  execFileSync(
    'security',
    ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', keychainPass, keychainPath],
    { stdio: 'inherit' }
  );
  execFileSync('security', ['find-identity', '-v', '-p', 'codesigning', keychainPath], { stdio: 'inherit' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
