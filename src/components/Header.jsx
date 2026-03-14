import React from 'react';
import { PlaneTakeoff } from 'lucide-react';

export default function Header({ isDarkMode, toggleTheme, onExport, onImport, user, onLogout }) {
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
            </div>
        </header>
    );
}
