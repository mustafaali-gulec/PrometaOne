/**
 * AppState DTO'ları — REST sınırında kullanılan düz tipler.
 */
export interface AppStateDto {
  scope: string;
  key: string;
  value: unknown;
  updatedAt: string;
}
