import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyDvtUxUN3Y-4OverV48AMmQfZpNPx694Ws",
    authDomain: "simflightlogger.firebaseapp.com",
    projectId: "simflightlogger",
    storageBucket: "simflightlogger.firebasestorage.app",
    messagingSenderId: "826767372110",
    appId: "1:826767372110:web:9d1258aaa8bc0a3f84781f"
};

const app = initializeApp(firebaseConfig);

// ── Firebase App Check (reCAPTCHA v3) ────────────────────────────────
// Garantisce che le richieste provengano solo dall'app reale su Vercel,
// bloccando script esterni e bot anche se autenticati.
initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider("6LeHIJUsAAAAAFvLEaXUrHPkS-bTHWzjCVmPi6Ir"),
    isTokenAutoRefreshEnabled: true,
});

export const db = getFirestore(app);
export const auth = getAuth(app);
