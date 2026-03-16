import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Book, MapPin, PlusCircle, Compass, ChevronLeft, ChevronRight, Moon, Sun, LogOut, Download, Upload, Calendar, ShieldCheck } from 'lucide-react';

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
                    gap: 'var(--space-3)',
                    width: '100%',
                    justifyContent: isExpanded ? 'flex-start' : 'center'
                }}>
                    <Compass size={28} color="var(--color-primary)" aria-hidden="true" />
                    {isExpanded && <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>SimFlight</h2>}
                </div>
                <button 
                    className="sidebar-toggle-btn" 
                    onClick={onToggle}
                    aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                    style={{ 
                        alignSelf: isExpanded ? 'flex-end' : 'center',
                        marginTop: isExpanded ? '-10px' : '0' // Subtle adjustment if expanded
                    }}
                >
                    {isExpanded ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                </button>
            </div>

            <div className="sidebar-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    end
                >
                    <LayoutDashboard size={24} aria-hidden="true" />
                    <span className="link-text">Dashboard</span>
                    {!isExpanded && <span className="tooltip">Dashboard</span>}
                </NavLink>

                <NavLink
                    to="/logbook"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <Book size={24} aria-hidden="true" />
                    <span className="link-text">Logbook</span>
                    {!isExpanded && <span className="tooltip">Logbook</span>}
                </NavLink>

                <NavLink
                    to="/schedule"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <Calendar size={24} aria-hidden="true" />
                    <span className="link-text">Schedule</span>
                    {!isExpanded && <span className="tooltip">Schedule</span>}
                </NavLink>

                <NavLink
                    to="/briefing"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <MapPin size={24} aria-hidden="true" />
                    <span className="link-text">Briefing</span>
                    {!isExpanded && <span className="tooltip">Briefing</span>}
                </NavLink>

                <div className="sidebar-divider"></div>

                <NavLink
                    to="/new-flight"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <PlusCircle size={24} aria-hidden="true" />
                    <span className="link-text">New Flight</span>
                    {!isExpanded && <span className="tooltip">New Flight</span>}
                </NavLink>

                {isAdmin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        style={{ color: 'var(--color-warning)' }}
                    >
                        <ShieldCheck size={24} aria-hidden="true" />
                        <span className="link-text">Admin</span>
                        {!isExpanded && <span className="tooltip">Admin Panel</span>}
                    </NavLink>
                )}
            </div>

            <div className="sidebar-footer">
                <div className="sidebar-divider"></div>
                
                <button 
                    className="sidebar-link has-tooltip" 
                    onClick={onExport} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', position: 'relative' }}
                    aria-label="Export flights data backup"
                >
                    <Download size={24} aria-hidden="true" />
                    <span className="link-text">Export Backup</span>
                    {!isExpanded && <span className="tooltip">Export Backup</span>}
                </button>

                <label 
                    className="sidebar-link has-tooltip" 
                    style={{ cursor: 'pointer', width: '100%', margin: 0, position: 'relative' }}
                    aria-label="Import flights data backup"
                >
                    <Upload size={24} aria-hidden="true" />
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
                    {isDarkMode ? <Sun size={24} aria-hidden="true" /> : <Moon size={24} aria-hidden="true" />}
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
                            src={user.photoURL || "/avatar.jpg"}
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
                                    fontWeight: 600, 
                                    margin: 0, 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis' 
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
                            <LogOut size={20} aria-hidden="true" />
                            <span className="tooltip" style={{ left: 'auto', right: '100%', marginRight: 'var(--space-3)', width: 'auto' }}>Sign Out</span>
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
