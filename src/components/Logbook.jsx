import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, Edit2, Filter, X, Eye, ChevronLeft, ChevronRight, Plane, Sparkles, Send, RotateCcw } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { findAirport } from '../utils/airportUtils';
import FlightDetailsModal from './FlightDetailsModal';

import LogbookStats from './LogbookStats';
import LogbookMap from './LogbookMap';

// Converts decimal hours to "8h 58m" format
// Handles both real decimals (8.97) and pseudo-decimal (8.58) formats
const formatFlightTime = (val) => {
    if (!val && val !== 0) return '—';
    const n = Number(val);
    if (isNaN(n) || n === 0) return '0h 00m';
    const h = Math.floor(n);
    const m = Math.round((n - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

/* ── AI Logbook Query — uses same Cloud Function as Copilot ── */
const COPILOT_FUNCTION_URL = 'https://europe-west1-simflightlogger.cloudfunctions.net/askCopilot';

const SUGGESTED_QUERIES = [
    'How many hours have I flown this year?',
    'Which is my most flown route?',
    "What's my total distance in nautical miles?",
    'Which airline have I flown with most?',
    "What's my longest flight ever?",
    'How many flights did I do last month?',
];

function buildLogbookStats(flights) {
    if (!flights?.length) return null;
    const totalHours = flights.reduce((a, f) => a + (Number(f.flightTime) || 0), 0);
    const totalMiles = flights.reduce((a, f) => a + (Number(f.miles) || 0), 0);
    const airlineCount = {}, aircraftCount = {}, routeCount = {}, monthlyCount = {};
    const airports = new Set();
    let longestFlight = null;
    const sorted = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(f => {
        if (f.departure) airports.add(f.departure);
        if (f.arrival)   airports.add(f.arrival);
        if (f.airline)   airlineCount[f.airline]  = (airlineCount[f.airline]  || 0) + 1;
        if (f.aircraft)  aircraftCount[f.aircraft] = (aircraftCount[f.aircraft] || 0) + 1;
        if (f.departure && f.arrival) {
            const r = `${f.departure}→${f.arrival}`;
            routeCount[r] = (routeCount[r] || 0) + 1;
        }
        if (f.date) {
            const m = f.date.slice(0, 7);
            monthlyCount[m] = (monthlyCount[m] || 0) + 1;
        }
        if (!longestFlight || (f.miles || 0) > (longestFlight.miles || 0)) longestFlight = f;
    });
    const top = (obj, n = 5) => Object.entries(obj).sort(([,a],[,b]) => b-a).slice(0,n).map(([k,v]) => `${k} (${v})`).join(', ');
    const last = sorted[0];
    return {
        totalFlights: flights.length,
        totalHours: totalHours.toFixed(2),
        totalMiles: Math.round(totalMiles).toLocaleString(),
        uniqueAirports: airports.size,
        topAirline: Object.entries(airlineCount).sort(([,a],[,b]) => b-a)[0]?.[0] || '—',
        topAircraftList: top(aircraftCount),
        topAirlineList: top(airlineCount),
        topRouteList: top(routeCount, 10),
        longestFlight: longestFlight ? `${longestFlight.departure}→${longestFlight.arrival} (${Math.round(longestFlight.miles||0)} nm) on ${longestFlight.date}` : '—',
        lastFlight: last ? `${last.departure}→${last.arrival} on ${last.date} (${last.aircraft})` : '—',
        monthlyDistribution: Object.entries(monthlyCount).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([m,c]) => `${m}: ${c}`).join(', '),
        aircraftLogbook: top(aircraftCount, 10),
        flightList: sorted.slice(0, 300).map(f =>
            `${f.date}|${f.departure}→${f.arrival}|${f.airline||''}|${f.aircraft||''}|${f.miles||0}nm|${formatFlightTime(f.flightTime)}|${f.alliance||''}`
        ).join('\n'),
    };
}

function LogbookAI({ flights }) {
    const [query, setQuery]     = useState('');
    const [answer, setAnswer]   = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [asked, setAsked]     = useState(false);
    const inputRef = useRef(null);

    const handleQuery = async (q) => {
        const text = (q || query).trim();
        if (!text || loading) return;
        setLoading(true); setError(''); setAnswer(''); setAsked(true);
        try {
            const stats = buildLogbookStats(flights);
            const res = await fetch(COPILOT_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `[Reply in English only]\n\n${text}`, stats, history: [] }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;
                    try { const { text: chunk } = JSON.parse(data); if (chunk) setAnswer(prev => prev + chunk); } catch (_) {}
                }
            }
        } catch (e) {
            setError('Could not get an answer. Please try again.');
            console.error('LogbookAI error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setQuery(''); setAnswer(''); setError(''); setAsked(false);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    return (
        <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', border: '1px solid var(--color-primary)', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-surface) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} color="#fff" />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>Ask your Logbook</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', marginTop: 1 }}>Query your {flights.length} flights in natural language</div>
                </div>
            </div>
            {!asked ? (
                <>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <input ref={inputRef} type="text" className="form-input"
                            placeholder="e.g. How many hours have I flown this year?"
                            value={query} onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleQuery()}
                            style={{ flex: 1, fontSize: '0.85rem' }} />
                        <button className="btn btn-primary" onClick={() => handleQuery()}
                            disabled={!query.trim() || loading} style={{ padding: '8px 16px', gap: 6 }}>
                            <Send size={14} /> Ask
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {SUGGESTED_QUERIES.map(q => (
                            <button key={q} onClick={() => { setQuery(q); handleQuery(q); }}
                                style={{ padding: '4px 12px', fontSize: '0.72rem', fontWeight: 500, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'all .15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
                                {q}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>"{query}"</div>
                    <div style={{ minHeight: 48, fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--color-text-primary)', background: 'var(--color-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', whiteSpace: 'pre-wrap' }}>
                        {loading && !answer && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-hint)' }}>
                                <div style={{ width: 14, height: 14, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                Analyzing your logbook…
                            </div>
                        )}
                        {error && <span style={{ color: 'var(--color-danger)' }}>{error}</span>}
                        {answer}
                        {loading && answer && <span style={{ opacity: 0.4 }}>▋</span>}
                    </div>
                    {!loading && (
                        <button className="btn btn-secondary" onClick={handleReset}
                            style={{ alignSelf: 'flex-start', gap: 6, fontSize: '0.78rem', padding: '6px 14px' }}>
                            <RotateCcw size={13} /> Ask another question
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}


export default function Logbook({ flights, onDelete, onEdit }) {
    console.log('Logbook: Rendering with', flights.length, 'flights');
    const context = useOutletContext();
    const isDarkMode = context?.isDarkMode;

    const [activeFilters, setActiveFilters] = useState({});
    const [selectedFlightDetails, setSelectedFlightDetails] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const flightsPerPage = 15;

    const uniqueAirlines = useMemo(() => [...new Set(flights.map(f => f.airline).filter(Boolean))].sort(), [flights]);
    const uniqueAircraft = useMemo(() => [...new Set(flights.map(f => f.aircraft).filter(Boolean))].sort(), [flights]);
    const uniqueAlliances = useMemo(() => [...new Set(flights.map(f => f.alliance).filter(Boolean))].sort(), [flights]);
    const uniqueICAOs = useMemo(() => {
        const codes = new Set();
        flights.forEach(f => {
            if (f.departure) codes.add(f.departure.toUpperCase());
            if (f.arrival) codes.add(f.arrival.toUpperCase());
        });
        return [...codes].sort();
    }, [flights]);

    const filteredFlights = useMemo(() => {
        let filtered = [...flights];
        const activeKeys = Object.keys(activeFilters);

        if (activeKeys.length > 0) {
            filtered = filtered.filter(f => {
                return activeKeys.every(key => {
                    if (key === 'icao') {
                        return f.departure === activeFilters[key] || f.arrival === activeFilters[key];
                    }
                    return f[key] === activeFilters[key];
                });
            });
        }
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [flights, activeFilters]);

    const mapData = useMemo(() => {
        const airportsMap = new Map();
        const routes = [];

        filteredFlights.forEach((f, idx) => {
            if (f.departure && f.arrival) {
                const depCode = f.departure.toUpperCase();
                const arrCode = f.arrival.toUpperCase();
                const depAp = findAirport(depCode);
                const arrAp = findAirport(arrCode);

                const isDepValid = depAp && typeof depAp.latitude === 'number' && typeof depAp.longitude === 'number';
                const isArrValid = arrAp && typeof arrAp.latitude === 'number' && typeof arrAp.longitude === 'number';

                if (isDepValid) {
                    airportsMap.set(depCode, {
                        icao: depCode,
                        coordinates: [depAp.longitude, depAp.latitude],
                        name: depAp.name || depCode
                    });
                }
                if (isArrValid) {
                    airportsMap.set(arrCode, {
                        icao: arrCode,
                        coordinates: [arrAp.longitude, arrAp.latitude],
                        name: arrAp.name || arrCode
                    });
                }

                if (isDepValid && isArrValid) {
                    routes.push({
                        id: `${depCode}-${arrCode}-${f.date}-${idx}`,
                        from: [depAp.longitude, depAp.latitude],
                        to: [arrAp.longitude, arrAp.latitude]
                    });
                }
            }
        });

        const airports = Array.from(airportsMap.values());
        return { airports, routes };
    }, [filteredFlights]);

    const handleFilterClick = (type, value) => {
        setActiveFilters(prev => {
            const next = { ...prev };
            if (!value) {
                delete next[type];
            } else {
                next[type] = value;
            }
            return next;
        });
        setCurrentPage(1);
    };

    const clearFilter = () => {
        setActiveFilters({});
        setCurrentPage(1);
    };

    const totalPages = Math.ceil(filteredFlights.length / flightsPerPage);
    const paginatedFlights = useMemo(() => {
        const startIndex = (currentPage - 1) * flightsPerPage;
        return filteredFlights.slice(startIndex, startIndex + flightsPerPage);
    }, [filteredFlights, currentPage]);

    const formatDate = (isoStr) => {
        if (!isoStr) return '';
        const date = new Date(isoStr);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const tileLayerRef = useRef(null);

    const stats = useMemo(() => {
        const total = filteredFlights.length;
        const miles = Math.round(filteredFlights.reduce((acc, f) => acc + (f.miles || 0), 0));
        const hours = Math.round(filteredFlights.reduce((acc, f) => acc + (f.flightTime || 0), 0));
        const xp = filteredFlights.reduce((acc, f) => acc + (Math.floor(((f.miles || 0) / 10) + ((f.flightTime || 0) * 50))), 0);
        return { total, miles, hours, xp };
    }, [filteredFlights]);

    const filterLabel = useMemo(() => {
        const parts = [];
        if (activeFilters.icao) parts.push(activeFilters.icao);
        if (activeFilters.airline) parts.push(activeFilters.airline);
        if (activeFilters.aircraft) parts.push(activeFilters.aircraft);
        if (activeFilters.alliance) parts.push(activeFilters.alliance);

        if (parts.length === 0) return "Global";
        return parts.join(' • ');
    }, [activeFilters]);

    const latestFlightOverall = useMemo(() => {
        if (!flights || flights.length === 0) return null;
        return [...flights].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    }, [flights]);

    const narrative = useMemo(() => {
        if (!latestFlightOverall) return null;
        const activeKeys = Object.keys(activeFilters);
        const isActiveFilter = activeKeys.length > 0;
        
        if (!isActiveFilter) {
            return `Latest activity: ${formatDate(latestFlightOverall.date)} (${latestFlightOverall.departure} → ${latestFlightOverall.arrival})`;
        } else {
            const lastVisitedInFilter = filteredFlights[0];
            if (!lastVisitedInFilter) return `No flights found for this filter`;
            
            const dateStr = formatDate(lastVisitedInFilter.date);
            const routeStr = `(${lastVisitedInFilter.departure} → ${lastVisitedInFilter.arrival})`;
            
            if (activeKeys.length === 1) {
                const key = activeKeys[0];
                const value = activeFilters[key];
                if (key === 'icao') return `Last visited: ${dateStr} with ${lastVisitedInFilter.airline} ${routeStr}`;
                if (key === 'airline') return `Last flight with ${value}: ${dateStr} ${routeStr}`;
                if (key === 'aircraft') return `Last session on ${value} with ${lastVisitedInFilter.airline}: ${dateStr} ${routeStr}`;
                if (key === 'alliance') return `Last flight with ${value} (${lastVisitedInFilter.airline}): ${dateStr} ${routeStr}`;
                return `Last matching activity: ${dateStr} ${routeStr}`;
            } else {
                if (activeFilters.icao) {
                    return `Last match at ${activeFilters.icao} with ${lastVisitedInFilter.airline}: ${dateStr} ${routeStr}`;
                }
                return `Last match with ${lastVisitedInFilter.airline}: ${dateStr} ${routeStr}`;
            }
        }
    }, [latestFlightOverall, activeFilters, filteredFlights]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Global Dashboard Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 350px) 1fr', gap: 'var(--space-6)' }}>
                <LogbookStats stats={stats} filterLabel={filterLabel} narrative={narrative} />
                <LogbookMap mapData={mapData} isDarkMode={isDarkMode} filteredFlights={filteredFlights} />
            </div>

            {/* AI Natural Language Query */}
            <LogbookAI flights={flights} />

            {/* Active Filters Bar - Punto 2 dello UX Analysis */}
            {Object.keys(activeFilters).length > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-primary-light)',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)',
                    flexWrap: 'wrap', animation: 'fadeSlideUp 0.3s ease'
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.07em', borderRight: '1px solid var(--color-primary)', paddingRight: 'var(--space-3)', marginRight: '4px' }}>
                        Active Filters
                    </div>
                    {Object.entries(activeFilters).map(([key, value]) => (
                        <div key={key} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            backgroundColor: 'var(--color-surface)', padding: '4px 10px',
                            borderRadius: 'var(--radius-full)', border: '1px solid var(--color-primary)',
                            fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-primary)'
                        }}>
                            <span style={{ color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{key}:</span>
                            {value}
                            <button onClick={() => handleFilterClick(key, null)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={clearFilter}
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem', height: '28px', marginLeft: 'auto' }}
                    >
                        Clear All
                    </button>
                </div>
            )}

            {/* List */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <h3 className="card-title" style={{ marginBottom: 0 }}>Logbook</h3>

                        {/* Explicit Filters */}
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <select
                                className="form-input"
                                style={{ padding: '6px 12px', width: 'auto', minWidth: '130px', cursor: 'pointer', fontSize: '0.85rem' }}
                                value={activeFilters.airline || ''}
                                onChange={(e) => handleFilterClick('airline', e.target.value)}
                            >
                                <option value="">All Airlines</option>
                                {uniqueAirlines.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>

                            <select
                                className="form-input"
                                style={{ padding: '6px 12px', width: 'auto', minWidth: '130px', cursor: 'pointer', fontSize: '0.85rem' }}
                                value={activeFilters.aircraft || ''}
                                onChange={(e) => handleFilterClick('aircraft', e.target.value)}
                            >
                                <option value="">All Aircraft</option>
                                {uniqueAircraft.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>

                            <select
                                className="form-input"
                                style={{ padding: '6px 12px', width: 'auto', minWidth: '130px', cursor: 'pointer', fontSize: '0.85rem' }}
                                value={activeFilters.alliance || ''}
                                onChange={(e) => handleFilterClick('alliance', e.target.value)}
                            >
                                <option value="">All Alliances</option>
                                {uniqueAlliances.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>

                            <div style={{ position: 'relative' }}>
                                <input
                                    list="icao-list"
                                    type="text"
                                    className="form-input"
                                    placeholder="Filter ICAO..."
                                    style={{ padding: '6px 12px', width: '120px', fontSize: '0.85rem' }}
                                    value={activeFilters.icao || ''}
                                    onChange={(e) => handleFilterClick('icao', e.target.value.toUpperCase())}
                                />
                <datalist id="icao-list">
                    {uniqueICAOs.map(icao => <option key={icao} value={icao} />)}
                </datalist>
            </div>
        </div>
    </div>

    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
        {filteredFlights.length} flight{filteredFlights.length !== 1 ? 's' : ''} found
    </div>
</div>

                <div className="table-container" style={{ marginTop: 'var(--space-4)' }}>
                    <table className="flights-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Airline / Aircraft</th>
                                <th>Route</th>
                                <th>Miles</th>
                                <th>Time</th>
                                <th>XP</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedFlights.length > 0 ? paginatedFlights.map(f => {
                                const isLatestTotal = latestFlightOverall && f.id === latestFlightOverall.id;
                                return (
                                <tr key={f.id} style={isLatestTotal ? { borderLeft: '3px solid var(--color-primary)', backgroundColor: 'var(--color-primary-light)' } : {}}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {formatDate(f.date)}
                                            {isLatestTotal && (
                                                <span style={{ 
                                                    fontSize: '0.65rem', backgroundColor: 'var(--color-primary)', 
                                                    color: 'white', padding: '2px 6px', borderRadius: '4px', 
                                                    fontWeight: 500, letterSpacing: '0.07em' 
                                                }}>Latest</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="clickable-filter-text" style={{ fontWeight: 500 }} onClick={() => handleFilterClick('airline', f.airline)} title={`Filter by ${f.airline}`}>{f.airline}</div>
                                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <span className="clickable-filter-text" onClick={() => handleFilterClick('aircraft', f.aircraft)} title={`Filter by ${f.aircraft}`}>{f.aircraft}</span>
                                            &bull;
                                            <span className="clickable-filter-text" onClick={() => handleFilterClick('alliance', f.alliance)} title={`Filter by ${f.alliance}`}>{f.alliance}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge data-mono clickable-filter-badge" onClick={() => handleFilterClick('icao', f.departure)} title={`Filter by ${f.departure}`}>{f.departure}</span>
                                        &rarr;
                                        <span className="badge data-mono clickable-filter-badge" onClick={() => handleFilterClick('icao', f.arrival)} title={`Filter by ${f.arrival}`}>{f.arrival}</span>
                                    </td>
                                    <td className="data-mono">{f.miles} nm</td>
                                    <td className="data-mono">{formatFlightTime(f.flightTime)}</td>
                                    <td>
                                        <span className="data-mono" style={{ color: 'var(--color-primary)', fontWeight: 500, fontSize: '0.85rem' }}>
                                            {Math.floor(((f.miles || 0) / 10) + ((f.flightTime || 0) * 50))}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedFlightDetails(f); }} className="has-tooltip" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '4px', marginRight: 'var(--space-2)' }} aria-label={`View details of flight to ${f.arrival}`}>
                                            <Eye size={18} aria-hidden="true" />
                                            <span className="tooltip-box">View Details</span>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onEdit(f); }} className="has-tooltip" style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px', marginRight: 'var(--space-2)' }} aria-label={`Edit flight to ${f.arrival}`}>
                                            <Edit2 size={18} aria-hidden="true" />
                                            <span className="tooltip-box">Edit Flight</span>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(f.id); }} className="has-tooltip" style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }} aria-label={`Delete flight to ${f.arrival}`}>
                                            <Trash2 size={18} aria-hidden="true" />
                                            <span className="tooltip-box">Delete Flight</span>
                                        </button>
                                    </td>
                                </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <Plane size={48} style={{ color: 'var(--color-text-hint)', opacity: 0.3 }} />
                                            <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '1.2rem' }}>No Flights Found</h4>
                                            <p style={{ margin: 0, color: 'var(--color-text-hint)', fontSize: '0.9rem', maxWidth: '300px' }}>
                                                None of your flights match the currently active filters. Try removing some filters to see your logbook.
                                            </p>
                                            {Object.keys(activeFilters).length > 0 && (
                                                <button
                                                    onClick={clearFilter}
                                                    className="btn btn-primary"
                                                    style={{ marginTop: 'var(--space-2)' }}
                                                >
                                                    Clear All Filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-divider)' }}>
                        <button
                            className="btn"
                            style={{ padding: '6px 12px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: currentPage === 1 ? 'var(--color-text-hint)' : 'var(--color-text-primary)' }}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>

                        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                            Page <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{currentPage}</span> of {totalPages}
                        </div>

                        <button
                            className="btn"
                            style={{ padding: '6px 12px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: currentPage === totalPages ? 'var(--color-text-hint)' : 'var(--color-text-primary)' }}
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {selectedFlightDetails && (
                <FlightDetailsModal
                    flight={selectedFlightDetails}
                    allFlights={flights}
                    onClose={() => setSelectedFlightDetails(null)}
                />
            )}
        </div>
    );
}
