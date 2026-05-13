/**
 * Credentials Encryption — AES-256-GCM
 * -------------------------------------
 * eLogo username/password gibi hassas verileri DB'ye şifreli yazmak için.
 * Master key .env'de tutulur, hiç DB'de görünmez.
 *
 * Master key oluşturma (deploy öncesi 1 kez):
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * .env:
 *   EINVOICE_MASTER_KEY=base64(32 byte)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;     // GCM önerilen IV: 96 bit
const TAG_LEN = 16;    // GCM auth tag: 128 bit

function getMasterKey(): Buffer {
  const k = process.env.EINVOICE_MASTER_KEY;
  if (!k) throw new Error("EINVOICE_MASTER_KEY .env'de tanımlı değil");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("EINVOICE_MASTER_KEY 32 byte (256-bit) olmalı");
  return buf;
}

/**
 * Şifreler. DB'ye 3 kolon yazılır: ciphertext, iv, tag
 */
export function encryptConfig(config: object): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(config), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

/**
 * Çözer. DB'den ciphertext, iv, tag ile çağrılır.
 */
export function decryptConfig<T = any>(ciphertext: Buffer, iv: Buffer, tag: Buffer): T {
  const key = getMasterKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf-8"));
}
