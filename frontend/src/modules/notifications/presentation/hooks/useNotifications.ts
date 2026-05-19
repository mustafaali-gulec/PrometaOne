/**
 * useNotifications — bildirimleri çeker, polling yapar, mark-as-read sağlar.
 *
 * Polling: varsayılan 30 saniye. Kullanım:
 *   const { notifications, unreadCount, markAsRead, refresh } = useNotifications(api);
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { NotificationDto } from '../../application/dto/NotificationDto';
import type { NotificationsApi } from '../../application/ports/NotificationsApi';

export interface UseNotificationsResult {
  notifications: ReadonlyArray<NotificationDto>;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

export interface UseNotificationsOptions {
  pollMs?: number;
  limit?: number;
  enabled?: boolean;
}

export function useNotifications(
  api: NotificationsApi,
  options: UseNotificationsOptions = {},
): UseNotificationsResult {
  const { pollMs = 30000, limit = 20, enabled = true } = options;

  const [notifications, setNotifications] = useState<ReadonlyArray<NotificationDto>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // En son istemenin "iptal edilebilirliği" — eski response'lar state'i ezmesin.
  const reqIdRef = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    const id = ++reqIdRef.current;
    setLoading(true);
    try {
      const result = await api.fetchForCurrentUser({ limit });
      if (id === reqIdRef.current) {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setError(null);
      }
    } catch (err: unknown) {
      if (id === reqIdRef.current) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      }
    } finally {
      if (id === reqIdRef.current) setLoading(false);
    }
  }, [api, enabled, limit]);

  const markAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      try {
        await api.markAsRead(notificationId);
        // Optimistic local update — bir sonraki refresh'te zaten güncellenir.
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId && !n.isRead
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      }
    },
    [api],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    if (pollMs > 0) {
      const t = setInterval(() => {
        void refresh();
      }, pollMs);
      return () => clearInterval(t);
    }
    return undefined;
  }, [enabled, pollMs, refresh]);

  return { notifications, unreadCount, loading, error, refresh, markAsRead };
}
