import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useSimBrief } from '../hooks/useSimBrief';
import SkydeckLogo from './SkydeckLogo';

const QUOTES = [
    { text: "The engine is the heart of an airplane, but the pilot is its soul.", author: "Walter Raleigh" },
    { text: "Once you have tasted flight, you will forever walk the earth with your eyes turned skyward.", author: "Leonardo da Vinci" },
    { text: "Aviation is proof that given the will, we have the capacity to achieve the impossible.", author: "Eddie Rickenbacker" },
    { text: "The air up there in the clouds is very pure and fine, bracing and delicious.", author: "Mark Twain" },
    { text: "To most people, the sky is the limit. To those who love aviation, the sky is home.", author: "Jerry Crawford" },
    { text: "Flying is learning how to throw yourself at the ground and miss.", author: "Douglas Adams" },
    { text: "The desire to fly is an idea handed down to us by our ancestors who looked enviously at birds.", author: "Wilbur Wright" },
    { text: "In flying, the road is always with you.", author: "Antoine de Saint-Exupéry" },
    { text: "There is no sport equal to that which aviators enjoy while being carried through the air on great white wings.", author: "Wilbur Wright" },
    { text: "Flight is the only truly new sensation that men have achieved in modern history.", author: "James Dickey" },
    { text: "A pilot who says he has never been frightened is either lying or hasn't been flying long enough.", author: "R.A. Bob Hoover" },
    { text: "The most beautiful thing in the world is, of course, the world itself.", author: "Wallace Stevens" },
    { text: "You haven't seen a tree until you've seen its shadow from the sky.", author: "Amelia Earhart" },
    { text: "I fly because it releases my mind from the tyranny of petty things.", author: "Antoine de Saint-Exupéry" },
    { text: "Lovers of air travel find it exhilarating to hang poised between the illusion of immortality and the fact of death.", author: "Alexander Chase" },
];

const getTodayQuote = () => {
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return QUOTES[day % QUOTES.length];
};

const formatZuluShort = (val) => {
    if (!val) return null;
    const d = !isNaN(Number(val)) && String(val).length >= 10
        ? new Date(Number(val) * 1000)
        : new Date(val);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}z`;
};

const NextFlightPill = ({ flights = [] }) => {
    const navigate = useNavigate();
    const { data, loading, error } = useSimBrief();
    const [hovered, setHovered] = React.useState(false);
    const [now, setNow] = React.useState(() => Date.now());

    // Tick every minute to re-evaluate the 30-min threshold
    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    const pillBase = {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 14px',
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        flexShrink: 0,
        height: '40px',
    };

    if (loading) {
        return (
            <div style={{ ...pillBase }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-border)' }} />
                <div style={{ width: '110px', height: '12px', borderRadius: '3px', background: 'var(--color-border)' }} />
            </div>
        );
    }

    if (!data || error) return null;

    // Check if SimBrief flight is already in logbook (same dep+arr+date)
    const simDate = data.departureTime
        ? (() => {
            const d = !isNaN(Number(data.departureTime)) && String(data.departureTime).length >= 10
                ? new Date(Number(data.departureTime) * 1000)
                : new Date(data.departureTime);
            return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        })()
        : null;

    const matchedFlight = Array.isArray(flights) && data.origin?.icao && data.destination?.icao
        ? flights.find(f => {
            const depMatch = String(f.departure || '').toUpperCase() === data.origin.icao.toUpperCase();
            const arrMatch = String(f.arrival   || '').toUpperCase() === data.destination.icao.toUpperCase();
            if (!depMatch || !arrMatch) return false;
            if (!simDate || !f.date) return true;
            const diffDays = Math.abs((new Date(f.date) - new Date(simDate)) / 86400000);
            return diffDays <= 7;
        })
        : null;

    // 30 minutes in ms after logbook insertion
    const THRESHOLD_MS = 30 * 60 * 1000;
    const loggedAt = matchedFlight?.createdAt
        ? (typeof matchedFlight.createdAt === 'number'
            ? matchedFlight.createdAt
            : matchedFlight.createdAt?.toMillis?.() ?? Date.parse(matchedFlight.createdAt))
        : null;
    const isLogged = !!matchedFlight;
    const pastThreshold = loggedAt !== null && (now - loggedAt) >= THRESHOLD_MS;
    const showNoFlights = isLogged && pastThreshold;

    const depTime = formatZuluShort(data.departureTime);

    // ── No flights planned pill ──
    if (showNoFlights) {
        return (
            <div style={{ position: 'relative', flexShrink: 0 }}>
                {hovered && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 10px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(22, 36, 51, 0.92)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: '#ffffff',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                    }}>
                        Plan your next flight
                        <div style={{
                            position: 'absolute', bottom: '100%', left: '50%',
                            transform: 'translateX(-50%)', width: 0, height: 0,
                            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                            borderBottom: '5px solid rgba(22, 36, 51, 0.92)',
                        }} />
                    </div>
                )}
                <button
                    onClick={() => navigate('/briefing')}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    style={{
                        ...pillBase,
                        cursor: 'pointer',
                        border: '1px dashed var(--color-border)',
                        opacity: hovered ? 0.8 : 1,
                        transition: 'opacity 0.15s ease',
                        gap: '8px',
                    }}
                >
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-text-hint)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                            No flights planned
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', lineHeight: 1.2 }}>
                            Plan your next flight →
                        </span>
                    </div>
                </button>
            </div>
        );
    }

    // ── Normal next flight pill ──
    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            {hovered && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(22, 36, 51, 0.92)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    pointerEvents: 'none',
                    zIndex: 1000,
                }}>
                    Open briefing
                    <div style={{
                        position: 'absolute', bottom: '100%', left: '50%',
                        transform: 'translateX(-50%)', width: 0, height: 0,
                        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                        borderBottom: '5px solid rgba(22, 36, 51, 0.92)',
                    }} />
                </div>
            )}
            <button
                onClick={() => navigate('/briefing')}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{ ...pillBase, cursor: 'pointer', transition: 'opacity 0.15s ease', opacity: hovered ? 0.8 : 1 }}
            >
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#146AFF', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                        Next flight
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)', lineHeight: 1.2 }}>
                        {data.origin?.icao} → {data.destination?.icao}
                    </span>
                </div>
                <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                        {data.aircraft}
                    </span>
                    {depTime && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', lineHeight: 1 }}>{depTime}</span>
                    )}
                </div>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>
        </div>
    );
};

export default function Header({ flights = [] }) {
    const { isDarkMode } = useTheme();
    const quote = getTodayQuote();

    const divider    = 'var(--color-border)';
    const quoteColor = 'var(--color-text-hint)';

    return (
        <header style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: `1px solid ${divider}`,
            padding: '0 var(--space-6)',
            height: '60px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.05)',
            display: 'flex',
            alignItems: 'center',
        }}>
            <div style={{
                maxWidth: '1400px', width: '100%', margin: '0 auto',
                display: 'flex', alignItems: 'center', gap: '20px',
            }}>
                <SkydeckLogo isDarkMode={isDarkMode} height={38} />

                <div style={{ width: '1px', height: '24px', background: divider, flexShrink: 0 }} />

                {/* Citazione */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill={quoteColor} style={{ flexShrink: 0, opacity: 0.5 }}>
                        <path d="M3 6a3 3 0 013-3h1v1.5H6a1.5 1.5 0 00-1.5 1.5V7H6a2 2 0 010 4H4a2 2 0 01-2-2V6zm7 0a3 3 0 013-3h1v1.5h-1A1.5 1.5 0 0011.5 6V7H13a2 2 0 010 4h-2a2 2 0 01-2-2V6z"/>
                    </svg>
                    <span style={{ fontSize: '12px', color: quoteColor, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        "{quote.text}"
                    </span>
                    <span style={{ fontSize: '11px', color: quoteColor, opacity: 0.7, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        — {quote.author}
                    </span>
                </div>

                <div style={{ width: '1px', height: '24px', background: divider, flexShrink: 0 }} />

                <NextFlightPill flights={flights} />
            </div>
        </header>
    );
}
