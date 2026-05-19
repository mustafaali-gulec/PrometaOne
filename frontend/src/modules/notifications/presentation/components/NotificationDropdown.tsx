/**
 * NotificationDropdown — bildirim listesini açan panel.
 */
import { Check, RefreshCw, X } from 'lucide-react';

import type { NotificationDto } from '../../application/dto/NotificationDto';

export interface NotificationDropdownProps {
  notifications: ReadonlyArray<NotificationDto>;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onMarkAsRead: (id: string) => void;
  onNavigate?: (link: string) => void;
}

export function NotificationDropdown({
  notifications,
  loading,
  error,
  onClose,
  onRefresh,
  onMarkAsRead,
  onNavigate,
}: NotificationDropdownProps) {
  return (
    <div
      role="dialog"
      aria-label="Bildirimler"
      className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[480px] overflow-hidden
                 rounded-lg shadow-lg bg-white border border-slate-200 z-50 flex flex-col"
    >
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Bildirimler</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Yenile"
            onClick={onRefresh}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">
            {error}
          </div>
        )}

        {!error && notifications.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Henüz bildirim yok.
          </div>
        )}

        {notifications.length === 0 && loading && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Yükleniyor…
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkAsRead={onMarkAsRead}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: NotificationDto;
  onMarkAsRead: (id: string) => void;
  onNavigate?: ((link: string) => void) | undefined;
}

function NotificationItem({ notification, onMarkAsRead, onNavigate }: NotificationItemProps) {
  const dateLabel = formatDate(notification.createdAt);
  const isClickable = notification.link !== null && onNavigate !== undefined;

  return (
    <li
      className={`group flex gap-3 px-4 py-3 ${
        notification.isRead ? 'bg-white' : 'bg-emerald-50/60'
      } hover:bg-slate-50 transition`}
    >
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className={`text-left w-full ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => {
            if (isClickable && notification.link !== null) {
              onNavigate(notification.link);
            }
          }}
          disabled={!isClickable}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-900 truncate">{notification.title}</p>
            <span className="text-[11px] text-slate-400 shrink-0">{dateLabel}</span>
          </div>
          {notification.body && (
            <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 whitespace-pre-line">
              {notification.body}
            </p>
          )}
        </button>
      </div>

      {!notification.isRead && (
        <button
          type="button"
          aria-label="Okundu olarak işaretle"
          onClick={() => onMarkAsRead(notification.id)}
          className="self-start opacity-0 group-hover:opacity-100 transition
                     p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
        >
          <Check className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return `${diffMin} dk`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} g`;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}
