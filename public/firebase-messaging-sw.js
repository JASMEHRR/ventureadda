/* eslint-disable no-undef */
/**
 * The service worker FCM requires in order to deliver a push while the site is
 * closed. It must live at this exact path and filename — the Firebase
 * messaging SDK registers `/firebase-messaging-sw.js` by convention, and a
 * worker anywhere else is never found.
 *
 * It is plain JavaScript in public/ rather than anything Vite compiles,
 * because a service worker is fetched by the browser at a fixed URL outside
 * the module graph. That has one consequence worth knowing: it cannot read
 * import.meta.env, so the Firebase config it needs is passed in the query
 * string by src/lib/push.ts at registration time. None of those values is a
 * secret — the whole web config ships in the client bundle already.
 *
 * `importScripts` with the compat build is the only form that works inside a
 * classic service worker; the modular SDK is ESM and a classic worker cannot
 * import it.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams

const config = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
}

// Registered without config, this worker would throw on every push and the
// failure would be invisible — service worker errors do not reach the page's
// console. Bailing loudly here is what makes a misconfiguration findable.
if (!config.projectId || !config.messagingSenderId) {
  console.error('[ventureadda] messaging worker started without Firebase config')
} else {
  firebase.initializeApp(config)

  // No onBackgroundMessage handler on purpose. Our notify-order function sends
  // a message with a `notification` block, which the browser displays by
  // itself; adding a handler that also calls showNotification is how you get
  // two notifications for one order.
  firebase.messaging()
}

/**
 * Focus an open tab rather than opening a second one.
 *
 * Without this, a seller who already has VentureAdda open and taps the
 * notification gets a duplicate tab, which on a phone is how you end up with
 * eleven of them.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.FCM_MSG?.notification?.click_action ?? '/orders', self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          client.navigate(target.href)
          return client.focus()
        }
      }
      return self.clients.openWindow(target.href)
    }),
  )
})
