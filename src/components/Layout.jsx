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
    flights,
    loading
}) {
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);

    const toggleSidebar = () => {
        setIsSidebarExpanded(!isSidebarExpanded);
    };

    return (
        <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>

            <Sidebar 
                isExpanded={isSidebarExpanded} 
                onToggle={toggleSidebar}
                user={user}
                onLogout={onLogout}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                onExport={onExport}
                onImport={onImport}
            />

            <div className={`main-wrapper ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
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
                    <Outlet context={{ flights, loading }} />
                </main>
            </div>
        </div>
    );
}
