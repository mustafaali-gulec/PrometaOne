/** Token kaynağı. Notifications modülüyle aynı pattern. */
export interface AuthTokenProvider {
  getAccessToken(): string | null;
}
