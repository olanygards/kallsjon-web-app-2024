import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// Validate Firebase config
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
] as const;

for (const envVar of requiredEnvVars) {
  if (!import.meta.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized already
let app: FirebaseApp;
let db: Firestore;

try {
  const apps = getApps();
  if (!apps.length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = apps[0];
  }
  db = getFirestore(app);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

// Test Firestore connection
const testConnection = async () => {
  try {
    // You can add more connection testing here if needed
  } catch (error) {
    console.error('Firestore connection test failed:', error);
  }
};

// App Check
// IMPORTANT: In dev, App Check debug tokens must be allowlisted in Firebase Console if enforcement is enabled.
// To avoid blocking local development, App Check is opt-in in DEV via VITE_ENABLE_FIREBASE_APPCHECK="true".
const enableAppCheck =
  import.meta.env.PROD || String(import.meta.env.VITE_ENABLE_FIREBASE_APPCHECK).toLowerCase() === 'true';

// Initialize Storage with explicit bucket URL to avoid default bucket issues
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const storage = getStorage(app, `gs://${storageBucket}`);

// Initialize Auth
const auth = getAuth(app);

if (enableAppCheck) {
  // DEV: generate debug token and print it (must be allowlisted if enforcement is on)
  if (import.meta.env.DEV) {
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    const recaptchaKey =
      import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
      '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Google's public test key

    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (e) {
    console.warn('App Check initialization warning:', e);
  }
} else if (import.meta.env.DEV) {
  console.info('Firebase App Check is disabled in DEV. Set VITE_ENABLE_FIREBASE_APPCHECK="true" to enable it.');
}

testConnection();

export { db, storage, auth }; 