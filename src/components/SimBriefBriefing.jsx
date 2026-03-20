import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, MapPin, Plane, Route, ArrowUp, Zap, Fuel, Clock, AlertTriangle, Wind, Thermometer, Gauge, Droplets, Radio, ExternalLink, Map, Settings } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSimBriefData, parseSimBriefData } from '../services/simbriefService';

const MiniMetar = ({ icao }) => {
    const [metar, setMetar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchMetar = async () => {
            if (!icao) return;
            setLoading(true);
            setError(false);
            try {
                const res = await fetch(`/api/metar?ids=${icao}&format=json`);
                if (!res.ok) throw new Error('HTTP Error');
                const data = await res.json();
                if (isMounted && data && data.length > 0) {
                    setMetar(data[0]);
                } else if (isMounted) {
                    setError(true);
                }
            } catch (error) {
                console.error('Failed to fetch METAR for', icao, error);
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMetar();
        return () => { isMounted = false; };
    }, [icao]);

    if (loading) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px', opacity: 0.6 }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '32px', borderRadius: '4px' }}></div>)}
            </div>
        );
    }

    if (error || !metar) {
        return (
            <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: 'var(--color-danger-bg)', 
                color: 'var(--color-danger)', 
                fontSize: '0.7rem', 
                borderRadius: '4px',
                textAlign: 'center',
                fontWeight: 600,
                border: '1px solid var(--color-danger)'
            }}>
                METAR Unavailable for {icao}
            </div>
        );
    }

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '8px', 
            marginTop: '10px',
            backgroundColor: 'rgba(0,0,0,0.02)',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Gauge size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pres</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.altim ? `${Math.round(metar.altim)}` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Wind size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wind</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.wdir !== undefined ? `${metar.wdir}°` : '--'}/{metar.wspd !== undefined ? `${metar.wspd}k` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Thermometer size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Temp</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.temp !== undefined ? `${Math.round(metar.temp)}°` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Droplets size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} aria-hidden="true" />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dew</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{metar.dewp !== undefined ? `${Math.round(metar.dewp)}°` : '--'}</span>
            </div>
        </div>
    );
};

const SimBriefBriefing = () => {
    const context = useOutletContext();
    const isDarkMode = context?.isDarkMode;
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [showSettings, setShowSettings] = useState(false);
    const [routeCopied, setRouteCopied] = useState(false);

    const [identifier, setIdentifier] = useState(() => {
        const saved = localStorage.getItem('simBriefIdentifier');
        return saved ? JSON.parse(saved) : { type: 'username', value: 'mrandruz' };
    });

    const loadFlightPlan = async () => {
        setLoading(true);
        setError(null);
        try {
            const trimmedValue = identifier.value.trim();
            const fetchOptions = identifier.type === 'userid' 
                ? { userid: trimmedValue } 
                : { username: trimmedValue };
            const rawData = await fetchSimBriefData(fetchOptions);
            const parsed = parseSimBriefData(rawData);
            setData(parsed);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleIdentifierChange = (e) => {
        const newId = { ...identifier, value: e.target.value };
        setIdentifier(newId);
        localStorage.setItem('simBriefIdentifier', JSON.stringify(newId));
    };

    const handleTypeChange = (type) => {
        const newId = { ...identifier, type };
        setIdentifier(newId);
        localStorage.setItem('simBriefIdentifier', JSON.stringify(newId));
    };

    const handleCopyRoute = () => {
        if (data?.route) {
            navigator.clipboard.writeText(data.route).then(() => {
                setRouteCopied(true);
                setTimeout(() => setRouteCopied(false), 2000);
            });
        }
    };

    const formatZulu = (val) => {
        if (!val) return '--:--z';
        
        // Handle ISO strings or valid date strings
        const dateObj = new Date(val);
        if (!isNaN(dateObj.getTime())) {
            const h = String(dateObj.getUTCHours()).padStart(2, '0');
            const m = String(dateObj.getUTCMinutes()).padStart(2, '0');
            return `${h}:${m}z`;
        }

        // Handle Unix timestamp (seconds) fallback
        if (!isNaN(Number(val)) && String(val).length >= 10) {
            const d = new Date(Number(val) * 1000);
            const h = String(d.getUTCHours()).padStart(2, '0');
            const m = String(d.getUTCMinutes()).padStart(2, '0');
            return `${h}:${m}z`;
        }

        // Handle HHMM or HH:MM string
        const str = String(val).replace(':', '');
        if (str.length === 4 && !isNaN(Number(str))) {
            return `${str.slice(0, 2)}:${str.slice(2, 4)}z`;
        }

        return '--:--z';
    };

    useEffect(() => {
        if (data) {
            console.log('SimBrief Debug - Times:', {
                dep: data.departureTime,
                arr: data.arrivalTime
            });
        }
    }, [data]);

    useEffect(() => {
        loadFlightPlan();
    }, []);

    useEffect(() => {
        if (!data || !mapRef.current) return;

        try {
            // Cleanup previous map instance if it exists
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }

            // Choose neutral tiles based on theme (CartoDB Positron for light, Dark Matter for dark)
            const tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            
            const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

            // Initialize map
            const map = L.map(mapRef.current).setView([0, 0], 2);
            mapInstance.current = map;

            L.tileLayer(tileUrl, { attribution }).addTo(map);

            // Origin marker (Green)
            const greenIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            // Destination marker (Red)
            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            // Add markers with coordinate checks
            const isValidCoord = (c) => typeof c === 'number' && !isNaN(c);
            const markers = [];
            
            if (isValidCoord(data.origin?.lat) && isValidCoord(data.origin?.lon)) {
                L.marker([data.origin.lat, data.origin.lon], { icon: greenIcon })
                    .addTo(map)
                    .bindPopup(`Origin: ${data.origin.icao} - ${data.origin.name}`);
                markers.push([data.origin.lat, data.origin.lon]);
            }

            if (isValidCoord(data.destination?.lat) && isValidCoord(data.destination?.lon)) {
                L.marker([data.destination.lat, data.destination.lon], { icon: redIcon })
                    .addTo(map)
                    .bindPopup(`Destination: ${data.destination.icao} - ${data.destination.name}`);
                markers.push([data.destination.lat, data.destination.lon]);
            }

            // Route polyline from waypoints
            const latLons = (data.waypoints || [])
                .filter(w => typeof w.lat === 'number' && typeof w.lon === 'number' && !isNaN(w.lat) && !isNaN(w.lon))
                .map(w => [w.lat, w.lon]);
            
            // If no waypoints, use origin/destination
            const finalLatLons = latLons.length > 0 ? latLons : markers;

            if (finalLatLons.length >= 2) {
                // Use a neutral slate color for the route
                const routeColor = isDarkMode ? '#94a3b8' : '#64748b';
                
                L.polyline(finalLatLons, {
                    color: routeColor,
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '5, 8'
                }).addTo(map);

                // Auto fitting bounds
                const bounds = L.latLngBounds(finalLatLons);
                map.fitBounds(bounds, { padding: [50, 50] });
            } else if (markers.length > 0) {
                map.setView(markers[0], 5);
            }

            // Cleanup on destroy
            return () => {
                if (mapInstance.current) {
                    try {
                       mapInstance.current.remove();
                    } catch (e) {}
                    mapInstance.current = null;
                }
            };

        } catch (e) {
            console.error('SimBrief: Error initializing map:', e);
            setError('Error loading map. Please verify flight plan data.');
        }

        return () => {
            if (mapInstance.current) {
                try {
                   mapInstance.current.remove();
                } catch (e) {}
                mapInstance.current = null;
            }
        };
    }, [data, isDarkMode]);

    if (loading) {
        return (
            <div className="card" style={{ border: 'none', background: 'var(--color-surface)', position: 'relative' }}>
                <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <div className="skeleton skeleton-circle" style={{ width: 44, height: 44 }}></div>
                        <div>
                            <div className="skeleton skeleton-title" style={{ width: '120px', marginBottom: '8px' }}></div>
                            <div className="skeleton skeleton-text" style={{ width: '80px' }}></div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: 'var(--space-6)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-6)' }}>
                        {[...Array(6)].map((_, i) => (
                            <div key={i}><div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: '12px', opacity: 0.6 }}></div><div className="skeleton skeleton-title" style={{ width: '80%' }}></div></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                    <AlertTriangle size={32} aria-hidden="true" />
                </div>
                <div>
                    <h3 style={{ marginBottom: '8px' }}>Mission Briefing Unavailable</h3>
                    <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px' }}>{error}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--color-background)', padding: '12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                     <IdentifierToggle identifier={identifier} onTypeChange={handleTypeChange} />
                     <input type="text" value={identifier.value} onChange={handleIdentifierChange} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', width: '140px' }} />
                     <button className="btn btn-primary" onClick={loadFlightPlan}>Retry Connection</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Header & Mission Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        <Zap size={14} aria-hidden="true" />
                        Flight Control
                    </div>
                    <h1 style={{ fontSize: '1.75rem', margin: 0, fontFamily: 'var(--font-family-display)', fontWeight: 500 }}>Briefing & Dispatch</h1>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setShowSettings(!showSettings)} className="btn btn-secondary" style={{ padding: '10px' }} aria-label="SimBrief settings">
                        <Settings size={20} aria-hidden="true" />
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.open('https://dispatch.simbrief.com/briefing/latest', '_blank')}>
                        <ExternalLink size={18} aria-hidden="true" />
                        <span>SimBrief</span>
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.open('https://charts.navigraph.com/flights/current', '_blank')}>
                        <Map size={18} aria-hidden="true" />
                        <span>Navigraph</span>
                    </button>
                    <button className="btn btn-primary" onClick={loadFlightPlan} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spin' : ''} aria-hidden="true" />
                        <span>Refresh Ops</span>
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="card" style={{ padding: 'var(--space-4)', border: '1px solid var(--color-primary)', animation: 'fadeSlideUp 0.3s ease-out', backgroundColor: 'var(--color-primary-light)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--color-primary)' }}>SimBrief Configuration:</span>
                        <IdentifierToggle identifier={identifier} onTypeChange={handleTypeChange} />
                        <input type="text" className="form-input" value={identifier.value} onChange={handleIdentifierChange} style={{ width: '200px', height: '36px', fontSize: '0.9rem' }} placeholder="Enter ID/Username..." />
                    </div>
                </div>
            )}

            {data && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                        {/* Hero Flight Card */}
                        <div className="card" style={{ padding: 0, overflow: 'hidden', border: 'none', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)' }}>
                            <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-divider)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-success)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Origin</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 300, lineHeight: 1, fontFamily: 'var(--font-family-display)', letterSpacing: '-0.03em' }}>{data.origin.icao}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 400 }}>{data.origin.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', marginTop: '6px', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{formatZulu(data.departureTime)}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-hint)', marginTop: '2px' }}>
                                            RWY {data.departureRunway} • {data.sid}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-text-hint)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 500, marginBottom: '2px', fontFamily: 'var(--font-family-mono)' }}>{data.duration}</div>
                                        <div style={{ width: '100px', height: '2px', backgroundColor: 'currentColor', position: 'relative' }}>
                                            <Plane size={14} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--color-surface)', padding: '0 4px' }} aria-hidden="true" />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-danger)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Destination</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 300, lineHeight: 1, fontFamily: 'var(--font-family-display)', letterSpacing: '-0.03em' }}>{data.destination.icao}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 400 }}>{data.destination.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', marginTop: '6px', fontWeight: 500, fontFamily: 'var(--font-family-mono)' }}>{formatZulu(data.arrivalTime)}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-hint)', marginTop: '2px' }}>
                                            RWY {data.arrivalRunway} • {data.star}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>{data.callsign}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{data.aircraft} · {data.airlineName || 'Private'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                 <div style={{ padding: 'var(--space-4) var(--space-6)', borderRight: '1px solid var(--color-divider)' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Origin Weather</span>
                                     <MiniMetar icao={data.origin.icao} />
                                 </div>
                                 <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dest Weather</span>
                                     <MiniMetar icao={data.destination.icao} />
                                 </div>
                            </div>
                        </div>

                        {/* Operational Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                            <MetricBlock label="Fuel Load" value={`${data.fuel} kg`} icon={Fuel} />
                            <MetricBlock label="Passengers" value={data.passengers} icon={Droplets} />
                            <MetricBlock label="Zero Fuel Weight" value={`${data.zfw} kg`} icon={Gauge} />
                            <MetricBlock label="Plan Distance" value={`${data.distance} nm`} icon={Route} />
                            <MetricBlock label="Cruise Level" value={`FL${Math.round(data.cruiseAltitude/100)}`} icon={ArrowUp} />
                            <MetricBlock label="Cost Index" value={data.costIndex} icon={Zap} />
                        </div>

                        {/* Route Operations */}
                        <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Route size={18} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>ATC Route</span>
                                </div>
                                <button onClick={handleCopyRoute} className={`btn ${routeCopied ? '' : 'btn-secondary'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: routeCopied ? 'var(--color-success-bg)' : undefined, color: routeCopied ? 'var(--color-success)' : undefined }}>
                                    {routeCopied ? 'COPIED' : 'COPY ROUTE'}
                                </button>
                            </div>
                            <div style={{ backgroundColor: 'var(--color-background)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-family-mono)', fontSize: '0.85rem', lineHeight: 1.6, wordBreak: 'break-all', color: 'var(--color-text-primary)' }}>
                                {data.route}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                        {/* Map View */}
                        <div style={{ flex: 1, minHeight: '500px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', position: 'relative' }}>
                             <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
                             <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
                                <div style={{ backgroundColor: 'var(--color-surface)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 500, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-family-mono)' }}>
                                    {data.distance} NM
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const IdentifierToggle = ({ identifier, onTypeChange }) => (
    <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', gap: '4px' }}>
        {['username', 'userid'].map(type => (
            <button key={type} onClick={() => onTypeChange(type)} style={{ padding: '4px 10px', fontSize: '0.65rem', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: identifier.type === type ? 'var(--color-primary)' : 'transparent', color: identifier.type === type ? '#fff' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                {type === 'username' ? 'Username' : 'Pilot ID'}
            </button>
        ))}
    </div>
);

const MetricBlock = ({ label, value, icon: Icon }) => (
    <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', background: 'var(--color-surface)' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <Icon size={18} aria-hidden="true" />
        </div>
        <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>{value}</div>
        </div>
    </div>
);

const InfoBlock = ({ icon: Icon, label, value, color, children }) => {
    const [isHovered, setIsHovered] = useState(false);
    const spanRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        if (spanRef.current) {
            setIsTruncated(spanRef.current.scrollWidth > spanRef.current.clientWidth);
        }
    }, [value]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%', position: 'relative' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--color-text-hint)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.07em' }}>
                <Icon size={12} style={{ color: color || 'var(--color-primary)' }} aria-hidden="true" />
                {label}
            </span>
            <div style={{ position: 'relative', cursor: isTruncated ? 'help' : 'default' }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <span ref={spanRef} style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {value}
                </span>
                {isHovered && isTruncated && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '0', marginBottom: '8px', backgroundColor: '#1e293b', color: '#f8fafc', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
                        {value}
                        <div style={{ position: 'absolute', top: '100%', left: '12px', width: '0', height: '0', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' }} />
                    </div>
                )}
            </div>
            <div style={{ marginTop: 'auto' }}>{children}</div>
        </div>
    );
};

export default SimBriefBriefing;
