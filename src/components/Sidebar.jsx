import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Book, MapPin, ChevronLeft, ChevronRight, Moon, Sun, LogOut, Download, Upload, Calendar, ShieldCheck, Activity, Trophy, Layers } from 'lucide-react';

export default function Sidebar({ 
    isExpanded, 
    onToggle, 
    user, 
    onLogout, 
    isDarkMode, 
    toggleTheme,
    onExport,
    onImport,
    isAdmin
}) {
    return (
        <nav className={`sidebar ${isExpanded ? 'expanded' : ''}`}>
            <div className="sidebar-header" style={{ 
                flexDirection: 'column', 
                height: 'auto', 
                gap: 'var(--space-2)',
                alignItems: 'center'
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    width: '100%',
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    overflow: 'hidden',
                }}>
                    {isExpanded ? (
                        /* Full wordmark when expanded — text color adapts to theme */
                        <svg width="160" height="38" viewBox="0 0 220 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Skydeck">
                            <polygon points="24,3 41,12.5 41,31.5 24,41 7,31.5 7,12.5"
                                fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.2"/>
                            <polygon points="24,3 41,12.5 41,22 7,22 7,12.5"
                                fill="#146AFF" fillOpacity="0.08"/>
                            <line x1="10" y1="23" x2="38" y2="23" stroke="var(--color-border)" strokeWidth="1"/>
                            <circle cx="14" cy="17.5" r="2.8" fill="#146AFF"/>
                            <circle cx="33" cy="13.5" r="2.8" fill="#146AFF"/>
                            <line x1="17" y1="16.8" x2="30" y2="14.2"
                                stroke="#146AFF" strokeWidth="1.8" strokeLinecap="round"/>
                            <text x="52" y="29"
                                fontFamily="'Poppins', 'Inter', -apple-system, sans-serif"
                                fontSize="22" fontWeight="600" letterSpacing="-0.4"
                                fill="var(--color-text-primary)">Skydeck</text>
                            <text x="53" y="43"
                                fontFamily="'Inter', -apple-system, sans-serif"
                                fontSize="9" fontWeight="500" letterSpacing="1.6"
                                fill="var(--color-text-hint)">FLIGHT LOGGER</text>
                        </svg>
                    ) : (
                        /* Icon only when collapsed */
                        <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Skydeck">
                            <polygon points="24,3 41,12.5 41,31.5 24,41 7,31.5 7,12.5"
                                fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.2"/>
                            <polygon points="24,3 41,12.5 41,22 7,22 7,12.5"
                                fill="#146AFF" fillOpacity="0.08"/>
                            <line x1="10" y1="23" x2="38" y2="23" stroke="var(--color-border)" strokeWidth="1"/>
                            <circle cx="14" cy="17.5" r="2.8" fill="#146AFF"/>
                            <circle cx="33" cy="13.5" r="2.8" fill="#146AFF"/>
                            <line x1="17" y1="16.8" x2="30" y2="14.2"
                                stroke="#146AFF" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                    )}
                </div>
                <button 
                    className="sidebar-toggle-btn" 
                    onClick={onToggle}
                    aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                    style={{ 
                        alignSelf: isExpanded ? 'flex-end' : 'center',
                        marginTop: isExpanded ? '-10px' : '0'
                    }}
                >
                    {isExpanded ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                </button>
            </div>

            <div className="sidebar-nav">

                {/* ── Core flight flow ── */}
                <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
                    <LayoutDashboard size={20} aria-hidden="true" />
                    <span className="link-text">Dashboard</span>
                    {!isExpanded && <span className="tooltip">Dashboard</span>}
                </NavLink>

                <NavLink to="/schedule" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Calendar size={20} aria-hidden="true" />
                    <span className="link-text">Schedule</span>
                    {!isExpanded && <span className="tooltip">Schedule</span>}
                </NavLink>

                <NavLink to="/briefing" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <MapPin size={20} aria-hidden="true" />
                    <span className="link-text">Briefing</span>
                    {!isExpanded && <span className="tooltip">Briefing</span>}
                </NavLink>

                <NavLink to="/logbook" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Book size={20} aria-hidden="true" />
                    <span className="link-text">Logbook</span>
                    {!isExpanded && <span className="tooltip">Logbook</span>}
                </NavLink>

                {/* ── Divider ── */}
                <div className="sidebar-divider" />

                {/* ── Additional tools ── */}                <NavLink to="/hangar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Activity size={20} aria-hidden="true" />
                    <span className="link-text">Hangar</span>
                    {!isExpanded && <span className="tooltip">The Hangar</span>}
                </NavLink>

                <NavLink to="/hubs" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Layers size={20} aria-hidden="true" />
                    <span className="link-text">Hubs</span>
                    {!isExpanded && <span className="tooltip">Hubs</span>}
                </NavLink>

                <NavLink to="/achievements" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Trophy size={20} aria-hidden="true" />
                    <span className="link-text">Achievements</span>
                    {!isExpanded && <span className="tooltip">Achievements</span>}
                </NavLink>

                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        style={{ color: 'var(--color-warning)' }}
                    >
                        <ShieldCheck size={20} aria-hidden="true" />
                        <span className="link-text">Admin</span>
                        {!isExpanded && <span className="tooltip">Admin Panel</span>}
                    </NavLink>
                )}
            </div>

            <div className="sidebar-footer">
                <div className="sidebar-divider" />
                
                <button 
                    className="sidebar-link has-tooltip" 
                    onClick={onExport} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', position: 'relative' }}
                    aria-label="Export flights data backup"
                >
                    <Download size={20} aria-hidden="true" />
                    <span className="link-text">Export Backup</span>
                    {!isExpanded && <span className="tooltip">Export Backup</span>}
                </button>

                <label 
                    className="sidebar-link has-tooltip" 
                    style={{ cursor: 'pointer', width: '100%', margin: 0, position: 'relative' }}
                    aria-label="Import flights data backup"
                >
                    <Upload size={20} aria-hidden="true" />
                    <span className="link-text">Import Backup</span>
                    {!isExpanded && <span className="tooltip">Import Backup</span>}
                    <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} aria-label="Upload JSON backup file" />
                </label>

                <button 
                    className="sidebar-link has-tooltip" 
                    onClick={toggleTheme} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', position: 'relative' }}
                    aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                    {isDarkMode ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
                    <span className="link-text">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    {!isExpanded && <span className="tooltip">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
                </button>

                {user && (
                    <div className="user-section" style={{ 
                        marginTop: 'var(--space-2)',
                        display: 'flex',
                        flexDirection: isExpanded ? 'row' : 'column',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: isExpanded ? 'var(--space-2)' : '0',
                        width: '100%'
                    }}>
                        <img
                            src={user.photoURL || (user.email?.toLowerCase() === 'and977@gmail.com' ? "/avatar.jpg" : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=1a73e8&color=fff&size=32`)}
                            alt="User"
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                border: '2px solid var(--color-border)',
                                objectFit: 'cover'
                            }}
                            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=1a73e8&color=fff&size=32` }}
                        />
                        {isExpanded && (
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <p style={{ 
                                    fontSize: '0.85rem', 
                                    fontWeight: 400,
                                    margin: 0, 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    color: 'var(--color-text-primary)',
                                }}>
                                    {user.displayName || 'Pilot'}
                                </p>
                            </div>
                        )}
                        <button 
                            className="sidebar-toggle-btn has-tooltip" 
                            onClick={onLogout}
                            aria-label="Sign out"
                            style={{ padding: '8px', position: 'relative' }}
                        >
                            <LogOut size={18} aria-hidden="true" />
                            <span className="tooltip" style={{ left: 'auto', right: '100%', marginRight: 'var(--space-3)', width: 'auto' }}>Sign Out</span>
                        </button>
                    </div>
                )}
            </div>

        </nav>
    );
}
