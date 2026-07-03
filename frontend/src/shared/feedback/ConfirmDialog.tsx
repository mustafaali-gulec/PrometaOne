/* =====================================================================
   shared/feedback — ConfirmDialog
   ---------------------------------------------------------------------
   Native confirm() yerine tema-uyumlu, erişilebilir onay diyaloğu.
   Aynı anda tek diyalog. z-index uygulama modallarının (z-50) üstünde.
===================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { pick } from './messages';
import { setConfirmRequest, useConfirmRequest } from './store';

export function ConfirmDialog(): ReactElement | null {
  const req = useConfirmRequest();
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState('');

  const finish = useCallback(
    (ok: boolean) => {
      if (req) req.resolve(ok, req.input ? inputValue : undefined);
      setConfirmRequest(null);
    },
    [req, inputValue],
  );

  const isDanger = (req?.tone ?? 'default') === 'danger';

  useEffect(() => {
    if (!req) return;
    setInputValue(req.input?.defaultValue ?? '');
    // Girişli diyalogda odak input'a; yıkıcı işlemde kazara onaylamayı
    // azaltmak için odağı "Vazgeç"e ver.
    const focusTarget = req.input
      ? inputRef.current
      : isDanger
        ? cancelRef.current
        : confirmRef.current;
    focusTarget?.focus();
  }, [req, isDanger]);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Capture aşamasında kes: alttaki uygulama Modal'ının document-keydown
        // onClose'u tetiklenmesin (ESC yalnız bu diyaloğu kapatır).
        e.stopPropagation();
        finish(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [req, finish]);

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

        {req.input && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            placeholder={req.input.placeholder}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
              }
            }}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '8px 10px',
              fontSize: 13.5,
              color: 'var(--ink)',
              background: 'var(--bg-alt)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-md, 6px)',
              outline: 'none',
            }}
          />
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
