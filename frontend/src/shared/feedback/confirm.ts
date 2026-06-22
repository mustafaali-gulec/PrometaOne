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

/** React bileşenleri için ergonomik erişim. */
export function useConfirm(): typeof confirmDialog {
  return confirmDialog;
}
