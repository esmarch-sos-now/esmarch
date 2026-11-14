const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export async function GET() {
  const config = JSON.stringify(firebaseConfig);
  const source = `
    importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");
    firebase.initializeApp(${config});
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      return self.registration.showNotification(data.title || "Có yêu cầu SOS mới", {
        body: data.body || "Có người cần hỗ trợ trong khu vực bạn đã đăng ký.",
        tag: "sos-request-" + (data.requestId || "new"),
        requireInteraction: true,
        data: { url: data.url || "/app/san-sang-ho-tro" }
      });
    });
    self.addEventListener("notificationclick", (event) => {
      event.notification.close();
      const target = new URL(event.notification.data?.url || "/app/san-sang-ho-tro", self.location.origin).href;
      event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }));
    });
  `;
  return new Response(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
