/**
 * TokenGenerator — tahmin edilemez jeton üretimi portu (public feed URL'i,
 * OAuth `state`). Test edilebilirlik için enjekte edilir; concrete impl
 * infrastructure/crypto/CryptoTokenGenerator.ts (node:crypto).
 */
export interface TokenGenerator {
  /** URL-güvenli rastgele jeton. */
  generate(byteLength?: number): string;
}
