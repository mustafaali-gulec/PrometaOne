/**
 * NotificationBell — Üst bar bildirim ikonu + badge + dropdown toggle.
 *
 * Kendi başına state tutmaz; useNotifications hook'unu çağırır.
 */
import { Bell } from 'lucide-react';
import { useState } from 'react';

import type { NotificationsApi } from '../../application/ports/NotificationsApi';

import { useNotifications } from '../hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export interface NotificationBellProps {
  api: NotificationsApi;
  /** Bildirim açıldığında çağrılır (örn. App.jsx'te route değiştirmek için). */
  onNavigate?: (link: string) => void;
}

export function NotificationBell({ api, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, error, refresh, markAsRead } =
    useNotifications(api);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Bildirimler${unreadCount > 0 ? ` (${unreadCount} okunmamış)` : ''}`}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full
                   text-slate-600 hover:text-slate-900 hover:bg-slate-100
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center
                       min-w-[18px] h-[18px] px-1 rounded-full
                       bg-rose-500 text-white text-[10px] font-bold tabular-nums"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          loading={loading}
          error={error}
          onClose={() => setOpen(false)}
          onRefresh={() => {
            void refresh();
          }}
          onMarkAsRead={(id) => {
            void markAsRead(id);
          }}
          onNavigate={(link) => {
            setOpen(false);
            onNavigate?.(link);
          }}
        />
      )}
    </div>
  );
}
