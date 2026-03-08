import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plane as PlaneIcon, MapPin, Clock, Fuel, Calendar, Wind, Thermometer, Droplets, Gauge, AlertCircle } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";
import { geoCentroid, geoDistance } from 'd3-geo';
import airports from 'airport-data';
import customAirports from '../customAirports';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Average fuel consumption in kg per nautical mile by aircraft type
const FUEL_CONSUMPTION_PER_NM = {
    'Airbus A319': 2.4,
    'Airbus A320': 2.6,
    'Airbus A321': 3.0,
    'Airbus A330': 5.8,
    'Airbus A350': 5.2,
    'Airbus A380': 10.5,
    'Boeing 777': 7.5,
    'Boeing 787': 5.6,
    'Altro': 3.5,
};

const MiniMetar = ({ icao, title }) => {
    const [metar, setMetar] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchMetar = async () => {
            if (!icao) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/metar?ids=${icao}&format=json`);
                const data = await res.json();
                if (isMounted && data && data.length > 0) {
                    setMetar(data[0]);
                }
            } catch (error) {
                console.error('Failed to fetch METAR for', icao, error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchMetar();
        return () => { isMounted = false; };
    }, [icao]);

    return (
        <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{title} ({icao})</span>
                {loading ? <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)' }}>Loading...</span> :
                    metar ? <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>Live</span> :
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-danger)' }}><AlertCircle size={10} /></span>}
            </div>

            {metar ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Wind size={16} style={{ color: 'var(--color-primary)', marginBottom: '4px' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.wdir !== undefined ? `${metar.wdir}°` : '--'}/{metar.wspd !== undefined ? `${metar.wspd}kt` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Thermometer size={16} style={{ color: 'var(--color-primary)', marginBottom: '4px' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.temp !== undefined ? `${Math.round(metar.temp)}°C` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Droplets size={16} style={{ color: 'var(--color-primary)', marginBottom: '4px' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.dewp !== undefined ? `${Math.round(metar.dewp)}°C` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Gauge size={16} style={{ color: 'var(--color-primary)', marginBottom: '4px' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.altim ? `${Math.round(metar.altim)}` : '--'}</span>
                    </div>
                </div>
            ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-hint)', textAlign: 'center', padding: '10px 0' }}>
                    {!loading && "No METAR data available"}
                </div>
            )}
        </div>
    );
};

export default function FlightDetailsModal({ flight, allFlights, onClose }) {
    if (!flight) return null;

    const [mapCenter, setMapCenter] = useState([0, 20]);
    const [mapScale, setMapScale] = useState(150);

    const depAp = findAirport(flight.departure);
    const arrAp = findAirport(flight.arrival);
    const hasMapData = depAp && arrAp;

    useEffect(() => {
        if (hasMapData) {
            // Calculate a reasonable center and zoom for the map
            const p1 = [depAp.longitude, depAp.latitude];
            const p2 = [arrAp.longitude, arrAp.latitude];

            setMapCenter([
                (p1[0] + p2[0]) / 2,
                (p1[1] + p2[1]) / 2
            ]);

            // Very rough scale estimation based on distance
            const dist = Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
            const calculatedScale = Math.min(800, Math.max(150, 6000 / (dist || 1)));
            setMapScale(calculatedScale);
        }
    }, [depAp, arrAp, hasMapData]);

    const stats = useMemo(() => {
        const fuelRate = FUEL_CONSUMPTION_PER_NM[flight.aircraft] || FUEL_CONSUMPTION_PER_NM['Altro'];
        const estimatedFuel = Math.round((flight.miles || 0) * fuelRate);

        let timesFlownFrom = 0;
        let timesFlownTo = 0;

        allFlights.forEach(f => {
            if (f.departure === flight.departure) timesFlownFrom++;
            if (f.arrival === flight.arrival) timesFlownTo++;
        });

        return { estimatedFuel, timesFlownFrom, timesFlownTo };
    }, [flight, allFlights]);

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '90%', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-primary)' }}>Flight Log</h2>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span className="badge data-mono">{flight.departure}</span> &rarr; <span className="badge data-mono">{flight.arrival}</span>
                            &bull; <span>{flight.airline}</span> &bull; <span>{flight.aircraft}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--color-surface-hover)' }}><X size={24} /></button>
                </div>

                {/* Main Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
                    <div style={{ backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(30, 215, 96, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}><Calendar size={14} /> Date</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }} className="data-mono">{new Date(flight.date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(30, 215, 96, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}><MapPin size={14} /> Distance</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }} className="data-mono">{flight.miles} nm</div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(30, 215, 96, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(30, 215, 96, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}><Clock size={14} /> Flight Time</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }} className="data-mono">{flight.flightTime} h</div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(232, 113, 10, 0.1)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(232, 113, 10, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}><Fuel size={14} color="#e8710a" /> Est. Fuel</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#e8710a' }} className="data-mono">{stats.estimatedFuel} kg</div>
                    </div>
                </div>

                {/* Map Section */}
                <div style={{ width: '100%', height: '240px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-border)' }}>
                    {hasMapData ? (
                        <ComposableMap projection="geoMercator" projectionConfig={{ scale: mapScale, center: mapCenter }} width={800} height={240}>
                            <defs>
                                <filter id="glow-modal">
                                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <Geographies geography={geoUrl}>
                                {({ geographies }) => geographies.map((geo) => (
                                    <Geography key={geo.rsmKey} geography={geo} fill="var(--color-divider)" stroke="var(--color-surface)" strokeWidth={0.5} style={{ default: { outline: "none" } }} />
                                ))}
                            </Geographies>

                            <Line
                                from={[depAp.longitude, depAp.latitude]}
                                to={[arrAp.longitude, arrAp.latitude]}
                                stroke="var(--color-primary)"
                                strokeWidth={2}
                                strokeLinecap="round"
                                className="modal-animated-route"
                            />

                            <Marker coordinates={[depAp.longitude, depAp.latitude]}>
                                <circle r={5} fill="var(--color-primary)" stroke="#fff" strokeWidth={1.5} filter={'url(#glow-modal)'} />
                                <text textAnchor="middle" y={-12} style={{ fontFamily: "var(--font-family-sans)", fill: 'var(--color-text-primary)', fontSize: '11px', fontWeight: 600, textShadow: "1px 1px 0 var(--color-surface), -1px -1px 0 var(--color-surface)" }}>
                                    {depAp.icao}
                                </text>
                            </Marker>

                            <Marker coordinates={[arrAp.longitude, arrAp.latitude]}>
                                <circle r={5} fill="var(--color-primary)" stroke="#fff" strokeWidth={1.5} filter={'url(#glow-modal)'} />
                                <text textAnchor="middle" y={-12} style={{ fontFamily: "var(--font-family-sans)", fill: 'var(--color-text-primary)', fontSize: '11px', fontWeight: 600, textShadow: "1px 1px 0 var(--color-surface), -1px -1px 0 var(--color-surface)" }}>
                                    {arrAp.icao}
                                </text>
                            </Marker>
                        </ComposableMap>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-hint)' }}>Map data not available for these airports</div>
                    )}

                    <style>{`
                        @keyframes dash-flow-modal { to { stroke-dashoffset: -20; } }
                        .modal-animated-route {
                            stroke-dasharray: 6 4;
                            animation: dash-flow-modal 1s linear infinite;
                        }
                    `}</style>
                </div>

                {/* Airport Stats & METAR */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>You flew out of <strong style={{ color: 'var(--color-text-primary)' }}>{flight.departure}</strong> <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{stats.timesFlownFrom}</span> time(s)</div>
                        <MiniMetar icao={flight.departure} title="Dep Weather" />
                    </div>

                    <div style={{ width: '1px', backgroundColor: 'var(--color-divider)' }}></div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>You flew into <strong style={{ color: 'var(--color-text-primary)' }}>{flight.arrival}</strong> <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{stats.timesFlownTo}</span> time(s)</div>
                        <MiniMetar icao={flight.arrival} title="Arr Weather" />
                    </div>
                </div>

            </div>
        </div>
    );
}
