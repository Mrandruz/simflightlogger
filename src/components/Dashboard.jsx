import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Plane, Clock, MapPin, Globe, Trophy, CalendarDays, ExternalLink, Sparkles, RefreshCw, Send, TrendingUp, BookOpen, Calendar, Zap } from 'lucide-react';
import { usePilotData } from '../hooks/usePilotData';
import { findAirport } from '../utils/airportUtils';

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
function PilotBrief({ flights, stats }) {
    const [brief, setBrief] = useState('');
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [question, setQuestion] = useState('');
    const [asking, setAsking] = useState(false);
    const [answer, setAnswer] = useState('');
    const inputRef = useRef(null);

    const buildStats = () => {
        const now = new Date();
        const monthFlights = flights.filter(f => {
            const d = new Date(f.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const sorted = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastFlight = sorted[0];
        const airlineCounts = {};
        flights.forEach(f => { if (f.airline) airlineCounts[f.airline] = (airlineCounts[f.airline] || 0) + 1; });
        const topAirline = Object.entries(airlineCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '—';
        const routeCounts = {};
        flights.forEach(f => { if (f.departure && f.arrival) { const r = `${f.departure}→${f.arrival}`; routeCounts[r] = (routeCounts[r] || 0) + 1; } });
        const topRoute = Object.entries(routeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '—';
        const totalMiles = flights.reduce((s, f) => s + (f.miles || 0), 0);
        const totalHours = flights.reduce((s, f) => s + (f.flightTime || 0), 0);
        const daysSinceLast = lastFlight ? Math.floor((now - new Date(lastFlight.date)) / (86400000)) : null;
        return {
            totalFlights: flights.length,
            totalHours: totalHours.toFixed(1),
            totalMiles: Math.round(totalMiles).toLocaleString(),
            topAirline, topAircraftList: stats.achievements?.typeRatingMaster?.extraInfo || '—',
            topAirlineList: topAirline, topRouteList: topRoute,
            flightsLastMonth: monthFlights.length,
            avgHours: flights.length ? (totalHours / flights.length).toFixed(1) : '0',
            longestFlight: stats.longestFlight ? `${stats.longestFlight.departure}→${stats.longestFlight.arrival}(${stats.longestFlight.miles}nm)` : '—',
            lastFlight: lastFlight ? `${lastFlight.departure}→${lastFlight.arrival} on ${lastFlight.date}` : '—',
            nextFlight: daysSinceLast !== null ? `Last flight was ${daysSinceLast} days ago` : 'no data',
            monthlyDistribution: '—', topAirportList: '—', aircraftLogbook: '—',
        };
    };

    const streamCopilot = async (message, onChunk) => {
        const res = await fetch(COPILOT_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, stats: buildStats(), history: [] }),
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
                try { const { text } = JSON.parse(raw); if (text) onChunk(text); } catch (_) { }
            }
        }
    };

    const handleGenerate = async () => {
        if (loading) return;
        setLoading(true); setBrief(''); setGenerated(true); setAnswer('');
        const now = new Date();
        const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const prompt = `Write a concise pilot brief for ${monthName}. Summarize the pilot's activity this month, highlight key stats, any interesting patterns or records, and give a short operational suggestion for the coming days. Keep it to 3-4 sentences. Aviation-toned, professional, no bullet points.`;
        try { await streamCopilot(prompt, chunk => setBrief(p => p + chunk)); }
        catch { setBrief('Unable to generate brief. Please try again.'); }
        finally { setLoading(false); }
    };

    const handleAsk = async () => {
        const q = question.trim();
        if (!q || asking) return;
        setAsking(true); setAnswer('');
        try { await streamCopilot(q, chunk => setAnswer(p => p + chunk)); }
        catch { setAnswer('Could not get an answer. Please try again.'); }
        finally { setAsking(false); }
    };

    const QUICK_QUESTIONS = ['How was my last month?', 'What\'s my longest route?', 'Suggest my next flight'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button onClick={handleGenerate} disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                    {loading ? <RefreshCw size={11} className="spin" /> : <RefreshCw size={11} />}
                    {generated ? 'Regenerate' : 'Generate brief'}
                </button>
            </div>

            {!generated && !loading && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-hint)', lineHeight: 1.6 }}>
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
                <input ref={inputRef} type="text" className="form-input"
                    placeholder="Ask your copilot…"
                    value={question} onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAsk()}
                    style={{ flex: 1, fontSize: '0.78rem', height: 32 }} />
                <button onClick={handleAsk} disabled={!question.trim() || asking}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer' }}>
                    {asking ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
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
    const colors = ['var(--color-primary)', '#5DCAA5', '#AFA9EC', '#FAC775', '#F09595'];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-primary)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ flex: 1, height: 5, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: colors[i % colors.length], borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', width: 22, textAlign: 'right', flexShrink: 0 }}>{d.count}</div>
                </div>
            ))}
        </div>
    );
}

/* ── Suggested flight card ── */
function SuggestedFlight({ flights }) {
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
            <div style={{ border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', padding: '12px 14px', background: 'rgba(26,115,232,.04)' }}>
                <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 3 }}>
                    {suggestion.origin}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                    {suggestion.originName}{suggestion.originCity && suggestion.originCity !== suggestion.originName ? ` · ${suggestion.originCity}` : ''}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <a href={sbUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                    <ExternalLink size={11} /> Plan on SimBrief
                </a>
                <a href="/schedule" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                    View schedule
                </a>
            </div>
        </div>
    );
}

/* ── Main Dashboard ── */
export default function Dashboard() {
    const { flights = [], loading } = useOutletContext();
    const navigate = useNavigate();
    const stats = usePilotData(flights);

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

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[...Array(3)].map((_, i) => <div key={i} className="card skeleton" style={{ height: 80 }} />)}
        </div>
    );

    if (!flights.length) return <EmptyState />;

    const QUICK_ACTIONS = [
        { icon: ExternalLink, label: 'Plan on SimBrief', sub: 'Open Briefing', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', action: () => navigate('/briefing') },
        { icon: Plane, label: 'Log a flight', sub: 'Add to logbook', color: 'var(--color-success)', bg: 'var(--color-success-bg)', action: () => navigate('/new-flight') },
        { icon: Calendar, label: 'View schedule', sub: 'Route suggestions', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', action: () => navigate('/schedule') },
        { icon: BookOpen, label: 'Open logbook', sub: `${kpis.totalFlights} flights`, color: '#8b5cf6', bg: 'rgba(139,92,246,.1)', action: () => navigate('/logbook') },
    ];

    const barColors = ['var(--color-primary)', '#5DCAA5', '#AFA9EC', '#FAC775'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn .4s ease-out' }}>

            {/* ── Hero KPI strip ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
                    {[
                        { label: 'Total flights', value: kpis.totalFlights.toLocaleString() },
                        { label: 'Block hours', value: fmtHours(kpis.totalHours) },
                        { label: 'Nautical miles', value: fmtMiles(kpis.totalMiles) },
                        { label: 'Countries', value: kpis.countries },
                        { label: 'This month', value: kpis.flightsThisMonth, sub: new Date().toLocaleDateString('en-US', { month: 'long' }) },
                    ].map((kpi, i) => (
                        <div key={kpi.label} style={{ padding: '14px 20px', borderRight: i < 4 ? '1px solid var(--color-border)' : 'none', background: i === 4 ? 'rgba(26,115,232,.03)' : 'transparent' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{kpi.label}</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 600, color: i === 4 ? 'var(--color-primary)' : 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>{kpi.value}</div>
                            {kpi.sub && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', marginTop: 2 }}>{kpi.sub}</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-3)' }}>
                {QUICK_ACTIONS.map(({ icon: Icon, label, sub, color, bg, action }) => (
                    <div key={label} onClick={action}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: `1.5px solid ${color}40`, background: `linear-gradient(135deg, ${bg} 0%, var(--color-surface) 100%)`, cursor: 'pointer', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 0 0 1px ${color}`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${color}30` }}>
                            <Icon size={16} style={{ color }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>{sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Main body: left column + right sidebar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 'var(--space-4)', alignItems: 'start' }}>

                {/* LEFT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                    {/* AI Brief */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'rgba(26,115,232,.05)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>AI Pilot Brief</span>
                        </div>
                        <div style={{ padding: 'var(--space-5)' }}>
                            <PilotBrief flights={flights} stats={stats} />
                        </div>
                    </div>

                    {/* Monthly timeline */}
                    <div className="card" style={{ padding: 'var(--space-5)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>Monthly activity</div>
                        {timelineStats.length > 0 ? (
                            <div style={{ height: 140 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timelineStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gradFl" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-hint)', fontSize: 11 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-hint)', fontSize: 11 }} allowDecimals={false} />
                                        <RechartsTooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                                        <Area type="monotone" dataKey="flights" name="Flights" stroke="var(--color-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#gradFl)" activeDot={{ r: 5, strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : <div style={{ height: 60, display: 'flex', alignItems: 'center', color: 'var(--color-text-hint)', fontSize: '0.8rem' }}>Add flights to see your history</div>}
                    </div>

                    {/* Stats 3-col */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-4)' }}>
                        {[
                            { title: 'Top airlines', data: airlineStats },
                            { title: 'Top aircraft', data: aircraftStats },
                            { title: 'Top airports', data: airportStats },
                        ].map(({ title, data }) => (
                            <div key={title} className="card" style={{ padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>{title}</div>
                                <MiniBarList data={data} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT SIDEBAR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                    {/* Suggested next flight */}
                    <div className="card" style={{ padding: 'var(--space-4)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>Suggested next flight</div>
                        <SuggestedFlight flights={flights} />
                    </div>

                    {/* Recent flights */}
                    <div className="card" style={{ padding: 'var(--space-4)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>Recent flights</div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {recentFlights.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < recentFlights.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)', width: 90, flexShrink: 0 }}>
                                        {f.departure}→{f.arrival}
                                    </div>
                                    <div style={{ flex: 1, fontSize: '0.7rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {f.airline || '—'} · {f.aircraft || '—'}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', flexShrink: 0 }}>
                                        {new Date(f.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => navigate('/logbook')} style={{ marginTop: 10, width: '100%', fontSize: '0.72rem', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                            View all flights →
                        </button>
                    </div>

                    {/* Achievements in progress */}
                    {nearestAchievements.length > 0 && (
                        <div className="card" style={{ padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>Achievements in progress</div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {nearestAchievements.map((a, i) => {
                                    const meta = ACHIEVEMENT_META[a.key] || { label: a.key, icon: Trophy };
                                    const Icon = meta.icon;
                                    return (
                                        <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < nearestAchievements.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--color-background)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Icon size={13} style={{ color: 'var(--color-text-secondary)' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{meta.label}</span>
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)' }}>{a.current}/{a.goal}</span>
                                                </div>
                                                <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(100, a.progress)}%`, background: 'var(--color-primary)', borderRadius: 2 }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={() => navigate('/achievements')} style={{ marginTop: 10, width: '100%', fontSize: '0.72rem', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                View all achievements →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin .8s linear infinite; }
            `}</style>
        </div>
    );
}
