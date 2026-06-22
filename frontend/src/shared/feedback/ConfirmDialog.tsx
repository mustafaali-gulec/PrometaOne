/* =====================================================================
   shared/feedback — ConfirmDialog
   ---------------------------------------------------------------------
   Native confirm() yerine tema-uyumlu, erişilebilir onay diyaloğu.
   Aynı anda tek diyalog. z-index uygulama modallarının (z-50) üstünde.
===================================================================== */
import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { pick } from './messages';
import { setConfirmRequest, useConfirmRequest } from './store';

export function ConfirmDialog(): ReactElement | null {
  const req = useConfirmRequest();
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const finish = useCallback(
    (ok: boolean) => {
      if (req) req.resolve(ok);
      setConfirmRequest(null);
    },
    [req],
  );

  const isDanger = (req?.tone ?? 'default') === 'danger';

  useEffect(() => {
    if (!req) return;
    // Yıkıcı işlemde kazara onaylamayı azaltmak için odağı "Vazgeç"e ver.
    const focusTarget = isDanger ? cancelRef.current : confirmRef.current;
    focusTarget?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, isDanger, finish]);

  if (!req) return null;

  const confirmBg = isDanger ? 'var(--negative)' : 'var(--accent)';
  const confirmLabel =
    req.confirmLabel ?? pick({ tr: 'Onayla', en: 'Confirm', de: 'Bestätigen', ar: 'تأكيد' });
  const cancelLabel =
    req.cancelLabel ?? pick({ tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' });

  return (
    // Backdrop'a tıklayınca iptal et; klavye eşleniği Escape ile sağlanıyor (yukarıdaki effect).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="prometa-fb-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) finish(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(1px)',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="prometa-fb-confirm-title"
        aria-describedby={req.description !== undefined ? 'prometa-fb-confirm-desc' : undefined}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--paper)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg, 8px)',
          boxShadow: 'var(--shadow-lg)',
          padding: 20,
        }}
      >
        <div
          id="prometa-fb-confirm-title"
          style={{ fontSize: 16, fontWeight: 650, color: 'var(--ink)', lineHeight: 1.35 }}
        >
          {req.title}
        </div>

        {req.description !== undefined && (
          <div
            id="prometa-fb-confirm-desc"
            style={{
              marginTop: 8,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--ink-soft)',
            }}
          >
            {req.description}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => finish(false)}
            style={{
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--ink-soft)',
              background: 'var(--bg-alt)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-md, 6px)',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => finish(true)}
            style={{
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              color: '#ffffff',
              background: confirmBg,
              border: `1px solid ${confirmBg}`,
              borderRadius: 'var(--radius-md, 6px)',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
