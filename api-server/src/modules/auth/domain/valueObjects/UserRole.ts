/**
 * UserRole — yetki hiyerarşisi.
 *
 * Mevcut types.ts'deki UserRole ile birebir aynı (uyumluluk).
 * Sonra types.ts'i bu modülün public API'sini import edecek şekilde
 * refactor edebiliriz.
 */
export type UserRole = 'viewer' | 'editor' | 'cfo' | 'admin';

const LEVEL: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  cfo: 3,
  admin: 4,
};

/** Hiyerarşik kontrol: `actor` rolü `required` rolüne eşit veya üstü mü? */
export function isAtLeast(actor: UserRole, required: UserRole): boolean {
  return LEVEL[actor] >= LEVEL[required];
}

/** Tüm rollerin sırası. */
export const ALL_USER_ROLES: ReadonlyArray<UserRole> = ['viewer', 'editor', 'cfo', 'admin'];
