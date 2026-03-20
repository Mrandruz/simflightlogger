import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Logbook from './components/Logbook';
import Briefing from './components/Briefing';
import NewFlight from './components/NewFlight';
import FlightEditModal from './components/FlightEditModal';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import DataRecovery from './components/DataRecovery';
import Schedule from './components/Schedule';
import AppSkeleton from './components/AppSkeleton';
import Hangar from './components/Hangar';
import FlightCopilot from './components/FlightCopilot';

import { ConfirmProvider, useConfirm } from './context/ConfirmContext';

import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useFlights } from './hooks/useFlights';
import { useToast } from './context/ToastContext';

export default function App() {
    const { user, authLoading, logout, isAuthorized, isAdmin } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const hasRedirected = useRef(false);

    useEffect(() => {
        if (!authLoading && user && !hasRedirected.current) {
            hasRedirected.current = true;
            navigate('/');
        }
        if (!user) {
            hasRedirected.current = false;
        }
    }, [user, authLoading, navigate]);
    const { showToast } = useToast();
    const { askConfirm } = useConfirm();
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

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedFlights = JSON.parse(e.target.result);
                if (Array.isArray(importedFlights)) {
                    const confirmed = await askConfirm({
                        title: 'Import Database',
                        message: 'Warning: importing a JSON file will MERGE these flights into your account. Do you want to proceed?',
                        confirmText: 'Import & Merge',
                        confirmType: 'primary',
                        icon: 'database'
                    });

                    if (confirmed) {
                        await importFlights(importedFlights);
                        showToast('Flights imported successfully', 'success');
                    }
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

    const handleDeleteClick = async (id) => {
        const confirmed = await askConfirm({
            title: 'Delete Flight',
            message: 'Are you sure you want to completely remove this flight from your logbook? This action cannot be undone.',
            confirmText: 'Delete Forever',
            confirmType: 'danger',
            icon: 'trash'
        });

        if (confirmed) {
            try {
                await deleteFlight(id);
                showToast('Flight deleted', 'success');
            } catch (error) {
                showToast('Error deleting flight. Please try again.', 'error');
            }
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
                    <Route path="/logbook" element={<Logbook flights={flights} onDelete={handleDeleteClick} onEdit={setEditingFlight} />} />
                    <Route path="/briefing" element={<Briefing flights={flights} />} />
                    <Route path="/new-flight" element={<NewFlight onAddFlight={handleAddFlight} flights={flights} />} />
                    <Route path="/schedule" element={<Schedule flights={flights} user={user} />} />
                    <Route path="/hangar" element={<Hangar />} />
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

            <FlightCopilot flights={flights} isDarkMode={isDarkMode} user={user} />
        </>
    );
}
