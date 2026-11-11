/* MKS Unified Service Worker — Web, Windows Desktop (.exe) & Mobile PWA Notifications */
const MKS_SW_VERSION = '8.2.1-b29';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'SHOW_NOTIFICATION' && data.title) {
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png?v=8.2.1',
      badge: '/icons/favicon.png?v=8.2.1',
      tag: data.tag || `mks-${Date.now()}`,
      renotify: Boolean(data.renotify),
      data: {
        targetView: data.targetView || 'NOTIFICATIONS',
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetView = (event.notification.data && event.notification.data.targetView) || 'NOTIFICATIONS';
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'MKS_NOTIFICATION_CLICK',
            targetView
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        const sep = targetUrl.includes('?') ? '&' : '?';
        return self.clients.openWindow(`${targetUrl}${sep}openView=${encodeURIComponent(targetView)}`);
      }
      return undefined;
    })
  );
});
