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
  var title = payload.notification.title || "Minutics";
  var options = {
    body: payload.notification.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: payload.data && payload.data.tag || "minutics-bg",
    requireInteraction: false
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].focus) return list[i].focus();
      }
      return clients.openWindow("./");
    })
  );
});
