/* =====================================================================
   shared/feedback — Imperative Confirm API
   ---------------------------------------------------------------------
   Native `confirm(...)` yerine, Promise tabanlı, stillenebilir ve
   tema-uyumlu onay diyaloğu. Her yerden çağrılabilir.

       if (!(await confirmDialog({ title: "Silinsin mi?", tone: "danger" }))) return;

   Aynı anda tek diyalog gösterilir; yeni bir istek gelirse önceki
   "false" ile çözülür.
===================================================================== */
import { setConfirmRequest } from './store';
import type { ConfirmOptions } from './types';

let seq = 0;
function nextId(): string {
  seq += 1;
  return `cnf_${seq}`;
}

let pending: ((ok: boolean) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  // Açık bir diyalog varsa onu iptal edilmiş say.
  if (pending) {
    pending(false);
    pending = null;
  }
  return new Promise<boolean>((resolve) => {
    pending = resolve;
    setConfirmRequest({
      ...opts,
      id: nextId(),
      resolve: (ok: boolean) => {
        pending = null;
        resolve(ok);
      },
    });
  });
}

/** Native prompt() yerine — tek satırlık metin girişli diyalog.
    Onayda girilen metni (boş olabilir), vazgeçmede null döndürür. */
export interface PromptDialogOptions {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function promptDialog(opts: PromptDialogOptions): Promise<string | null> {
  if (pending) {
    pending(false);
    pending = null;
  }
  return new Promise<string | null>((resolve) => {
    const settle = (ok: boolean, value?: string): void => {
      pending = null;
      resolve(ok ? (value ?? '') : null);
    };
    pending = (ok: boolean) => settle(ok);
    setConfirmRequest({
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      input: { placeholder: opts.placeholder, defaultValue: opts.defaultValue },
      id: nextId(),
      resolve: settle,
    });
  });
}

/** React bileşenleri için ergonomik erişim. */
export function useConfirm(): typeof confirmDialog {
  return confirmDialog;
}
