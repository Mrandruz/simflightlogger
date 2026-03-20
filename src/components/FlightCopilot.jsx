import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCopilot } from '../hooks/useCopilot';

const SUGGESTIONS = [
    "What's my favourite aircraft?",
    'How did I do this month?',
    'Most frequent route?',
    'Longest flight?',
    'Which month do I fly most?',
    'Analyse my performance',
];

const CopilotIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
    </svg>
);

/* Claude icon — circle D + asterisk mark B */
const ClaudeIcon = ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="15" fill="#D97757"/>
        <line x1="16" y1="7"  x2="16" y2="25" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="7"  y1="16" x2="25" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="9.5" y1="9.5"  x2="22.5" y2="22.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="22.5" y1="9.5" x2="9.5"  y2="22.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
);

const TypingDots = () => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
        {[0, 1, 2].map((i) => (
            <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--color-text-hint)',
                animation: 'copilot-pulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
            }} />
        ))}
    </div>
);

const Message = ({ msg }) => {
    const isUser = msg.role === 'user';
    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '10px',
        }}>
            {!isUser && (
                <div style={{
                    width: '26px', height: '26px', borderRadius: '8px',
                    background: '#146AFF', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginRight: '8px', marginTop: '2px',
                }}>
                    <CopilotIcon size={13} />
                </div>
            )}
            <div style={{
                maxWidth: '80%', padding: '9px 12px',
                borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: isUser ? '#146AFF' : 'var(--color-surface-hover)',
                color: isUser ? '#fff' : 'var(--color-text-primary)',
                fontSize: '13px', lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
                {msg.content || <TypingDots />}
            </div>
        </div>
    );
};

export default function FlightCopilot({ flights, isDarkMode = false, user }) {
    const [open, setOpen]   = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef    = useRef(null);
    const inputRef          = useRef(null);
    const navigate          = useNavigate();

    const { send, messages, loading, error, clear, hasData, onAction } = useCopilot(flights);

    useEffect(() => {
        if (!onAction) return;
        if (onAction.type === 'open_checklist') {
            navigate(`/hangar?checklist=${encodeURIComponent(onAction.aircraft)}`);
            setOpen(false);
        }
    }, [onAction, navigate]);

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

    const firstName = user?.displayName?.split(' ')[0] || 'Captain';

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
                .cp-fab:hover { transform: scale(1.06) !important; }
                .cp-send:hover:not(:disabled) { background: #0040B1 !important; }
                .cp-sug:hover {
                    border-color: var(--color-primary) !important;
                    color: var(--color-primary) !important;
                }
                .cp-clear:hover { color: var(--color-danger) !important; }
            `}</style>

            {/* bottom: 36px (status bar height) + 16px gap = 52px */}
            <div style={{
                position: 'fixed', bottom: '44px', right: '24px',
                zIndex: 500, display: 'flex', flexDirection: 'column',
                alignItems: 'flex-end', gap: '10px',
            }}>
                {/* ── Panel ── */}
                {open && (
                    <div style={{
                        width: '350px', height: '520px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '20px',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        animation: 'copilot-slide-up 0.2s ease-out',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: '10px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '10px',
                                        background: '#146AFF', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <CopilotIcon size={15} />
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '13px', fontWeight: 600,
                                            color: 'var(--color-text-primary)', lineHeight: 1.1,
                                        }}>
                                            Flight Copilot
                                        </div>
                                        <div style={{
                                            fontSize: '10px', color: 'var(--color-text-hint)',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}>
                                            Powered by <ClaudeIcon size={12} /> Claude AI
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {messages.length > 0 && (
                                        <button onClick={clear} className="cp-clear" style={{
                                            width: '28px', height: '28px', borderRadius: '8px',
                                            background: 'var(--color-surface-hover)',
                                            border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--color-text-hint)', fontSize: '11px',
                                            fontWeight: 600, transition: 'color 0.15s',
                                        }}>
                                            ↺
                                        </button>
                                    )}
                                    <button onClick={() => setOpen(false)} style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        background: 'var(--color-surface-hover)',
                                        border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--color-text-hint)',
                                    }}>
                                        <X size={14} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>

                            {/* Stats bar */}
                            {stats && (
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: '1px', background: 'var(--color-border)',
                                    borderRadius: '12px', overflow: 'hidden',
                                    marginBottom: '12px',
                                }}>
                                    {[
                                        { val: stats.flights, lbl: 'Flights' },
                                        { val: stats.hours,   lbl: 'Hours' },
                                        { val: stats.miles,   lbl: 'nm' },
                                    ].map(({ val, lbl }) => (
                                        <div key={lbl} style={{
                                            background: 'var(--color-surface-hover)',
                                            padding: '8px 10px', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#146AFF', lineHeight: 1 }}>
                                                {val}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-hint)', marginTop: '2px' }}>
                                                {lbl}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', background: 'var(--color-border)', flexShrink: 0 }} />

                        {/* Body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                            {messages.length === 0 ? (
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '3px' }}>
                                        Hi {firstName}, what would you like to know?
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
                                        Ask me anything about your flights.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                        {SUGGESTIONS.map((s) => (
                                            <button key={s} className="cp-sug"
                                                onClick={() => send(s)}
                                                style={{
                                                    textAlign: 'left', padding: '9px 10px',
                                                    borderRadius: '10px',
                                                    border: '0.5px solid var(--color-border)',
                                                    background: 'var(--color-surface-hover)',
                                                    cursor: 'pointer',
                                                    fontSize: '11.5px', color: 'var(--color-text-secondary)',
                                                    lineHeight: 1.35,
                                                    transition: 'border-color 0.15s, color 0.15s',
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
                                        <Message key={i} msg={msg} />
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
                            padding: '10px 12px',
                            borderTop: '1px solid var(--color-border)',
                            display: 'flex', gap: '8px', flexShrink: 0,
                            background: 'var(--color-surface)',
                        }}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Ask anything about your flights…"
                                disabled={loading || !hasData}
                                style={{
                                    flex: 1, padding: '9px 12px', borderRadius: '10px',
                                    border: '0.5px solid var(--color-border)',
                                    background: 'var(--color-surface-hover)',
                                    color: 'var(--color-text-primary)',
                                    fontSize: '13px', outline: 'none',
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
                        {open ? <X size={20} strokeWidth={2} /> : <CopilotIcon size={20} />}
                        {!open && (
                            <div style={{
                                position: 'absolute', top: '-3px', right: '-3px',
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: '#1ED760',
                                border: '2px solid var(--color-surface)',
                            }} />
                        )}
                    </button>
                    <span style={{
                        fontSize: '10px', fontWeight: 500, letterSpacing: '0.04em',
                        color: 'var(--color-text-hint)',
                        whiteSpace: 'nowrap',
                    }}>
                        Flight Copilot
                    </span>
                </div>
            </div>
        </>
    );
}
