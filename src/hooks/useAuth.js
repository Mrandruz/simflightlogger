import { useState, useEffect } from 'react';
import { 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export function useAuth() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [userStatus, setUserStatus] = useState(null); // 'pending', 'approved', 'rejected'

    useEffect(() => {
        let unsubscribeStatus = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                console.log('Current User logged in:', firebaseUser.email, 'UID:', firebaseUser.uid);
                
                // Fetch or listen to user status in Firestore
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                
                unsubscribeStatus = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserStatus(docSnap.data().status);
                    } else {
                        setUserStatus('pending');
                    }
                    setAuthLoading(false);
                }, (error) => {
                    console.error('User status listener error:', error);
                    // Fallback for admin or unindexed users
                    if (firebaseUser.email?.toLowerCase() === 'and977@gmail.com') {
                        setUserStatus('approved');
                    } else {
                        setUserStatus('pending');
                    }
                    setAuthLoading(false);
                });
            } else {
                setUserStatus(null);
                setAuthLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeStatus();
        };
    }, []);

    const loginWithEmail = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const registerWithEmail = async (email, password, displayName) => {
        try {
            const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
            
            if (displayName) {
                await updateProfile(newUser, { displayName });
            }

            // Create user document in Firestore with pending status
            await setDoc(doc(db, 'users', newUser.uid), {
                email: newUser.email,
                displayName: displayName || newUser.email.split('@')[0],
                status: 'pending',
                createdAt: new Date().toISOString(),
                uid: newUser.uid
            });

            // Trigger notification (to be implemented)
            fetch('/api/register-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: newUser.email, 
                    displayName: displayName || newUser.email.split('@')[0],
                    uid: newUser.uid
                })
            }).catch(err => console.error('Notification failed:', err));

        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    const isAuthorized = userStatus === 'approved' || (user && user.email?.toLowerCase() === 'and977@gmail.com');
    const isAdmin = user && user.email?.toLowerCase() === 'and977@gmail.com';

    return { 
        user, 
        authLoading, 
        userStatus, 
        isAuthorized, 
        isAdmin,
        loginWithEmail, 
        registerWithEmail, 
        logout 
    };
}
