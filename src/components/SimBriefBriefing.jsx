import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, MapPin, Plane, Route, ArrowUp, Zap, Fuel, Clock, AlertTriangle, Wind, Thermometer, Gauge, Droplets, Radio, ExternalLink, Map, Settings } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSimBriefData, parseSimBriefData } from '../services/simbriefService';

const MiniMetar = ({ icao }) => {
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

    if (loading) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px', opacity: 0.6 }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '32px', borderRadius: '4px' }}></div>)}
            </div>
        );
    }

    if (!metar) return null;

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
                <Gauge size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Pres</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{metar.altim ? `${Math.round(metar.altim)}` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Wind size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Wind</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{metar.wdir !== undefined ? `${metar.wdir}°` : '--'}/{metar.wspd !== undefined ? `${metar.wspd}k` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Thermometer size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Temp</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{metar.temp !== undefined ? `${Math.round(metar.temp)}°` : '--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Droplets size={14} style={{ color: 'var(--color-text-hint)', marginBottom: '2px' }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Dew</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{metar.dewp !== undefined ? `${Math.round(metar.dewp)}°` : '--'}</span>
            </div>
        </div>
    );
};

const SimBriefBriefing = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [showSettings, setShowSettings] = useState(false);

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

            // Initialize map with a safe default center
            const map = L.map(mapRef.current).setView([0, 0], 2);
            mapInstance.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

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
                L.polyline(finalLatLons, {
                    color: '#3b82f6', // Fallback to a clear blue
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
    }, [data]);

    if (error && !data) {
        return (
            <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <AlertTriangle size={24} />
                    <h3 style={{ margin: 0, color: 'inherit' }}>SimBrief Error</h3>
                </div>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>{error}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{
                            display: 'flex',
                            backgroundColor: 'var(--color-background)',
                            padding: '4px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            gap: '4px'
                        }}>
                            <button
                                onClick={() => handleTypeChange('username')}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.7rem',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    backgroundColor: identifier.type === 'username' ? 'var(--color-primary)' : 'transparent',
                                    color: identifier.type === 'username' ? '#fff' : 'var(--color-text-secondary)'
                                }}
                            >
                                Username
                            </button>
                            <button
                                onClick={() => handleTypeChange('userid')}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.7rem',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    backgroundColor: identifier.type === 'userid' ? 'var(--color-primary)' : 'transparent',
                                    color: identifier.type === 'userid' ? '#fff' : 'var(--color-text-secondary)'
                                }}
                            >
                                Pilot ID
                            </button>
                        </div>
                        <input
                            type="text"
                            value={identifier.value}
                            onChange={handleIdentifierChange}
                            placeholder={identifier.type === 'username' ? "Username" : "Pilot ID"}
                            style={{
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-background)',
                                color: 'var(--color-text-primary)',
                                width: '120px'
                            }}
                        />
                        <button className="btn btn-primary" onClick={loadFlightPlan}>Retry</button>
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                    <Zap size={20} style={{ color: 'var(--color-warning)' }} />
                    Latest SimBrief Flight Plan
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: showSettings ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                            color: showSettings ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title="SimBrief Settings"
                    >
                        <Settings size={18} />
                    </button>

                    {showSettings && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
                            <div style={{
                                display: 'flex',
                                backgroundColor: 'var(--color-background)',
                                padding: '4px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                gap: '4px'
                            }}>
                                <button
                                    onClick={() => handleTypeChange('username')}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '0.7rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        backgroundColor: identifier.type === 'username' ? 'var(--color-primary)' : 'transparent',
                                        color: identifier.type === 'username' ? '#fff' : 'var(--color-text-secondary)',
                                        fontWeight: identifier.type === 'username' ? 600 : 400
                                    }}
                                >
                                    Username
                                </button>
                                <button
                                    onClick={() => handleTypeChange('userid')}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '0.7rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        backgroundColor: identifier.type === 'userid' ? 'var(--color-primary)' : 'transparent',
                                        color: identifier.type === 'userid' ? '#fff' : 'var(--color-text-secondary)',
                                        fontWeight: identifier.type === 'userid' ? 600 : 400
                                    }}
                                >
                                    Pilot ID
                                </button>
                            </div>
                            <input
                                type="text"
                                value={identifier.value}
                                onChange={handleIdentifierChange}
                                placeholder={identifier.type === 'username' ? "Username" : "Pilot ID"}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '0.85rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-background)',
                                    color: 'var(--color-text-primary)',
                                    width: '120px'
                                }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="btn"
                            onClick={() => {
                                window.open('https://dispatch.simbrief.com/briefing/latest', '_blank');
                            }}
                            style={{ 
                                padding: '8px 16px', 
                                gap: '8px',
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                                opacity: !identifier.value ? 0.5 : 1,
                                cursor: !identifier.value ? 'not-allowed' : 'pointer'
                            }}
                            disabled={!identifier.value}
                        >
                            <ExternalLink size={16} />
                            <span>Open SimBrief</span>
                        </button>
                        <button
                            className="btn"
                            onClick={() => {
                                window.open('https://charts.navigraph.com/flights/current', '_blank');
                            }}
                            style={{ 
                                padding: '8px 16px', 
                                gap: '8px',
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                                opacity: !identifier.value ? 0.5 : 1,
                                cursor: !identifier.value ? 'not-allowed' : 'pointer'
                            }}
                            disabled={!identifier.value}
                        >
                            <Map size={16} />
                            <span>Navigraph Charts</span>
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={loadFlightPlan}
                            disabled={loading}
                            style={{ padding: '8px 16px', gap: '8px' }}
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} />
                            <span>{loading ? 'Loading...' : 'Refresh'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-danger-bg)',
                    color: 'var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    border: '1px solid var(--color-danger)'
                }}>
                    <AlertTriangle size={20} />
                    <span style={{ fontWeight: 500 }}>{error}</span>
                </div>
            )}

            {!error && !data && !loading && (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <p>No flight plan loaded. Click "Refresh" to fetch the latest OFP from SimBrief.</p>
                </div>
            )}

            {data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 1.5fr', gap: 'var(--space-6)' }}>
                        {/* Information Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                            {/* Origins & Destinations row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
                                <InfoBlock icon={MapPin} label="Origin" value={`${data.origin.icao} - ${data.origin.name}`} color="var(--color-success)">
                                    <MiniMetar icao={data.origin.icao} />
                                </InfoBlock>
                                <InfoBlock icon={MapPin} label="Destination" value={`${data.destination.icao} - ${data.destination.name}`} color="var(--color-danger)">
                                    <MiniMetar icao={data.destination.icao} />
                                </InfoBlock>
                            </div>

                            {/* Main stats grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
                                <InfoBlock icon={Radio} label="Callsign" value={`${data.callsign}${data.airlineName ? ` (${data.airlineName})` : ''}`} />
                                <InfoBlock icon={Plane} label="Aircraft" value={data.aircraft} />
                                <InfoBlock icon={Route} label="Distance" value={`${data.distance} nm`} />
                                <InfoBlock icon={ArrowUp} label="Cruise Altitude" value={`FL${Math.round(data.cruiseAltitude / 100)}`} />
                                <InfoBlock icon={Fuel} label="Fuel" value={`${data.fuel} kg`} />
                                <InfoBlock icon={Clock} label="Estimated Duration" value={data.duration} />
                            </div>
                            
                            <div style={{
                                padding: 'var(--space-3)',
                                backgroundColor: 'var(--color-background)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Route</span>
                                <span className="data-mono" style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', wordBreak: 'break-all', lineHeight: '1.4' }}>
                                    {data.route}
                                </span>
                            </div>
                        </div>

                        {/* Map Display */}
                        <div style={{ 
                            height: '100%', 
                            minHeight: '450px',
                            borderRadius: 'var(--radius-md)', 
                            overflow: 'hidden', 
                            border: '1px solid var(--color-border)',
                            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
                        }}>
                            <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
                        </div>
                    </div>
                </div>
            )}
            
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-3)',
                    zIndex: 10
                }}>
                    <RefreshCw size={32} className="spin" style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Fetching data from SimBrief...</span>
                </div>
            )}
        </div>
    );
};

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
            <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--color-text-hint)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                letterSpacing: '0.5px'
            }}>
                <Icon size={12} style={{ color: color || 'var(--color-primary)' }} />
                {label}
            </span>
            <div 
                style={{ position: 'relative', cursor: isTruncated ? 'help' : 'default' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <span 
                    ref={spanRef}
                    style={{ 
                        fontSize: '0.95rem', 
                        fontWeight: 600, 
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block'
                    }}
                >
                    {value}
                </span>
                
                {isHovered && isTruncated && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '0',
                        marginBottom: '8px',
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        pointerEvents: 'none'
                    }}>
                        {value}
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '12px',
                            width: '0',
                            height: '0',
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid #1e293b'
                        }} />
                    </div>
                )}
            </div>
            <div style={{ marginTop: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default SimBriefBriefing;
