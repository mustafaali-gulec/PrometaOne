/**
 * EffectivePermissionsDto — bir kullanıcının çözülmüş (allow olan) izin seti.
 *
 * `permissions` katalogdaki `resource.action` string'lerinin düz listesidir.
 */
export interface EffectivePermissionsDto {
  username: string;
  role: string;
  permissions: ReadonlyArray<string>;
}
