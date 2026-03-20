import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCopilot } from '../hooks/useCopilot';

const SUGGESTIONS = [
    'Qual è il mio aereo preferito?',
    'Come sono andato questo mese?',
    'Rotta più frequente?',
    'Volo più lungo?',
    'In quale mese volo di più?',
    'Analizza le mie performance',
];

// Icona send/copilot
const CopilotIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
    </svg>
);

const TypingDots = ({ color }) => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
        {[0, 1, 2].map((i) => (
            <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: color,
                animation: 'copilot-pulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
            }} />
        ))}
    </div>
);

const Message = ({ msg, isDarkMode }) => {
    const isUser = msg.role === 'user';
    const avatarBg = '#146AFF';
    const bubbleBg = isUser ? '#146AFF' : (isDarkMode ? '#1a3349' : '#f0f4f8');
    const bubbleColor = isUser ? '#fff' : (isDarkMode ? '#e8f0f8' : '#111827');
    const dotColor = isDarkMode ? '#5a7a9a' : '#9ba8b5';

    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '10px',
        }}>
            {!isUser && (
                <div style={{
                    width: '26px', height: '26px', borderRadius: '8px',
                    background: avatarBg, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginRight: '8px', marginTop: '2px',
                }}>
                    <CopilotIcon size={13} />
                </div>
            )}
            <div style={{
                maxWidth: '80%', padding: '9px 12px',
                borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: bubbleBg, color: bubbleColor,
                fontSize: '13px', lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
                {msg.content || <TypingDots color={dotColor} />}
            </div>
        </div>
    );
};

export default function FlightCopilot({ flights, isDarkMode = false, user }) {
    const [open, setOpen]     = useState(false);
    const [input, setInput]   = useState('');
    const messagesEndRef      = useRef(null);
    const inputRef            = useRef(null);
    const navigate            = useNavigate();

    const { send, messages, loading, error, clear, hasData, onAction } = useCopilot(flights);

    // Gestisce azioni speciali restituite dal Copilot (es. apri checklist)
    useEffect(() => {
        if (!onAction) return;
        if (onAction.type === 'open_checklist') {
            navigate(`/hangar?checklist=${encodeURIComponent(onAction.aircraft)}`);
            setOpen(false);
        }
    }, [onAction, navigate]);

    // Statistiche rapide per la stats bar
    const stats = useMemo(() => {
        if (!flights || flights.length === 0) return null;
        const totalHours = flights.reduce((s, f) => s + (f.flightTime || 0), 0);
        const totalMiles = flights.reduce((s, f) => s + (f.miles || 0), 0);
        return {
            flights: flights.length,
            hours: Math.round(totalHours),
            miles: totalMiles >= 1000
                ? `${(totalMiles / 1000).toFixed(0)}k`
                : Math.round(totalMiles).toString(),
        };
    }, [flights]);

    const firstName = user?.displayName?.split(' ')[0] || 'Capitano';

    useEffect(() => {
        if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 120);
    }, [open]);

    const handleSend = () => {
        if (!input.trim() || loading) return;
        send(input.trim());
        setInput('');
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // Colori
    const surface   = isDarkMode ? '#0d1f2d' : '#ffffff';
    const border    = isDarkMode ? '#1e3a52' : '#e5e7eb';
    const inputBg   = isDarkMode ? '#1a3349' : '#f9fafb';
    const textPrim  = isDarkMode ? '#f0f4f8' : '#111827';
    const textMuted = isDarkMode ? '#5a7a9a' : '#9ba8b5';
    const statsBg   = isDarkMode ? '#1a3349' : '#f5f7fa';
    const statsDiv  = isDarkMode ? '#1e3a52' : '#e5e7eb';
    const sugBorder = isDarkMode ? '#1e3a52' : '#e5e7eb';
    const sugBg     = isDarkMode ? '#1a3349' : '#f9fafb';
    const sugColor  = isDarkMode ? '#c8daea' : '#374151';

    return (
        <>
            <style>{`
                @keyframes copilot-pulse {
                    0%,80%,100%{opacity:.3;transform:scale(.8)}
                    40%{opacity:1;transform:scale(1)}
                }
                @keyframes copilot-slide-up {
                    from{opacity:0;transform:translateY(12px)}
                    to{opacity:1;transform:translateY(0)}
                }
                .cp-fab:hover{transform:scale(1.06)!important}
                .cp-send:hover:not(:disabled){background:#0040B1!important}
                .cp-sug:hover{border-color:#146AFF!important;color:#146AFF!important}
                .cp-clear:hover{color:var(--color-danger)!important}
            `}</style>

            <div style={{
                position: 'fixed', bottom: '24px', right: '24px',
                zIndex: 500, display: 'flex', flexDirection: 'column',
                alignItems: 'flex-end', gap: '10px',
            }}>
                {/* ── Pannello ── */}
                {open && (
                    <div style={{
                        width: '350px', height: '520px',
                        background: surface, border: `1px solid ${border}`,
                        borderRadius: '20px',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        animation: 'copilot-slide-up 0.2s ease-out',
                    }}>

                        {/* Header */}
                        <div style={{
                            padding: '14px 14px 0',
                            background: surface, flexShrink: 0,
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', marginBottom: '12px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                    <div style={{
                                        width: '34px', height: '34px', borderRadius: '10px',
                                        background: '#146AFF', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <CopilotIcon size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: textPrim, lineHeight: 1.2 }}>
                                            Skydeck Copilot
                                        </div>
                                        <div style={{ fontSize: '11px', color: textMuted }}>
                                            {hasData ? `${flights?.length || 0} voli nel contesto` : 'Nessun dato'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {messages.length > 0 && (
                                        <button className="cp-clear" onClick={clear} style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            fontSize: '11px', color: textMuted, padding: '4px',
                                            transition: 'color 0.15s',
                                        }}>
                                            Pulisci
                                        </button>
                                    )}
                                    <button onClick={() => setOpen(false)} style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        background: statsBg, border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: textMuted,
                                    }}>
                                        <X size={14} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>

                            {/* Stats bar */}
                            {stats && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: '1px', background: statsDiv,
                                    borderRadius: '12px', overflow: 'hidden',
                                    marginBottom: '12px',
                                }}>
                                    {[
                                        { val: stats.flights, lbl: 'Voli' },
                                        { val: stats.hours,   lbl: 'Ore' },
                                        { val: stats.miles,   lbl: 'nm' },
                                    ].map(({ val, lbl }) => (
                                        <div key={lbl} style={{
                                            background: statsBg, padding: '8px 10px', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#146AFF', lineHeight: 1 }}>
                                                {val}
                                            </div>
                                            <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>
                                                {lbl}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Divisore */}
                        <div style={{ height: '1px', background: border, flexShrink: 0 }} />

                        {/* Corpo */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                            {messages.length === 0 ? (
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: textPrim, marginBottom: '3px' }}>
                                        Ciao {firstName}, cosa vuoi sapere?
                                    </div>
                                    <div style={{ fontSize: '12px', color: textMuted, marginBottom: '14px', lineHeight: 1.4 }}>
                                        Chiedimi qualsiasi cosa sui tuoi voli.
                                    </div>
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                                    }}>
                                        {SUGGESTIONS.map((s) => (
                                            <button key={s} className="cp-sug"
                                                onClick={() => send(s)}
                                                style={{
                                                    textAlign: 'left', padding: '9px 10px',
                                                    borderRadius: '10px',
                                                    border: `0.5px solid ${sugBorder}`,
                                                    background: sugBg, cursor: 'pointer',
                                                    fontSize: '11.5px', color: sugColor,
                                                    lineHeight: 1.35, transition: 'border-color 0.15s, color 0.15s',
                                                }}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, i) => (
                                        <Message key={i} msg={msg} isDarkMode={isDarkMode} />
                                    ))}
                                    {error && (
                                        <div style={{
                                            fontSize: '12px', color: 'var(--color-danger)',
                                            textAlign: 'center', padding: '8px',
                                        }}>
                                            {error}
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input */}
                        <div style={{
                            padding: '10px 12px', borderTop: `1px solid ${border}`,
                            display: 'flex', gap: '8px', flexShrink: 0, background: surface,
                        }}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Chiedi qualcosa sui tuoi voli…"
                                disabled={loading || !hasData}
                                style={{
                                    flex: 1, padding: '9px 12px', borderRadius: '10px',
                                    border: `0.5px solid ${border}`, background: inputBg,
                                    color: textPrim, fontSize: '13px', outline: 'none',
                                    fontFamily: 'inherit',
                                }}
                            />
                            <button className="cp-send" onClick={handleSend}
                                disabled={loading || !input.trim() || !hasData}
                                style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: '#146AFF', border: 'none',
                                    cursor: loading ? 'wait' : 'pointer', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                    opacity: (loading || !input.trim()) ? 0.5 : 1,
                                    transition: 'background 0.15s, opacity 0.15s',
                                }}
                            >
                                <CopilotIcon size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── FAB ── */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <button className="cp-fab" onClick={() => setOpen((v) => !v)}
                        style={{
                            width: '52px', height: '52px', borderRadius: '16px',
                            background: open ? '#0040B1' : '#146AFF',
                            border: 'none', cursor: 'pointer', color: '#fff', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(20,106,255,0.38)',
                            transition: 'all 0.2s ease', position: 'relative',
                        }}
                    >
                        {open
                            ? <X size={20} strokeWidth={2} />
                            : <CopilotIcon size={20} />
                        }
                        {/* Badge verde "attivo" */}
                        {!open && (
                            <div style={{
                                position: 'absolute', top: '-3px', right: '-3px',
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: '#1ED760', border: `2px solid ${isDarkMode ? '#0d151e' : '#ffffff'}`,
                            }} />
                        )}
                    </button>
                    <span style={{
                        fontSize: '10px', fontWeight: 500, letterSpacing: '0.04em',
                        color: isDarkMode ? '#5a7a9a' : '#9ba8b5',
                        whiteSpace: 'nowrap',
                    }}>
                        Copilot AI
                    </span>
                </div>
            </div>
        </>
    );
}
