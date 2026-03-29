import React from 'react';
import { useAuth } from '../hooks/useAuth';
import ARIAAssistant from './ARIAAssistant';

export default function ARIAPage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="page-container" style={styles.centered}>
                <p style={styles.hint}>Accedi per utilizzare ARIA.</p>
            </div>
        );
    }

    return (
        <div className="page-container" style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>ARIA</h1>
                    <p style={styles.subtitle}>Adaptive Route Intelligence Assistant · Velar Virtual Airline</p>
                </div>
                <div style={styles.badge}>
                    <span style={styles.badgeDot} />
                    Online
                </div>
            </div>

            <ARIAAssistant
                userId={user.uid}
                pilotName={user.displayName || 'Pilota'}
            />
        </div>
    );
}

const styles = {
    page: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '860px',
        margin: '0 auto',
        padding: '32px 24px',
    },
    centered: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    hint: {
        color: 'var(--color-text-secondary)',
        fontSize: '14px',
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    title: {
        margin: 0,
        fontSize: '26px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--color-text-primary)',
    },
    subtitle: {
        margin: '4px 0 0',
        fontSize: '13px',
        color: 'var(--color-text-secondary)',
        letterSpacing: '0.01em',
    },
    badge: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 500,
        color: '#22c55e',
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: '20px',
        padding: '4px 12px',
    },
    badgeDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#22c55e',
        boxShadow: '0 0 6px #22c55e',
    },
};
