/* =====================================================================
   shared/feedback — Genel proje mesaj/geri bildirim altyapısı
   ---------------------------------------------------------------------
   Tek giriş noktası. Kullanım:

     // main.jsx (bir kez)
     import { FeedbackProvider } from "./shared/feedback";
     <FeedbackProvider><App /></FeedbackProvider>

     // her yerden
     import { toast, confirmDialog, msg } from "./shared/feedback";
     toast.success(msg.crud.created("Birim"));
     if (!(await confirmDialog(msg.crud.deleteConfirm(ou.name, "Birim")))) return;
===================================================================== */
export { FeedbackProvider } from './FeedbackProvider';
export { toast, useToast } from './toast';
export { confirmDialog, promptDialog, useConfirm } from './confirm';
export { msg, pick, currentLang } from './messages';
export { clearToasts } from './store';

export type { Lang, Variants } from './messages';
export type {
  ToastKind,
  ToastOptions,
  ToastItem,
  ToastAction,
  ConfirmOptions,
  ConfirmTone,
} from './types';
