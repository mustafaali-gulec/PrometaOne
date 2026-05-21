/**
 * UserRole — yetki hiyerarşisi.
 *
 * Mevcut types.ts'deki UserRole ile birebir aynı (uyumluluk).
 * Sonra types.ts'i bu modülün public API'sini import edecek şekilde
 * refactor edebiliriz.
 *
 * Hiyerarşi (Faz 4 ADR-0005 ile güncellendi):
 *   viewer < editor < hr_manager < cfo < admin
 */
export type UserRole = 'viewer' | 'editor' | 'hr_manager' | 'cfo' | 'admin';

const LEVEL: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  hr_manager: 3,
  cfo: 4,
  admin: 5,
};

/** Hiyerarşik kontrol: `actor` rolü `required` rolüne eşit veya üstü mü? */
export function isAtLeast(actor: UserRole, required: UserRole): boolean {
  return LEVEL[actor] >= LEVEL[required];
}

/** Tüm rollerin sırası. */
export const ALL_USER_ROLES: ReadonlyArray<UserRole> = [
  'viewer',
  'editor',
  'hr_manager',
  'cfo',
  'admin',
];
