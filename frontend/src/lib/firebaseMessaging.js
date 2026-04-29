import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import api from "./api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const isConfigured = () =>
  Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey
  );

export async function initFirebaseMessaging() {
  if (!isConfigured()) return;
  if (!(await isSupported())) return;

  try {
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const params = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });
    const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
    const fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    if (fcmToken) {
      await api.post("/notifications/register-device", { token: fcmToken }).catch(() => {});
    }

    onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || "Enterprise CRM";
      const body = payload?.notification?.body || "You have a new update.";
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/logo.png" });
      }
    });
  } catch (error) {
    console.warn("Firebase messaging init failed", error);
  }
}
