import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, Edit2, RotateCcw, Filter, X, Eye, ChevronLeft, ChevronRight, Plane, Map as MapIcon, Search, Calendar, MapPin, Clock, Hash, LayoutGrid, List, AlertCircle, Quote } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { findAirport } from '../utils/airportUtils';
import FlightDetailsModal from './FlightDetailsModal';

// Dynamic font size scaling based on value length
const getStatFontSize = (value) => {
    const len = value.toString().replace(/[^0-9]/g, '').length;
    if (len <= 3) return 'clamp(2rem, 16cqw, 2.6rem)';
    if (len <= 5) return 'clamp(1.7rem, 14cqw, 2.3rem)';
    return 'clamp(1.4rem, 12cqw, 2rem)';
};


export default function Logbook({ flights, onDelete, onEdit }) {
    console.log('Logbook: Rendering with', flights.length, 'flights');
    const context = useOutletContext();
    const isDarkMode = context?.isDarkMode;

    const [activeFilters, setActiveFilters] = useState({});
    const [selectedFlightDetails, setSelectedFlightDetails] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const flightsPerPage = 15;

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersGroupRef = useRef(null);
    const routesGroupRef = useRef(null);

    const [isManualZoom, setIsManualZoom] = useState(false);
    const isProgrammaticChange = useRef(false);

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

    const fitToData = useCallback((animate = true) => {
        if (!mapInstance.current || mapData.airports.length === 0) return;

        isProgrammaticChange.current = true;

        const bounds = L.latLngBounds();
        mapData.airports.forEach(ap => {
            bounds.extend([ap.coordinates[1], ap.coordinates[0]]);
        });

        if (bounds.isValid()) {
            mapInstance.current.invalidateSize();
            mapInstance.current.fitBounds(bounds, {
                padding: [30, 30],
                maxZoom: 10,
                animate
            });

            const timeout = animate ? 800 : 200;
            setTimeout(() => {
                if (mapInstance.current && mapInstance.current.getZoom() < 2) {
                    mapInstance.current.setZoom(2, { animate: false });
                }
                setTimeout(() => {
                    isProgrammaticChange.current = false;
                }, 200);
            }, timeout);

            setIsManualZoom(prev => prev ? false : prev);
        } else {
            isProgrammaticChange.current = false;
        }
    }, [mapData.airports]);

    const handleZoomReset = useCallback(() => {
        fitToData(true);
    }, [fitToData]);

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

    // Map Initialization (Once)
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const map = L.map(mapRef.current, {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            zoomControl: false,
            attributionControl: false,
            renderer: L.canvas() // Use Canvas for high performance vector rendering
        });

        const initialTileUrl = isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

        tileLayerRef.current = L.tileLayer(initialTileUrl, {
            noWrap: true,
            bounds: [[-90, -180], [90, 180]]
        }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstance.current = map;
        markersGroupRef.current = L.layerGroup().addTo(map);
        routesGroupRef.current = L.layerGroup().addTo(map);

        // Interaction listeners
        map.on('zoomend moveend', () => {
            if (!isProgrammaticChange.current) {
                setIsManualZoom(true);
            }
        });

        // Trigger initial fit with a slight delay
        const fitTimer = setTimeout(() => {
            if (mapInstance.current) fitToData(false);
        }, 800);

        return () => {
            clearTimeout(fitTimer);
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []); // Run ONLY once on mount

    // Theme Update Effect
    useEffect(() => {
        if (!mapInstance.current || !tileLayerRef.current) return;

        const newTileUrl = isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

        tileLayerRef.current.setUrl(newTileUrl);
    }, [isDarkMode]);

    // Map Updates (Markers & Routes)
    useEffect(() => {
        if (!mapInstance.current || !markersGroupRef.current || !routesGroupRef.current) return;

        // Clear existing layers
        markersGroupRef.current.clearLayers();
        routesGroupRef.current.clearLayers();

        // Custom Icons
        const originIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [20, 32],
            iconAnchor: [10, 32],
            popupAnchor: [1, -34],
            shadowSize: [32, 32]
        });

        const destIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [20, 32],
            iconAnchor: [10, 32],
            popupAnchor: [1, -34],
            shadowSize: [32, 32]
        });

        const pointIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div class="marker-dot"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        // Add Routes
        mapData.routes.forEach(route => {
            L.polyline([[route.from[1], route.from[0]], [route.to[1], route.to[0]]], {
                color: isDarkMode ? '#1ed760' : '#1db954',
                weight: 1.5,
                opacity: 0.4,
                dashArray: '5, 10'
            }).addTo(routesGroupRef.current);
        });

        // Identify latest flight for pin highlighting
        const latest = filteredFlights[0];
        const latestDep = latest?.departure?.toUpperCase();
        const latestArr = latest?.arrival?.toUpperCase();

        // Add Markers
        mapData.airports.forEach(ap => {
            const latLng = [ap.coordinates[1], ap.coordinates[0]];
            const isLatestOrigin = ap.icao === latestDep;
            const isLatestDest = ap.icao === latestArr;

            if (isLatestOrigin || isLatestDest) {
                L.marker(latLng, {
                    icon: isLatestOrigin ? originIcon : destIcon,
                    zIndexOffset: 1000
                })
                    .addTo(markersGroupRef.current)
                    .bindTooltip(`${isLatestOrigin ? 'Latest Dep' : 'Latest Arr'}: ${ap.icao}`, {
                        direction: 'top', offset: [0, -5], sticky: false
                    });
            } else {
                L.marker(latLng, { icon: pointIcon })
                    .addTo(markersGroupRef.current);
            }
        });

        // Auto fitting
        if (mapData.airports.length > 0 && !isManualZoom) {
            fitToData(false);
        }
    }, [mapData, fitToData, isDarkMode, filteredFlights, isManualZoom]);

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Global Dashboard Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 350px) 1fr', gap: 'var(--space-6)' }}>
                {/* Stats Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--space-6)', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-primary)', marginBottom: '12px', fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-family-display)', flexWrap: 'wrap', lineHeight: 1.2 }}>
                            <Plane size={24} style={{ color: 'var(--color-primary)' }} /> Operational Statistics
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)', fontWeight: 500 }}>
                            {filterLabel === 'Global' ? (
                                <>Showing&nbsp;&nbsp;<span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>all flights</span></>
                            ) : (
                                <>Filtered by&nbsp;&nbsp;<span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{filterLabel}</span></>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            {[
                                { label: 'Total Flights', value: stats.total, color: 'var(--color-text-primary)' },
                                { label: 'Total Hours', value: stats.hours, color: 'var(--color-text-primary)' },
                                { label: 'Nautical Miles', value: stats.miles.toLocaleString(), color: 'var(--color-text-primary)' },
                                { label: 'Experience (XP)', value: stats.xp.toLocaleString(), color: 'var(--color-primary)' },
                            ].map(({ label, value, color }) => (
                                <div key={label} style={{
                                    padding: 'var(--space-4)',
                                    backgroundColor: 'rgba(100,100,100,0.05)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    containerType: 'inline-size'
                                }}>
                                    <div style={{
                                        fontSize: '0.65rem',
                                        color: 'var(--color-text-hint)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        marginBottom: '4px'
                                    }}>
                                        {label}
                                    </div>
                                    <div style={{
                                        fontSize: getStatFontSize(value),
                                        fontWeight: 800,
                                        color: color,
                                        lineHeight: 1.2
                                    }}>
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            marginTop: 'var(--space-6)',
                            padding: 'var(--space-4)',
                            backgroundColor: 'rgba(20, 106, 255, 0.03)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Watermark — piccolo, angolo in basso a destra */}
                            <div style={{
                                position: 'absolute',
                                bottom: '8px',
                                right: '10px',
                                opacity: 0.08,
                                color: 'var(--color-primary)',
                                pointerEvents: 'none'
                            }}>
                                <Plane size={40} />
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--color-text-secondary)',
                                fontStyle: 'italic',
                                lineHeight: 1.5,
                                position: 'relative',
                                zIndex: 1,
                                textAlign: 'center'
                            }}>
                                <div>"Your wings already exist.</div>
                                <div>All you have to do is fly."</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* The Map */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '500px' }}>
                    <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

                    <div style={{
                        position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
                        backgroundColor: 'var(--color-surface)', padding: '6px 12px',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-sm)', fontSize: '0.7rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                        <MapIcon size={14} /> Global Network
                    </div>

                    {isManualZoom && (
                        <button onClick={handleZoomReset} className="btn btn-secondary btn-sm" style={{
                            position: 'absolute', bottom: '12px', left: '12px', zIndex: 1000,
                            backgroundColor: 'var(--color-surface)',
                            boxShadow: 'var(--shadow-md)',
                            padding: '8px 12px',
                            fontSize: '0.75rem'
                        }}>
                            <RotateCcw size={14} /> Reset View
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                    .marker-dot {
                        width: 10px;
                        height: 10px;
                        background-color: var(--color-primary);
                        border: 2px solid #fff;
                        border-radius: 50%;
                        box-shadow: 0 0 12px var(--color-primary);
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .custom-map-marker:hover .marker-dot {
                        transform: scale(1.4);
                        box-shadow: 0 0 20px var(--color-primary);
                        z-index: 1000;
                    }
                    .map-tooltip {
                        background: var(--color-surface) !important;
                        color: var(--color-text-primary) !important;
                        border: 1px solid var(--color-border) !important;
                        border-radius: var(--radius-md) !important;
                        box-shadow: var(--shadow-md) !important;
                        font-family: var(--font-family-sans) !important;
                        font-weight: 600 !important;
                        font-size: 0.75rem !important;
                        padding: 4px 8px !important;
                    }
                    .leaflet-container {
                        background: var(--color-background) !important;
                    }
                `}</style>

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
                                {activeFilters.icao && (
                                    <button
                                        onClick={() => handleFilterClick('icao', null)}
                                        className="has-tooltip"
                                        style={{
                                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', color: 'var(--color-text-hint)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px'
                                        }}
                                        aria-label="Clear ICAO filter"
                                    >
                                        <X size={14} aria-hidden="true" />
                                        <span className="tooltip-box">Clear ICAO</span>
                                    </button>
                                )}
                            </div>

                            {Object.keys(activeFilters).length > 0 && (
                                <button
                                    onClick={clearFilter}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                                    aria-label="Clear all filters"
                                >
                                    <X size={14} aria-hidden="true" /> Clear All
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
