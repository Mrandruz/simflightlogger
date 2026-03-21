import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, Edit2, Filter, X, Eye, ChevronLeft, ChevronRight, Plane } from 'lucide-react';
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

/* ── Anomaly Detection Engine ── */
const KNOWN_AIRCRAFT = [
    'Airbus A319','Airbus A320','Airbus A321','Airbus A330',
    'Airbus A350','Airbus A380','Boeing 777','Boeing 787','Altro',
];
const TODAY = new Date().toISOString().split('T')[0];

const ANOMALY_TYPES = {
    IMPOSSIBLE_ROUTE:   { severity: 'error',   label: 'Impossible route',        icon: '🚫' },
    DUPLICATE:          { severity: 'error',   label: 'Duplicate flight',         icon: '📋' },
    ZERO_DISTANCE:      { severity: 'error',   label: 'Missing distance',         icon: '📏' },
    ZERO_TIME:          { severity: 'error',   label: 'Missing flight time',      icon: '⏱️' },
    SPEED_TOO_HIGH:     { severity: 'warning', label: 'Unrealistic speed',        icon: '⚡' },
    SPEED_TOO_LOW:      { severity: 'warning', label: 'Unrealistic speed',        icon: '🐢' },
    MISSING_AIRLINE:    { severity: 'warning', label: 'Missing airline',          icon: '✈️' },
    MISSING_AIRCRAFT:   { severity: 'warning', label: 'Missing aircraft',         icon: '🛩️' },
    UNKNOWN_AIRCRAFT:   { severity: 'info',    label: 'Unknown aircraft type',    icon: '❓' },
    FUTURE_DATE:        { severity: 'warning', label: 'Future date',              icon: '📅' },
};

function detectAnomalies(flights) {
    const anomalies = [];
    const seen = {};

    flights.forEach(f => {
        const id = f.id;
        const dep = (f.departure || '').toUpperCase();
        const arr = (f.arrival   || '').toUpperCase();
        const miles = Number(f.miles || 0);
        const hours = Number(f.flightTime || 0);

        // Impossible route
        if (dep && arr && dep === arr) {
            anomalies.push({ flightId: id, type: 'IMPOSSIBLE_ROUTE', flight: f,
                detail: `${dep} → ${arr}` });
        }

        // Duplicate
        const key = `${dep}|${arr}|${f.date}`;
        if (seen[key]) {
            anomalies.push({ flightId: id, type: 'DUPLICATE', flight: f,
                detail: `${dep} → ${arr} on ${f.date}` });
        } else {
            seen[key] = true;
        }

        // Missing distance
        if (!miles || miles === 0) {
            anomalies.push({ flightId: id, type: 'ZERO_DISTANCE', flight: f,
                detail: `${dep} → ${arr}` });
        }

        // Missing flight time
        if (!hours || hours === 0) {
            anomalies.push({ flightId: id, type: 'ZERO_TIME', flight: f,
                detail: `${dep} → ${arr}` });
        }

        // Speed check (only if both distance and time are valid)
        if (miles > 0 && hours > 0) {
            const speed = miles / hours;
            if (speed > 650) anomalies.push({ flightId: id, type: 'SPEED_TOO_HIGH', flight: f,
                detail: `${Math.round(speed)} kts implied (${dep} → ${arr}, ${miles}nm in ${formatFlightTime(hours)})` });
            else if (speed < 100) anomalies.push({ flightId: id, type: 'SPEED_TOO_LOW', flight: f,
                detail: `${Math.round(speed)} kts implied (${dep} → ${arr}, ${miles}nm in ${formatFlightTime(hours)})` });
        }

        // Missing airline
        if (!f.airline || !f.airline.trim()) {
            anomalies.push({ flightId: id, type: 'MISSING_AIRLINE', flight: f,
                detail: `${dep} → ${arr} on ${f.date}` });
        }

        // Missing aircraft
        if (!f.aircraft || !f.aircraft.trim()) {
            anomalies.push({ flightId: id, type: 'MISSING_AIRCRAFT', flight: f,
                detail: `${dep} → ${arr} on ${f.date}` });
        } else if (!KNOWN_AIRCRAFT.includes(f.aircraft)) {
            anomalies.push({ flightId: id, type: 'UNKNOWN_AIRCRAFT', flight: f,
                detail: `"${f.aircraft}" on ${dep} → ${arr}` });
        }

        // Future date
        if (f.date && f.date > TODAY) {
            anomalies.push({ flightId: id, type: 'FUTURE_DATE', flight: f,
                detail: `${dep} → ${arr} on ${f.date}` });
        }
    });

    return anomalies;
}

function AnomalyBanner({ flights, onEditFlight }) {
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const anomalies = useMemo(() => detectAnomalies(flights), [flights]);

    if (dismissed || anomalies.length === 0) return null;

    const errors   = anomalies.filter(a => ANOMALY_TYPES[a.type].severity === 'error');
    const warnings = anomalies.filter(a => ANOMALY_TYPES[a.type].severity === 'warning');
    const infos    = anomalies.filter(a => ANOMALY_TYPES[a.type].severity === 'info');

    const bannerColor = errors.length > 0
        ? 'var(--color-danger)'
        : warnings.length > 0 ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary)';
    const bannerBg = errors.length > 0
        ? 'var(--color-danger-bg, rgba(239,68,68,0.06))'
        : warnings.length > 0 ? 'rgba(245,158,11,0.06)' : 'var(--color-primary-light)';

    return (
        <div style={{ borderRadius: 'var(--radius-lg)', border: `1px solid ${bannerColor}`, background: bannerBg, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', cursor: 'pointer' }}
                onClick={() => setExpanded(e => !e)}>
                <span style={{ fontSize: '1.1rem' }}>
                    {errors.length > 0 ? '🚨' : warnings.length > 0 ? '⚠️' : 'ℹ️'}
                </span>
                <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: bannerColor, fontFamily: 'var(--font-family-display)' }}>
                        {anomalies.length} logbook {anomalies.length === 1 ? 'issue' : 'issues'} detected
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: 10 }}>
                        {errors.length > 0 && `${errors.length} error${errors.length > 1 ? 's' : ''}`}
                        {errors.length > 0 && warnings.length > 0 && ' · '}
                        {warnings.length > 0 && `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
                        {(errors.length > 0 || warnings.length > 0) && infos.length > 0 && ' · '}
                        {infos.length > 0 && `${infos.length} info`}
                    </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', userSelect: 'none' }}>
                    {expanded ? '▲ Hide' : '▼ Show details'}
                </span>
                <button onClick={e => { e.stopPropagation(); setDismissed(true); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', padding: '2px 6px', fontSize: '1rem', lineHeight: 1 }}
                    title="Dismiss">×</button>
            </div>

            {/* Expanded list */}
            {expanded && (
                <div style={{ borderTop: `1px solid ${bannerColor}`, padding: 'var(--space-3) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 320, overflowY: 'auto' }}>
                    {['error', 'warning', 'info'].map(severity =>
                        anomalies.filter(a => ANOMALY_TYPES[a.type].severity === severity).map((a, i) => {
                            const def = ANOMALY_TYPES[a.type];
                            const color = severity === 'error' ? 'var(--color-danger)' : severity === 'warning' ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary)';
                            return (
                                <div key={`${a.flightId}-${a.type}-${i}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{def.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{def.label}</span>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginLeft: 8 }}>{a.detail}</span>
                                    </div>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '3px 10px', fontSize: '0.72rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                                        onClick={() => onEditFlight(a.flight)}
                                    >
                                        Fix ✏️
                                    </button>
                                </div>
                            );
                        })
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

            {/* Anomaly Detection Banner */}
            <AnomalyBanner flights={flights} onEditFlight={onEdit} />

            {/* Global Dashboard Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 350px) 1fr', gap: 'var(--space-6)' }}>
                <LogbookStats stats={stats} filterLabel={filterLabel} narrative={narrative} />
                <LogbookMap mapData={mapData} isDarkMode={isDarkMode} filteredFlights={filteredFlights} />
            </div>

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
