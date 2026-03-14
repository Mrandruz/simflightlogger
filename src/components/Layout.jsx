import React from 'react';
import { Outlet } from 'react-router-dom';
import { Activity, Wifi, Cpu, Zap, Heart } from 'lucide-react';
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

    const StatusBar = () => (
        <div className="status-bar">
            <div className="status-bar-section">
                <span>v1.2.4 • Stable</span>
            </div>

            <div className="status-bar-section">
                <div className="status-item">
                    <Wifi size={12} className="status-icon" style={{ color: '#F6821F' }} />
                    <span>Firebase</span>
                    <div className="status-dot pulse"></div>
                </div>
                <div className="status-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="status-icon" style={{ opacity: 0.9 }}>
                        <path d="M17.5,19c-3.03,0-5.5-2.47-5.5-5.5s2.47-5.5,5.5-5.5c2.47,0,4.5,2.03,4.5,4.5S20,17,17.5,17l-3,0c-0.55,0-1,0.45-1,1s0.45,1,1,1L17.5,19z M6.5,19C3.47,19,1,16.53,1,13.5S3.47,8,6.5,8c2.47,0,4.5,2.03,4.5,4.5S8.97,17,6.5,17l3,0c0.55,0,1,0.45,1,1s-0.45,1-1,1L6.5,19z" />
                    </svg>
                    <span>SimBrief</span>
                    <div className="status-dot pulse"></div>
                </div>
                <div className="status-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="status-icon" style={{ color: '#00adef' }}>
                        <path d="M12,2L14.39,9.57L22,12L14.39,14.43L12,22L9.61,14.43L2,12L9.61,9.57L12,2Z" />
                    </svg>
                    <span>Navigraph</span>
                    <div className="status-dot pulse"></div>
                </div>
            </div>

            <div className="status-bar-section">
                <span>Designed with <Heart size={10} fill="#ff4d4d" color="#ff4d4d" style={{ verticalAlign: 'middle', margin: '0 2px' }} /> by <img src="/antigravity-icon.png" alt="Antigravity" style={{ height: '14px', verticalAlign: 'middle', margin: '0 2px' }} /> <strong>Antigravity</strong></span>
            </div>
        </div>
    );

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

                <StatusBar />
            </div>
        </div>
    );
}
