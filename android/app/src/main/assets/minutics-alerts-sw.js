self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
    if (windows.length) return windows[0].focus();
    return clients.openWindow("./");
  }));
});
