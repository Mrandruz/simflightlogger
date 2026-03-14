import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from './firebase';

import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Logbook from './components/Logbook';
import Briefing from './components/Briefing';
import NewFlight from './components/NewFlight';
import FlightEditModal from './components/FlightEditModal';
import LoginScreen from './components/LoginScreen';
import ConfirmModal from './components/ConfirmModal';
import Schedule from './components/Schedule';

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [flights, setFlights] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('simFlightTheme');
        if (saved === null) {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return saved === 'dark';
    });

    const [editingFlight, setEditingFlight] = useState(null);
    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, payload: null });
    const navigate = useNavigate();

    const getUserFlightsCollection = () => {
        if (!user) return null;
        return collection(db, 'users', user.uid, 'flights');
    };

    const getUserFlightDoc = (flightId) => {
        if (!user) return null;
        return doc(db, 'users', user.uid, 'flights', flightId);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) {
            setFlights([]);
            setLoading(false);
            return;
        }

        const fetchFlights = async () => {
            setLoading(true);
            try {
                const userFlightsCol = collection(db, 'users', user.uid, 'flights');
                const snapshot = await getDocs(userFlightsCol);
                const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                setFlights(data);
            } catch (error) {
                console.error('Error loading flights from Firestore:', error);
                const saved = localStorage.getItem('simFlights');
                if (saved) {
                    try { setFlights(JSON.parse(saved)); } catch (e) { /* ignore */ }
                }
            } finally {
                setLoading(false);
            }
        };
        fetchFlights();
    }, [user]);

    useEffect(() => {
        localStorage.setItem('simFlightTheme', isDarkMode ? 'dark' : 'light');
        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flights, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "simflights_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const userFlightsCol = getUserFlightsCollection();
        if (!userFlightsCol) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedFlights = JSON.parse(e.target.result);
                if (Array.isArray(importedFlights)) {
                    setConfirmModalState({
                        isOpen: true,
                        type: 'import',
                        payload: { importedFlights, userFlightsCol },
                    });
                } else {
                    alert("The file does not contain a valid flights format.");
                }
            } catch (error) {
                console.error('Import error:', error);
                alert("Error reading the JSON file.");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const confirmImport = async () => {
        const { importedFlights, userFlightsCol } = confirmModalState.payload;
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
            alert('Failed to import flights.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFlight = async (flight) => {
        const userFlightsCol = getUserFlightsCollection();
        if (!userFlightsCol) return;
        try {
            const { id, ...flightData } = flight;
            const docRef = await addDoc(userFlightsCol, flightData);
            setFlights(prev => [{ ...flightData, id: docRef.id }, ...prev]);

            // Note: Navigation removed. The NewFlight component handles showing a Toast
            // instead of immediately redirecting, providing better user feedback.

        } catch (error) {
            console.error('Error adding flight:', error);
            alert('Error saving flight. Please try again.');
        }
    };

    const handleUpdateFlight = async (updatedFlight) => {
        const flightDocRef = getUserFlightDoc(updatedFlight.id);
        if (!flightDocRef) return;
        try {
            const { id, ...flightData } = updatedFlight;
            await updateDoc(flightDocRef, flightData);
            setFlights(prev => prev.map(f => f.id === id ? updatedFlight : f));
            setEditingFlight(null);
        } catch (error) {
            console.error('Error updating flight:', error);
            alert('Error updating flight. Please try again.');
        }
    };

    const handleDeleteFlight = async (id) => {
        setConfirmModalState({
            isOpen: true,
            type: 'delete',
            payload: { id },
        });
    };

    const confirmDelete = async () => {
        const { id } = confirmModalState.payload;
        const flightDocRef = getUserFlightDoc(id);
        if (!flightDocRef) return;
        try {
            await deleteDoc(flightDocRef);
            setFlights(prev => prev.filter(f => f.id !== id));
        } catch (error) {
            console.error('Error deleting flight:', error);
            alert('Error deleting flight. Please try again.');
        }
    };

    const handleEditFlight = (flight) => {
        setEditingFlight(flight);
    };

    if (authLoading) {
        return (
            <div className={`app-container ${isDarkMode ? 'dark' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✈️</div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    if (loading) {
        return (
            <div className={`app-container ${isDarkMode ? 'dark' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✈️</div>
                    <p>Loading flights...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Routes>
                <Route
                    element={
                        <Layout
                            isDarkMode={isDarkMode}
                            toggleTheme={toggleTheme}
                            onExport={handleExport}
                            onImport={handleImport}
                            user={user}
                            onLogout={handleLogout}
                            flights={flights}
                        />
                    }
                >
                    <Route path="/" element={<Dashboard flights={flights} />} />
                    <Route path="/logbook" element={<Logbook flights={flights} onDelete={handleDeleteFlight} onEdit={handleEditFlight} />} />
                    <Route path="/briefing" element={<Briefing flights={flights} />} />
                    <Route path="/new-flight" element={<NewFlight onAddFlight={handleAddFlight} />} />
                    <Route path="/schedule" element={<Schedule flights={flights} />} />
                </Route>
            </Routes>

            {editingFlight && (
                <FlightEditModal
                    flight={editingFlight}
                    onUpdateFlight={handleUpdateFlight}
                    onCancel={() => setEditingFlight(null)}
                />
            )}

            <ConfirmModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, type: null, payload: null })}
                onConfirm={() => {
                    if (confirmModalState.type === 'delete') confirmDelete();
                    if (confirmModalState.type === 'import') confirmImport();
                }}
                title={confirmModalState.type === 'delete' ? "Delete Flight" : "Import Database"}
                message={confirmModalState.type === 'delete'
                    ? "Are you sure you want to completely remove this flight from your logbook? This action cannot be undone."
                    : "Warning: importing a JSON file will OVERWRITE all flights currently on your dashboard. Do you want to proceed?"}
                confirmText={confirmModalState.type === 'delete' ? "Delete" : "Overwrite & Import"}
                confirmStyle={confirmModalState.type === 'delete' ? 'danger' : 'warning'}
            />
        </>
    );
}
