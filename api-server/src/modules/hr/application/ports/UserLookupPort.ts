/**
 * UserLookupPort — Auth modülünden User bilgisini sorgulamak için port.
 *
 * ADR-0005 § "Anti-corruption layer": HR auth domain'ine yazmaz, yalnız okur.
 * Concrete adapter (PR 4) auth modülünün public API'sinden veri çeker.
 *
 * Bu port'un return tipi auth modülünün `UserSummary`'sini değil, HR'a uygun
 * minimal bir view'ı verir (gevşek bağlantı).
 */

export interface HrUserSummary {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  active: boolean;
}

export interface UserLookupPort {
  /** Verilen userId aktif bir kullanıcıya karşılık geliyor mu? null = yok. */
  findById(userId: number): Promise<HrUserSummary | null>;
}
