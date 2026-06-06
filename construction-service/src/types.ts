/**
 * Servis-içi ortak tipler. Auth ile aynı rol hiyerarşisi (monolit ile uyumlu):
 *   viewer < editor < hr_manager < cfo < admin
 */
export type UserRole = 'viewer' | 'editor' | 'hr_manager' | 'cfo' | 'admin';

export interface AuthContext {
  userId: number;
  username: string;
  role: UserRole;
}

export const ROLE_LEVEL: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  hr_manager: 3,
  cfo: 4,
  admin: 5,
};

export function canRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
}
