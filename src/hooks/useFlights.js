import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export function useFlights(user) {
    const [flights, setFlights] = useState([]);
    const [loading, setLoading] = useState(false);

    const getUserFlightsCollection = () => {
        if (!user) return null;
        return collection(db, 'users', user.uid, 'flights');
    };

    const getUserFlightDoc = (flightId) => {
        if (!user) return null;
        return doc(db, 'users', user.uid, 'flights', flightId);
    };

    useEffect(() => {
        if (!user) {
            setFlights([]);
            setLoading(false);
            return;
        }

        const fetchFlights = async () => {
            console.log('useFlights: Starting fetch for user', user.uid);
            setLoading(true);
            try {
                const userFlightsCol = collection(db, 'users', user.uid, 'flights');
                const snapshot = await getDocs(userFlightsCol);
                const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                console.log('useFlights: Successfully fetched', data.length, 'flights');
                setFlights(data);
            } catch (error) {
                console.error('useFlights: Error loading flights from Firestore:', error);
                const saved = localStorage.getItem('simFlights');
                if (saved) {
                    try { 
                        const data = JSON.parse(saved);
                        console.log('useFlights: Falling back to localStorage, found', data.length, 'flights');
                        setFlights(data); 
                    } catch (e) { /* ignore */ }
                }
            } finally {
                setLoading(false);
                console.log('useFlights: Loading finished');
            }
        };
        fetchFlights();
    }, [user]);

    const addFlight = async (flight) => {
        const userFlightsCol = getUserFlightsCollection();
        if (!userFlightsCol) return;
        try {
            const { id, ...flightData } = flight;
            const docRef = await addDoc(userFlightsCol, flightData);
            const newFlight = { ...flightData, id: docRef.id };
            setFlights(prev => [newFlight, ...prev]);
            return newFlight;
        } catch (error) {
            console.error('Error adding flight:', error);
            throw error;
        }
    };

    const updateFlight = async (updatedFlight) => {
        const flightDocRef = getUserFlightDoc(updatedFlight.id);
        if (!flightDocRef) return;
        try {
            const { id, ...flightData } = updatedFlight;
            await updateDoc(flightDocRef, flightData);
            setFlights(prev => prev.map(f => f.id === id ? updatedFlight : f));
        } catch (error) {
            console.error('Error updating flight:', error);
            throw error;
        }
    };

    const deleteFlight = async (flightId) => {
        const flightDocRef = getUserFlightDoc(flightId);
        if (!flightDocRef) return;
        try {
            await deleteDoc(flightDocRef);
            setFlights(prev => prev.filter(f => f.id !== flightId));
        } catch (error) {
            console.error('Error deleting flight:', error);
            throw error;
        }
    };

    const importFlights = async (importedFlights) => {
        const userFlightsCol = getUserFlightsCollection();
        if (!userFlightsCol) return;
        try {
            setLoading(true);
            const snapshot = await getDocs(userFlightsCol);
            const deletePromises = snapshot.docs.map(d => deleteDoc(getUserFlightDoc(d.id)));
            await Promise.all(deletePromises);

            const newFlights = [];
            for (const flight of importedFlights) {
                const { id, ...flightData } = flight;
                const docRef = await addDoc(userFlightsCol, flightData);
                newFlights.push({ ...flightData, id: docRef.id });
            }
            setFlights(newFlights);
        } catch (error) {
            console.error('Import process error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const exportFlights = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flights, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "simflights_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return { 
        flights, 
        loading, 
        addFlight, 
        updateFlight, 
        deleteFlight, 
        importFlights, 
        exportFlights 
    };
}
