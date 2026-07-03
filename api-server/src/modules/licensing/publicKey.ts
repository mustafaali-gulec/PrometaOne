/**
 * Lisans doğrulama PUBLIC KEY'i (Ed25519, SPKI PEM).
 *
 * `node tools/license-generator/cli.js keygen` çıktısından gömüldü. Karşılığı
 * olan PRIVATE key üretici firmada kalır (tools/license-generator/keys/ —
 * gitignore'lu), müşteriye ASLA gitmez. Buradaki public key yalnız DOĞRULAMA
 * yapabilir; lisans ÜRETEMEZ — müşteri sunucusunda durması güvenlidir.
 *
 * Anahtar rotasyonu gerekirse: keygen --force → yeni PEM'i buraya göm → tüm
 * müşterilere yeni sürüm + yeni lisans dağıt. Geçici override için env:
 * LICENSE_PUBLIC_KEY_PEM (config.ts).
 *
 * Bu dosya bilinçli olarak config.ts'e bağımlı DEĞİLDİR (scripts/ altından da
 * import edilir); override değeri çağırandan parametreyle gelir.
 */
export const EMBEDDED_LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAUkycLWvQ5MvJOF8DmT8gKEjL0bzs4INERXa0lcqvhus=
-----END PUBLIC KEY-----
`;

/** Env override (LICENSE_PUBLIC_KEY_PEM) varsa onu, yoksa gömülü PEM'i döner. */
export function resolveLicensePublicKeyPem(override?: string | null): string {
  if (override && override.trim() !== '') return override;
  return EMBEDDED_LICENSE_PUBLIC_KEY_PEM;
}
