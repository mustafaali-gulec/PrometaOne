# `shared/feedback/` — Proje Mesaj / Geri Bildirim Altyapısı

Tüm proje için **tek, tutarlı ve anlamlı** kullanıcı geri bildirimi katmanı.
Native `alert()` ve `confirm()` yerine geçer; mesaj metinlerini tek merkezde
(çok dilli) toplar.

## Neden?

`App.jsx` içinde geri bildirim dağınıktı:

- **121×** `alert(...)` — bloklayan, stillenemez, tema-dışı kutular
- **92×** `confirm(...)` — native onay kutuları, "tehlike" vurgusu yok
- **~5000×** satır-içi `lang === "en" ? ... : ...` — merkezi olmayan, tutarsız metin

Bu modül üçünü de tek bir API'de toplar.

## Parçalar

| Dosya                                     | Görev                                                               |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `toast.ts`                                | `toast.success/error/warning/info/loading` — `alert` yerine         |
| `confirm.ts`                              | `confirmDialog(opts): Promise<boolean>` — `confirm` yerine          |
| `messages.ts`                             | **Anlamlı, çok dilli mesaj kataloğu** (`msg.*`) — tek metin kaynağı |
| `store.ts`                                | Framework-bağımsız tekil store (React dışından da yazılır)          |
| `ToastViewport.tsx` / `ConfirmDialog.tsx` | Tema-uyumlu görünümler (`var(--*)`)                                 |
| `FeedbackProvider.tsx`                    | Kökte bir kez monte edilen host                                     |

## Kullanım

```jsx
import { toast, confirmDialog, msg } from './shared/feedback';

// Bildirim
toast.success('Kayıt eklendi');
toast.error('İşlem başarısız', { description: err.message });

// Anlamlı katalog mesajları (çağrı anında dili okur)
toast.warning(msg.validation.required('Birim adı'));
toast.error(msg.crud.cannotDelete(ou.name, ['3 alt birim', '2 departman']));

// Onay (Promise tabanlı)
if (!(await confirmDialog(msg.crud.deleteConfirm(ou.name, 'Birim')))) return;
```

> **Önemli:** `messages.ts` içindeki her giriş bir **fonksiyondur** ve çağrı
> anında `window.__PROMETA_LANG__`'ı okur. `msg.x` referansını saklamayın,
> her zaman `msg.x()` çağırın.

## Eski `notify(...)` ile ilişki

`App.jsx`'teki eski tek-slotluk `notify(...)` bu sisteme **köprülendi** — yani
mevcut tüm başarı mesajları otomatik olarak yeni istiflenen toast'lara yükseldi;
çağrı yerlerini değiştirmek gerekmedi.

## Migrasyon (devam eden)

`alert(...)` → `toast.error/warning(...)`, `confirm(...)` → `await confirmDialog(...)`.
Pilot: HR org/departman/pozisyon/personel (`HrOrgModule`). Diğer modüller
aşamalı taşınır; yeni metinler `messages.ts` kataloğuna eklenir.
