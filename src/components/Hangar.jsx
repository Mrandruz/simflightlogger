import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plane, Fuel, Map as MapIcon, Clock, Wrench, RefreshCw, AlertTriangle, Zap, Route, ArrowUp, Gauge, LayoutGrid, Award, History, Building2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { findAirport } from '../utils/airportUtils';

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

const Sparkline = ({ data, color = 'var(--color-primary)' }) => {
    if (!data || data.length < 2) return null;
    const padding = 2;
    const width = 100;
    const height = 30;
    const max = Math.max(...data, 1);
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - (val / max) * (height - padding * 2) - padding;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
            />
        </svg>
    );
};

const MaintenanceStatus = ({ totalHours }) => {
    const aCheckInterval = 500;
    const cCheckInterval = 4000;
    
    const aCheckRemaining = Math.max(0, aCheckInterval - (totalHours % aCheckInterval));
    const cCheckRemaining = Math.max(0, cCheckInterval - (totalHours % cCheckInterval));
    
    const aPercent = (aCheckRemaining / aCheckInterval) * 100;
    const cPercent = (cCheckRemaining / cCheckInterval) * 100;

    return (
        <div className="card glass-surface" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', border: '1px solid var(--color-divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Wrench size={14} />
                Digital Tech Log
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>A-Check</span>
                        <span style={{ color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>{aCheckRemaining.toFixed(0)}h REM</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--color-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${aPercent}%`, background: aPercent < 20 ? 'var(--color-danger)' : 'var(--color-primary)', transition: 'width 1s ease-out' }} />
                    </div>
                </div>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>C-Check</span>
                        <span style={{ color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>{cCheckRemaining.toFixed(0)}h REM</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--color-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${cPercent}%`, background: 'var(--color-success)', transition: 'width 1s ease-out' }} />
                    </div>
                </div>
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

const MilestoneGrid = ({ stats, color = 'var(--color-primary)' }) => {
    const milestones = [
        { 
            label: 'Elite Pilot', 
            icon: Award, 
            achieved: stats.count >= 50, 
            desc: '50+ missions completed',
            val: `${stats.count}/50`
        },
        { 
            label: 'Long Haul Tech', 
            icon: Route, 
            achieved: stats.maxMiles >= 1500, 
            desc: 'Flights over 1500nm',
            val: `${Math.round(stats.maxMiles)}nm`
        },
        { 
            label: 'Night Owl', 
            icon: Zap, 
            achieved: stats.totalHours > 100, 
            desc: 'Total hours > 100h',
            val: `${stats.totalHours.toFixed(1)}h`
        },
        { 
            label: 'Route Master', 
            icon: MapIcon, 
            achieved: stats.visitedAirports.length >= 10, 
            desc: '10+ unique airports',
            val: `${stats.visitedAirports.length}/10`
        }
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
            {milestones.map((m, i) => (
                <div key={i} className={`milestone-card ${m.achieved ? 'achieved' : 'locked'}`} style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-divider)',
                    background: m.achieved ? 'var(--color-surface)' : 'rgba(255,255,255,0.02)',
                    opacity: m.achieved ? 1 : 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <m.icon size={16} style={{ color: m.achieved ? color : 'var(--color-text-hint)' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: m.achieved ? color : 'var(--color-text-hint)' }}>{m.val}</span>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{m.label}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', fontWeight: 600 }}>{m.desc}</div>
                    </div>
                    {m.achieved && (
                        <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', opacity: 0.1 }}>
                            <m.icon size={48} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default function Hangar() {
    const { flights, isDarkMode } = useOutletContext();
    const [selectedType, setSelectedType] = useState(null);

    const fleetStats = useMemo(() => {
        const stats = {};
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

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

        flights.forEach(f => {
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
                    usageTrend: Array(30).fill(0)
                };
            }
            stats[type].totalHours += (f.flightTime || 0);
            stats[type].count += 1;
            stats[type].totalMiles += (f.miles || 0);
            
            if ((f.miles || 0) > stats[type].maxMiles) stats[type].maxMiles = f.miles;
            
            const fuelRate = 2.6; 
            stats[type].totalFuel += (f.miles || 0) * fuelRate;
            
            if (f.departure) stats[type].visitedAirports.add(f.departure);
            if (f.arrival) stats[type].visitedAirports.add(f.arrival);
            
            const fDate = new Date(f.date);
            if (fDate >= thirtyDaysAgo) {
                const dayIndex = Math.floor((now - fDate) / (24 * 60 * 60 * 1000));
                if (dayIndex >= 0 && dayIndex < 30) {
                    stats[type].usageTrend[29 - dayIndex] += (f.flightTime || 0);
                }
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
            
            stats[type].topRoutes = Object.entries(stats[type].routes)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);

            const sortedAirlines = Object.entries(stats[type].airlines)
                .sort(([, a], [, b]) => b - a);
            
            stats[type].topAirlines = sortedAirlines.slice(0, 5);
            stats[type].mainAirline = sortedAirlines.length > 0 ? normalizeAirline(sortedAirlines[0][0]) : null;
        });

        return stats;
    }, [flights]);

    const aircraftTypes = useMemo(() => 
        Object.keys(fleetStats).sort((a, b) => fleetStats[b].count - fleetStats[a].count)
    , [fleetStats]);

    useEffect(() => {
        if (aircraftTypes.length > 0 && !selectedType) {
            setSelectedType(aircraftTypes[0]);
        }
    }, [aircraftTypes, selectedType]);

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
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <Zap size={16} aria-hidden="true" />
                        Fleet Operations
                    </div>
                    <h2 style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800 }}>The Hangar</h2>
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
                                <Sparkline data={stats.usageTrend} color={selectedType === type ? 'var(--color-primary)' : 'var(--color-text-hint)'} />
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
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Fleet Status</div>
                                            <div style={{ color: 'var(--color-success)', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
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
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Fuel Efficiency</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900 }}>2.6<span style={{ fontSize: '1rem', color: 'var(--color-text-hint)', marginLeft: '4px' }}>kg/nm</span></div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Last Mission</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900 }}>
                                                {selectedData.lastFlight ? new Date(selectedData.lastFlight).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-6)' }}>
                                        <div style={{ color: 'var(--color-text-hint)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-4)' }}>Aircraft Milestones</div>
                                        <MilestoneGrid stats={selectedData} />
                                    </div>
                                </div>
                            </div>

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

                                    {/* Recent Missions */}
                                    <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                                            <History size={18} className="color-primary" />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>Recent Missions</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                            {selectedData.recentFlights.map((f, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{f.departure} → {f.arrival}</span>
                                                        <span style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem' }}>{f.flightTime}h</span>
                                                    </div>
                                                    <span style={{ color: 'var(--color-text-hint)', fontSize: '0.75rem' }}>{new Date(f.date).toLocaleDateString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                                    {/* Tech Log */}
                                    <MaintenanceStatus totalHours={selectedData.totalHours} />

                                    {/* Top Routes */}
                                    <div className="card glass-surface" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-divider)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-4)' }}>
                                            <Route size={18} className="color-primary" />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>Top Network Pairs</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {selectedData.topRoutes.map(([route, count], i) => (
                                                <AnalyticsBar 
                                                    key={i}
                                                    label={route}
                                                    value={`${count} Ops`}
                                                    percentage={(count / selectedData.topRoutes[0][1]) * 100}
                                                />
                                            ))}
                                        </div>
                                    </div>

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
