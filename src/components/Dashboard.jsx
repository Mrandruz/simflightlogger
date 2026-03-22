import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Plane, Clock, MapPin, Globe, Trophy, CalendarDays, ExternalLink, Sparkles, RefreshCw, Send, TrendingUp, BookOpen, Calendar, Zap, Activity, Users, Map } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { usePilotData } from '../hooks/usePilotData';
import { findAirport } from '../utils/airportUtils';

// ---------------------------------------------------------------------------
// aggregateStats — identica a useCopilot.js, evita duplicazione e stub fields
// ---------------------------------------------------------------------------
const aggregateStats = (flights) => {
    if (!flights || flights.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const aircraftCount = {};
    const airportCount = {};
    const airlineCount = {};
    const routeCount = {};
    const monthlyCount = {};
    const aircraftIndex = {};

    let totalHours = 0;
    let totalMiles = 0;
    let flightsLastMonth = 0;
    let longestFlight = null;

    const sorted = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach((f) => {
        totalHours += f.flightTime || 0;
        totalMiles += f.miles || 0;

        if (new Date(f.date) >= thirtyDaysAgo) flightsLastMonth++;
        if (!longestFlight || (f.miles || 0) > (longestFlight.miles || 0)) longestFlight = f;

        if (f.aircraft) {
            aircraftCount[f.aircraft] = (aircraftCount[f.aircraft] || 0) + 1;
            if (!aircraftIndex[f.aircraft]) {
                aircraftIndex[f.aircraft] = { count: 0, hours: 0, miles: 0, lastFlight: null, routes: {} };
            }
            const idx = aircraftIndex[f.aircraft];
            idx.count++;
            idx.hours += f.flightTime || 0;
            idx.miles += f.miles || 0;
            if (!idx.lastFlight) idx.lastFlight = `${f.departure}→${f.arrival} il ${f.date}`;
            if (f.departure && f.arrival) {
                const r = `${f.departure}→${f.arrival}`;
                idx.routes[r] = (idx.routes[r] || 0) + 1;
            }
        }

        if (f.departure) airportCount[f.departure] = (airportCount[f.departure] || 0) + 1;
        if (f.arrival)   airportCount[f.arrival]   = (airportCount[f.arrival]   || 0) + 1;
        if (f.airline)   airlineCount[f.airline]   = (airlineCount[f.airline]   || 0) + 1;
        if (f.departure && f.arrival) {
            const key = `${f.departure}→${f.arrival}`;
            routeCount[key] = (routeCount[key] || 0) + 1;
        }
        if (f.date) {
            const month = f.date.slice(0, 7);
            monthlyCount[month] = (monthlyCount[month] || 0) + 1;
        }
    });

    const top = (obj, n = 5) =>
        Object.entries(obj)
            .sort(([, a], [, b]) => b - a)
            .slice(0, n)
            .map(([k, v]) => `${k} (${v})`)
            .join(', ');

    const last = sorted[0];

    const aircraftLogbook = Object.entries(aircraftIndex)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([type, d]) => {
            const topRoute = Object.entries(d.routes).sort(([, a], [, b]) => b - a)[0]?.[0] || '—';
            return `${type}: ${d.count} voli, ${d.hours.toFixed(1)}h, ${Math.round(d.miles)} nm, ultimo: ${d.lastFlight || '—'}, rotta top: ${topRoute}`;
        })
        .join(' | ');

    const daysSinceLast = last ? Math.floor((now - new Date(last.date)) / 86400000) : null;

    return {
        totalFlights: flights.length,
        totalHours: totalHours.toFixed(1),
        totalMiles: Math.round(totalMiles).toLocaleString(),
        topAircraft: Object.entries(aircraftCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        topAirport:  Object.entries(airportCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        topAirline:  Object.entries(airlineCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        topRoute:    Object.entries(routeCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        flightsLastMonth,
        avgHours: (totalHours / flights.length).toFixed(1),
        longestFlight: longestFlight
            ? `${longestFlight.departure}→${longestFlight.arrival} (${Math.round(longestFlight.miles || 0)} nm)`
            : '—',
        topAircraftList: top(aircraftCount),
        topAirportList:  top(airportCount),
        topAirlineList:  top(airlineCount),
        topRouteList:    top(routeCount),
        monthlyDistribution: Object.entries(monthlyCount)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([m, c]) => `${m}: ${c}`)
            .join(', '),
        lastFlight: last
            ? `${last.departure}→${last.arrival} il ${last.date} (${last.aircraft})`
            : '—',
        nextFlight: daysSinceLast !== null
            ? `Last flight was ${daysSinceLast} days ago`
            : 'no data',
        aircraftLogbook,
    };
};

const COPILOT_URL = 'https://europe-west1-simflightlogger.cloudfunctions.net/askCopilot';

/* ── Helpers ── */
const fmtMiles = n => n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const fmtHours = n => Number(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : Number(n).toFixed(1);

function daysSinceColor(d) {
    if (d === null) return { bg: 'var(--color-surface)', color: 'var(--color-text-hint)', dot: 'var(--color-text-hint)' };
    if (d <= 3) return { bg: 'var(--color-success-bg)', color: 'var(--color-success)', dot: 'var(--color-success)' };
    if (d <= 10) return { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', dot: 'var(--color-warning)' };
    return { bg: 'rgba(239,68,68,.08)', color: 'var(--color-danger)', dot: 'var(--color-danger)' };
}

/* ── Empty State ── */
function EmptyState() {
    const navigate = useNavigate();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 420, gap: 'var(--space-6)', padding: 'var(--space-8)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plane size={28} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
                <h2 style={{ fontFamily: 'var(--font-family-display)', fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Welcome to Skydeck</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', maxWidth: 400, lineHeight: 1.6 }}>
                    Your personal flight logbook and planning hub. Add your first flight to unlock stats, AI insights, achievements and more.
                </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-4)', width: '100%', maxWidth: 520 }}>
                {[
                    { icon: BookOpen, title: 'Log a flight', desc: 'Add routes manually from your logbook', action: () => navigate('/new-flight'), color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                    { icon: Calendar, title: 'Plan a route', desc: 'Use SimBrief integration from Briefing', action: () => navigate('/briefing'), color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                    { icon: TrendingUp, title: 'View schedule', desc: 'See suggested routes for each alliance', action: () => navigate('/schedule'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
                ].map(({ icon: Icon, title, desc, action, color, bg }) => (
                    <div key={title} onClick={action} style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', transition: 'border-color .15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = color}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <Icon size={18} style={{ color }} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>{title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── AI Pilot Brief ── */
function PilotBrief({ flights, generated, loading, brief }) {
    const [question, setQuestion] = useState('');
    const [asking, setAsking] = useState(false);
    const [answer, setAnswer] = useState('');
    const inputRef = useRef(null);

    const handleAsk = async () => {
        const q = question.trim();
        if (!q || asking) return;
        setAsking(true); setAnswer('');

        try {
            // Usa aggregateStats condivisa — stessi dati del Copilot, nessun campo stub
            const currentStats = aggregateStats(flights);

            // Token Firebase obbligatorio per la Cloud Function
            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Utente non autenticato.');

            const res = await fetch(COPILOT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ message: q, stats: currentStats, history: [] }),
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
                    if (raw === '[DONE]') return;
                    try { const { text } = JSON.parse(raw); if (text) setAnswer(p => p + text); } catch (_) { }
                }
            }
        } catch {
            setAnswer('Could not get an answer. Please try again.');
        } finally {
            setAsking(false);
        }
    };

    const QUICK_QUESTIONS = ['How was my last month?', 'What\'s my longest route?', 'Suggest my next flight'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {!generated && !loading && (
                <div style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-hint)', lineHeight: 1.5 }}>
                    Generate an AI narrative of your activity this month — flight patterns, stats and suggestions.
                </div>
            )}

            {(generated || loading) && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-background)', borderLeft: '2px solid var(--color-primary)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, fontSize: '0.84rem', lineHeight: 1.7, color: 'var(--color-text-primary)', minHeight: 48 }}>
                    {loading && !brief && (
                        <span style={{ color: 'var(--color-text-hint)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 11, height: 11, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
                            Drafting your brief…
                        </span>
                    )}
                    {brief}
                    {loading && brief && <span style={{ opacity: .35 }}>▋</span>}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                <textarea ref={inputRef} className="form-input"
                    placeholder="Ask your copilot…"
                    value={question} onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAsk())}
                    style={{ flex: 1, fontSize: '0.78rem', height: 64, padding: '8px 12px', resize: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontFamily: 'inherit' }} />
                <button onClick={handleAsk} disabled={!question.trim() || asking}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 64, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer' }}>
                    {asking ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                </button>
            </div>

            {!question && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {QUICK_QUESTIONS.map(q => (
                        <button key={q} onClick={() => { setQuestion(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                            style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                            {q}
                        </button>
                    ))}
                </div>
            )}

            {answer && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.82rem', lineHeight: 1.65, color: 'var(--color-text-primary)' }}>
                    {answer}
                    {asking && <span style={{ opacity: .35 }}>▋</span>}
                </div>
            )}
        </div>
    );
}

/* ── Mini bar chart (inline, no recharts) ── */
function MiniBarList({ data, colorVar = 'var(--color-primary)' }) {
    if (!data.length) return <div style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)' }}>No data yet</div>;
    const max = data[0].count;
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-primary)', width: 95, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ flex: 1, height: 6, background: 'var(--color-background)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.02)' }}>
                        <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: `linear-gradient(90deg, ${colors[i % colors.length]}aa, ${colors[i % colors.length]})`, borderRadius: 4, boxShadow: `0 0 8px ${colors[i % colors.length]}40` }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: colors[i % colors.length], width: 26, textAlign: 'right', flexShrink: 0 }}>{d.count}</div>
                </div>
            ))}
        </div>
    );
}

/* ── Suggested flight card ── */
function SuggestedFlight({ flights }) {
    const navigate = useNavigate();
    const suggestion = useMemo(() => {
        if (!flights.length) return null;
        const sorted = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
        const last = sorted[0];
        if (!last?.arrival) return null;
        const ap = findAirport(last.arrival.toUpperCase());
        return {
            origin: last.arrival.toUpperCase(),
            originName: ap?.name || ap?.city || last.arrival,
            originCity: ap?.city || '',
            airline: last.airline || null,
            date: last.date,
        };
    }, [flights]);

    if (!suggestion) return (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-hint)', padding: 'var(--space-2) 0' }}>Log flights to see suggestions.</div>
    );

    const sbUrl = `https://dispatch.simbrief.com/options/custom?orig=${suggestion.origin}`;
    const daysAgo = Math.floor((new Date() - new Date(suggestion.date)) / 86400000);
    const lastLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Your last flight landed at <strong style={{ color: 'var(--color-text-primary)' }}>{suggestion.origin}</strong> {lastLabel}. Plan your next departure from here:
            </div>
            <div style={{ border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', background: 'linear-gradient(145deg, rgba(26,115,232,.08) 0%, rgba(26,115,232,.02) 100%)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -10, width: 80, height: 80, background: 'radial-gradient(circle, rgba(26,115,232,.15) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                    {suggestion.origin}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    {suggestion.originName}{suggestion.originCity && suggestion.originCity !== suggestion.originName ? ` · ${suggestion.originCity}` : ''}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <a href={sbUrl} target="_blank" rel="noopener noreferrer"
                    className="action-btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.75rem', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: '#fff', border: 'none', textDecoration: 'none', fontWeight: 600, boxShadow: '0 2px 8px rgba(26,115,232,.3)' }}>
                    <ExternalLink size={14} /> SimBrief
                </a>
                <button onClick={() => navigate('/schedule')}
                    className="action-btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.75rem', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', textDecoration: 'none', fontWeight: 500, cursor: 'pointer' }}>
                    <Calendar size={14} /> Schedule
                </button>
            </div>
        </div>
    );
}

/* ── Main Dashboard ── */
export default function Dashboard() {
    const { flights = [], loading: flightsLoading } = useOutletContext();
    const navigate = useNavigate();
    const stats = usePilotData(flights);

    // AI Brief State moved here for header integration
    const [brief, setBrief] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [generated, setGenerated] = useState(false);

    const handleGenerateBrief = async () => {
        if (aiLoading) return;
        setAiLoading(true); setBrief(''); setGenerated(true);

        const now = new Date();
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Usa aggregateStats condivisa — stessi dati del Copilot, nessun campo stub
        const statsPayload = aggregateStats(flights);

        const prompt = `Write a concise pilot brief for ${monthName}. Summarize the pilot's activity this month, highlight key stats, any interesting patterns or records, and give a short operational suggestion for the coming days. Keep it to 3-4 sentences. Aviation-toned, professional, no bullet points.`;

        try {
            // Token Firebase obbligatorio per la Cloud Function
            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Utente non autenticato.');

            const res = await fetch(COPILOT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ message: prompt, stats: statsPayload, history: [] }),
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
                    try { const { text } = JSON.parse(raw); if (text) setBrief(p => p + text); } catch (_) { }
                }
            }
        } catch (err) {
            setBrief('Unable to generate brief.');
        } finally {
            setAiLoading(false);
        }
    };

    const kpis = useMemo(() => {
        if (!flights.length) return { totalFlights: 0, totalMiles: 0, totalHours: 0, daysSinceLastFlight: null, flightsThisMonth: 0, countries: 0 };
        const sorted = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
        const daysSinceLastFlight = Math.floor((new Date() - new Date(sorted[0].date)) / 86400000);
        const now = new Date();
        const flightsThisMonth = flights.filter(f => { const d = new Date(f.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
        return {
            totalFlights: flights.length,
            totalMiles: flights.reduce((s, f) => s + (f.miles || 0), 0),
            totalHours: flights.reduce((s, f) => s + (f.flightTime || 0), 0).toFixed(1),
            daysSinceLastFlight, flightsThisMonth,
            countries: stats.countriesVisited || 0,
        };
    }, [flights, stats]);

    const aircraftStats = useMemo(() => {
        const c = {}; flights.forEach(f => { if (f.aircraft) c[f.aircraft] = (c[f.aircraft] || 0) + 1; });
        return Object.entries(c).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 4);
    }, [flights]);

    const airportStats = useMemo(() => {
        const c = {}; flights.forEach(f => { if (f.departure) c[f.departure] = (c[f.departure] || 0) + 1; if (f.arrival) c[f.arrival] = (c[f.arrival] || 0) + 1; });
        return Object.entries(c).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 4);
    }, [flights]);

    const airlineStats = useMemo(() => {
        const c = {}; flights.forEach(f => { if (f.airline) c[f.airline] = (c[f.airline] || 0) + 1; });
        return Object.entries(c).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 4);
    }, [flights]);

    const timelineStats = useMemo(() => {
        const g = {}; flights.forEach(f => { if (f.date) { const k = f.date.slice(0, 7); g[k] = (g[k] || 0) + 1; } });
        return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, flights]) => {
            const [y, m] = k.split('-');
            return { displayDate: new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short' }), flights };
        });
    }, [flights]);

    const recentFlights = useMemo(() =>
        [...flights].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
        , [flights]);

    const nearestAchievements = useMemo(() => {
        if (!stats.achievements) return [];
        return Object.entries(stats.achievements)
            .map(([key, data]) => ({ key, ...data }))
            .filter(a => !a.unlocked && a.progress > 0)
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 3);
    }, [stats]);

    const ACHIEVEMENT_META = {
        worldTraveler: { label: 'World Traveler', icon: Globe },
        longHaulAce: { label: 'Long Haul Ace', icon: Plane },
        airlineLoyal: { label: 'Airline Loyal', icon: Zap },
        tireless: { label: 'Tireless', icon: Zap },
        typeRatingMaster: { label: 'Type Rating Master', icon: TrendingUp },
        dailyStreak: { label: '7-Day Streak', icon: CalendarDays },
        newDiscovery: { label: 'New Discovery', icon: MapPin },
    };

    if (flightsLoading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[...Array(3)].map((_, i) => <div key={i} className="card skeleton" style={{ height: 80 }} />)}
        </div>
    );

    if (!flights.length) return <EmptyState />;

    const QUICK_ACTIONS = [
        { icon: Calendar, label: 'View schedule', sub: 'Route suggestions', color: '#f59e0b', bg: '#fef3c7', action: () => navigate('/schedule') },
        { icon: ExternalLink, label: 'Plan on SimBrief', sub: 'Open Briefing', color: '#3b82f6', bg: '#eff6ff', action: () => navigate('/briefing') },
        { icon: Plane, label: 'Log a flight', sub: 'Add to logbook', color: '#10b981', bg: '#ecfdf5', action: () => navigate('/new-flight') },
        { icon: BookOpen, label: 'Open logbook', sub: `${kpis.totalFlights} flights`, color: '#8b5cf6', bg: '#f5f3ff', action: () => navigate('/logbook') },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', animation: 'fadeIn .4s ease-out' }}>

            {/* ── Hero KPI strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 'var(--space-4)' }}>
                {[
                    { label: 'Total flights', value: kpis.totalFlights.toLocaleString(), icon: Activity, color: '#3b82f6' },
                    { label: 'Block hours', value: fmtHours(kpis.totalHours), icon: Clock, color: '#10b981' },
                    { label: 'Nautical miles', value: fmtMiles(kpis.totalMiles), icon: Map, color: '#8b5cf6' },
                    { label: 'Countries', value: kpis.countries, icon: Globe, color: '#f59e0b' },
                    { label: 'This month', value: kpis.flightsThisMonth, sub: new Date().toLocaleDateString('en-US', { month: 'long' }), icon: CalendarDays, color: '#ec4899' },
                ].map((kpi, i) => (
                    <div key={kpi.label} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', border: `1px solid ${kpi.color}25`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                        <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: `radial-gradient(circle, ${kpi.color}15 0%, transparent 70%)`, borderRadius: '50%' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: `${kpi.color}15`, color: kpi.color }}>
                                <kpi.icon size={14} strokeWidth={2.5} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{kpi.label}</div>
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            {kpi.value}
                            {kpi.sub && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-sans)' }}>{kpi.sub}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Quick Actions ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-4)' }}>
                {QUICK_ACTIONS.map(({ icon: Icon, label, sub, color, bg, action }) => (
                    <div key={label} onClick={action}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: `linear-gradient(135deg, ${bg} 0%, var(--color-surface) 100%)`, cursor: 'pointer', transition: 'all .25s ease', border: `1px solid ${color}30`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${color}20`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)'; }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${color}20`, boxShadow: `0 2px 10px ${color}15` }}>
                            <Icon size={18} style={{ color }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)' }}>{sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Main body: left column + right sidebar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 'var(--space-5)', alignItems: 'start' }}>

                {/* LEFT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

                    {/* AI Brief - WOW Effect */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 8px 30px rgba(56,189,248,0.12)', background: 'var(--color-surface)', position: 'relative' }}>
                        {/* Soft tint background per farla risaltare senza essere troppo aggressivo - Opacità aumentata su richiesta */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--color-primary) 0%, transparent 100%)', opacity: 0.1, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'var(--color-primary)', opacity: 0.05, pointerEvents: 'none' }} />
                        
                        <div style={{ position: 'absolute', top: -100, left: -100, width: 300, height: 300, background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: -100, right: -100, width: 300, height: 300, background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
                        
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(56,189,248,0.3)' }}>
                                        <Sparkles size={18} style={{ color: '#fff' }} />
                                    </div>
                                    <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: '1px solid rgba(56,189,248,0.3)', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: 500, fontSize: '1.05rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>AI Pilot Brief</h3>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)' }} />
                                        System Online
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleGenerateBrief} disabled={aiLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-primary)', fontWeight: 600, transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                                {aiLoading ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />}
                                {generated ? 'Regenerate' : 'Generate brief'}
                            </button>
                        </div>
                        <div className="ai-brief-content" style={{ padding: '20px 24px', position: 'relative', zIndex: 1 }}>
                            <PilotBrief
                                flights={flights}
                                generated={generated} loading={aiLoading} brief={brief}
                            />
                        </div>
                    </div>

                    {/* Monthly timeline */}
                    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>Monthly activity</div>
                        {timelineStats.length > 0 ? (
                            <div style={{ height: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timelineStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gradFl" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-hint)', fontSize: 11, fontWeight: 500 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-hint)', fontSize: 11, fontWeight: 500 }} allowDecimals={false} />
                                        <RechartsTooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                        <Area type="monotone" dataKey="flights" name="Flights" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#gradFl)" activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-primary)' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : <div style={{ height: 60, display: 'flex', alignItems: 'center', color: 'var(--color-text-hint)', fontSize: '0.8rem' }}>Add flights to see your history</div>}
                    </div>

                    {/* Stats 3-col */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-5)' }}>
                        {[
                            { title: 'Top airlines', data: airlineStats },
                            { title: 'Top aircraft', data: aircraftStats },
                            { title: 'Top airports', data: airportStats },
                        ].map(({ title, data }) => (
                            <div key={title} className="card" style={{ padding: '20px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>{title}</div>
                                <MiniBarList data={data} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT SIDEBAR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

                    {/* Suggested next flight */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>Suggested next flight</div>
                        <SuggestedFlight flights={flights} />
                    </div>

                    {/* Recent flights */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>Recent flights</div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {recentFlights.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < recentFlights.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Plane size={14} style={{ color: 'var(--color-text-secondary)', transform: 'rotate(45deg)' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                                            {f.departure} <span style={{ color: 'var(--color-primary)' }}>→</span> {f.arrival}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {f.airline || '—'} · {f.aircraft || '—'}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--color-text-hint)', flexShrink: 0, textAlign: 'right' }}>
                                        {new Date(f.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => navigate('/logbook')} style={{ marginTop: 16, width: '100%', fontSize: '0.75rem', fontWeight: 600, padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text-primary)', cursor: 'pointer', transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-background)'}>
                            View all flights →
                        </button>
                    </div>

                    {/* Achievements in progress */}
                    {nearestAchievements.length > 0 && (
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>Achievements in progress</div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {nearestAchievements.map((a, i) => {
                                    const meta = ACHIEVEMENT_META[a.key] || { label: a.key, icon: Trophy };
                                    const Icon = meta.icon;
                                    return (
                                        <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < nearestAchievements.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Icon size={16} style={{ color: 'var(--color-warning)' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{meta.label}</span>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-hint)' }}>{a.current}<span style={{ opacity: 0.5 }}>/{a.goal}</span></span>
                                                </div>
                                                <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(100, a.progress)}%`, background: 'var(--color-warning)', borderRadius: 2 }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={() => navigate('/achievements')} style={{ marginTop: 16, width: '100%', fontSize: '0.75rem', fontWeight: 600, padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text-primary)', cursor: 'pointer', transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-background)'}>
                                View all achievements →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes ping { 75%, 100% { transform: scale(1.4); opacity: 0; } }
                .spin { animation: spin .8s linear infinite; }
                
                /* Specific contrast for AI Brief in Light Mode */
                .ai-brief-content {
                    --color-text-primary: #000000;
                    --color-text-secondary: #374151; /* Darker gray - Tailwind gray-700 equivalent */
                    --color-text-hint: #4b5563;
                }
                
                /* Restore Dark Mode colors for AI Brief (based on index.css values) */
                [data-theme="dark"] .ai-brief-content {
                    --color-text-primary: #F7F7F9;
                    --color-text-secondary: #A2A9B1;
                    --color-text-hint: #8A949D;
                }
            `}</style>
        </div>
    );
}
