import React from 'react';
import { PlaneTakeoff, Moon, Sun, Download, Upload } from 'lucide-react';

export default function Header({ isDarkMode, toggleTheme, onExport, onImport }) {
    return (
        <header style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-divider)',
            padding: 'var(--space-4) var(--space-6)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.05)'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)'
            }}>
                <div style={{
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                    padding: '8px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex'
                }}>
                    <PlaneTakeoff size={24} />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.25rem', margin: 0 }}>SimFlight Logger</h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Your professional sim flight logbook
                    </p>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        onClick={onExport}
                        style={{
                            background: 'none',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-surface)',
                            transition: 'all 0.2s'
                        }}
                        title="Export Data Backup (JSON)"
                    >
                        <Download size={20} />
                    </button>

                    <label
                        style={{
                            background: 'none',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-surface)',
                            transition: 'all 0.2s'
                        }}
                        title="Import Data Backup (JSON)"
                    >
                        <Upload size={20} />
                        <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
                    </label>

                    <div style={{ width: '1px', backgroundColor: 'var(--color-divider)', margin: '4px 8px' }}></div>

                    <button
                        onClick={toggleTheme}
                        style={{
                            background: 'none',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-surface)',
                            transition: 'all 0.2s'
                        }}
                        title={isDarkMode ? "Switch to light theme" : "Switch to dark theme"}
                    >
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>
        </header>
    );
}
