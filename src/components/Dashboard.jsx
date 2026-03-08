import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Plane, MapPin, Clock, Trash2, TrendingUp, Edit2, ChevronDown, ChevronUp, RotateCcw, Filter, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area } from 'recharts';
import { ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup } from "react-simple-maps";
import { geoCentroid, geoBounds, geoContains } from 'd3-geo';
import airports from 'airport-data';
import customAirports from '../customAirports';
import PilotProfileCard from './PilotProfileCard';
import SuggestedRoutes from './SuggestedRoutes';
import MetarCards from './MetarCards';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

// Map topology for the world
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function Dashboard({ flights, onDelete, onEdit }) {
    const [isTableOpen, setIsTableOpen] = useState(true);
    const [activeFilter, setActiveFilter] = useState(null); // { type: 'icao' | 'airline' | 'aircraft' | 'alliance', value: string }
    const recentAirportsByAlliance = useMemo(() => {
        const sortedFlights = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
        const result = [];
        const seenAlliances = new Set();

        for (const f of sortedFlights) {
            if (!f.alliance || seenAlliances.has(f.alliance)) continue;

            const icao = f.arrival ? f.arrival.toUpperCase() : f.departure ? f.departure.toUpperCase() : null;
            if (icao) {
                const airportData = findAirport(icao);
                const city = airportData ? (airportData.city || airportData.name.split(',')[0] || airportData.name) : 'Unknown City';
                result.push({
                    icao,
                    city,
                    alliance: f.alliance
                });
                seenAlliances.add(f.alliance);
            }
            if (result.length >= 3) break;
        }
        return result;
    }, [flights]);
    const [hoveredAirport, setHoveredAirport] = useState(null);
    const [mapZoom, setMapZoom] = useState(1);
    const [mapCenter, setMapCenter] = useState([0, 10]);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const geographiesRef = useRef([]);

    const handleCountryClick = useCallback((geo) => {
        const centroid = geoCentroid(geo);
        const bounds = geoBounds(geo);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const maxSpan = Math.max(dx, dy);
        // Calculate zoom: smaller countries → higher zoom
        const zoom = Math.min(12, Math.max(2, 120 / maxSpan));
        setMapCenter(centroid);
        setMapZoom(zoom);
        setSelectedCountry(geo.rsmKey);
    }, []);

    const handleMarkerClick = useCallback((coordinates) => {
        const geo = geographiesRef.current.find(g => geoContains(g, coordinates));
        if (geo) {
            handleCountryClick(geo);
        }
    }, [handleCountryClick]);

    const handleZoomReset = useCallback(() => {
        setMapZoom(1);
        setMapCenter([0, 10]);
        setSelectedCountry(null);
    }, []);
    const kpis = useMemo(() => {
        return {
            totalFlights: flights.length,
            totalMiles: flights.reduce((sum, f) => sum + (f.miles || 0), 0),
            totalHours: flights.reduce((sum, f) => sum + (f.flightTime || 0), 0).toFixed(1)
        };
    }, [flights]);

    const aircraftStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.aircraft) counts[f.aircraft] = (counts[f.aircraft] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [flights]);

    const airportStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.departure) counts[f.departure] = (counts[f.departure] || 0) + 1;
            if (f.arrival) counts[f.arrival] = (counts[f.arrival] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    }, [flights]);

    const airlineStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.airline) counts[f.airline] = (counts[f.airline] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [flights]);

    const allianceStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.alliance) counts[f.alliance] = (counts[f.alliance] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [flights]);

    const timelineStats = useMemo(() => {
        const grouped = {};

        // Group flights by month
        flights.forEach(f => {
            if (f.date) {
                // Get YYYY-MM
                const dateKey = f.date.substring(0, 7);
                if (!grouped[dateKey]) {
                    grouped[dateKey] = { dateStr: dateKey, flights: 0 };
                }
                grouped[dateKey].flights += 1;
            }
        });

        // Convert to array and sort chronologically
        const sortedArray = Object.values(grouped).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

        // Format dates for display (e.g. "Mar 2026")
        return sortedArray.map(item => {
            const [year, month] = item.dateStr.split('-');
            const dateObj = new Date(year, parseInt(month) - 1, 1);
            return {
                ...item,
                displayDate: dateObj.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
            };
        });
    }, [flights]);

    const mappedAirports = useMemo(() => {
        const visitedCodes = new Set();
        flights.forEach(f => {
            if (f.departure) visitedCodes.add(f.departure.toUpperCase());
            if (f.arrival) visitedCodes.add(f.arrival.toUpperCase());
        });

        const points = [];
        visitedCodes.forEach(code => {
            const ap = findAirport(code);
            if (ap) {
                points.push({
                    icao: code,
                    coordinates: [ap.longitude, ap.latitude],
                    name: ap.name
                });
            }
        });
        return points;
    }, [flights]);

    const mappedRoutes = useMemo(() => {
        const routes = [];
        flights.forEach(f => {
            if (f.departure && f.arrival) {
                const depCode = f.departure.toUpperCase();
                const arrCode = f.arrival.toUpperCase();
                const depAp = findAirport(depCode);
                const arrAp = findAirport(arrCode);

                if (depAp && arrAp) {
                    routes.push({
                        id: `${depCode}-${arrCode}-${Math.random()}`,
                        from: [depAp.longitude, depAp.latitude],
                        to: [arrAp.longitude, arrAp.latitude]
                    });
                }
            }
        });
        return routes;
    }, [flights]);

    const formatDate = (isoStr) => {
        const date = new Date(isoStr);
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleFilterClick = (type, value) => {
        setActiveFilter({ type, value });
        setIsTableOpen(true); // Ensure table is open when a filter is applied
    };

    const clearFilter = () => {
        setActiveFilter(null);
    };

    const filteredFlights = useMemo(() => {
        let filtered = [...flights];
        if (activeFilter) {
            filtered = filtered.filter(f => {
                switch (activeFilter.type) {
                    case 'icao':
                        return f.departure === activeFilter.value || f.arrival === activeFilter.value;
                    case 'airline':
                        return f.airline === activeFilter.value;
                    case 'aircraft':
                        return f.aircraft === activeFilter.value;
                    case 'alliance':
                        return f.alliance === activeFilter.value;
                    default:
                        return true;
                }
            });
        }
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [flights, activeFilter]);

    const colors = ['#1ed760', '#00ab6c', '#24CC9A', '#7bdcb5', '#C1DBBD', '#00d084'];
    const pieColors = ['#1ed760', '#7bdcb5', '#00ab6c', '#C1DBBD', '#24CC9A'];

    if (flights.length === 0) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--color-text-secondary)' }}>
                <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                <h3 style={{ margin: 0 }}>No flights recorded</h3>
                <p>Add your first flight using the form on the side.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Pilot Profile Module */}
            <PilotProfileCard flights={flights} />

            {/* METAR Cards */}
            {recentAirportsByAlliance.length > 0 && <MetarCards airports={recentAirportsByAlliance} />}

            {/* KPIs */}
            <div className="kpi-grid">
                <div className="card kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="kpi-label">Total Flights</span>
                        <div style={{ padding: '8px', backgroundColor: 'var(--color-primary-light)', borderRadius: '50%', color: 'var(--color-primary)' }}><Plane size={20} /></div>
                    </div>
                    <span className="kpi-value">{kpis.totalFlights}</span>
                </div>

                <div className="card kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="kpi-label">Total Miles</span>
                        <div style={{ padding: '8px', backgroundColor: 'var(--color-success-bg)', borderRadius: '50%', color: 'var(--color-success)' }}><MapPin size={20} /></div>
                    </div>
                    <span className="kpi-value text-success">{kpis.totalMiles.toLocaleString()}</span>
                </div>

                <div className="card kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="kpi-label">Flight Hours</span>
                        <div style={{ padding: '8px', backgroundColor: 'var(--color-warning-bg)', borderRadius: '50%', color: 'var(--color-warning)' }}><Clock size={20} /></div>
                    </div>
                    <span className="kpi-value text-warning">{kpis.totalHours}</span>
                </div>
            </div>

            {/* Suggested Routes */}
            <SuggestedRoutes flights={flights} />

            {/* Timeline AreaChart */}
            <div className="card">
                <h3 className="card-title">Monthly Flight History</h3>
                <div style={{ height: 200 }}>
                    {timelineStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineStats} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorFlights" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} allowDecimals={false} />
                                <RechartsTooltip cursor={{ stroke: 'var(--color-divider)', strokeWidth: 2 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                <Area type="monotone" dataKey="flights" name="Flights" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorFlights)" activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-primary)' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-hint)' }}>
                            Add flights to see your progress over time
                        </div>
                    )}
                </div>
            </div>

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
                <div className="card">
                    <h3 className="card-title">Top Airlines</h3>
                    <div style={{ height: 250 }}>
                        {airlineStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={airlineStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} width={100} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Bar dataKey="count" name="Flights" radius={[0, 4, 4, 0]} barSize={24}>
                                        {airlineStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">Top Alliances</h3>
                    <div style={{ height: 250 }}>
                        {allianceStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                                    <Pie data={allianceStats} nameKey="name" dataKey="value" name="Flights" cx="50%" cy="45%" innerRadius={50} outerRadius={70} paddingAngle={2}>
                                        {allianceStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">Top Aircraft</h3>
                    <div style={{ height: 250 }}>
                        {aircraftStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={aircraftStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} width={80} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Bar dataKey="count" name="Flights" radius={[0, 4, 4, 0]} barSize={24}>
                                        {aircraftStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">Top Airports</h3>
                    <div style={{ height: 250 }}>
                        {airportStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={airportStats.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} width={60} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Bar dataKey="count" name="Flights" radius={[0, 4, 4, 0]} barSize={20}>
                                        {airportStats.slice(0, 5).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[(index + 2) % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

            </div>

            {/* Interactive Global Map */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-6)', paddingBottom: 0 }}>
                    <h3 className="card-title">Visited Airports Map</h3>
                </div>
                <div style={{ width: '100%', height: '450px', backgroundColor: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

                    {/* Reset button (visible only when zoomed) */}
                    {mapZoom > 1 && (
                        <button onClick={handleZoomReset} title="Global view" style={{
                            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)', cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)', fontSize: '0.8rem', fontWeight: 500,
                            fontFamily: 'var(--font-family-sans)', transition: 'background-color 0.2s'
                        }}>
                            <RotateCcw size={14} /> Global View
                        </button>
                    )}

                    {/* Hint text when at world view */}
                    {mapZoom <= 1 && (
                        <div style={{
                            position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                            zIndex: 10, fontSize: '0.75rem', color: 'var(--color-text-hint)',
                            backgroundColor: 'var(--color-surface)', padding: '4px 12px',
                            borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap'
                        }}>
                            Click on a country or an airport to zoom in
                        </div>
                    )}

                    <ComposableMap projectionConfig={{ scale: 170, center: [0, 10] }} width={900} height={400}>
                        {/* SVG Defs for animations */}
                        <defs>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <ZoomableGroup zoom={mapZoom} center={mapCenter} maxZoom={12} onMoveEnd={({ coordinates, zoom }) => { setMapCenter(coordinates); setMapZoom(zoom); }}>
                            <Geographies geography={geoUrl}>
                                {({ geographies }) => {
                                    geographiesRef.current = geographies;
                                    return geographies.map((geo) => (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            onClick={() => handleCountryClick(geo)}
                                            fill={selectedCountry === geo.rsmKey ? 'var(--color-primary-light)' : 'var(--color-divider)'}
                                            stroke="var(--color-surface)"
                                            strokeWidth={0.5}
                                            style={{
                                                default: { outline: "none", cursor: "pointer" },
                                                hover: { fill: selectedCountry === geo.rsmKey ? 'var(--color-primary-light)' : '#c8cdd2', outline: "none", cursor: "pointer" },
                                                pressed: { outline: "none" },
                                            }}
                                        />
                                    ));
                                }}
                            </Geographies>

                            {/* Animated dashed routes */}
                            {mappedRoutes.map((route) => (
                                <Line
                                    key={route.id}
                                    from={route.from}
                                    to={route.to}
                                    stroke="var(--color-primary)"
                                    strokeWidth={1.5}
                                    strokeLinecap="round"
                                    strokeDasharray="6 4"
                                    className="animated-route"
                                    style={{
                                        opacity: 0.6
                                    }}
                                />
                            ))}

                            {/* Pulsing markers + hover glow */}
                            {mappedAirports.map(({ icao, name, coordinates }) => (
                                <Marker
                                    key={icao}
                                    coordinates={coordinates}
                                    onMouseEnter={() => setHoveredAirport(icao)}
                                    onMouseLeave={() => setHoveredAirport(null)}
                                    onClick={() => handleMarkerClick(coordinates)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Pulse ring */}
                                    <circle
                                        r={10}
                                        fill="var(--color-primary)"
                                        opacity={0}
                                        className="map-pulse-ring"
                                    />
                                    {/* Main dot */}
                                    <circle
                                        r={hoveredAirport === icao ? 6 : 4}
                                        fill="var(--color-primary)"
                                        stroke={hoveredAirport === icao ? '#fff' : 'var(--color-map-stroke)'}
                                        strokeWidth={hoveredAirport === icao ? 2 : 1.5}
                                        filter={hoveredAirport === icao ? 'url(#glow)' : 'none'}
                                        style={{ transition: 'r 0.2s ease, stroke-width 0.2s ease' }}
                                    />
                                    {/* ICAO label (always visible) */}
                                    <text
                                        textAnchor="middle"
                                        y={-14}
                                        style={{
                                            fontFamily: "var(--font-family-sans)",
                                            fill: hoveredAirport === icao ? 'var(--color-primary)' : 'var(--color-text-primary)',
                                            fontSize: hoveredAirport === icao ? '12px' : '11px',
                                            fontWeight: 700,
                                            textShadow: "1px 1px 0 var(--color-map-shadow), -1px -1px 0 var(--color-map-shadow), 1px -1px 0 var(--color-map-shadow), -1px 1px 0 var(--color-map-shadow)",
                                            transition: 'font-size 0.2s ease, fill 0.2s ease'
                                        }}>
                                        {icao}
                                    </text>
                                    {/* Airport name tooltip on hover */}
                                    {hoveredAirport === icao && (
                                        <g>
                                            <rect
                                                x={-name.length * 3.2}
                                                y={10}
                                                width={name.length * 6.4}
                                                height={20}
                                                rx={4}
                                                fill="var(--color-primary)"
                                                opacity={0.9}
                                            />
                                            <text
                                                textAnchor="middle"
                                                y={24}
                                                style={{
                                                    fontFamily: "var(--font-family-sans)",
                                                    fill: "#fff",
                                                    fontSize: "10px",
                                                    fontWeight: 500,
                                                }}>
                                                {name}
                                            </text>
                                        </g>
                                    )}
                                </Marker>
                            ))}
                        </ZoomableGroup>
                    </ComposableMap>
                </div>

                {/* Map animation styles */}
                <style>{`
                        @keyframes pulse-ring {
                            0% { r: 4; opacity: 0.6; }
                            100% { r: 16; opacity: 0; }
                        }
                        @keyframes dash-flow {
                            to { stroke-dashoffset: -20; }
                        }
                        .map-pulse-ring {
                            animation: pulse-ring 2s ease-out infinite;
                        }
                        .animated-route {
                            animation: dash-flow 1.5s linear infinite;
                        }
                    `}</style>
            </div>

            {/* List */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 'var(--space-4)' }} onClick={() => setIsTableOpen(!isTableOpen)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <h3 className="card-title" style={{ marginBottom: 0 }}>Flight Log</h3>
                        {activeFilter && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: 'rgba(30, 215, 96, 0.15)',
                                border: '1px solid var(--color-primary)',
                                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                                color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 600
                            }} onClick={(e) => e.stopPropagation()}>
                                <Filter size={14} />
                                <span style={{ textTransform: 'uppercase' }}>{activeFilter.type}:</span> {activeFilter.value}
                                <button
                                    onClick={(e) => { e.stopPropagation(); clearFilter(); }}
                                    style={{
                                        background: 'none', border: 'none', color: 'var(--color-primary)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                                        padding: '2px', marginLeft: '4px', borderRadius: '50%'
                                    }}
                                    className="filter-clear-btn"
                                    title="Clear Filter"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}
                    >
                        {isTableOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>

                {isTableOpen && (
                    <div className="table-container" style={{ marginTop: 'var(--space-4)' }}>
                        <table className="flights-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Airline / Aircraft</th>
                                    <th>Route</th>
                                    <th>Miles</th>
                                    <th>Time</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFlights.length > 0 ? filteredFlights.map(f => (
                                    <tr key={f.id}>
                                        <td>{formatDate(f.date)}</td>
                                        <td>
                                            <div
                                                className="clickable-filter-text"
                                                style={{ fontWeight: 500 }}
                                                onClick={() => handleFilterClick('airline', f.airline)}
                                                title={`Filter by ${f.airline}`}
                                            >
                                                {f.airline}
                                            </div>
                                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <span
                                                    className="clickable-filter-text"
                                                    onClick={() => handleFilterClick('aircraft', f.aircraft)}
                                                    title={`Filter by ${f.aircraft}`}
                                                >
                                                    {f.aircraft}
                                                </span>
                                                &bull;
                                                <span
                                                    className="clickable-filter-text"
                                                    onClick={() => handleFilterClick('alliance', f.alliance)}
                                                    title={`Filter by ${f.alliance}`}
                                                >
                                                    {f.alliance}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className="badge data-mono clickable-filter-badge"
                                                onClick={() => handleFilterClick('icao', f.departure)}
                                                title={`Filter by ${f.departure}`}
                                            >
                                                {f.departure}
                                            </span>
                                            &rarr;
                                            <span
                                                className="badge data-mono clickable-filter-badge"
                                                onClick={() => handleFilterClick('icao', f.arrival)}
                                                title={`Filter by ${f.arrival}`}
                                            >
                                                {f.arrival}
                                            </span>
                                        </td>
                                        <td className="data-mono">{f.miles} nm</td>
                                        <td className="data-mono">{f.flightTime} h</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(f); }}
                                                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px', marginRight: 'var(--space-2)' }}
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                                                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-hint)' }}>
                                            No flights match the current filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
