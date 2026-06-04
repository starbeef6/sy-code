import { setStore } from './core';
import { t } from '../lib/i18n';

let notificationTimer: ReturnType<typeof setTimeout> | null = null;

export function showNotification(message: string): void {
  if (notificationTimer) clearTimeout(notificationTimer);
  setStore('notification', t(message));
  notificationTimer = setTimeout(() => {
    setStore('notification', null);
    notificationTimer = null;
  }, 3000);
}

export function clearNotification(): void {
  if (notificationTimer) clearTimeout(notificationTimer);
  notificationTimer = null;
  setStore('notification', null);
}
