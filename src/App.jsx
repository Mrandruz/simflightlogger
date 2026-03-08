import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import Header from './components/Header';
import FlightForm from './components/FlightForm';
import Dashboard from './components/Dashboard';
import FlightEditModal from './components/FlightEditModal';

const flightsCollection = collection(db, 'flights');

export default function App() {
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

    // Load flights from Firestore on mount
    useEffect(() => {
        const fetchFlights = async () => {
            try {
                const snapshot = await getDocs(flightsCollection);
                const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                setFlights(data);
            } catch (error) {
                console.error('Error loading flights from Firestore:', error);
                // Fallback to localStorage
                const saved = localStorage.getItem('simFlights');
                if (saved) {
                    try { setFlights(JSON.parse(saved)); } catch (e) { /* ignore */ }
                }
            } finally {
                setLoading(false);
            }
        };
        fetchFlights();
    }, []);

    // Save theme to local storage and update body
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
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedFlights = JSON.parse(e.target.result);
                if (Array.isArray(importedFlights)) {
                    if (window.confirm("Warning: importing will OVERWRITE all flights currently on your dashboard. Do you want to proceed?")) {
                        // Delete all existing flights from Firestore
                        const snapshot = await getDocs(flightsCollection);
                        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'flights', d.id)));
                        await Promise.all(deletePromises);

                        // Add all imported flights to Firestore
                        const newFlights = [];
                        for (const flight of importedFlights) {
                            const { id, ...flightData } = flight; // remove old id
                            const docRef = await addDoc(flightsCollection, flightData);
                            newFlights.push({ ...flightData, id: docRef.id });
                        }
                        setFlights(newFlights);
                    }
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

    const handleAddFlight = async (flight) => {
        try {
            const { id, ...flightData } = flight; // remove client-generated id
            const docRef = await addDoc(flightsCollection, flightData);
            setFlights(prev => [{ ...flightData, id: docRef.id }, ...prev]);
        } catch (error) {
            console.error('Error adding flight:', error);
            alert('Error saving flight. Please try again.');
        }
    };

    const handleUpdateFlight = async (updatedFlight) => {
        try {
            const { id, ...flightData } = updatedFlight;
            await updateDoc(doc(db, 'flights', id), flightData);
            setFlights(prev => prev.map(f => f.id === id ? updatedFlight : f));
            setEditingFlight(null);
        } catch (error) {
            console.error('Error updating flight:', error);
            alert('Error updating flight. Please try again.');
        }
    };

    const handleDeleteFlight = async (id) => {
        if (!window.confirm('Are you sure you want to delete this flight? This action cannot be undone.')) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'flights', id));
            setFlights(prev => prev.filter(f => f.id !== id));
        } catch (error) {
            console.error('Error deleting flight:', error);
            alert('Error deleting flight. Please try again.');
        }
    };

    const handleEditFlight = (flight) => {
        setEditingFlight(flight);
    };

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
        <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
            <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} onExport={handleExport} onImport={handleImport} />
            <main className="main-content">
                <aside>
                    <FlightForm onAddFlight={handleAddFlight} />
                </aside>
                <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>
                    <Dashboard flights={flights} onDelete={handleDeleteFlight} onEdit={handleEditFlight} />
                </section>
            </main>
            {editingFlight && (
                <FlightEditModal
                    flight={editingFlight}
                    onUpdateFlight={handleUpdateFlight}
                    onCancel={() => setEditingFlight(null)}
                />
            )}
        </div>
    );
}
