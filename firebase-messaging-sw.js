// This file must sit in the same folder as index.html (site root) so its
// scope covers the whole app. It only handles notifications that arrive
// while the app is closed or in the background — foreground messages are
// handled directly inside index.html instead.

importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

// Same values as the firebaseConfig block in index.html.
firebase.initializeApp({
  apiKey: "AIzaSyCtPPf6YKZ9U5cxXIu01LIXaJ_roo3gNOY",
  authDomain: "fleet-tracker-ebd10.firebaseapp.com",
  projectId: "fleet-tracker-ebd10",
  storageBucket: "fleet-tracker-ebd10.firebasestorage.app",
  messagingSenderId: "509479364229",
  appId: "1:509479364229:web:28e7e64fd238b9d0a62bec"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Fleet Compliance Log';
  const body = (payload.notification && payload.notification.body) || 'A vehicle needs attention.';
  self.registration.showNotification(title, {
    body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
  });
});
