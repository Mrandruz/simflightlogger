import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plane, Fuel, Map as MapIcon, Clock, Wrench, RefreshCw, AlertTriangle, Zap, Route, ArrowUp, Gauge, LayoutGrid, Award, History, Building2, FileText, X, ExternalLink } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { findAirport } from '../utils/airportUtils';

// ---------------------------------------------------------------------------
// Checklist registry — add a new entry for each aircraft PDF you upload.
// Convention: place PDFs in /public/checklists/<filename>.pdf
// The key must match exactly the aircraft type string stored in your flights.
// ---------------------------------------------------------------------------
const AIRCRAFT_CHECKLISTS = {
    'Airbus A350':    '/checklists/Airbus A350.pdf',
    'Airbus A330':  '/checklists/A330.pdf',
    'Airbus A320':  '/checklists/A319_A320_A321.pdf',
    'Airbus A319':  '/checklists/A319_A320_A321.pdf',
    'Airbus A321':  '/checklists/A319_A320_A321.pdf',
    'Airbus A380':  '/checklists/A380.pdf',
    'Boeing 777':  '/checklists/Boeing777.pdf',
    'Boeing 787':  '/checklists/Boeing787.pdf',
    // Add more as you upload them
};

// ---------------------------------------------------------------------------
// Fuel consumption reference table (kg per nautical mile, cruise average).
// Values are realistic simulator approximations per aircraft family.
// Matching is done via substring so 'Airbus A320' hits the 'A320' key.
// Add or refine entries as needed — unknown types fall back to null (hidden).
// ---------------------------------------------------------------------------
const FUEL_RATES = {
    // Narrowbody
    'A318': 2.1, 'A319': 2.2, 'A320': 2.4, 'A321': 2.6,
    'B737-700': 2.3, 'B737-800': 2.6, 'B737-900': 2.8, 'B737 MAX': 2.4,
    'E170': 1.6, 'E175': 1.7, 'E190': 1.9, 'E195': 2.0,
    'CRJ': 1.5, 'Q400': 1.1, 'ATR': 0.9,
    // Widebody
    'A330-200': 5.2, 'A330-300': 5.6, 'Airbus A330': 5.0,
    'A340': 7.2,
    'A350-900': 5.4, 'A350-1000': 6.0, 'A350': 5.4,
    'A380': 10.5,
    'B747': 11.0, 'B747-8': 10.0,
    'B767': 5.8,
    'B777-200': 7.8, 'B777-300': 8.5, 'B777X': 7.2, 'Boeing 777': 7.8,
    'B787-8': 4.8, 'B787-9': 5.2, 'B787-10': 5.6, 'Boeing 787': 5.0,
    // Business / regional
    'Citation': 0.8, 'Phenom': 0.6, 'Global': 1.4, 'Falcon': 1.2,
    'Concorde': 22.0,
};

// Returns the fuel rate (kg/nm) for a given aircraft type string, or null if unknown.
const getFuelRate = (aircraftType) => {
    if (!aircraftType) return null;
    const t = aircraftType.toUpperCase();
    // Exact match first
    for (const [key, rate] of Object.entries(FUEL_RATES)) {
        if (t === key.toUpperCase()) return rate;
    }
    // Substring match (longest key wins to avoid 'B777' matching 'B777-300')
    let best = null;
    let bestLen = 0;
    for (const [key, rate] of Object.entries(FUEL_RATES)) {
        if (t.includes(key.toUpperCase()) && key.length > bestLen) {
            best = rate; bestLen = key.length;
        }
    }
    return best;
};

// ---------------------------------------------------------------------------
// ChecklistViewer — floating panel that renders the PDF in an iframe.
// Controlled externally via `pdfUrl` (null = hidden).
// ---------------------------------------------------------------------------
const ChecklistViewer = ({ aircraftType, pdfUrl, onClose }) => {
    const [page, setPage] = useState(1);

    // Reset to page 1 whenever a new aircraft is opened
    useEffect(() => { setPage(1); }, [pdfUrl]);

    if (!pdfUrl) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.15s ease-out',
                }}
            />

            {/* Panel */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(860px, 95vw)',
                height: 'min(90vh, 960px)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-divider)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                zIndex: 1001,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'fadeSlideUp 0.2s ease-out',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--color-divider)',
                    flexShrink: 0,
                }}>
                    <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {aircraftType} — Checklist
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', marginTop: '1px' }}>
                            {pdfUrl.split('/').pop()}
                        </div>
                    </div>
                    <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in new tab"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px',
                            borderRadius: '6px',
                            color: 'var(--color-text-hint)',
                            background: 'none',
                            border: '1px solid var(--color-divider)',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                        }}
                    >
                        <ExternalLink size={14} />
                    </a>
                    <button
                        onClick={onClose}
                        title="Close"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px',
                            borderRadius: '6px',
                            color: 'var(--color-text-hint)',
                            background: 'none',
                            border: '1px solid var(--color-divider)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* PDF iframe */}
                <iframe
                    key={pdfUrl}
                    src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                    title={`${aircraftType} Checklist`}
                    style={{ flex: 1, border: 'none', width: '100%' }}
                />
            </div>
        </>
    );
};

const MetricBlock = ({ label, value, icon: Icon, color = 'var(--color-primary)' }) => (
    <div className="card glass-surface" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: '1px solid var(--color-divider)' }}>
        <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: `${color}15`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: color 
        }}>
            <Icon size={20} aria-hidden="true" />
        </div>
        <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }} className="data-mono">{value}</div>
        </div>
    </div>
);

const OperationalMap = ({ airports, routes, isDarkMode }) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    useEffect(() => {
        if (!mapRef.current || !airports || airports.length === 0) return;

        try {
            // Cleanup
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }

            const tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            
            const map = L.map(mapRef.current, { 
                attributionControl: false,
                scrollWheelZoom: false 
            }).setView([20, 0], 2);
            
            mapInstance.current = map;
            L.tileLayer(tileUrl).addTo(map);

            const bounds = L.latLngBounds();
            const airportCoords = {};

            airports.forEach(icao => {
                const airport = findAirport(icao);
                if (airport && typeof airport.latitude === 'number' && typeof airport.longitude === 'number') {
                    const pos = [airport.latitude, airport.longitude];
                    airportCoords[icao] = pos;
                    
                    L.circleMarker(pos, {
                        radius: 4,
                        fillColor: '#3b82f6',
                        color: '#ffffff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(map).bindPopup(airport.name || icao);
                    
                    bounds.extend(pos);
                }
            });

            // Draw Polylines for routes
            if (routes && Object.keys(routes).length > 0) {
                const sortedRoutes = Object.entries(routes)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10);

                sortedRoutes.forEach(([routeKey, count]) => {
                    const [dep, arr] = routeKey.split('-');
                    const depPos = airportCoords[dep];
                    const arrPos = airportCoords[arr];

                    if (depPos && arrPos) {
                        L.polyline([depPos, arrPos], {
                            color: '#3b82f6',
                            weight: 1.5,
                            opacity: Math.min(0.2 + (count * 0.1), 0.6),
                            dashArray: '5, 5',
                            lineCap: 'round'
                        }).addTo(map);
                    }
                });
            }

            if (Object.keys(airportCoords).length > 0) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
            } else {
                map.setView([20, 0], 2);
            }
        } catch (error) {
            console.error("Leaflet initialization error:", error);
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [airports, routes, isDarkMode]);

    return <div ref={mapRef} style={{ height: '280px', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-divider)', position: 'relative', zIndex: 1 }} />;
};

const Sparkline = ({ data, color = 'var(--color-primary)', tooltip }) => {
    const [isHovered, setIsHovered] = useState(false);
    if (!data || data.length < 2) return null;
    const padding = 2;
    const width = 100;
    const height = 30;
    const max = Math.max(...data, 0.1);
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - (val / max) * (height - padding * 2) - padding;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', cursor: 'help' }}>
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    style={{ filter: `drop-shadow(0 0 4px ${color}40)`, transition: 'all 0.3s ease' }}
                />
            </svg>
            {isHovered && tooltip && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    transform: 'translateY(-8px)',
                    background: 'rgba(30, 30, 35, 0.95)',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    backdropFilter: 'blur(4px)',
                    animation: 'fadeSlideUp 0.15s ease-out'
                }}>
                    {tooltip}
                </div>
            )}
        </div>
    );
};

const MaintenanceStatus = ({ totalHours }) => {
    const checks = [
        { label: 'A-Check', interval: 500,   color: 'var(--color-primary)', warnAt: 0.15 },
        { label: 'B-Check', interval: 1000,  color: 'var(--color-primary)', warnAt: 0.15 },
        { label: 'C-Check', interval: 4000,  color: 'var(--color-success)', warnAt: 0.10 },
        { label: 'D-Check', interval: 20000, color: 'var(--color-success)', warnAt: 0.05 },
    ];

    return (
        <div className="card glass-surface" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', border: '1px solid var(--color-divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Wrench size={14} />
                Digital Tech Log
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {checks.map(({ label, interval, color, warnAt }) => {
                    const remaining = Math.max(0, interval - (totalHours % interval));
                    const percent   = (remaining / interval) * 100;
                    const isDue     = percent / 100 < warnAt;
                    const barColor  = isDue ? 'var(--color-danger)' : color;
                    return (
                        <div key={label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{label}</span>
                                    {isDue && (
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Due Soon
                                        </span>
                                    )}
                                </div>
                                <span style={{ color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>
                                    {remaining.toFixed(0)}h REM
                                </span>
                            </div>
                            <div style={{ height: '5px', background: 'var(--color-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${percent}%`, background: barColor, transition: 'width 1s ease-out' }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AnalyticsBar = ({ label, value, subValue, percentage, color = 'var(--color-primary)' }) => (
    <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
                {subValue && <span style={{ fontSize: '0.65rem', color: 'var(--color-text-hint)', fontWeight: 600, textTransform: 'uppercase' }}>{subValue}</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: color }}>{value}</span>
            </div>
        </div>
        <div style={{ height: '8px', background: 'var(--color-divider)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
            <div 
                className="maintenance-progress-fill"
                style={{ 
                    height: '100%', 
                    width: `${percentage}%`, 
                    background: color,
                    borderRadius: '4px',
                    boxShadow: `0 0 10px ${color}40`
                }} 
            />
        </div>
    </div>
);

// Returns { tier, label, nextThreshold, progress 0-1 } for a given value and tier thresholds
const resolveTier = (value, tiers) => {
    let current = null;
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (value >= tiers[i].threshold) { current = i; break; }
    }
    if (current === null) {
        return { tier: null, label: null, nextThreshold: tiers[0].threshold, progress: value / tiers[0].threshold };
    }
    const next = tiers[current + 1];
    return {
        tier: current,
        label: tiers[current].label,
        nextThreshold: next?.threshold ?? null,
        progress: next ? (value - tiers[current].threshold) / (next.threshold - tiers[current].threshold) : 1,
    };
};

const TIER_COLORS = ['var(--color-text-hint)', '#cd7f32', '#a8a9ad', '#f5c518', 'var(--color-primary)'];
const TIER_NAMES  = ['—', 'Bronze', 'Silver', 'Gold', 'Elite'];

const MilestoneGrid = ({ stats, color = 'var(--color-primary)' }) => {
    const milestones = [
        {
            label: 'Mission Count',
            icon: Award,
            value: stats.count,
            tiers: [
                { threshold: 10,  label: 'Bronze' },
                { threshold: 50,  label: 'Silver' },
                { threshold: 150, label: 'Gold'   },
                { threshold: 500, label: 'Elite'  },
            ],
            format: v => `${v} flt`,
        },
        {
            label: 'Long Haul',
            icon: Route,
            value: Math.round(stats.maxMiles || 0),
            tiers: [
                { threshold: 500,  label: 'Bronze' },
                { threshold: 1500, label: 'Silver' },
                { threshold: 4000, label: 'Gold'   },
                { threshold: 8000, label: 'Elite'  },
            ],
            format: v => `${v} nm`,
        },
        {
            label: 'Block Hours',
            icon: Clock,
            value: Math.floor(stats.totalHours || 0),
            tiers: [
                { threshold: 50,   label: 'Bronze' },
                { threshold: 200,  label: 'Silver' },
                { threshold: 500,  label: 'Gold'   },
                { threshold: 1500, label: 'Elite'  },
            ],
            format: v => `${v}h`,
        },
        {
            label: 'Airports',
            icon: MapIcon,
            value: stats.visitedAirports.length,
            tiers: [
                { threshold: 5,  label: 'Bronze' },
                { threshold: 15, label: 'Silver' },
                { threshold: 40, label: 'Gold'   },
                { threshold: 80, label: 'Elite'  },
            ],
            format: v => `${v} apt`,
        },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
            {milestones.map((m, i) => {
                const { tier, label: tierLabel, nextThreshold, progress } = resolveTier(m.value, m.tiers);
                const tierColor = tier !== null ? TIER_COLORS[tier + 1] : TIER_COLORS[0];
                const achieved = tier !== null;
                return (
                    <div key={i} className={`milestone-card ${achieved ? 'achieved' : 'locked'}`} style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${achieved ? tierColor + '40' : 'var(--color-divider)'}`,
                        background: achieved ? 'var(--color-surface)' : 'rgba(255,255,255,0.02)',
                        opacity: achieved ? 1 : 0.6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <m.icon size={16} style={{ color: achieved ? tierColor : 'var(--color-text-hint)' }} />
                            {achieved && (
                                <span style={{
                                    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px',
                                    color: tierColor,
                                    background: tierColor + '18',
                                    border: `1px solid ${tierColor}40`,
                                    borderRadius: '3px', padding: '1px 5px',
                                    textTransform: 'uppercase',
                                }}>
                                    {tierLabel}
                                </span>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{m.label}</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: achieved ? tierColor : 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)', marginTop: '2px' }}>
                                {m.format(m.value)}
                            </div>
                        </div>
                        {/* Progress bar toward next tier */}
                        <div>
                            <div style={{ height: '3px', background: 'var(--color-divider)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(progress * 100, 100)}%`,
                                    background: achieved ? tierColor : 'var(--color-text-hint)',
                                    borderRadius: '2px',
                                    transition: 'width 1s ease-out',
                                }} />
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', marginTop: '3px', fontWeight: 600 }}>
                                {nextThreshold !== null
                                    ? `Next: ${m.format(nextThreshold)}`
                                    : '✦ Max tier reached'}
                            </div>
                        </div>
                        {achieved && (
                            <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', opacity: 0.07 }}>
                                <m.icon size={48} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const TopRoutes = ({ allRoutes = [] }) => {
    const [showAll, setShowAll] = useState(false);
    const displayed = showAll ? allRoutes : allRoutes.slice(0, 5);
    const hasMore = allRoutes.length > 5;

    return (
        <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                <Route size={18} className="color-primary" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>Top Network Pairs</span>
                {hasMore && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 600 }}>
                        {allRoutes.length} routes total
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {displayed.map(([route, count], i) => (
                    <AnalyticsBar
                        key={i}
                        label={route}
                        value={`${count} Ops`}
                        percentage={(count / allRoutes[0][1]) * 100}
                    />
                ))}
            </div>
            {hasMore && (
                <button
                    onClick={() => setShowAll(v => !v)}
                    style={{
                        marginTop: 'var(--space-3)',
                        width: '100%',
                        padding: '7px 0',
                        background: 'none',
                        border: '1px solid var(--color-divider)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-text-hint)',
                        transition: 'all 0.15s ease',
                    }}
                >
                    {showAll ? '↑ Show less' : `↓ Show all ${allRoutes.length} routes`}
                </button>
            )}
        </div>
    );
};

const formatDuration = (hours) => {
    if (!hours && hours !== 0) return '—';
    const h = Math.floor(hours);
    const m = String(Math.round((hours % 1) * 60)).padStart(2, '0');
    return `${h}h ${m}m`;
};

const PersonalRecords = ({ stats }) => {
    const records = [
        {
            label: 'Longest Distance',
            icon: Route,
            value: stats.longestFlight
                ? `${Math.round(stats.longestFlight.miles)} nm`
                : '—',
            sub: stats.longestFlight
                ? `${stats.longestFlight.departure} → ${stats.longestFlight.arrival}`
                : null,
            highlight: true,
        },
        {
            label: 'Longest Duration',
            icon: Clock,
            value: stats.longestDuration
                ? formatDuration(stats.longestDuration.flightTime)
                : '—',
            sub: stats.longestDuration
                ? `${stats.longestDuration.departure} → ${stats.longestDuration.arrival}`
                : null,
            highlight: false,
        },
        {
            label: 'Signature Route',
            icon: Zap,
            value: stats.signatureRoute ?? '—',
            sub: stats.signatureRoute
                ? `${stats.routes[stats.signatureRoute]} ops`
                : null,
            highlight: false,
        },
        {
            label: 'Home Base',
            icon: MapIcon,
            value: stats.topAirport ?? '—',
            sub: stats.topAirport
                ? `${stats.airportFrequency[stats.topAirport]} movements`
                : null,
            highlight: false,
        },
        {
            label: 'Total Distance',
            icon: ArrowUp,
            value: stats.totalMiles > 0
                ? `${Math.round(stats.totalMiles).toLocaleString()} nm`
                : '—',
            sub: stats.totalMiles > 0
                ? `≈ ${(stats.totalMiles / 24901).toFixed(1)}× Earth`
                : null,
            highlight: false,
        },
        {
            label: 'Avg Flight Time',
            icon: Gauge,
            value: stats.count > 0
                ? formatDuration(stats.totalHours / stats.count)
                : '—',
            sub: `over ${stats.count} flights`,
            highlight: false,
        },
    ];

    return (
        <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-5)' }}>
                <Award size={18} className="color-primary" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>Personal Records</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {records.map((rec, i) => (
                    <div key={i} style={{
                        background: rec.highlight ? 'rgba(var(--color-primary-rgb), 0.05)' : 'var(--color-surface)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <rec.icon size={13} style={{ color: rec.highlight ? 'var(--color-primary)' : 'var(--color-text-hint)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                {rec.label}
                            </span>
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            fontFamily: 'var(--font-family-mono)',
                            color: rec.highlight ? 'var(--color-primary)' : 'var(--color-text-primary)',
                            lineHeight: 1.1,
                        }}>
                            {rec.value}
                        </div>
                        {rec.sub && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 600 }}>
                                {rec.sub}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const CompareRow = ({ label, valA, valB, unit = '', higherIsBetter = true }) => {
    const a = parseFloat(String(valA).replace(/,/g, '')) || 0;
    const b = parseFloat(String(valB).replace(/,/g, '')) || 0;
    const aWins = higherIsBetter ? a >= b : a <= b;
    const bWins = higherIsBetter ? b > a : b < a;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ textAlign: 'right', fontSize: '1rem', fontWeight: 800, color: aWins ? 'var(--color-primary)' : 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>
                {valA}{unit}{aWins && b !== a && <span style={{ fontSize: '0.65rem', marginLeft: '4px' }}>▲</span>}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ textAlign: 'left', fontSize: '1rem', fontWeight: 800, color: bWins ? 'var(--color-primary)' : 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>
                {valB}{unit}{bWins && <span style={{ fontSize: '0.65rem', marginLeft: '4px' }}>▲</span>}
            </div>
        </div>
    );
};

const AircraftComparison = ({ typeA, dataA, typeB, dataB, onClose }) => {
    if (!dataA || !dataB) return null;
    return (
        <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)', animation: 'fadeSlideUp 0.25s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-6)' }}>
                <LayoutGrid size={16} className="color-primary" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', flex: 1 }}>Head-to-Head Comparison</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'flex', alignItems: 'center' }}>
                    <X size={16} />
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', gap: '12px', marginBottom: 'var(--space-4)' }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--color-primary)' }}>{typeA}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 600 }}>{dataA.topAirlines[0]?.[0] || 'Private'}</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-hint)', alignSelf: 'center' }}>vs</div>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--color-text-secondary)' }}>{typeB}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 600 }}>{dataB.topAirlines[0]?.[0] || 'Private'}</div>
                </div>
            </div>
            <CompareRow label="Missions"       valA={dataA.count}                                    valB={dataB.count}                                    higherIsBetter={true} />
            <CompareRow label="Total Hours"    valA={dataA.totalHours.toFixed(1)}                    valB={dataB.totalHours.toFixed(1)}                    unit="h"   higherIsBetter={true} />
            <CompareRow label="Total Distance" valA={Math.round(dataA.totalMiles).toLocaleString()}  valB={Math.round(dataB.totalMiles).toLocaleString()}  unit=" nm" higherIsBetter={true} />
            <CompareRow label="Avg Flight"     valA={dataA.count > 0 ? (dataA.totalHours / dataA.count).toFixed(1) : '0'} valB={dataB.count > 0 ? (dataB.totalHours / dataB.count).toFixed(1) : '0'} unit="h" higherIsBetter={true} />
            <CompareRow label="Longest Flight" valA={Math.round(dataA.maxMiles || 0)}                valB={Math.round(dataB.maxMiles || 0)}                unit=" nm" higherIsBetter={true} />
            <CompareRow label="Airports"       valA={dataA.visitedAirports.length}                   valB={dataB.visitedAirports.length}                   higherIsBetter={true} />
            <CompareRow label="Unique Routes"  valA={dataA.allRoutes?.length ?? 0}                   valB={dataB.allRoutes?.length ?? 0}                   higherIsBetter={true} />
            {(dataA.fuelRate || dataB.fuelRate) && (
                <CompareRow label="Fuel kg/nm" valA={dataA.fuelRate?.toFixed(1) ?? '—'}              valB={dataB.fuelRate?.toFixed(1) ?? '—'}              higherIsBetter={false} />
            )}
        </div>
    );
};

export default function Hangar() {
    const { flights, isDarkMode } = useOutletContext();
    const [selectedType, setSelectedType] = useState(null);
    const [checklistUrl, setChecklistUrl] = useState(null);
    const [checklistAircraft, setChecklistAircraft] = useState(null);
    const [compareType, setCompareType] = useState(null);
    const [timeFilter, setTimeFilter] = useState('all');

    const openChecklist = (type) => {
        const url = AIRCRAFT_CHECKLISTS[type];
        if (url) { setChecklistUrl(url); setChecklistAircraft(type); }
    };

    const filterCutoff = useMemo(() => {
        const now = new Date();
        if (timeFilter === '30d') return new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000);
        if (timeFilter === '6m')  return new Date(now.getTime() - 183 * 24 * 60 * 60 * 1000);
        return null;
    }, [timeFilter]);

    const fleetStats = useMemo(() => {
        const stats = {};
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const sparkConfig = {
            '30d': { points: 30, label: 'Last 30 days', unit: 'day' },
            '6m':  { points: 24, label: 'Last 6 months', unit: 'week' },
            'all': { points: 12, label: 'Last 12 months', unit: 'month' }
        }[timeFilter] || { points: 30, label: 'All time', unit: 'day' };

        // Simplified airline normalization for CSS selection
        const normalizeAirline = (name) => {
            if (!name) return null;
            const n = name.toLowerCase();
            if (n.includes('lufthansa')) return 'Lufthansa';
            if (n.includes('klm')) return 'KLM';
            if (n.includes('air france')) return 'Air-France';
            if (n.includes('british')) return 'British-Airways';
            if (n.includes('united')) return 'United-Airlines';
            if (n.includes('delta')) return 'Delta';
            if (n.includes('american')) return 'American-Airlines';
            if (n.includes('emirates')) return 'Emirates';
            if (n.includes('ita') || n.includes('alitalia')) return 'Ita-Airways';
            if (n.includes('ryanair')) return 'Ryanair';
            if (n.includes('easyjet')) return 'EasyJet';
            return name.split(' ')[0]; // Fallback to first word
        };

        const filteredFlights = filterCutoff
            ? flights.filter(f => f.date && new Date(f.date) >= filterCutoff)
            : flights;

        filteredFlights.forEach(f => {
            if (!f.aircraft) return;
            const type = f.aircraft;
            if (!stats[type]) {
                stats[type] = { 
                    totalHours: 0, 
                    count: 0, 
                    totalMiles: 0, 
                    totalFuel: 0, 
                    lastFlight: null, 
                    visitedAirports: new Set(),
                    routes: {},
                    airlines: {},
                    recentFlights: [],
                    maxMiles: 0,
                    usageTrend: Array(sparkConfig.points).fill(0),
                    longestFlight: null,
                    longestDuration: null,
                    airportFrequency: {},
                };
            }
            stats[type].totalHours += (f.flightTime || 0);
            stats[type].count += 1;
            stats[type].totalMiles += (f.miles || 0);
            
            if ((f.miles || 0) > stats[type].maxMiles) {
                stats[type].maxMiles = f.miles;
                stats[type].longestFlight = f;
            }

            if ((f.flightTime || 0) > (stats[type].longestDuration?.flightTime || 0)) {
                stats[type].longestDuration = f;
            }

            if (f.departure) stats[type].airportFrequency[f.departure] = (stats[type].airportFrequency[f.departure] || 0) + 1;
            if (f.arrival)   stats[type].airportFrequency[f.arrival]   = (stats[type].airportFrequency[f.arrival]   || 0) + 1;
            
            const fuelRate = getFuelRate(type);
            if (fuelRate !== null) {
                stats[type].totalFuel += (f.miles || 0) * fuelRate;
            }
            stats[type].fuelRate = fuelRate;
            
            if (f.departure) stats[type].visitedAirports.add(f.departure);
            if (f.arrival) stats[type].visitedAirports.add(f.arrival);
            
            const fDate = new Date(f.date);
            
            // Sparkline Trend logic
            let trendIndex = -1;
            if (sparkConfig.unit === 'day') {
                trendIndex = Math.floor((now - fDate) / (24 * 60 * 60 * 1000));
            } else if (sparkConfig.unit === 'week') {
                trendIndex = Math.floor((now - fDate) / (7 * 24 * 60 * 60 * 1000));
            } else if (sparkConfig.unit === 'month') {
                trendIndex = (now.getFullYear() - fDate.getFullYear()) * 12 + (now.getMonth() - fDate.getMonth());
            }

            if (trendIndex >= 0 && trendIndex < sparkConfig.points) {
                stats[type].usageTrend[sparkConfig.points - 1 - trendIndex] += (f.flightTime || 0);
            }

            if (f.departure && f.arrival) {
                const routeKey = `${f.departure}-${f.arrival}`;
                stats[type].routes[routeKey] = (stats[type].routes[routeKey] || 0) + 1;
            }

            if (f.airline) {
                stats[type].airlines[f.airline] = (stats[type].airlines[f.airline] || 0) + (f.flightTime || 0);
            }

            stats[type].recentFlights.push(f);

            if (!stats[type].lastFlight || fDate > new Date(stats[type].lastFlight)) {
                stats[type].lastFlight = f.date;
            }
        });

        Object.keys(stats).forEach(type => {
            stats[type].recentFlights.sort((a, b) => new Date(b.date) - new Date(a.date));
            stats[type].recentFlights = stats[type].recentFlights.slice(0, 5);
            
            stats[type].visitedAirports = Array.from(stats[type].visitedAirports);
            
            stats[type].allRoutes = Object.entries(stats[type].routes)
                .sort(([, a], [, b]) => b - a);

            stats[type].topRoutes = stats[type].allRoutes.slice(0, 5);

            const sortedAirlines = Object.entries(stats[type].airlines)
                .sort(([, a], [, b]) => b - a);
            
            stats[type].topAirlines = sortedAirlines.slice(0, 5);
            stats[type].sparkLabel = `Activity: ${sparkConfig.label}`;
            stats[type].mainAirline = sortedAirlines.length > 0 ? normalizeAirline(sortedAirlines[0][0]) : null;

            // Personal records derived fields
            stats[type].signatureRoute = stats[type].topRoutes[0]?.[0] ?? null;
            stats[type].topAirport = Object.entries(stats[type].airportFrequency)
                .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
        });

        return stats;
    }, [flights, filterCutoff]);

    const aircraftTypes = useMemo(() => 
        Object.keys(fleetStats).sort((a, b) => fleetStats[b].count - fleetStats[a].count)
    , [fleetStats]);

    useEffect(() => {
        if (aircraftTypes.length > 0 && !selectedType) {
            setSelectedType(aircraftTypes[0]);
        }
    }, [aircraftTypes, selectedType]);

    useEffect(() => { setCompareType(null); }, [selectedType]);

    const selectedData = selectedType ? fleetStats[selectedType] : null;

    if (aircraftTypes.length === 0) {
        return (
            <div className="card glass-surface" style={{ padding: 'var(--space-12)', textAlign: 'center', marginTop: 'var(--space-12)' }}>
                <Plane size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                <h3 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Your Hangar is Empty</h3>
                <p style={{ color: 'var(--color-text-hint)', maxWidth: '400px', margin: '8px auto 0' }}>
                    Start logging flights to see your aircraft appear here with detailed operational statistics.
                </p>
            </div>
        );
    }

    return (
        <div className="hangar-container" data-airline={selectedData?.mainAirline} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', flex: 1, minHeight: 0 }}>
            <ChecklistViewer
                aircraftType={checklistAircraft}
                pdfUrl={checklistUrl}
                onClose={() => { setChecklistUrl(null); setChecklistAircraft(null); }}
            />
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <Zap size={16} aria-hidden="true" />
                        Fleet Operations
                    </div>
                    <h2 style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>The Hangar</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
                    {[{ key: '30d', label: '30 days' }, { key: '6m', label: '6 months' }, { key: 'all', label: 'All time' }].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTimeFilter(key)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease',
                                background: timeFilter === key ? 'var(--color-primary)' : 'none',
                                color: timeFilter === key ? '#fff' : 'var(--color-text-hint)',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Master/Detail Content */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 'var(--space-8)', alignItems: 'start' }}>
                {/* Master: Sticky Sidebar List */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 'var(--space-3)',
                    position: 'sticky',
                    top: 'var(--space-6)',
                    maxHeight: 'calc(100vh - 120px)',
                    overflowY: 'auto',
                    paddingRight: '4px'
                }}>
                    {aircraftTypes.map(type => {
                        const stats = fleetStats[type];
                        return (
                            <button 
                                key={type}
                                onClick={() => setSelectedType(type)}
                                className={`hangar-list-item ${selectedType === type ? 'active' : ''}`}
                                style={{ 
                                    padding: 'var(--space-4)', 
                                    borderRadius: 'var(--radius-md)', 
                                    cursor: 'pointer',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-4)',
                                    background: selectedType === type ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                    border: '1px solid var(--color-divider)',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div style={{ 
                                    width: '40px', 
                                    height: '40px', 
                                    borderRadius: '10px', 
                                    backgroundColor: selectedType === type ? 'var(--color-primary)' : 'rgba(var(--color-primary-rgb), 0.1)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    color: selectedType === type ? '#fff' : 'var(--color-primary)',
                                    flexShrink: 0
                                }}>
                                    <Plane size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: selectedType === type ? 'var(--color-primary-dark)' : 'var(--color-text-primary)' }}>{type}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)' }}>{stats.count} Missions</div>
                                </div>
                                <Sparkline 
                                    data={stats.usageTrend} 
                                    tooltip={stats.sparkLabel}
                                    color={selectedType === type ? 'var(--color-primary)' : 'var(--color-text-hint)'} 
                                />
                                {selectedType && type !== selectedType && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCompareType(compareType === type ? null : type); }}
                                        title={compareType === type ? 'Remove comparison' : 'Compare with selected'}
                                        style={{
                                            flexShrink: 0,
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            padding: '3px 7px',
                                            borderRadius: '4px',
                                            border: `1px solid ${compareType === type ? 'var(--color-primary)' : 'var(--color-divider)'}`,
                                            background: compareType === type ? 'var(--color-primary)' : 'none',
                                            color: compareType === type ? '#fff' : 'var(--color-text-hint)',
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.4px',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        {compareType === type ? '✓ vs' : 'vs'}
                                    </button>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Detail: Aircraft Deep-Dive */}
                <div>
                    {selectedData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', animation: 'fadeSlideUp 0.3s ease-out' }}>
                            {/* Hero Detail Card */}
                            <div className="card glass-surface" style={{ padding: 'var(--space-8)', position: 'relative', overflow: 'hidden', border: '1px solid var(--color-divider)' }}>
                                <div style={{ position: 'absolute', top: '-40px', right: '-40px', opacity: 0.03, transform: 'rotate(-15deg)' }}>
                                    <Plane size={420} />
                                </div>
                                
                                <div style={{ position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                                        <div>
                                            <h1 style={{ fontSize: '3.5rem', margin: '0', fontWeight: 900, letterSpacing: '-2px', color: 'var(--color-text-primary)' }}>
                                                {selectedType}
                                            </h1>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Building2 size={16} className="color-primary" />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                                                        {selectedData.topAirlines[0]?.[0] || 'Private'}
                                                    </span>
                                                </div>
                                                <div style={{ height: '4px', width: '4px', borderRadius: '50%', background: 'var(--color-divider)' }} />
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-hint)' }}>
                                                    {selectedData.count} Flights Total
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Fleet Status</div>
                                            <div style={{ color: 'var(--color-success)', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                                <div style={{ height: '8px', width: '8px', borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 8px var(--color-success)' }} />
                                                Active / Ready
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
                                        <div>
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Total Flight Time</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{selectedData.totalHours.toFixed(1)}<span style={{ fontSize: '1rem', color: 'var(--color-text-hint)', marginLeft: '4px' }}>h</span></div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Total Fuel</div>
                                            {selectedData.fuelRate !== null && selectedData.fuelRate !== undefined ? (
                                                <div>
                                                    <div style={{ fontSize: '2rem', fontWeight: 900 }}>
                                                        {Math.round(selectedData.totalFuel).toLocaleString()}
                                                        <span style={{ fontSize: '1rem', color: 'var(--color-text-hint)', marginLeft: '4px' }}>kg</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', marginTop: '4px', fontWeight: 600 }}>
                                                        {selectedData.fuelRate.toFixed(1)} kg/nm avg
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-hint)' }}>
                                                    N/A
                                                    <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '2px', fontWeight: 600 }}>type not mapped</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Last Mission</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900 }}>
                                                {selectedData.lastFlight ? new Date(selectedData.lastFlight).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-6)' }}>
                                        {AIRCRAFT_CHECKLISTS[selectedType] && (
                                            <button
                                                onClick={() => openChecklist(selectedType)}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '16px',
                                                    padding: '14px 18px',
                                                    marginBottom: 'var(--space-6)',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(var(--color-primary-rgb), 0.06)',
                                                    border: '1px solid rgba(var(--color-primary-rgb), 0.2)',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                <div style={{
                                                    width: '38px', height: '38px', flexShrink: 0,
                                                    borderRadius: '10px',
                                                    background: 'rgba(var(--color-primary-rgb), 0.12)',
                                                    border: '1px solid rgba(var(--color-primary-rgb), 0.25)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--color-primary)',
                                                }}>
                                                    <FileText size={18} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '2px' }}>
                                                        {selectedType} — Operational checklist
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 600 }}>
                                                        Pre-flight · Engine Start · Taxi · Takeoff · Cruise · Landing · Shutdown
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.72rem', fontWeight: 800,
                                                    color: 'var(--color-primary)',
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    flexShrink: 0,
                                                    opacity: 0.8,
                                                }}>
                                                    Open
                                                    <ExternalLink size={12} />
                                                </div>
                                            </button>
                                        )}
                                        <div style={{ color: 'var(--color-text-hint)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-4)' }}>Aircraft Milestones</div>
                                        <MilestoneGrid stats={selectedData} />
                                    </div>
                                </div>
                            </div>

                            {/* Comparison panel */}
                            {compareType && fleetStats[compareType] && (
                                <AircraftComparison
                                    typeA={selectedType}
                                    dataA={selectedData}
                                    typeB={compareType}
                                    dataB={fleetStats[compareType]}
                                    onClose={() => setCompareType(null)}
                                />
                            )}

                            {/* Secondary Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--space-8)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                                    {/* Map */}
                                    <div className="card glass-surface" style={{ padding: 'var(--space-4)', border: '1px solid var(--color-divider)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)', paddingLeft: 'var(--space-2)' }}>
                                            <MapIcon size={16} className="color-primary" />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Operational Network</span>
                                        </div>
                                        <OperationalMap airports={selectedData.visitedAirports} routes={selectedData.routes} isDarkMode={isDarkMode} />
                                    </div>

                                    {/* Personal Records */}
                                    <PersonalRecords stats={selectedData} />

                                    {/* Recent Missions */}
                                    <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                                            <History size={18} className="color-primary" />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>Recent Missions</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                            {selectedData.recentFlights.map((f, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface)', gap: '12px' }}>
                                                    {/* Left: flight number badge + route */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                        {f.flightNumber ? (
                                                            <span style={{
                                                                flexShrink: 0,
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                fontFamily: 'var(--font-family-mono)',
                                                                color: 'var(--color-primary)',
                                                                background: 'rgba(var(--color-primary-rgb), 0.08)',
                                                                border: '1px solid rgba(var(--color-primary-rgb), 0.2)',
                                                                borderRadius: '4px',
                                                                padding: '2px 6px',
                                                                letterSpacing: '0.5px',
                                                            }}>
                                                                {f.flightNumber}
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                flexShrink: 0,
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                color: 'var(--color-text-hint)',
                                                                background: 'var(--color-divider)',
                                                                borderRadius: '4px',
                                                                padding: '2px 6px',
                                                                letterSpacing: '0.5px',
                                                            }}>
                                                                —
                                                            </span>
                                                        )}
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                                                {f.departure} → {f.arrival}
                                                            </div>
                                                            {f.airline && (
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {f.airline}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Right: duration + distance + date */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                                        {f.miles > 0 && (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>
                                                                {Math.round(f.miles)} nm
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            fontFamily: 'var(--font-family-mono)',
                                                            color: 'var(--color-text-secondary)',
                                                            background: 'var(--color-divider)',
                                                            borderRadius: '4px',
                                                            padding: '2px 6px',
                                                        }}>
                                                            {typeof f.flightTime === 'number'
                                                                ? `${Math.floor(f.flightTime)}h ${String(Math.round((f.flightTime % 1) * 60)).padStart(2, '0')}m`
                                                                : `${f.flightTime}h`}
                                                        </span>
                                                        <span style={{ color: 'var(--color-text-hint)', fontSize: '0.72rem', minWidth: '56px', textAlign: 'right' }}>
                                                            {new Date(f.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                                    {/* Tech Log */}
                                    <MaintenanceStatus totalHours={selectedData.totalHours} />

                                    {/* Top Routes */}
                                    <TopRoutes allRoutes={selectedData.allRoutes ?? selectedData.topRoutes} />

                                    {/* Airlines */}
                                    <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                                            <Building2 size={18} className="color-primary" />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>Livery Distribution</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {selectedData.topAirlines.map(([airline, hours], i) => (
                                                <AnalyticsBar 
                                                    key={i}
                                                    label={airline}
                                                    subValue="Deployment Share"
                                                    value={`${hours.toFixed(1)}h`}
                                                    percentage={(hours / selectedData.topAirlines[0][1]) * 100}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
