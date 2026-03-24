import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, MapPin, CheckCircle } from 'lucide-react';
import SimBriefBriefing from './SimBriefBriefing';
import { useSimBrief } from '../hooks/useSimBrief';

export default function Briefing({ onAddFlight, flights }) {
    const navigate = useNavigate();
    const { data, loading } = useSimBrief();

    // ── Replica esatta della logica alreadyLogged di SimBriefBriefing ──────────
    // Controlla se il piano SimBrief attivo è già presente nel logbook
    // entro una finestra di 7 giorni dalla data di partenza pianificata.
    const alreadyLogged = useMemo(() => {
        if (!data || !Array.isArray(flights) || !data.origin?.icao || !data.destination?.icao) {
            return false;
        }
        const simDate = data.departureTime
            ? (() => {
                const d = !isNaN(Number(data.departureTime)) && String(data.departureTime).length >= 10
                    ? new Date(Number(data.departureTime) * 1000)
                    : new Date(data.departureTime);
                return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
            })()
            : null;

        return !!flights.find(f => {
            const depMatch = String(f.departure || '').toUpperCase() === data.origin.icao.toUpperCase();
            const arrMatch = String(f.arrival   || '').toUpperCase() === data.destination.icao.toUpperCase();
            if (!depMatch || !arrMatch) return false;
            if (!simDate || !f.date) return true;
            return Math.abs((new Date(f.date) - new Date(simDate)) / 86400000) <= 7;
        });
    }, [data, flights]);

    const hasPlan = !loading && data?.origin?.icao && data?.destination?.icao;
    const shouldRedirect = !loading && (!hasPlan || alreadyLogged);
    const isAlreadyLogged = hasPlan && alreadyLogged;

    if (shouldRedirect) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '48px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '20px',
                }}>
                    <div style={{
                        width: '64px', height: '64px',
                        borderRadius: '50%',
                        background: isAlreadyLogged ? 'var(--color-success-bg)' : 'var(--color-primary-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {isAlreadyLogged
                            ? <CheckCircle size={28} style={{ color: 'var(--color-success)' }} strokeWidth={1.5} />
                            : <MapPin      size={28} style={{ color: 'var(--color-primary)' }} strokeWidth={1.5} />
                        }
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '440px' }}>
                        <h2 style={{
                            margin: 0,
                            fontFamily: 'var(--font-family-display)',
                            fontWeight: 600, fontSize: '1.2rem',
                            color: 'var(--color-text-primary)',
                        }}>
                            {isAlreadyLogged
                                ? `${data.origin.icao} \u2192 ${data.destination.icao} already logged`
                                : 'No active flight plan'
                            }
                        </h2>
                        <p style={{
                            margin: 0,
                            fontSize: '0.88rem',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.65,
                        }}>
                            {isAlreadyLogged
                                ? 'This flight is already in your logbook. Head to Schedule, pick one of your AI\u2011suggested routes and dispatch a new plan on SimBrief to see the next briefing here.'
                                : 'Head to Schedule to pick one of your AI\u2011suggested flights, then use the SimBrief button to generate a flight plan. Once dispatched, the briefing will appear here automatically.'
                            }
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/schedule')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 24px',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.88rem', fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-primary)'}
                    >
                        <Calendar size={16} />
                        Go to Schedule
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <SimBriefBriefing onAddFlight={onAddFlight} flights={flights} />
        </div>
    );
}
