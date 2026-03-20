/**
 * FlightCopilot — widget AI flottante in basso a destra.
 *
 * Uso nel tuo App.jsx o layout principale:
 *   import FlightCopilot from './components/FlightCopilot';
 *   // dentro il return, fuori dal router:
 *   <FlightCopilot flights={flights} isDarkMode={isDarkMode} />
 *
 * Assicurati che flights sia l'array completo dei voli dell'utente.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Plane, X } from 'lucide-react';
import { useCopilot } from '../hooks/useCopilot';

// Suggerimenti rapidi mostrati quando la chat è vuota
const SUGGESTIONS = [
    'Qual è il mio aereo preferito?',
    'Come sono andato nell\'ultimo mese?',
    'Qual è la mia rotta più frequente?',
    'Analizza le mie performance generali.',
    'Qual è il volo più lungo che ho fatto?',
    'In quale mese volo di più?',
];

// Indicatore di typing (tre pallini animati)
const TypingDots = () => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
        {[0, 1, 2].map((i) => (
            <div
                key={i}
                style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--color-text-hint)',
                    animation: 'copilot-pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                }}
            />
        ))}
    </div>
);

// Singolo messaggio
const Message = ({ msg, isDarkMode }) => {
    const isUser = msg.role === 'user';
    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '10px',
        }}>
            {!isUser && (
                <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: '#146AFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginRight: '8px', marginTop: '2px',
                }}>
                    <Plane size={13} strokeWidth={1.8} />
                </div>
            )}
            <div style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: isUser
                    ? '#146AFF'
                    : isDarkMode ? '#1e3a52' : '#f0f4f8',
                color: isUser
                    ? '#ffffff'
                    : isDarkMode ? '#e8f0f8' : '#111827',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {msg.content || <TypingDots />}
            </div>
        </div>
    );
};

export default function FlightCopilot({ flights, isDarkMode = false }) {
    const [open, setOpen]       = useState(false);
    const [input, setInput]     = useState('');
    const messagesEndRef        = useRef(null);
    const inputRef              = useRef(null);

    const { send, messages, loading, error, clear, hasData } = useCopilot(flights);

    // Scroll automatico all'ultimo messaggio
    useEffect(() => {
        if (open) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    // Focus sull'input quando si apre
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 100);
    }, [open]);

    const handleSend = () => {
        if (!input.trim() || loading) return;
        send(input.trim());
        setInput('');
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestion = (s) => {
        send(s);
    };

    // Colori
    const surface  = isDarkMode ? '#0d1f2d' : '#ffffff';
    const border   = isDarkMode ? '#1e3a52' : '#e5e7eb';
    const inputBg  = isDarkMode ? '#1e3a52' : '#f9fafb';
    const textHint = isDarkMode ? '#5a7a9a' : '#9ba8b5';

    return (
        <>
            {/* Keyframes per i typing dots */}
            <style>{`
                @keyframes copilot-pulse {
                    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1); }
                }
                .copilot-btn:hover { opacity: 0.9; transform: scale(1.05); }
                .copilot-send:hover:not(:disabled) { background: #0040B1 !important; }
                .copilot-suggestion:hover { background: ${isDarkMode ? '#1e3a52' : '#e8f0ff'} !important; }
                .copilot-clear:hover { color: var(--color-danger) !important; }
            `}</style>

            {/* Widget flottante */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 500,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '12px',
            }}>
                {/* Pannello chat */}
                {open && (
                    <div style={{
                        width: '360px',
                        height: '500px',
                        background: surface,
                        border: `1px solid ${border}`,
                        borderRadius: '16px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        animation: 'fadeSlideUp 0.2s ease-out',
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '14px 16px',
                            borderBottom: `1px solid ${border}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            background: isDarkMode ? '#0d1f2d' : '#ffffff',
                            flexShrink: 0,
                        }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: '#146AFF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Plane size={16} strokeWidth={1.8} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#f0f4f8' : '#111827' }}>
                                    Skydeck Copilot
                                </div>
                                <div style={{ fontSize: '11px', color: textHint }}>
                                    {hasData ? `${flights?.length || 0} voli nel contesto` : 'Nessun dato disponibile'}
                                </div>
                            </div>
                            {messages.length > 0 && (
                                <button
                                    className="copilot-clear"
                                    onClick={clear}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: '11px', color: textHint, padding: '4px',
                                        transition: 'color 0.15s',
                                    }}
                                    title="Nuova conversazione"
                                >
                                    Pulisci
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: textHint, padding: '4px', lineHeight: 1,
                                    fontSize: '18px',
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Messaggi */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '16px',
                        }}>
                            {messages.length === 0 ? (
                                /* Stato vuoto con suggerimenti */
                                <div>
                                    <div style={{
                                        textAlign: 'center',
                                        marginBottom: '20px',
                                    }}>
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>✈️</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#f0f4f8' : '#111827', marginBottom: '4px' }}>
                                            Ciao! Sono il tuo copilota AI.
                                        </div>
                                        <div style={{ fontSize: '12px', color: textHint, lineHeight: 1.4 }}>
                                            Chiedimi qualsiasi cosa sui tuoi voli.
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {SUGGESTIONS.map((s) => (
                                            <button
                                                key={s}
                                                className="copilot-suggestion"
                                                onClick={() => handleSuggestion(s)}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    border: `1px solid ${border}`,
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    color: isDarkMode ? '#c8daea' : '#374151',
                                                    transition: 'background 0.15s',
                                                }}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Lista messaggi */
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
                            padding: '12px',
                            borderTop: `1px solid ${border}`,
                            display: 'flex',
                            gap: '8px',
                            flexShrink: 0,
                            background: surface,
                        }}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Chiedi qualcosa sui tuoi voli…"
                                disabled={loading || !hasData}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: `1px solid ${border}`,
                                    background: inputBg,
                                    color: isDarkMode ? '#f0f4f8' : '#111827',
                                    fontSize: '13px',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                }}
                            />
                            <button
                                className="copilot-send"
                                onClick={handleSend}
                                disabled={loading || !input.trim() || !hasData}
                                style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '8px',
                                    background: '#146AFF',
                                    border: 'none',
                                    cursor: loading ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                    opacity: (loading || !input.trim()) ? 0.5 : 1,
                                    transition: 'background 0.15s, opacity 0.15s',
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Bottone FAB */}
                <button
                    className="copilot-btn"
                    onClick={() => setOpen((v) => !v)}
                    style={{
                        width: '52px', height: '52px',
                        borderRadius: '50%',
                        background: open ? '#0040B1' : '#146AFF',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 20px rgba(20,106,255,0.4)',
                        transition: 'all 0.2s ease',
                        color: '#ffffff',
                        padding: 0,
                    }}
                    title={open ? 'Chiudi Copilot' : 'Apri Skydeck Copilot'}
                >
                    {open
                        ? <X size={20} strokeWidth={2} />
                        : <Plane size={22} strokeWidth={1.8} />
                    }
                </button>
            </div>
        </>
    );
}
