import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDvtUxUN3Y-4OverV48AMmQfZpNPx694Ws",
    authDomain: "simflightlogger.firebaseapp.com",
    projectId: "simflightlogger",
    storageBucket: "simflightlogger.firebasestorage.app",
    messagingSenderId: "826767372110",
    appId: "1:826767372110:web:9d1258aaa8bc0a3f84781f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
