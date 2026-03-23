import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { RefreshCw, MapPin, Plane, Route, ArrowUp, Zap, Fuel, Clock, AlertTriangle, Wind, Thermometer, Gauge, Droplets, Radio, ExternalLink, Map, Settings, BookOpen, CheckCircle, FileText, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSimBriefData, parseSimBriefData } from '../services/simbriefService';

/* ── OFP PDF Viewer Modal ── */
function OFPViewer({ url }) {
    const [open, setOpen] = useState(false);
    // Use PDF directly — SimBrief doesn't block iframe embedding
    // #pagemode=thumbs shows the sidebar with page thumbnails
    const viewerUrl = `${url}#toolbar=1&navpanes=1&scrollbar=1&pagemode=thumbs`;

    return (
        <>
            <button
                className="btn btn-secondary"
                onClick={() => setOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: 'var(--space-3)', fontSize: '0.82rem', width: '100%' }}
            >
                <FileText size={15} />
                View Full OFP (Operational Flight Plan)
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setOpen(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, animation: 'fadeIn 0.15s ease-out' }}
                    />
                    {/* Panel */}
                    <div style={{
                        position: 'fixed',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 'min(900px, 95vw)',
                        height: 'min(90vh, 980px)',
                        background: 'var(--color-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-divider)',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        animation: 'fadeSlideUp 0.2s ease-out',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderBottom: '1px solid var(--color-divider)', flexShrink: 0 }}>
                            <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, fontFamily: 'var(--font-family-display)' }}>Operational Flight Plan</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', marginTop: 1 }}>SimBrief OFP</div>
                            </div>
                            <a href={url} target="_blank" rel="noopener noreferrer" title="Open PDF directly"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, color: 'var(--color-text-hint)', background: 'none', border: '1px solid var(--color-divider)', cursor: 'pointer', textDecoration: 'none', flexShrink: 0 }}>
                                <ExternalLink size={14} />
                            </a>
                            <button onClick={() => setOpen(false)} title="Close"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, color: 'var(--color-text-hint)', background: 'none', border: '1px solid var(--color-divider)', cursor: 'pointer', flexShrink: 0 }}>
                                <X size={14} />
                            </button>
                        </div>
                        {/* iframe via Google Docs Viewer */}
                        <iframe
                            key={url}
                            src={viewerUrl}
                            title="Operational Flight Plan"
                            style={{ flex: 1, border: 'none', width: '100%' }}
                        />
                    </div>
                </>
            )}
        </>
    );
}

/* ── AI Briefing Narrative ── */
const COPILOT_FUNCTION_URL = 'https://europe-west1-simflightlogger.cloudfunctions.net/askCopilot';
const TTS_FUNCTION_URL     = 'https://europe-west1-simflightlogger.cloudfunctions.net/textToSpeech';

function BriefingNarrative({ data }) {
    const [narrative, setNarrative]       = useState('');
    const [loading, setLoading]           = useState(false);
    const [generated, setGenerated]       = useState(false);
    const [audioUrl, setAudioUrl]         = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [usingTTS, setUsingTTS]         = useState(null); // 'elevenlabs' | 'webspeech' | null
    const audioRef = useRef(null);

    useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

    // Reset audio when narrative changes
    useEffect(() => {
        window.speechSynthesis?.cancel();
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        setAudioUrl(null);
        setUsingTTS(null);
    }, [narrative]);

    const speakWithBrowser = (text) => {
        window.speechSynthesis?.cancel();
        const utter    = new SpeechSynthesisUtterance(text);
        utter.lang     = 'en-US';
        utter.rate     = 0.92;
        utter.pitch    = 1.0;
        const voices   = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && /daniel|alex|fred|male/i.test(v.name))
            || voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (preferred) utter.voice = preferred;
        window.speechSynthesis.speak(utter);
        setUsingTTS('webspeech');
    };

    const handleListen = async () => {
        if (!narrative || audioLoading) return;
        if (usingTTS === 'webspeech') {
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            else if (window.speechSynthesis.speaking) window.speechSynthesis.pause();
            else speakWithBrowser(narrative);
            return;
        }
        if (usingTTS === 'elevenlabs' && audioRef.current) {
            if (audioRef.current.paused) audioRef.current.play();
            else audioRef.current.pause();
            return;
        }
        setAudioLoading(true);
        try {
            const res = await fetch(TTS_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: narrative }),
            });
            if (!res.ok) { speakWithBrowser(narrative); return; }
            const blob = await res.blob();
            if (blob.size === 0) { speakWithBrowser(narrative); return; }
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setUsingTTS('elevenlabs');
            setTimeout(() => audioRef.current?.play(), 100);
        } catch {
            speakWithBrowser(narrative);
        } finally {
            setAudioLoading(false);
        }
    };

    const handleStop = () => {
        window.speechSynthesis?.cancel();
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        setUsingTTS(null);
    };

    const buildStats = () => ({
        totalFlights: '—', totalHours: '—', totalMiles: '—',
        topAircraft: data.aircraft || '—', topAirport: data.origin?.icao || '—',
        topAirline: data.airlineName || '—',
        topRoute: `${data.origin?.icao}→${data.destination?.icao}`,
        flightsLastMonth: '—', avgHours: '—', longestFlight: '—',
        topAircraftList: data.aircraft || '—', topAirportList: '—',
        topRouteList: '—', monthlyDistribution: '—', lastFlight: '—',
        nextFlight: [
            `${data.origin?.icao} → ${data.destination?.icao}`,
            data.aircraft        ? `aircraft: ${data.aircraft}`                       : '',
            data.airlineName     ? `airline: ${data.airlineName}`                     : '',
            data.callsign        ? `callsign: ${data.callsign}`                       : '',
            data.duration        ? `duration: ${data.duration}`                       : '',
            data.distance        ? `distance: ${data.distance} nm`                    : '',
            data.cruiseAltitude  ? `cruise: FL${Math.round(data.cruiseAltitude/100)}` : '',
            data.fuel            ? `fuel: ${data.fuel} kg`                            : '',
            data.route           ? `route: ${data.route}`                             : '',
            data.sid             ? `SID: ${data.sid}`                                 : '',
            data.star            ? `STAR: ${data.star}`                               : '',
            data.departureRunway ? `dep rwy: ${data.departureRunway}`                 : '',
            data.arrivalRunway   ? `arr rwy: ${data.arrivalRunway}`                   : '',
            data.costIndex       ? `cost index: ${data.costIndex}`                    : '',
            data.passengers      ? `pax: ${data.passengers}`                          : '',
            data.zfw             ? `ZFW: ${data.zfw} kg`                             : '',
        ].filter(Boolean).join(', '),
        aircraftLogbook: '',
    });

    const generate = async () => {
        if (loading || !data) return;
        setLoading(true); setNarrative(''); setGenerated(true);
        const prompt = `Write a concise pre-flight briefing narrative for the following flight plan. Write it as a professional flight dispatcher or senior captain would — factual, precise, aviation-toned. Cover: route overview, cruise level, key waypoints if available, fuel load, expected duration, and any notable operational considerations. Keep it to 3-4 short paragraphs. Do not use bullet points.`;
        try {
            const res = await fetch(COPILOT_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, stats: buildStats(), history: [] }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n'); buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]') break;
                    try { const { text } = JSON.parse(raw); if (text) setNarrative(p => p + text); } catch (_) {}
                }
            }
        } catch (e) {
            setNarrative('Unable to generate briefing narrative. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isPlaying = usingTTS === 'webspeech'
        ? window.speechSynthesis?.speaking && !window.speechSynthesis?.paused
        : usingTTS === 'elevenlabs' && audioRef.current && !audioRef.current.paused;

    return (
        <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>AI Flight Briefing</span>
                    {usingTTS && <span style={{ fontSize: '0.65rem', color: 'var(--color-text-hint)', background: 'var(--color-surface-hover)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)' }}>
                        {usingTTS === 'elevenlabs' ? '🎙️ ElevenLabs' : '🔊 Browser TTS'}
                    </span>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {narrative && !loading && (
                        <>
                            <button className="btn btn-secondary" onClick={handleListen} disabled={audioLoading}
                                style={{ padding: '6px 14px', fontSize: '0.75rem', gap: 6 }}>
                                {audioLoading ? <><RefreshCw size={13} className="spin" /> Loading…</>
                                    : isPlaying ? <>⏸ Pause</>
                                    : usingTTS   ? <>▶ Resume</>
                                    : <>🎧 Listen</>}
                            </button>
                            {usingTTS && (
                                <button className="btn btn-secondary" onClick={handleStop}
                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                                    ⏹
                                </button>
                            )}
                        </>
                    )}
                    <button className={`btn ${generated ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={generate} disabled={loading}
                        style={{ padding: '6px 14px', fontSize: '0.75rem', gap: 6 }}>
                        {loading ? <><RefreshCw size={13} className="spin" /> Generating…</>
                            : generated ? <><RefreshCw size={13} /> Regenerate</>
                            : <>✦ Generate Briefing</>}
                    </button>
                </div>
            </div>

            {audioUrl && <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', height: 36, borderRadius: 'var(--radius-md)' }} />}

            {!generated && !loading && (
                <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)', textAlign: 'center', color: 'var(--color-text-hint)', fontSize: '0.8rem' }}>
                    Click "Generate Briefing" for an AI narrative of this flight plan.
                </div>
            )}
            {(generated || loading) && (
                <div style={{ fontSize: '0.85rem', lineHeight: 1.75, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                    {loading && !narrative && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-hint)' }}>
                            <div style={{ width: 13, height: 13, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                            Drafting your briefing…
                        </div>
                    )}
                    {narrative}
                    {loading && narrative && <span style={{ opacity: 0.35 }}>▋</span>}
                </div>
            )}
        </div>
    );
}

/* ── SimBrief aircraft code → FlightForm aircraft label ── */
const SIMBRIEF_AIRCRAFT_MAP = {
    // Airbus A319
    'A319': 'Airbus A319', 'A19N': 'Airbus A319',
    // Airbus A320
    'A320': 'Airbus A320', 'A20N': 'Airbus A320',
    // Airbus A321
    'A321': 'Airbus A321', 'A21N': 'Airbus A321', 'A20S': 'Airbus A321',
    // Airbus A330
    'A330': 'Airbus A330', 'A332': 'Airbus A330', 'A333': 'Airbus A330',
    // Airbus A350
    'A350': 'Airbus A350', 'A359': 'Airbus A350', 'A35K': 'Airbus A350',
    // Airbus A380
    'A380': 'Airbus A380', 'A388': 'Airbus A380',
    // Boeing 777
    'B777': 'Boeing 777', 'B77W': 'Boeing 777', 'B77L': 'Boeing 777', 'B772': 'Boeing 777', 'B773': 'Boeing 777',
    // Boeing 787
    'B787': 'Boeing 787', 'B789': 'Boeing 787', 'B788': 'Boeing 787', 'B78X': 'Boeing 787',
};

const AIRLINE_ALLIANCE_MAP = {
    // Star Alliance
    'Lufthansa':'Star Alliance','United Airlines':'Star Alliance','Air Canada':'Star Alliance',
    'Singapore Airlines':'Star Alliance','ANA':'Star Alliance','All Nippon Airways':'Star Alliance',
    'Thai Airways':'Star Alliance','Turkish Airlines':'Star Alliance','Austrian Airlines':'Star Alliance',
    'SAS':'Star Alliance','Scandinavian Airlines':'Star Alliance','TAP Air Portugal':'Star Alliance',
    'LOT Polish Airlines':'Star Alliance','Air China':'Star Alliance','Ethiopian Airlines':'Star Alliance',
    'EgyptAir':'Star Alliance','Air India':'Star Alliance','Avianca':'Star Alliance',
    // SkyTeam
    'Air France':'SkyTeam','KLM':'SkyTeam','Delta Air Lines':'SkyTeam','Delta':'SkyTeam',
    'Aeromexico':'SkyTeam','China Eastern':'SkyTeam','China Southern':'SkyTeam',
    'Korean Air':'SkyTeam','Vietnam Airlines':'SkyTeam','Garuda Indonesia':'SkyTeam',
    'Middle East Airlines':'SkyTeam','Kenya Airways':'SkyTeam','Saudia':'SkyTeam','Etihad':'SkyTeam',
    'TAROM':'SkyTeam','ITA Airways':'SkyTeam',
    // Oneworld
    'American Airlines':'Oneworld','British Airways':'Oneworld','Iberia':'Oneworld',
    'Qatar Airways':'Oneworld','Cathay Pacific':'Oneworld','Japan Airlines':'Oneworld',
    'Finnair':'Oneworld','Malaysia Airlines':'Oneworld','Royal Jordanian':'Oneworld',
    'Alaska Airlines':'Oneworld','Qantas':'Oneworld','Brussels Airlines':'Oneworld',
};

function mapSimbriefAircraft(simbriefCode) {
    if (!simbriefCode) return '';
    const upper = simbriefCode.toUpperCase();
    return SIMBRIEF_AIRCRAFT_MAP[upper] || '';
}

/* Parse SimBrief duration → decimal hours for FlightForm flightTime field
   Handles: "8h 58m", "8:58", "08:58", "8+58", "538" (minutes), "32280" (seconds) */
function parseDuration(dur) {
    if (!dur) return '';
    const s = String(dur).trim();

    // "8h 58m" or "8h58m" or "8h 58" 
    const hmMatch = s.match(/^(\d+)\s*h\s*(\d+)\s*m?$/i);
    if (hmMatch) return (parseInt(hmMatch[1]) + parseInt(hmMatch[2]) / 60).toFixed(2);

    // "8h" only
    const hOnly = s.match(/^(\d+)\s*h$/i);
    if (hOnly) return parseInt(hOnly[1]).toFixed(2);

    // "8:58" or "08:58"
    const colonMatch = s.match(/^(\d+):(\d{2})$/);
    if (colonMatch) return (parseInt(colonMatch[1]) + parseInt(colonMatch[2]) / 60).toFixed(2);

    // "8+58" (SimBrief internal format)
    const plusMatch = s.match(/^(\d+)\+(\d{2})$/);
    if (plusMatch) return (parseInt(plusMatch[1]) + parseInt(plusMatch[2]) / 60).toFixed(2);

    // Pure number: if > 1000 assume seconds, if > 24 assume minutes, else hours
    if (!isNaN(Number(s))) {
        const n = Number(s);
        if (n > 1440) return (n / 3600).toFixed(2);  // seconds → hours
        if (n > 24)   return (n / 60).toFixed(2);    // minutes → hours
        return n.toFixed(2);                          // already hours
    }

    return '';
}

const MiniMetar = ({ icao }) => {
    const [metar, setMetar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchMetar = async () => {
            if (!icao) return;
            setLoading(true);
            setError(false);
            try {
                const res = await fetch(`/api/metar?ids=${icao}&format=json`);
                if (!res.ok) throw new Error('HTTP Error');
                const data = await res.json();
                if (isMounted && data && data.length > 0) {
                    setMetar(data[0]);
                } else if (isMounted) {
                    setError(true);
                }
            } catch (error) {
                console.error('Failed to fetch METAR for', icao, error);
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMetar();
        return () => { isMounted = false; };
    }, [icao]);

    if (loading) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px', opacity: 0.6 }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '32px', borderRadius: '4px' }}></div>)}
            </div>
        );
    }

    if (error || !metar) {
        return (
            <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: 'var(--color-danger-bg)', 
                color: 'var(--color-danger)', 
                fontSize: '0.7rem', 
                borderRadius: '4px',
                textAlign: 'center',
                fontWeight: 600,
                border: '1px solid var(--color-danger)'
            }}>
                METAR Unavailable for {icao}
            </div>
        );
    }

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '8px', 
            marginTop: '10px',
            backgroundColor: 'rgba(0,0,0,0.02)',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Gauge size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pres</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.altim ? `${Math.round(metar.altim)}` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Wind size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wind</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.wdir !== undefined ? `${metar.wdir}°` : '--'}/{metar.wspd !== undefined ? `${metar.wspd}k` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Thermometer size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Temp</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.temp !== undefined ? `${Math.round(metar.temp)}°` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Droplets size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dew</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.dewp !== undefined ? `${Math.round(metar.dewp)}°` : '--'}</span>
            </div>
        </div>
    );
};

const SimBriefBriefing = ({ onAddFlight, flights = [] }) => {
    const context = useOutletContext();
    const isDarkMode = context?.isDarkMode;
    const navigate = useNavigate();
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [showSettings, setShowSettings] = useState(false);
    const [routeCopied, setRouteCopied] = useState(false);
    const [logState, setLogState] = useState('idle'); // idle | duplicate | saving | saved | error

    // ── Check if SimBrief flight already logged in last 7 days ──────────
    const alreadyLogged = React.useMemo(() => {
        if (!data || !Array.isArray(flights) || !data.origin?.icao || !data.destination?.icao) return false;
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
    const [showPreview, setShowPreview] = useState(false);

    const [identifier, setIdentifier] = useState(() => {
        const saved = localStorage.getItem('simBriefIdentifier');
        return saved ? JSON.parse(saved) : { type: 'username', value: 'mrandruz' };
    });

    /* ── Build flight draft from SimBrief data ── */
    const buildFlightDraft = () => {
        if (!data) return null;
        const aircraft = mapSimbriefAircraft(data.aircraft);
        const airline  = data.airlineName || '';
        const alliance = AIRLINE_ALLIANCE_MAP[airline] || 'Nessuna';

        // Always parse from the display string "8h 58m" — most reliable source.
        // durationSeconds is only a fallback if display string fails, and only if > 60
        // (SimBrief sometimes sends raw hours as integer, e.g. 8 instead of 32280 seconds)
        let flightTime = parseDuration(data.duration);
        if (!flightTime || flightTime === '0.00') {
            const sec = Number(data.durationSeconds);
            if (sec > 60) flightTime = (sec / 3600).toFixed(2);
        }

        console.log('[Skydeck] buildFlightDraft →', {
            durationSeconds: data.durationSeconds,
            durationDisplay: data.duration,
            flightTimeResult: flightTime,
        });

        return {
            departure:  data.origin?.icao      || '',
            arrival:    data.destination?.icao  || '',
            airline,
            alliance,
            aircraft,
            miles:      String(data.distance   || ''),
            flightTime,
            date:       new Date().toISOString().split('T')[0],
        };
    };

    /* ── Quick save: build draft → call onAddFlight → redirect ── */
    const handleLogFlight = async (force = false) => {
        const draft = buildFlightDraft();
        if (!draft || !draft.departure || !draft.arrival) return;

        // Duplicate check unless user already confirmed
        if (!force) {
            const duplicate = flights.find(f =>
                f.departure?.toUpperCase() === draft.departure.toUpperCase() &&
                f.arrival?.toUpperCase()   === draft.arrival.toUpperCase() &&
                f.date === draft.date
            );
            if (duplicate) {
                setLogState('duplicate');
                return;
            }
        }

        setLogState('saving');
        try {
            await onAddFlight({
                ...draft,
                id:         crypto.randomUUID(),
                createdAt:  Date.now(),
                miles:      Number(draft.miles),
                flightTime: Number(draft.flightTime),
            });
            setLogState('saved');
            setTimeout(() => navigate('/logbook'), 1200);
        } catch (e) {
            console.error('Log flight error:', e);
            setLogState('error');
            setTimeout(() => setLogState('idle'), 3000);
        }
    };

    /* ── Edit Details: prefill NewFlight form ── */
    const handleEditDetails = () => {
        const draft = buildFlightDraft();
        if (!draft) return;
        navigate('/new-flight', { state: { prefillData: draft } });
    };

    const loadFlightPlan = async () => {
        setLoading(true);
        setError(null);
        try {
            const trimmedValue = identifier.value.trim();
            const fetchOptions = identifier.type === 'userid' 
                ? { userid: trimmedValue } 
                : { username: trimmedValue };
            const rawData = await fetchSimBriefData(fetchOptions);
            const parsed = parseSimBriefData(rawData);
            setData(parsed);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleIdentifierChange = (e) => {
        const newId = { ...identifier, value: e.target.value };
        setIdentifier(newId);
        localStorage.setItem('simBriefIdentifier', JSON.stringify(newId));
    };

    const handleTypeChange = (type) => {
        const newId = { ...identifier, type };
        setIdentifier(newId);
        localStorage.setItem('simBriefIdentifier', JSON.stringify(newId));
    };

    const handleCopyRoute = () => {
        if (data?.route) {
            navigator.clipboard.writeText(data.route).then(() => {
                setRouteCopied(true);
                setTimeout(() => setRouteCopied(false), 2000);
            });
        }
    };

    const formatZulu = (val) => {
        if (!val) return '--:--z';
        
        // Handle ISO strings or valid date strings
        const dateObj = new Date(val);
        if (!isNaN(dateObj.getTime())) {
            const h = String(dateObj.getUTCHours()).padStart(2, '0');
            const m = String(dateObj.getUTCMinutes()).padStart(2, '0');
            return `${h}:${m}z`;
        }

        // Handle Unix timestamp (seconds) fallback
        if (!isNaN(Number(val)) && String(val).length >= 10) {
            const d = new Date(Number(val) * 1000);
            const h = String(d.getUTCHours()).padStart(2, '0');
            const m = String(d.getUTCMinutes()).padStart(2, '0');
            return `${h}:${m}z`;
        }

        // Handle HHMM or HH:MM string
        const str = String(val).replace(':', '');
        if (str.length === 4 && !isNaN(Number(str))) {
            return `${str.slice(0, 2)}:${str.slice(2, 4)}z`;
        }

        return '--:--z';
    };

    useEffect(() => {
        if (data) {
            console.log('SimBrief Debug - Times:', {
                dep: data.departureTime,
                arr: data.arrivalTime
            });
        }
    }, [data]);

    useEffect(() => {
        loadFlightPlan();
    }, []);

    useEffect(() => {
        if (!data || !mapRef.current) return;

        try {
            // Cleanup previous map instance if it exists
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }

            // Choose neutral tiles based on theme (CartoDB Positron for light, Dark Matter for dark)
            const tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            
            const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

            // Initialize map
            const map = L.map(mapRef.current).setView([0, 0], 2);
            mapInstance.current = map;

            L.tileLayer(tileUrl, { attribution }).addTo(map);

            // Origin marker (Green)
            const greenIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            // Destination marker (Red)
            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            // Add markers with coordinate checks
            const isValidCoord = (c) => typeof c === 'number' && !isNaN(c);
            const markers = [];
            
            if (isValidCoord(data.origin?.lat) && isValidCoord(data.origin?.lon)) {
                L.marker([data.origin.lat, data.origin.lon], { icon: greenIcon })
                    .addTo(map)
                    .bindPopup(`Origin: ${data.origin.icao} - ${data.origin.name}`);
                markers.push([data.origin.lat, data.origin.lon]);
            }

            if (isValidCoord(data.destination?.lat) && isValidCoord(data.destination?.lon)) {
                L.marker([data.destination.lat, data.destination.lon], { icon: redIcon })
                    .addTo(map)
                    .bindPopup(`Destination: ${data.destination.icao} - ${data.destination.name}`);
                markers.push([data.destination.lat, data.destination.lon]);
            }

            // Route polyline from waypoints
            const latLons = (data.waypoints || [])
                .filter(w => typeof w.lat === 'number' && typeof w.lon === 'number' && !isNaN(w.lat) && !isNaN(w.lon))
                .map(w => [w.lat, w.lon]);
            
            // If no waypoints, use origin/destination
            const finalLatLons = latLons.length > 0 ? latLons : markers;

            if (finalLatLons.length >= 2) {
                // Use a neutral slate color for the route
                const routeColor = isDarkMode ? '#94a3b8' : '#64748b';
                
                L.polyline(finalLatLons, {
                    color: routeColor,
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '5, 8'
                }).addTo(map);

                // Auto fitting bounds
                const bounds = L.latLngBounds(finalLatLons);
                map.fitBounds(bounds, { padding: [50, 50] });
            } else if (markers.length > 0) {
                map.setView(markers[0], 5);
            }

            // Cleanup on destroy
            return () => {
                if (mapInstance.current) {
                    try {
                       mapInstance.current.remove();
                    } catch (e) {}
                    mapInstance.current = null;
                }
            };

        } catch (e) {
            console.error('SimBrief: Error initializing map:', e);
            setError('Error loading map. Please verify flight plan data.');
        }

        return () => {
            if (mapInstance.current) {
                try {
                   mapInstance.current.remove();
                } catch (e) {}
                mapInstance.current = null;
            }
        };
    }, [data, isDarkMode]);

    if (loading) {
        return (
            <div className="card" style={{ border: 'none', background: 'var(--color-surface)', position: 'relative' }}>
                <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <div className="skeleton skeleton-circle" style={{ width: 44, height: 44 }}></div>
                        <div>
                            <div className="skeleton skeleton-title" style={{ width: '120px', marginBottom: '8px' }}></div>
                            <div className="skeleton skeleton-text" style={{ width: '80px' }}></div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: 'var(--space-6)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-6)' }}>
                        {[...Array(6)].map((_, i) => (
                            <div key={i}><div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: '12px', opacity: 0.6 }}></div><div className="skeleton skeleton-title" style={{ width: '80%' }}></div></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                    <AlertTriangle size={32} aria-hidden="true" />
                </div>
                <div>
                    <h3 style={{ marginBottom: '8px' }}>Mission Briefing Unavailable</h3>
                    <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px' }}>{error}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--color-background)', padding: '12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                     <IdentifierToggle identifier={identifier} onTypeChange={handleTypeChange} />
                     <input type="text" value={identifier.value} onChange={handleIdentifierChange} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', width: '140px' }} />
                     <button className="btn btn-primary" onClick={loadFlightPlan}>Retry Connection</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Header & Mission Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        <Zap size={14} aria-hidden="true" />
                        Flight Control
                    </div>
                    <h1 style={{ fontSize: '1.75rem', margin: 0, fontFamily: 'var(--font-family-display)', fontWeight: 500 }}>Briefing & Dispatch</h1>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setShowSettings(!showSettings)} className="btn btn-secondary" style={{ padding: '10px' }} aria-label="SimBrief settings">
                        <Settings size={20} aria-hidden="true" />
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.open('https://dispatch.simbrief.com/briefing/latest', '_blank')}>
                        <ExternalLink size={18} aria-hidden="true" />
                        <span>SimBrief</span>
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.open('https://charts.navigraph.com/flights/current', '_blank')}>
                        <Map size={18} aria-hidden="true" />
                        <span>Navigraph</span>
                    </button>
                    <button className="btn btn-primary" onClick={loadFlightPlan} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spin' : ''} aria-hidden="true" />
                        <span>Refresh Ops</span>
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="card" style={{ padding: 'var(--space-4)', border: '1px solid var(--color-primary)', animation: 'fadeSlideUp 0.3s ease-out', backgroundColor: 'var(--color-primary-light)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--color-primary)' }}>SimBrief Configuration:</span>
                        <IdentifierToggle identifier={identifier} onTypeChange={handleTypeChange} />
                        <input type="text" className="form-input" value={identifier.value} onChange={handleIdentifierChange} style={{ width: '200px', height: '36px', fontSize: '0.9rem' }} placeholder="Enter ID/Username..." />
                    </div>
                </div>
            )}

            {data && alreadyLogged && (
                <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)', border: '1px dashed var(--color-border)' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={28} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-family-display)', fontWeight: 500 }}>
                            {data.origin?.icao} → {data.destination?.icao} already logged
                        </h3>
                        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            This flight is already in your logbook. Plan a new route on SimBrief to see your next briefing here.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => window.open('https://dispatch.simbrief.com/briefing/latest', '_blank')}
                            style={{ gap: '8px' }}
                        >
                            <ExternalLink size={16} />
                            Plan on SimBrief
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={loadFlightPlan}
                            style={{ gap: '8px' }}
                        >
                            <RefreshCw size={16} />
                            Refresh
                        </button>
                    </div>
                </div>
            )}

    {data && !alreadyLogged && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                        {/* Hero Flight Card */}
                        <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)' }}>
                            <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-success)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Origin</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 300, lineHeight: 1, fontFamily: 'var(--font-family-display)', letterSpacing: '-0.03em' }}>{data.origin.icao}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 400 }}>{data.origin.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', marginTop: '6px', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{formatZulu(data.departureTime)}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-hint)', marginTop: '2px' }}>
                                            RWY {data.departureRunway} • {data.sid}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-text-hint)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 500, marginBottom: '2px', fontFamily: 'var(--font-family-mono)' }}>{data.duration}</div>
                                        <div style={{ width: '100px', height: '2px', backgroundColor: 'currentColor', position: 'relative' }}>
                                            <Plane size={14} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--color-surface)', padding: '0 4px' }} aria-hidden="true" />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-danger)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Destination</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 300, lineHeight: 1, fontFamily: 'var(--font-family-display)', letterSpacing: '-0.03em' }}>{data.destination.icao}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 400 }}>{data.destination.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', marginTop: '6px', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{formatZulu(data.arrivalTime)}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-hint)', marginTop: '2px' }}>
                                            RWY {data.arrivalRunway} • {data.star}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>{data.callsign}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{data.aircraft} · {data.airlineName || 'Private'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                 <div style={{ padding: 'var(--space-4) var(--space-6)', borderRight: '1px solid var(--color-divider)' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Origin Weather</span>
                                     <MiniMetar icao={data.origin.icao} />
                                 </div>
                                 <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dest Weather</span>
                                     <MiniMetar icao={data.destination.icao} />
                                 </div>
                            </div>
                        </div>

                        {/* Operational Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                            <MetricBlock label="Fuel Load" value={`${data.fuel} kg`} icon={Fuel} />
                            <MetricBlock label="Passengers" value={data.passengers} icon={Droplets} />
                            <MetricBlock label="Zero Fuel Weight" value={`${data.zfw} kg`} icon={Gauge} />
                            <MetricBlock label="Plan Distance" value={`${data.distance} nm`} icon={Route} />
                            <MetricBlock label="Cruise Level" value={`FL${Math.round(data.cruiseAltitude/100)}`} icon={ArrowUp} />
                            <MetricBlock label="Cost Index" value={data.costIndex} icon={Zap} />
                        </div>

                        {/* ── Weights ── */}
                        <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-1)' }}>
                                <Gauge size={16} style={{ color: 'var(--color-primary)' }} />
                                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Weight Summary</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                                {[
                                    { label: 'Est. ZFW',  value: data.zfw,    max: data.maxZfw, unit: 'kg' },
                                    { label: 'Est. TOW',  value: data.tow,    max: data.maxTow, unit: 'kg' },
                                    { label: 'Est. LDW',  value: data.ldw,    max: data.maxLdw, unit: 'kg' },
                                ].map(({ label, value, max, unit }) => {
                                    const pct = max && Number(max) > 0 ? Math.round((Number(value) / Number(max)) * 100) : null;
                                    const color = pct > 95 ? 'var(--color-danger)' : pct > 85 ? 'var(--color-warning, #f59e0b)' : 'var(--color-success)';
                                    return (
                                        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>{Number(value).toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>{unit}</span></span>
                                            {max && Number(max) > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width .4s' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.6rem', color: color, fontWeight: 600 }}>{pct}% of max ({Number(max).toLocaleString()} kg)</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Fuel Breakdown ── */}
                        <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-1)' }}>
                                <Fuel size={16} style={{ color: 'var(--color-primary)' }} />
                                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Fuel Breakdown</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                                {[
                                    { label: 'Ramp (Total)', value: data.fuel,          color: 'var(--color-primary)'  },
                                    { label: 'Trip',         value: data.fuelTrip,       color: 'var(--color-success)'  },
                                    { label: 'Reserve',      value: data.fuelReserve,    color: 'var(--color-warning, #f59e0b)' },
                                    { label: 'Alternate',    value: data.fuelAlternate,  color: 'var(--color-text-secondary)' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                                        <span style={{ fontSize: '1rem', fontWeight: 600, color, fontFamily: 'var(--font-family-display)' }}>{Number(value).toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-hint)' }}>kg</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Wind & Step Climbs ── */}
                        {(data.avgWindDir || data.stepclimb) && (
                            <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-1)' }}>
                                    <Wind size={16} style={{ color: 'var(--color-primary)' }} />
                                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Wind & Profile</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {data.avgWindDir && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                                            {[
                                                { label: 'Avg Wind Dir', value: `${data.avgWindDir}°` },
                                                { label: 'Avg Wind Spd', value: `${data.avgWindSpd} kt` },
                                                { label: 'Wind Component', value: (() => {
                                                    const comp = Number(data.avgWindComp);
                                                    if (isNaN(comp)) return '—';
                                                    return comp >= 0
                                                        ? <span style={{ color: 'var(--color-success)' }}>+{comp} kt ↑ Tail</span>
                                                        : <span style={{ color: 'var(--color-danger)' }}>{comp} kt ↓ Head</span>;
                                                })() },
                                            ].map(({ label, value }) => (
                                                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {data.stepclimb && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Step Climbs</span>
                                            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', background: 'var(--color-background)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                                {data.stepclimb}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── OFP Viewer ── */}
                        {data.ofpUrl && <OFPViewer url={data.ofpUrl} />}

                        {/* Route Operations */}
                        <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Route size={18} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>ATC Route</span>
                                </div>
                                <button onClick={handleCopyRoute} className={`btn ${routeCopied ? '' : 'btn-secondary'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: routeCopied ? 'var(--color-success-bg)' : undefined, color: routeCopied ? 'var(--color-success)' : undefined }}>
                                    {routeCopied ? 'COPIED' : 'COPY ROUTE'}
                                </button>
                            </div>
                            <div style={{ backgroundColor: 'var(--color-background)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-family-mono)', fontSize: '0.85rem', lineHeight: 1.6, wordBreak: 'break-all', color: 'var(--color-text-primary)' }}>
                                {data.route}
                            </div>
                        </div>

                        {/* ── Log This Flight CTA ── */}
                        <div className="card" style={{ padding: 'var(--space-5)', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-surface) 100%)', border: '1px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {/* Preview summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                                {[
                                    { label: 'Route',    value: `${data.origin?.icao} → ${data.destination?.icao}` },
                                    { label: 'Aircraft', value: mapSimbriefAircraft(data.aircraft) || data.aircraft || '—' },
                                    { label: 'Distance', value: `${data.distance} NM` },
                                    { label: 'Duration', value: data.duration || '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleLogFlight(false)}
                                    disabled={logState === 'saving' || logState === 'saved' || !onAddFlight}
                                    style={{ flex: 1, gap: '8px', fontSize: '0.9rem', padding: '12px', justifyContent: 'center',
                                        ...(logState === 'saved'     ? { backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' } : {}),
                                        ...(logState === 'error'     ? { backgroundColor: 'var(--color-danger)',  borderColor: 'var(--color-danger)'  } : {}),
                                        ...(logState === 'duplicate' ? { backgroundColor: 'var(--color-warning, #f59e0b)', borderColor: 'var(--color-warning, #f59e0b)' } : {}),
                                    }}
                                >
                                    {logState === 'saving'    && <><RefreshCw size={16} className="spin" /> Saving…</>}
                                    {logState === 'saved'     && <><CheckCircle size={16} /> Saved! Redirecting…</>}
                                    {logState === 'error'     && <>Error — try again</>}
                                    {logState === 'duplicate' && <>⚠️ Already logged today</>}
                                    {logState === 'idle'      && <><BookOpen size={16} /> Log This Flight</>}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleEditDetails}
                                    style={{ padding: '12px 20px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    ✏️ Edit Details
                                </button>
                            </div>

                            {/* Duplicate warning */}
                            {logState === 'duplicate' && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.78rem', color: 'var(--color-text-primary)', gap: 'var(--space-3)' }}>
                                    <span>A flight <strong>{data?.origin?.icao} → {data?.destination?.icao}</strong> is already in your logbook for today.</span>
                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                        <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.75rem' }} onClick={() => setLogState('idle')}>
                                            Cancel
                                        </button>
                                        <button className="btn" style={{ padding: '5px 12px', fontSize: '0.75rem', background: 'var(--color-warning, #f59e0b)', color: '#fff', border: 'none' }} onClick={() => handleLogFlight(true)}>
                                            Log Anyway
                                        </button>
                                    </div>
                                </div>
                            )}
                            {!onAddFlight && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', margin: 0 }}>
                                    Pass <code>onAddFlight</code> prop to Briefing to enable quick logging.
                                </p>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                        {/* Map View */}
                        <div style={{ height: '500px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', position: 'relative' }}>
                             <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
                             <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
                                <div style={{ backgroundColor: 'var(--color-surface)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 500, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-family-mono)' }}>
                                    {data.distance} NM
                                </div>
                             </div>
                        </div>

                        {/* AI Briefing Narrative */}
                        <BriefingNarrative data={data} />
                    </div>
                </div>
            )}
        </div>
    );
};

const IdentifierToggle = ({ identifier, onTypeChange }) => (
    <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', gap: '4px' }}>
        {['username', 'userid'].map(type => (
            <button key={type} onClick={() => onTypeChange(type)} style={{ padding: '4px 10px', fontSize: '0.65rem', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: identifier.type === type ? 'var(--color-primary)' : 'transparent', color: identifier.type === type ? '#fff' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                {type === 'username' ? 'Username' : 'Pilot ID'}
            </button>
        ))}
    </div>
);

const MetricBlock = ({ label, value, icon: Icon }) => (
    <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', background: 'var(--color-surface)' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <Icon size={18} aria-hidden="true" />
        </div>
        <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>{value}</div>
        </div>
    </div>
);

const InfoBlock = ({ icon: Icon, label, value, color, children }) => {
    const [isHovered, setIsHovered] = useState(false);
    const spanRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        if (spanRef.current) {
            setIsTruncated(spanRef.current.scrollWidth > spanRef.current.clientWidth);
        }
    }, [value]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%', position: 'relative' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.07em' }}>
                <Icon size={12} style={{ color: color || 'var(--color-primary)' }} aria-hidden="true" />
                {label}
            </span>
            <div style={{ position: 'relative', cursor: isTruncated ? 'help' : 'default' }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <span ref={spanRef} style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {value}
                </span>
                {isHovered && isTruncated && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '0', marginBottom: '8px', backgroundColor: '#1e293b', color: '#f8fafc', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
                        {value}
                        <div style={{ position: 'absolute', top: '100%', left: '12px', width: '0', height: '0', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' }} />
                    </div>
                )}
            </div>
            <div style={{ marginTop: 'auto' }}>{children}</div>
        </div>
    );
};

export default SimBriefBriefing;
