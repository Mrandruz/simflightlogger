import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Trash2, Edit2, RotateCcw, Filter, X, Eye, ChevronLeft, ChevronRight, Plane } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup } from "react-simple-maps";
import { geoCentroid, geoBounds, geoContains } from 'd3-geo';
import airports from 'airport-data';
import customAirports from '../customAirports';
import FlightDetailsModal from './FlightDetailsModal';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function Logbook({ flights, onDelete, onEdit }) {
    const [activeFilters, setActiveFilters] = useState({});
    const [hoveredAirport, setHoveredAirport] = useState(null);
    const [mapZoom, setMapZoom] = useState(1);
    const [mapCenter, setMapCenter] = useState([0, 10]);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const [selectedFlightDetails, setSelectedFlightDetails] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const flightsPerPage = 15;
    const geographiesRef = useRef([]);

    const uniqueAirlines = useMemo(() => [...new Set(flights.map(f => f.airline).filter(Boolean))].sort(), [flights]);
    const uniqueAircraft = useMemo(() => [...new Set(flights.map(f => f.aircraft).filter(Boolean))].sort(), [flights]);
    const uniqueAlliances = useMemo(() => [...new Set(flights.map(f => f.alliance).filter(Boolean))].sort(), [flights]);

    const handleCountryClick = useCallback((geo) => {
        const centroid = geoCentroid(geo);
        const bounds = geoBounds(geo);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const maxSpan = Math.max(dx, dy);
        const zoom = Math.min(12, Math.max(2, 120 / maxSpan));
        setMapCenter(centroid);
        setMapZoom(zoom);
        setSelectedCountry(geo.rsmKey);
    }, []);

    const handleMarkerClick = useCallback((coordinates) => {
        const geo = geographiesRef.current.find(g => geoContains(g, coordinates));
        if (geo) handleCountryClick(geo);
    }, [handleCountryClick]);

    const handleZoomReset = useCallback(() => {
        setMapZoom(1);
        setMapCenter([0, 10]);
        setSelectedCountry(null);
    }, []);

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

    const totalPages = Math.ceil(filteredFlights.length / flightsPerPage);
    const paginatedFlights = useMemo(() => {
        const startIndex = (currentPage - 1) * flightsPerPage;
        return filteredFlights.slice(startIndex, startIndex + flightsPerPage);
    }, [filteredFlights, currentPage]);

    const mappedAirports = useMemo(() => {
        const visitedCodes = new Set();
        filteredFlights.forEach(f => {
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
    }, [filteredFlights]);

    const mappedRoutes = useMemo(() => {
        const routes = [];
        filteredFlights.forEach(f => {
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
    }, [filteredFlights]);

    const formatDate = (isoStr) => {
        const date = new Date(isoStr);
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Interactive Global Map */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-6)', paddingBottom: 0 }}>
                    <h3 className="card-title">Flights Global View</h3>
                </div>
                <div style={{ width: '100%', height: '450px', backgroundColor: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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

                            {mappedRoutes.map((route) => (
                                <Line key={route.id} from={route.from} to={route.to} stroke="var(--color-primary)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="6 4" className="animated-route" style={{ opacity: 0.6 }} />
                            ))}

                            {mappedAirports.map(({ icao, name, coordinates }) => (
                                <Marker key={icao} coordinates={coordinates} onMouseEnter={() => setHoveredAirport(icao)} onMouseLeave={() => setHoveredAirport(null)} onClick={() => handleMarkerClick(coordinates)} style={{ cursor: 'pointer' }}>
                                    <circle r={10} fill="var(--color-primary)" opacity={0} className="map-pulse-ring" />
                                    <circle r={hoveredAirport === icao ? 6 : 4} fill="var(--color-primary)" stroke={hoveredAirport === icao ? '#fff' : 'var(--color-map-stroke)'} strokeWidth={hoveredAirport === icao ? 2 : 1.5} filter={hoveredAirport === icao ? 'url(#glow)' : 'none'} style={{ transition: 'r 0.2s ease, stroke-width 0.2s ease' }} />
                                    <text textAnchor="middle" y={-14} style={{ fontFamily: "var(--font-family-sans)", fill: hoveredAirport === icao ? 'var(--color-primary)' : 'var(--color-text-primary)', fontSize: hoveredAirport === icao ? '10px' : '9px', fontWeight: 600, textShadow: "1px 1px 0 var(--color-map-shadow), -1px -1px 0 var(--color-map-shadow), 1px -1px 0 var(--color-map-shadow), -1px 1px 0 var(--color-map-shadow)", transition: 'font-size 0.2s ease, fill 0.2s ease' }}>
                                        {icao}
                                    </text>
                                    {hoveredAirport === icao && (
                                        <g>
                                            <rect x={-name.length * 3.2} y={10} width={name.length * 6.4} height={20} rx={4} fill="var(--color-primary)" opacity={0.9} />
                                            <text textAnchor="middle" y={24} style={{ fontFamily: "var(--font-family-sans)", fill: "#fff", fontSize: "10px", fontWeight: 500 }}>{name}</text>
                                        </g>
                                    )}
                                </Marker>
                            ))}
                        </ZoomableGroup>
                    </ComposableMap>
                </div>
                <style>{`
                    @keyframes pulse-ring { 0% { r: 4; opacity: 0.6; } 100% { r: 16; opacity: 0; } }
                    @keyframes dash-flow { to { stroke-dashoffset: -20; } }
                    .map-pulse-ring { animation: pulse-ring 2s ease-out infinite; }
                    .animated-route { animation: dash-flow 1.5s linear infinite; }
                `}</style>
            </div>

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

                            {Object.keys(activeFilters).length > 0 && (
                                <button
                                    onClick={clearFilter}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                                >
                                    <X size={14} /> Clear All
                                </button>
                            )}
                        </div>

                        {activeFilters.icao && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: 'rgba(30, 215, 96, 0.15)',
                                border: '1px solid var(--color-primary)',
                                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                                color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 600
                            }}>
                                <Filter size={14} />
                                <span>Airport:</span> {activeFilters.icao}
                                <button onClick={() => handleFilterClick('icao', null)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', marginLeft: '4px', borderRadius: '50%' }} className="filter-clear-btn" title="Clear ICAO Filter">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
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
                            {paginatedFlights.length > 0 ? paginatedFlights.map(f => (
                                <tr key={f.id}>
                                    <td>{formatDate(f.date)}</td>
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
                                    <td className="data-mono">{f.flightTime} h</td>
                                    <td>
                                        <span className="data-mono" style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                            {Math.floor(((f.miles || 0) / 10) + ((f.flightTime || 0) * 50))}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedFlightDetails(f); }} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '4px', marginRight: 'var(--space-2)' }} title="View details"><Eye size={18} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onEdit(f); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px', marginRight: 'var(--space-2)' }} title="Edit"><Edit2 size={18} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(f.id); }} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }} title="Delete"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            )) : (
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
                            Page <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{currentPage}</span> of {totalPages}
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
