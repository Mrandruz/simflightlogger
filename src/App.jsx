import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Logbook from './components/Logbook';
import Briefing from './components/Briefing';
import NewFlight from './components/NewFlight';
import FlightEditModal from './components/FlightEditModal';
import LoginScreen from './components/LoginScreen';
import ConfirmModal from './components/ConfirmModal';
import Schedule from './components/Schedule';
import AppSkeleton from './components/AppSkeleton';
import AdminPanel from './components/AdminPanel';
import DataRecovery from './components/DataRecovery';

import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useFlights } from './hooks/useFlights';
import { useToast } from './context/ToastContext';

export default function App() {
    const { user, authLoading, logout, isAuthorized, isAdmin } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const { showToast } = useToast();
    const { 
        flights, 
        loading, 
        addFlight, 
        updateFlight, 
        deleteFlight, 
        importFlights, 
        exportFlights 
    } = useFlights(user);

    const [editingFlight, setEditingFlight] = useState(null);
    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, type: null, payload: null });

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedFlights = JSON.parse(e.target.result);
                if (Array.isArray(importedFlights)) {
                    setConfirmModalState({
                        isOpen: true,
                        type: 'import',
                        payload: { importedFlights },
                    });
                } else {
                    showToast("The file does not contain a valid flights format.", "error");
                }
            } catch (error) {
                console.error('Import error:', error);
                showToast("Error reading the JSON file.", "error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const confirmImport = async () => {
        try {
            await importFlights(confirmModalState.payload.importedFlights);
            setConfirmModalState({ isOpen: false, type: null, payload: null });
        } catch (error) {
            showToast('Failed to import flights.', 'error');
        }
    };

    const handleAddFlight = async (flight) => {
        try {
            await addFlight(flight);
        } catch (error) {
            showToast('Error saving flight. Please try again.', 'error');
        }
    };

    const handleUpdateFlight = async (updatedFlight) => {
        try {
            await updateFlight(updatedFlight);
            setEditingFlight(null);
        } catch (error) {
            showToast('Error updating flight. Please try again.', 'error');
        }
    };

    const confirmDelete = async () => {
        try {
            await deleteFlight(confirmModalState.payload.id);
            setConfirmModalState({ isOpen: false, type: null, payload: null });
        } catch (error) {
            showToast('Error deleting flight. Please try again.', 'error');
        }
    };

    if (authLoading) {
        return <AppSkeleton isDarkMode={isDarkMode} />;
    }

    if (!user) {
        return <LoginScreen />;
    }

    if (!isAuthorized) {
        return (
            <div className="pending-access">
                <div className="login-card">
                    <h2>Access Pending</h2>
                    <p>Your account has been created, but it's currently awaiting approval from the administrator.</p>
                    <p>You will be notified once your access is granted.</p>
                    <button onClick={logout} className="google-login-btn mt-4">Sign Out</button>
                </div>
            </div>
        );
    }

    if (loading) {
        return <AppSkeleton isDarkMode={isDarkMode} />;
    }

    return (
        <>
            <Routes>
                <Route
                    element={
                        <Layout
                            isDarkMode={isDarkMode}
                            toggleTheme={toggleTheme}
                            onExport={exportFlights}
                            onImport={handleImport}
                            user={user}
                            onLogout={logout}
                            isAdmin={isAdmin}
                            flights={flights}
                        />
                    }
                >
                    <Route path="/" element={<Dashboard flights={flights} />} />
                    <Route path="/logbook" element={<Logbook flights={flights} onDelete={(id) => setConfirmModalState({ isOpen: true, type: 'delete', payload: { id } })} onEdit={setEditingFlight} />} />
                    <Route path="/briefing" element={<Briefing flights={flights} />} />
                    <Route path="/new-flight" element={<NewFlight onAddFlight={handleAddFlight} flights={flights} />} />
                    <Route path="/schedule" element={<Schedule flights={flights} user={user} />} />
                    {isAdmin && <Route path="/admin" element={<AdminPanel />} />}
                    {isAdmin && <Route path="/admin/recovery" element={<DataRecovery />} />}
                </Route>
            </Routes>

            {editingFlight && (
                <FlightEditModal
                    flight={editingFlight}
                    onUpdateFlight={handleUpdateFlight}
                    onCancel={() => setEditingFlight(null)}
                    flights={flights}
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
