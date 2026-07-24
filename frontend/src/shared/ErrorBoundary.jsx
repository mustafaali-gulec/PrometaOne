import React from 'react';

// Kök hata sınırı: herhangi bir ekranın render çökmesi tüm uygulamayı beyaz
// ekrana düşürmesin diye main.jsx'te en dışta sarılır. App context'lerinin
// dışında yaşadığı için dili license.js ile aynı yoldan çözer.
const MESSAGES = {
  tr: {
    title: 'Beklenmeyen bir hata oluştu',
    body: 'Ekran çizilirken bir hata yakalandı. Sayfayı yenileyerek devam edebilirsiniz; sorun sürerse yöneticinize bildirin.',
    reload: 'Sayfayı Yenile',
    detail: 'Teknik ayrıntı',
  },
  en: {
    title: 'An unexpected error occurred',
    body: 'An error was caught while rendering this screen. Reload the page to continue; if the problem persists, contact your administrator.',
    reload: 'Reload Page',
    detail: 'Technical details',
  },
  de: {
    title: 'Ein unerwarteter Fehler ist aufgetreten',
    body: 'Beim Zeichnen dieses Bildschirms wurde ein Fehler abgefangen. Laden Sie die Seite neu, um fortzufahren; wenn das Problem weiterhin besteht, wenden Sie sich an Ihren Administrator.',
    reload: 'Seite neu laden',
    detail: 'Technische Details',
  },
  ar: {
    title: 'حدث خطأ غير متوقع',
    body: 'تم اكتشاف خطأ أثناء عرض هذه الشاشة. أعد تحميل الصفحة للمتابعة؛ وإذا استمرت المشكلة فتواصل مع المسؤول.',
    reload: 'إعادة تحميل الصفحة',
    detail: 'التفاصيل التقنية',
  },
};

function resolveLang() {
  try {
    const w = window.__PROMETA_LANG__;
    if (w && MESSAGES[w]) return w;
  } catch {
    /* yoksay */
  }
  try {
    // App.jsx S katmanı JSON.stringify ile yazar → JSON.parse gerekli
    const raw = window.localStorage.getItem('promet:lang');
    if (raw) {
      let v = raw;
      try {
        v = JSON.parse(raw);
      } catch {
        /* düz string olabilir */
      }
      if (v && MESSAGES[v]) return v;
    }
  } catch {
    /* yoksay */
  }
  return 'tr';
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary render hatası yakaladı:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const lang = resolveLang();
    const m = MESSAGES[lang];
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg, #f5f5f4)',
          color: 'var(--ink, #1c1917)',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: 'var(--paper, #fff)',
            border: '1px solid var(--line, #e7e5e4)',
            borderRadius: 8,
            padding: '28px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{m.title}</h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--ink-mute, #78716c)',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}
          >
            {m.body}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 700,
              border: 'none',
              borderRadius: 6,
              background: 'var(--accent, #0f766e)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {m.reload}
          </button>
          <details style={{ marginTop: 20, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            <summary style={{ fontSize: 11, color: 'var(--ink-mute, #78716c)', cursor: 'pointer' }}>
              {m.detail}
            </summary>
            <pre
              style={{
                fontSize: 10.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                direction: 'ltr',
                background: 'var(--bg-alt, #fafaf9)',
                padding: 10,
                borderRadius: 4,
                marginTop: 8,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
