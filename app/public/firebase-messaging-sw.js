importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBXruwmDU9SAX4nAe5_Do-x-5qmi_SFh7E",
  authDomain: "lifetime-a4bde.firebaseapp.com",
  projectId: "lifetime-a4bde",
  storageBucket: "lifetime-a4bde.firebasestorage.app",
  messagingSenderId: "330723236770",
  appId: "1:330723236770:web:7df53f2dba32fe87b0f0fb"
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("SW: background message", payload);
  var title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "Minutics";
  var body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "";
  self.registration.showNotification(title, {
    body: body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: (payload.data && payload.data.tag) || "minutics-bg",
    requireInteraction: true,
    silent: false
  });
});

self.addEventListener("push", function (event) {
  if (!event.data) return;
  var payload;
  try { payload = event.data.json(); } catch (e) { return; }

  var title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "Minutics";
  var body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "";
  var tag = (payload.data && payload.data.tag) || "minutics-push";
  var link = (payload.data && payload.data.link) || "";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: tag,
      requireInteraction: true,
      silent: false,
      data: { url: link || "./" }
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes(new URL(url, self.location.origin).pathname)) {
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
