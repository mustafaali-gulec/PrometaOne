/**
 * Standalone demo — shared/feedback (toast + confirm + mesaj kataloğu).
 *
 * App.jsx'e hiç dokunmaz. URL: http://localhost:5173/feedback-demo.html
 * Gerçek tema değişkenleri için styles.css import edilir.
 */
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { createRoot } from 'react-dom/client';

import { FeedbackProvider, toast, confirmDialog, msg } from './shared/feedback';
import type { Lang } from './shared/feedback';
import './styles.css';

function Btn({ onClick, children }: { onClick: () => void; children: ReactNode }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 14px',
        borderRadius: 6,
        border: '1px solid var(--line-strong)',
        background: 'var(--paper)',
        color: 'var(--ink)',
        cursor: 'pointer',
        fontSize: 13.5,
        fontWeight: 600,
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: 'var(--ink-mute)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DemoPage(): ReactElement {
  const [lang, setLangState] = useState<Lang>('tr');

  const setLang = (l: Lang): void => {
    window.__PROMETA_LANG__ = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
    setLangState(l);
  };

  const langs: Lang[] = ['tr', 'en', 'de', 'ar'];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
        Mesaj / Geri Bildirim Altyapısı
      </h1>
      <p style={{ color: 'var(--ink-mute)', fontSize: 14, marginTop: 6 }}>
        <code>shared/feedback</code> — toast, onay diyaloğu ve çok dilli anlamlı mesaj kataloğu.
      </p>

      <Section title={`Dil (aktif: ${lang})`}>
        {langs.map((l) => (
          <Btn key={l} onClick={() => setLang(l)}>
            {l.toUpperCase()} {l === lang ? '✓' : ''}
          </Btn>
        ))}
      </Section>

      <Section title="Toast türleri">
        <Btn onClick={() => toast.success(msg.crud.created('Birim'))}>success — created</Btn>
        <Btn onClick={() => toast.error(msg.common.unexpected())}>error — unexpected</Btn>
        <Btn onClick={() => toast.warning(msg.validation.required('Birim adı'))}>
          warning — required
        </Btn>
        <Btn onClick={() => toast.info(msg.common.saved())}>info — saved</Btn>
      </Section>

      <Section title="Zengin içerik">
        <Btn
          onClick={() =>
            toast.error(msg.crud.cannotDelete('Genel Müdürlük', ['3 alt birim', '2 departman']), {
              description: 'Bağlı kayıtlar kaldırılmadan silme yapılamaz.',
            })
          }
        >
          error + açıklama
        </Btn>
        <Btn
          onClick={() =>
            toast.success('Kayıt silindi', {
              action: { label: 'Geri Al', onClick: () => toast.info('Geri alındı') },
            })
          }
        >
          success + aksiyon
        </Btn>
        <Btn
          onClick={() => {
            const id = toast.loading('İşleniyor…');
            window.setTimeout(() => toast.update(id, 'success', 'Tamamlandı'), 1500);
          }}
        >
          loading → success
        </Btn>
      </Section>

      <Section title="Onay diyaloğu (confirm)">
        <Btn
          onClick={() => {
            void confirmDialog(msg.crud.deleteConfirm('Genel Müdürlük', 'Birim')).then((ok) =>
              ok ? toast.success(msg.crud.deleted('Birim')) : toast.info('İşlem iptal edildi'),
            );
          }}
        >
          danger — silme onayı
        </Btn>
        <Btn
          onClick={() => {
            void confirmDialog({
              title: 'Devam edilsin mi?',
              description: 'Bu işlem kaydedilmemiş değişiklikleri uygular.',
            }).then((ok) => toast.info(ok ? 'Onaylandı' : 'Vazgeçildi'));
          }}
        >
          default — onay
        </Btn>
      </Section>
    </div>
  );
}

const container = document.getElementById('feedback-root');
if (!container) {
  throw new Error('#feedback-root bulunamadı');
}
createRoot(container).render(
  <FeedbackProvider>
    <DemoPage />
  </FeedbackProvider>,
);
