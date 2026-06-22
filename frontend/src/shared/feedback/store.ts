/* =====================================================================
   shared/feedback — Store
   ---------------------------------------------------------------------
   Framework'ten bağımsız tekil (singleton) durum deposu. React dışından
   da (App.jsx'teki düz handler'lar dahil) yazılabilmesi için imperative
   API'ler (toast.ts / confirm.ts) bu modülü kullanır; React tarafı ise
   useSyncExternalStore ile aboneliği kurar.
===================================================================== */
import { useSyncExternalStore } from 'react';

import type { ToastItem, ConfirmRequest } from './types';

type Listener = () => void;

let toasts: ToastItem[] = [];
let confirmRequest: ConfirmRequest | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ---------- Toast mutasyonları ---------- */

export function addToast(item: ToastItem): void {
  // Aynı id ile gelirse üzerine yaz (idempotent güncelleme).
  const existing = toasts.some((t) => t.id === item.id);
  toasts = existing ? toasts.map((t) => (t.id === item.id ? item : t)) : [...toasts, item];
  emit();
}

export function updateToast(id: string, patch: Partial<ToastItem>): void {
  let changed = false;
  toasts = toasts.map((t) => {
    if (t.id !== id) return t;
    changed = true;
    return { ...t, ...patch };
  });
  if (changed) emit();
}

export function removeToast(id: string): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

export function clearToasts(): void {
  if (toasts.length > 0) {
    toasts = [];
    emit();
  }
}

function getToasts(): ToastItem[] {
  return toasts;
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getToasts, getToasts);
}

/* ---------- Onay (confirm) durumu ---------- */

export function setConfirmRequest(req: ConfirmRequest | null): void {
  confirmRequest = req;
  emit();
}

function getConfirmRequest(): ConfirmRequest | null {
  return confirmRequest;
}

export function useConfirmRequest(): ConfirmRequest | null {
  return useSyncExternalStore(subscribe, getConfirmRequest, getConfirmRequest);
}
