# `frontend/src/shared/`

Birden çok modülün ihtiyaç duyduğu, **modüllere özgü olmayan** kod.

```
shared/
├── ui/        ← Generic Button, Modal, Table, Input
├── lib/       ← formatDate, currency, http, validators
├── types/     ← Brand types, utility types, Result<T,E>
├── hooks/     ← useAuth, useTheme, useLocale
└── i18n/      ← TR/EN/DE/AR translations
```

Kural: `shared/` modüllerden hiçbir şey import etmez. Tek yönlü: modüller `shared/`'tan import eder, tersi yasak (ESLint zorlar).

Bir kod sadece tek bir modülde kullanılıyorsa **shared'a koyma** — o modülün içine koy. Sonra başka modül de ihtiyaç duyarsa shared'a taşı.
