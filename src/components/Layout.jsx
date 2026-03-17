import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Activity, Wifi, Cpu, Zap, Heart } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import PilotProfileCard from './PilotProfileCard';

const StatusBar = () => (
    <div className="status-bar">
        <div className="status-bar-section">
            <span>v1.11.1 • Elite Hangar Update</span>
            <span style={{ marginLeft: 'var(--space-1)', opacity: 0.7 }}>•</span>
            <div className="has-tooltip" style={{ marginLeft: 'var(--space-1)' }}>
                <span className="hover-opacity" style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}>Credits</span>
                <div className="tooltip-box">
                    <div style={{ 
                        fontFamily: 'var(--font-family-mono)', 
                        fontSize: '0.7rem', 
                        lineHeight: '1.8',
                        letterSpacing: '0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 'bold', marginBottom: '4px' }}>
                            A project by Andrea Lana
                            <img src="/avatar.jpg" alt="AL" style={{ height: '14px', width: '14px', borderRadius: '50%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }}>
                            Coded with Antigravity
                            <img src="/antigravity-icon.png" alt="AG" style={{ height: '12px', width: '12px' }} />
                            &nbsp;+ Gemini 3
                            <img 
                                src={`/gemini-icon.png?v=${Date.now()}`} 
                                alt="G3" 
                                style={{ 
                                    height: '14px', 
                                    width: 'auto', 
                                    objectFit: 'contain'
                                }} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="status-bar-section" style={{ marginLeft: 'auto' }}>
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
    </div>
);

export default function Layout({
    isDarkMode,
    toggleTheme,
    onExport,
    onImport,
    user,
    onLogout,
    flights,
    loading,
    isAdmin
}) {
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const location = useLocation();
    const isNewFlightPage = location.pathname === '/new-flight';

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
                isAdmin={isAdmin}
            />

            <div className={`main-wrapper ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
                <Header />

                <main className="main-content" style={{ 
                    display: isNewFlightPage ? 'flex' : 'block',
                    flexDirection: 'column',
                    justifyContent: isNewFlightPage ? 'center' : 'flex-start',
                    minHeight: isNewFlightPage ? 'calc(100vh - 120px)' : 'auto'
                }}>
                    {/* Hide Pilot Profile on New Flight page to save space */}
                    {!isNewFlightPage && (
                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <PilotProfileCard flights={flights} user={user} />
                        </div>
                    )}

                    {/* Dynamic Page Content */}
                    <Outlet context={{ flights, loading, isDarkMode }} />
                </main>

                <StatusBar />
            </div>
        </div>
    );
}
