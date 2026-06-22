/* =====================================================================
   shared/feedback — Imperative Toast API
   ---------------------------------------------------------------------
   `alert(...)` yerine her yerden (React dışı düz fonksiyonlardan da)
   çağrılabilen anlık bildirim API'si.

       import { toast } from "@/shared/feedback";
       toast.success("Kayıt eklendi");
       toast.error("İşlem başarısız", { description: err.message });
       const id = toast.loading("Yükleniyor…");
       toast.update(id, "success", "Tamamlandı");
===================================================================== */
import { addToast, removeToast, updateToast } from './store';
import type { ToastItem, ToastKind, ToastOptions } from './types';

/** Türe göre varsayılan görünme süresi (ms). loading → yapışkan. */
const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 7000,
  loading: 0,
};

let seq = 0;
function nextId(): string {
  seq += 1;
  return `tst_${seq}`;
}

function show(kind: ToastKind, title: string, opts: ToastOptions = {}): string {
  const id = opts.id ?? nextId();
  const item: ToastItem = {
    id,
    kind,
    title,
    duration: opts.duration ?? DEFAULT_DURATION[kind],
    createdAt: Date.now(),
  };
  // exactOptionalPropertyTypes: undefined atamak yerine alanı yoksay.
  if (opts.description !== undefined) item.description = opts.description;
  if (opts.action !== undefined) item.action = opts.action;
  addToast(item);
  return id;
}

export const toast = {
  success: (title: string, opts?: ToastOptions): string => show('success', title, opts),
  error: (title: string, opts?: ToastOptions): string => show('error', title, opts),
  warning: (title: string, opts?: ToastOptions): string => show('warning', title, opts),
  info: (title: string, opts?: ToastOptions): string => show('info', title, opts),
  loading: (title: string, opts?: ToastOptions): string =>
    show('loading', title, { duration: 0, ...opts }),

  /** Belirli bir toast'u kapat. */
  dismiss: (id: string): void => removeToast(id),

  /** Var olan bir toast'u (genelde loading → success/error) güncelle. */
  update: (id: string, kind: ToastKind, title: string, opts?: ToastOptions): void => {
    const patch: Partial<ToastItem> = {
      kind,
      title,
      duration: opts?.duration ?? DEFAULT_DURATION[kind],
    };
    if (opts?.description !== undefined) patch.description = opts.description;
    if (opts?.action !== undefined) patch.action = opts.action;
    updateToast(id, patch);
  },
};

/** React bileşenleri için ergonomik erişim (aynı tekil API'yi döndürür). */
export function useToast(): typeof toast {
  return toast;
}
