#!/usr/bin/env node
/**
 * Prometa One — Lisans Üretici CLI (Ed25519).
 *
 * SADECE üretici firmada çalışır — bu klasör ve özellikle keys/ altındaki
 * private key MÜŞTERİYE ASLA GÖNDERİLMEZ. Detay: README.md
 *
 * Komutlar:
 *   keygen [--force]
 *       keys/license-private.pem üretir, public key PEM'ini stdout'a basar.
 *   issue --customer "Firma" --valid-until 2027-07-03 --max-terminals 5
 *         [--fingerprint XXXX-XXXX-XXXX-XXXX] [--features "*"]
 *         [--notes "..."] [--out license.lic]
 *       İmzalı lisans dosyası üretir.
 *   verify <dosya> [--fingerprint XXXX-XXXX-XXXX-XXXX]
 *       İmza + tarih + parmak izi doğrular, insan-okur özet basar.
 *
 * Bağımlılık YOK — yalnız node:crypto / node:fs / node:path / node:util.
 */
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'license-private.pem');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'license-public.pem');

const PRODUCT = 'prometa-one';

// ============================================================================
// canonicalJSON — anahtarları rekürsif alfabetik sıralanmış JSON.stringify.
// DİKKAT: Bu fonksiyon api-server/src/modules/licensing/application/verifier.ts
// içindeki kopyasıyla BİREBİR AYNI olmalıdır (imza bu metin üzerinde atılır).
// ============================================================================
function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJSON(v)).join(',') + ']';
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

// ============================================================================
// Yardımcılar
// ============================================================================
function fail(msg) {
  console.error(`HATA: ${msg}`);
  process.exit(1);
}

function normalizeFingerprint(fp) {
  return String(fp).trim().toUpperCase();
}

/** validUntil (YYYY-MM-DD) günü SONUNA kadar geçerli — Europe/Istanbul (UTC+3). */
function expiryMomentMs(validUntil) {
  return Date.parse(`${validUntil}T23:59:59.999+03:00`);
}

function loadPrivateKey() {
  if (!existsSync(PRIVATE_KEY_PATH)) {
    fail(`Private key bulunamadı: ${PRIVATE_KEY_PATH}\nÖnce 'keygen' komutunu çalıştırın.`);
  }
  return createPrivateKey(readFileSync(PRIVATE_KEY_PATH, 'utf8'));
}

function loadPublicKey() {
  if (existsSync(PUBLIC_KEY_PATH)) {
    return createPublicKey(readFileSync(PUBLIC_KEY_PATH, 'utf8'));
  }
  if (existsSync(PRIVATE_KEY_PATH)) {
    // Public pem yoksa private'tan türet
    return createPublicKey(createPrivateKey(readFileSync(PRIVATE_KEY_PATH, 'utf8')));
  }
  fail(`Ne ${PUBLIC_KEY_PATH} ne de ${PRIVATE_KEY_PATH} bulunamadı. Önce 'keygen' çalıştırın.`);
}

// ============================================================================
// keygen
// ============================================================================
function cmdKeygen(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { force: { type: 'boolean', default: false } },
  });

  if (existsSync(PRIVATE_KEY_PATH) && !values.force) {
    fail(
      `Private key ZATEN VAR: ${PRIVATE_KEY_PATH}\n` +
        `Üzerine yazmak mevcut lisansları geçersiz kılabilir (public key değişir).\n` +
        `Gerçekten yenilemek istiyorsanız --force ile çalıştırın.`,
    );
  }

  mkdirSync(KEYS_DIR, { recursive: true });

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

  writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 });
  writeFileSync(PUBLIC_KEY_PATH, publicPem);

  console.log(`Private key yazıldı : ${PRIVATE_KEY_PATH}`);
  console.log(`Public key yazıldı  : ${PUBLIC_KEY_PATH}`);
  console.log('');
  console.log("Aşağıdaki PUBLIC KEY PEM api-server'a gömülür");
  console.log('(api-server/src/modules/licensing/publicKey.ts):');
  console.log('');
  console.log(String(publicPem).trim());
}

// ============================================================================
// issue
// ============================================================================
function cmdIssue(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      customer: { type: 'string' },
      'valid-until': { type: 'string' },
      'max-terminals': { type: 'string' },
      fingerprint: { type: 'string' },
      features: { type: 'string', default: '*' },
      notes: { type: 'string', default: '' },
      out: { type: 'string', default: 'license.lic' },
    },
  });

  if (!values.customer) fail('--customer zorunlu (örn. --customer "Acme A.Ş.")');
  if (!values['valid-until']) fail('--valid-until zorunlu (örn. --valid-until 2027-07-03)');

  const validUntil = values['valid-until'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(Date.parse(validUntil))) {
    fail(`--valid-until YYYY-MM-DD biçiminde olmalı, verilen: ${validUntil}`);
  }

  const maxTerminals = values['max-terminals'] ? Number(values['max-terminals']) : 1;
  if (!Number.isInteger(maxTerminals) || maxTerminals < 1) {
    fail(`--max-terminals pozitif tam sayı olmalı, verilen: ${values['max-terminals']}`);
  }

  const fingerprint = values.fingerprint ? normalizeFingerprint(values.fingerprint) : null;
  const features = String(values.features)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    licenseId: `LIC-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`,
    product: PRODUCT,
    customer: values.customer,
    issuedAt: new Date().toISOString(),
    validUntil,
    maxTerminals,
    fingerprint,
    features: features.length > 0 ? features : ['*'],
    notes: values.notes ?? '',
  };

  const privateKey = loadPrivateKey();
  const signature = cryptoSign(
    null,
    Buffer.from(canonicalJSON(payload), 'utf8'),
    privateKey,
  ).toString('base64');

  const outPath = resolve(values.out ?? 'license.lic');
  writeFileSync(outPath, JSON.stringify({ payload, signature }, null, 2) + '\n');

  console.log(`Lisans yazıldı: ${outPath}`);
  console.log('');
  printSummary(payload);
}

// ============================================================================
// verify
// ============================================================================
function cmdVerify(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { fingerprint: { type: 'string' } },
  });

  const file = positionals[0];
  if (!file) fail('Kullanım: verify <lisans-dosyası> [--fingerprint XXXX-XXXX-XXXX-XXXX]');
  if (!existsSync(file)) fail(`Dosya bulunamadı: ${file}`);

  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail('Dosya geçerli JSON değil.');
  }
  if (
    !doc ||
    typeof doc !== 'object' ||
    typeof doc.signature !== 'string' ||
    !doc.payload ||
    typeof doc.payload !== 'object'
  ) {
    fail('Lisans biçimi geçersiz — { payload, signature } bekleniyor.');
  }

  const publicKey = loadPublicKey();
  const now = Date.now();
  const p = doc.payload;

  const sigOk = cryptoVerify(
    null,
    Buffer.from(canonicalJSON(p), 'utf8'),
    publicKey,
    Buffer.from(doc.signature, 'base64'),
  );

  const checks = [];
  checks.push(['İmza (Ed25519)', sigOk]);
  checks.push([`Ürün (${p.product ?? '?'})`, p.product === PRODUCT]);

  const expiryMs = expiryMomentMs(p.validUntil);
  const notExpired = Number.isFinite(expiryMs) && now <= expiryMs;
  checks.push([`Geçerlilik (${p.validUntil} gün sonuna kadar, UTC+3)`, notExpired]);

  const issuedMs = Date.parse(p.issuedAt);
  const notFuture = !Number.isFinite(issuedMs) || issuedMs <= now + 5 * 60 * 1000;
  checks.push(['issuedAt gelecekte değil', notFuture]);

  let fpOk = true;
  if (p.fingerprint != null && p.fingerprint !== '') {
    if (values.fingerprint) {
      fpOk = normalizeFingerprint(p.fingerprint) === normalizeFingerprint(values.fingerprint);
      checks.push([`Parmak izi eşleşmesi (${p.fingerprint})`, fpOk]);
    } else {
      checks.push([
        `Parmak izi (${p.fingerprint}) — --fingerprint verilmedi, KONTROL EDİLMEDİ`,
        true,
      ]);
    }
  } else {
    checks.push(['Parmak izi: kilitli değil (her makinede çalışır)', true]);
  }

  console.log('Lisans doğrulama sonucu');
  console.log('=======================');
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? 'OK ' : 'FAIL'}] ${label}`);
  }
  console.log('');
  printSummary(p);

  const allOk = checks.every(([, ok]) => ok);
  if (!allOk) {
    console.log('\nSONUÇ: LİSANS GEÇERSİZ');
    process.exit(2);
  }
  const daysLeft = Math.max(0, Math.ceil((expiryMs - now) / 86_400_000));
  console.log(`\nSONUÇ: LİSANS GEÇERLİ (kalan ${daysLeft} gün)`);
}

function printSummary(p) {
  console.log(`  Lisans ID     : ${p.licenseId}`);
  console.log(`  Ürün          : ${p.product}`);
  console.log(`  Müşteri       : ${p.customer}`);
  console.log(`  Kesim tarihi  : ${p.issuedAt}`);
  console.log(`  Son geçerlilik: ${p.validUntil} (gün sonuna kadar, UTC+3)`);
  console.log(`  Maks terminal : ${p.maxTerminals}`);
  console.log(`  Parmak izi    : ${p.fingerprint ?? '(kilitli değil)'}`);
  console.log(
    `  Özellikler    : ${Array.isArray(p.features) ? p.features.join(', ') : p.features}`,
  );
  if (p.notes) console.log(`  Notlar        : ${p.notes}`);
}

// ============================================================================
// main
// ============================================================================
const [, , command, ...rest] = process.argv;

switch (command) {
  case 'keygen':
    cmdKeygen(rest);
    break;
  case 'issue':
    cmdIssue(rest);
    break;
  case 'verify':
    cmdVerify(rest);
    break;
  default:
    console.log(`Prometa One — Lisans Üretici CLI (Ed25519)

Kullanım:
  node cli.js keygen [--force]
  node cli.js issue --customer "Firma" --valid-until 2027-07-03 --max-terminals 5 \\
                    [--fingerprint XXXX-XXXX-XXXX-XXXX] [--features "*"] \\
                    [--notes "..."] [--out license.lic]
  node cli.js verify <dosya> [--fingerprint XXXX-XXXX-XXXX-XXXX]

Detaylı akış için README.md'ye bakın.`);
    process.exit(command ? 1 : 0);
}
