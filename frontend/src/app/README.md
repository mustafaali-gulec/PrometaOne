# `frontend/src/app/`

Yeni uygulama iskeleti. Bootstrap + global provider'lar + routing.

```
app/
├── App.tsx          ← Yeni root component (eski 81K App.jsx DEĞİL)
├── main.tsx         ← createRoot + render
├── routes.tsx       ← React Router config (lazy modüller)
└── providers.tsx    ← Theme, QueryClient, i18n, Auth provider'ları
```

## ⚠️ Strangler Fig durumu

Şu an `frontend/src/main.jsx` hâlâ eski `App.jsx`'i mount ediyor. Bu klasör boş ve hazır — ilk modüller buraya gelmeye başlayınca aktive olacak.

**Aktivasyon planı** (`docs/MIGRATION_ROADMAP.md`):

1. İlk modül (notifications) tamamlandığında `app/App.tsx` yazılır
2. `main.jsx` → `main.tsx`'e geçer
3. Vite entry `app/main.tsx` olur
4. Eski `App.jsx` bir route altına yerleşir (ör. `/legacy/*`) ve oradan eski kod çağrılır
5. Modüller bir bir migrate edildikçe `/legacy/*` küçülür
6. Son modül de migrate edilince `App.jsx` silinir

Detay: `docs/adr/0003-strangler-fig-migration.md`.
