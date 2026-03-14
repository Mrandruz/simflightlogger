import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Book, MapPin, PlusCircle, Compass, ChevronLeft, ChevronRight, Moon, Sun, LogOut, Download, Upload } from 'lucide-react';

export default function Sidebar({ 
    isExpanded, 
    onToggle, 
    user, 
    onLogout, 
    isDarkMode, 
    toggleTheme,
    onExport,
    onImport
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
                    <Compass size={28} color="var(--color-primary)" />
                    {isExpanded && <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>SimFlight</h2>}
                </div>
                <button 
                    className="sidebar-toggle-btn" 
                    onClick={onToggle}
                    style={{ 
                        alignSelf: isExpanded ? 'flex-end' : 'center',
                        marginTop: isExpanded ? '-10px' : '0' // Subtle adjustment if expanded
                    }}
                >
                    {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            <div className="sidebar-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    end
                >
                    <LayoutDashboard size={24} />
                    <span className="link-text">Dashboard</span>
                    {!isExpanded && <span className="tooltip">Dashboard</span>}
                </NavLink>

                <NavLink
                    to="/logbook"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <Book size={24} />
                    <span className="link-text">Logbook</span>
                    {!isExpanded && <span className="tooltip">Logbook</span>}
                </NavLink>

                <NavLink
                    to="/briefing"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <MapPin size={24} />
                    <span className="link-text">Briefing</span>
                    {!isExpanded && <span className="tooltip">Briefing</span>}
                </NavLink>

                <div className="sidebar-divider"></div>

                <NavLink
                    to="/new-flight"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <PlusCircle size={24} />
                    <span className="link-text">New Flight</span>
                    {!isExpanded && <span className="tooltip">New Flight</span>}
                </NavLink>
            </div>

            <div className="sidebar-footer">
                <div className="sidebar-divider"></div>
                
                <button 
                    className="sidebar-link" 
                    onClick={onExport} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
                    title="Export Backup"
                >
                    <Download size={24} />
                    <span className="link-text">Export Backup</span>
                    {!isExpanded && <span className="tooltip">Export Backup</span>}
                </button>

                <label 
                    className="sidebar-link" 
                    style={{ cursor: 'pointer', width: '100%', margin: 0 }}
                    title="Import Backup"
                >
                    <Upload size={24} />
                    <span className="link-text">Import Backup</span>
                    {!isExpanded && <span className="tooltip">Import Backup</span>}
                    <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
                </label>

                <button 
                    className="sidebar-link" 
                    onClick={toggleTheme} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
                >
                    {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
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
                        {user.photoURL && (
                            <img
                                src={user.photoURL}
                                alt="User"
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    border: '2px solid var(--color-border)'
                                }}
                            />
                        )}
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
                            className="sidebar-toggle-btn" 
                            onClick={onLogout}
                            title="Sign Out"
                            style={{ padding: '8px' }}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
