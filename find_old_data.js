
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDvtUxUN3Y-4OverV48AMmQfZpNPx694Ws",
    authDomain: "simflightlogger.firebaseapp.com",
    projectId: "simflightlogger",
    storageBucket: "simflightlogger.firebasestorage.app",
    messagingSenderId: "826767372110",
    appId: "1:826767372110:web:9d1258aaa8bc0a3f84781f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findData() {
    console.log("Searching for user data...");
    try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        
        console.log(`Found ${snapshot.docs.length} user documents.`);
        
        for (const userDoc of snapshot.docs) {
            const flightsCol = collection(db, 'users', userDoc.id, 'flights');
            const flightsSnapshot = await getDocs(flightsCol);
            
            console.log(`Checking UID: ${userDoc.id} (${userDoc.data().email || 'no email'}) - Flights: ${flightsSnapshot.docs.length}`);
            
            if (flightsSnapshot.docs.length > 0) {
                console.log(">>> THIS UID HAS DATA!");
            }
        }
    } catch (error) {
        console.error("Error during search:", error);
    }
    console.log("Search complete.");
    process.exit(0);
}

findData();
