/**
 * OAuthStateCodec — OAuth `state` parametresinin imzalanması/doğrulanması portu.
 *
 * Callback ucu tarayıcı yönlendirmesiyle gelir; üzerinde bizim JWT'miz YOKTUR.
 * Bu yüzden hangi şirket adına yetkilendirme yapıldığı `state` içinde taşınır ve
 * HMAC ile imzalanır — aksi hâlde saldırgan istediği companyId'yi uydurur (CSRF).
 */
export interface OAuthStatePayload {
  companyId: number;
  actorId: number | null;
  /** Unix saniye — imzanın son geçerlilik anı. */
  exp: number;
}

export interface OAuthStateCodec {
  sign(payload: OAuthStatePayload): string;
  /** İmza/son kullanma geçersizse hata fırlatır. */
  verify(state: string): OAuthStatePayload;
}
