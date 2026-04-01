import React from 'react';
import { useAuth } from '../hooks/useAuth';
import ARIAAssistant from './ARIAAssistant';

/**
 * Logo Velar inline come SVG — nessuna dipendenza da file esterni.
 * Adatta automaticamente i colori alle variabili CSS del tema (light/dark).
 */
function VelarLogo({ height = 32 }) {
    return (
        <svg
            height={height}
            viewBox="0 0 420 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Velar"
            style={{ display: 'block' }}
        >
            {/* ── Icona V ── */}
            {/* Gradiente blu dell'icona — usa colori Velar originali */}
            <defs>
                <linearGradient id="velar-grad-top" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3ab4f2"/>
                    <stop offset="100%" stopColor="#146AFF"/>
                </linearGradient>
                <linearGradient id="velar-grad-bot" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#146AFF"/>
                    <stop offset="100%" stopColor="#0e3fa8"/>
                </linearGradient>
            </defs>

            {/* Freccia superiore destra (chiara) */}
            <polygon
                points="58,10 110,80 85,80 42,22"
                fill="url(#velar-grad-top)"
            />
            {/* Freccia sinistra (scura) */}
            <polygon
                points="10,10 58,80 42,80 10,30"
                fill="url(#velar-grad-bot)"
            />
            {/* Freccia inferiore (più chiara) */}
            <polygon
                points="42,80 85,80 68,120 26,120"
                fill="url(#velar-grad-top)"
                opacity="0.75"
            />

            {/* ── Testo VELAR ── usa la variabile CSS del testo primario */}
            <text
                x="130"
                y="105"
                fontFamily="'Poppins', 'Inter', sans-serif"
                fontSize="82"
                fontWeight="700"
                letterSpacing="-2"
                fill="var(--color-text-primary)"
            >
                VELAR
            </text>

            {/* ── Sottotitolo ── */}
            <text
                x="132"
                y="140"
                fontFamily="'Inter', sans-serif"
                fontSize="22"
                fontWeight="400"
                letterSpacing="1"
                fill="var(--color-text-hint)"
            >
                Motion, simplified.
            </text>
        </svg>
    );
}

export default function ARIAPage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="page-container" style={styles.centered}>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                    Accedi per utilizzare ARIA.
                </p>
            </div>
        );
    }

    return (
        <div className="page-container" style={styles.page}>

            {/* ── Page header ── */}
            <div style={styles.pageHeader}>
                <div style={styles.pageHeaderLeft}>
                    <div style={styles.sectionLabel}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                stroke="var(--color-primary)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span>AI ASSISTANT</span>
                    </div>
                    <h1 style={styles.pageTitle}>Flight Planning & Dispatch</h1>
                </div>

                <VelarLogo height={38} />
            </div>

            {/* ── ARIA ── */}
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
        padding: '0', // Full-page, no padding
        width: '100%',
        height: 'calc(100vh - 64px)', // Adjust for potential header
    },
    centered: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    pageHeader: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '16px',
    },
    pageHeaderLeft: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    sectionLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--color-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontFamily: 'var(--font-family-sans)',
    },
    pageTitle: {
        margin: 0,
        fontSize: '28px',
        fontWeight: 500,
        fontFamily: 'var(--font-family-display)',
        color: 'var(--color-text-primary)',
        lineHeight: 1.2,
    },
};
