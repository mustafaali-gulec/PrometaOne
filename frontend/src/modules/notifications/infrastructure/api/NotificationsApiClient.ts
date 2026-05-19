/**
 * NotificationsApiClient — NotificationsApi'nin fetch implementasyonu.
 */
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type { NotificationsApi } from '../../application/ports/NotificationsApi';
import type { FetchNotificationsResult } from '../../application/dto/NotificationDto';

export class NotificationsApiClient implements NotificationsApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  async fetchForCurrentUser(
    options: { limit?: number; unreadOnly?: boolean } = {},
  ): Promise<FetchNotificationsResult> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.unreadOnly === true) params.set('unreadOnly', 'true');
    const qs = params.toString();
    const url = `${this.baseUrl}/v1/notifications${qs ? `?${qs}` : ''}`;
    return this.request<FetchNotificationsResult>(url, { method: 'GET' });
  }

  async markAsRead(notificationId: string): Promise<void> {
    const url = `${this.baseUrl}/v1/notifications/${encodeURIComponent(notificationId)}/read`;
    await this.request<{ ok: true }>(url, { method: 'POST' });
  }

  async fetchUnreadCount(): Promise<number> {
    const url = `${this.baseUrl}/v1/notifications/unread-count`;
    const result = await this.request<{ count: number }>(url, { method: 'GET' });
    return result.count;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const token = this.tokens.getAccessToken();
    if (!token) {
      throw new Error('No auth token');
    }
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return (await response.json()) as T;
  }
}
