const admin = require("firebase-admin");

let initialized = false;

const initializeFirebaseAdmin = () => {
  if (initialized) return true;
  try {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawServiceAccount) return false;
    const serviceAccount = JSON.parse(rawServiceAccount);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    initialized = true;
    return true;
  } catch (error) {
    console.warn("FCM init failed", error?.message || error);
    return false;
  }
};

const sendMulticast = async ({ tokens = [], title, body, data = {} }) => {
  if (!tokens.length) return { successCount: 0, failureCount: 0 };
  if (!initializeFirebaseAdmin()) return { skipped: true, successCount: 0, failureCount: tokens.length };

  const messaging = admin.messaging();
  try {
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: "high" },
      apns: {
        payload: { aps: { sound: "default", contentAvailable: true } },
        headers: { "apns-priority": "10" },
      },
    });
    return result;
  } catch (error) {
    console.warn("FCM send failed", error?.message || error);
    return { successCount: 0, failureCount: tokens.length };
  }
};

module.exports = {
  sendMulticast,
};
