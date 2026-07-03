/* =====================================================================
   shared/feedback — Tipler
   ---------------------------------------------------------------------
   Tüm proje için ortak "geri bildirim" katmanının tip tanımları:
   anlık bildirimler (toast) ve onay diyalogları (confirm).
===================================================================== */
import type { ReactNode } from 'react';

/** Toast türü — renk, ikon ve varsayılan süreyi belirler. */
export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'loading';

/** Toast üzerinde opsiyonel tek aksiyon (ör. "Geri Al"). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** `toast.*` çağrılarına verilebilecek seçenekler. */
export interface ToastOptions {
  /** Başlığın altında ikincil açıklama satırı. */
  description?: string;
  /** ms cinsinden görünme süresi. 0 veya negatif → otomatik kapanmaz. */
  duration?: number;
  /** Sağda tek aksiyon butonu. */
  action?: ToastAction;
  /** Var olan bir toast'u güncellemek/tekilleştirmek için sabit kimlik. */
  id?: string;
}

/** Store'da tutulan, çözümlenmiş (resolved) toast kaydı. */
export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  /** Çözümlenmiş süre (ms). <= 0 ise yapışkan. */
  duration: number;
  action?: ToastAction;
  createdAt: number;
}

/** Onay diyaloğunun tonu — "danger" yıkıcı (silme vb.) işlemler için kırmızı. */
export type ConfirmTone = 'default' | 'danger';

/** `confirmDialog(...)` seçenekleri. */
export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Verilirse diyalog tek satırlık metin girişi gösterir (promptDialog). */
  input?: { placeholder?: string; defaultValue?: string };
}

/** Store'da bekleyen onay isteği — sonucu Promise'e bağlar. */
export interface ConfirmRequest extends ConfirmOptions {
  id: string;
  /** input'lu isteklerde value onaylanan giriş metnidir; onaysızda undefined. */
  resolve: (ok: boolean, value?: string) => void;
}
