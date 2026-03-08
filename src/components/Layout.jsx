import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PilotProfileCard from './PilotProfileCard';

export default function Layout({
    isDarkMode,
    toggleTheme,
    onExport,
    onImport,
    user,
    onLogout,
    flights
}) {
    return (
        <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>

            <Sidebar />

            <div className="main-wrapper">
                <Header
                    isDarkMode={isDarkMode}
                    toggleTheme={toggleTheme}
                    onExport={onExport}
                    onImport={onImport}
                    user={user}
                    onLogout={onLogout}
                />

                <main className="main-content">
                    {/* Shared Pilot Profile that stays at the top of every page */}
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <PilotProfileCard flights={flights} />
                    </div>

                    {/* Dynamic Page Content */}
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
