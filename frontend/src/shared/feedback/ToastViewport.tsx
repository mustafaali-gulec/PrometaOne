/* =====================================================================
   shared/feedback — ToastViewport
   ---------------------------------------------------------------------
   Aktif toast'ları sağ üstte (RTL'de sol üstte) istifleyerek gösterir.
   Tema değişkenleri (var(--paper), var(--positive) ...) kullanır →
   açık/koyu tema otomatik takip edilir.
===================================================================== */
import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { removeToast, useToasts } from './store';
import type { ToastItem, ToastKind } from './types';

interface KindStyle {
  color: string;
  soft: string;
}

const KIND_STYLE: Record<ToastKind, KindStyle> = {
  success: { color: 'var(--positive)', soft: 'var(--positive-soft)' },
  error: { color: 'var(--negative)', soft: 'var(--negative-soft)' },
  warning: { color: 'var(--warning)', soft: 'var(--warning-soft)' },
  info: { color: 'var(--info)', soft: 'var(--info-soft)' },
  loading: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
};

function ToastIcon({ kind }: { kind: ToastKind }): ReactElement {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'success':
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    case 'loading':
      return (
        <svg {...common} className="prometa-fb-spin">
          <path d="M21 12a9 9 0 1 1-6.2-8.6" />
        </svg>
      );
    default:
      return <svg {...common} />;
  }
}

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps): ReactElement {
  const timerRef = useRef<number | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    disarm();
    if (item.duration > 0) {
      timerRef.current = window.setTimeout(() => onDismiss(item.id), item.duration);
    }
  }, [disarm, item.duration, item.id, onDismiss]);

  useEffect(() => {
    arm();
    return disarm;
  }, [arm, disarm]);

  const style = KIND_STYLE[item.kind];

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      aria-live={item.kind === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={disarm}
      onMouseLeave={arm}
      className="prometa-fb-toast-in"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 12px 11px 13px',
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderInlineStart: `3px solid ${style.color}`,
        borderRadius: 'var(--radius-lg, 8px)',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--ink)',
        pointerEvents: 'auto',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: style.soft,
          color: style.color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        <ToastIcon kind={item.kind} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13.5,
            lineHeight: 1.35,
            color: 'var(--ink)',
            overflowWrap: 'anywhere',
          }}
        >
          {item.title}
        </div>
        {item.description !== undefined && (
          <div
            style={{
              marginTop: 2,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: 'var(--ink-mute)',
              overflowWrap: 'anywhere',
            }}
          >
            {item.description}
          </div>
        )}
        {item.action !== undefined && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            style={{
              marginTop: 8,
              padding: '3px 10px',
              fontSize: 12.5,
              fontWeight: 600,
              color: style.color,
              background: style.soft,
              border: 'none',
              borderRadius: 'var(--radius, 4px)',
              cursor: 'pointer',
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Kapat"
        onClick={() => onDismiss(item.id)}
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius, 4px)',
          color: 'var(--ink-faint)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastViewport(): ReactElement | null {
  const toasts = useToasts();
  const onDismiss = useCallback((id: string) => removeToast(id), []);

  if (toasts.length === 0) return null;

  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: rtl ? 'auto' : 16,
        left: rtl ? 16 : 'auto',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      {/* En yeni toast en üstte */}
      {toasts
        .slice()
        .reverse()
        .map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
        ))}
    </div>
  );
}
