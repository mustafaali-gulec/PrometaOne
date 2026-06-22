/* =====================================================================
   shared/feedback — FeedbackProvider
   ---------------------------------------------------------------------
   Uygulama kökünde BİR KEZ monte edilir (main.jsx). Toast istifini ve
   onay diyaloğunu render eder, gerekli keyframe'leri enjekte eder.
   Context gerektirmez — imperative API (toast / confirmDialog) tekil
   store üzerinden çalışır, bu yüzden sağlayıcı yalnızca "host"tur.
===================================================================== */
import type { ReactElement, ReactNode } from 'react';

import { ConfirmDialog } from './ConfirmDialog';
import { ToastViewport } from './ToastViewport';

const STYLES = `
@keyframes prometa-fb-toast-in { from { opacity: 0; transform: translateY(-10px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes prometa-fb-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes prometa-fb-spin { to { transform: rotate(360deg); } }
.prometa-fb-toast-in { animation: prometa-fb-toast-in .2s cubic-bezier(.21,1.02,.73,1); }
.prometa-fb-fade-in { animation: prometa-fb-fade-in .15s ease; }
.prometa-fb-spin { animation: prometa-fb-spin .8s linear infinite; transform-origin: center; }
@media (prefers-reduced-motion: reduce) {
  .prometa-fb-toast-in, .prometa-fb-fade-in { animation: none; }
}
`;

export function FeedbackProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      <style>{STYLES}</style>
      {children}
      <ToastViewport />
      <ConfirmDialog />
    </>
  );
}
