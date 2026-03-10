import React, { useState, useEffect } from 'react';
import { Wind, Thermometer, Droplets, Gauge } from 'lucide-react';

const MetarCard = ({ airportInfo }) => {
    const { icao, city, alliance } = airportInfo;
    const [metar, setMetar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localTime, setLocalTime] = useState('');

    // update local time every minute based on timezone name if available
    useEffect(() => {
        const update = () => {
            const now = new Date();
            if (airportInfo.tz) {
                try {
                    const fmt = new Intl.DateTimeFormat('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: airportInfo.tz });
                    setLocalTime(fmt.format(now));
                } catch (e) {
                    setLocalTime(now.toISOString().substr(11, 5));
                }
            } else if (airportInfo.timezone !== undefined) {
                // fallback using offset hours
                const offset = airportInfo.timezone; // hours from UTC
                const local = new Date(now.getTime() + offset * 3600000);
                setLocalTime(local.toISOString().substr(11, 5));
            } else {
                setLocalTime(now.toISOString().substr(11, 5));
            }
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, [airportInfo.tz, airportInfo.timezone]);

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
        const interval = setInterval(fetchMetar, 3600000); // every hour
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [icao]);

    if (!icao) return null;

    return (
        <div className="card" style={{ padding: 'var(--space-4)', flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-family-sans)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {icao} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>{city}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', marginLeft: '8px' }}>Local {localTime}</span>
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{alliance}</span>
                </div>
                {loading ? <span className="skeleton" style={{ display: 'inline-block', width: '50px', height: '14px', borderRadius: '2px', marginTop: '4px' }}></span> : <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></div> Live</span>}
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginTop: 'auto' }}>
                    <div className="skeleton" style={{ width: '100%', height: '50px', borderRadius: '4px' }}></div>
                    <div className="skeleton" style={{ width: '100%', height: '50px', borderRadius: '4px' }}></div>
                    <div className="skeleton" style={{ width: '100%', height: '50px', borderRadius: '4px' }}></div>
                    <div className="skeleton" style={{ width: '100%', height: '50px', borderRadius: '4px' }}></div>
                </div>
            ) : metar ? (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Gauge size={20} style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Air Pressure</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.altim ? `${Math.round(metar.altim)} hPa` : '--'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Wind size={20} style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Wind</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.wdir !== undefined ? `${metar.wdir}°` : '--'}/{metar.wspd !== undefined ? `${metar.wspd}kt` : '--'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Thermometer size={20} style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Temp</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.temp !== undefined ? `${Math.round(metar.temp)}°C` : '--'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Droplets size={20} style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }} />
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Dew Point</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.dewp !== undefined ? `${Math.round(metar.dewp)}°C` : '--'}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-hint)', fontSize: '0.9rem', minHeight: '100px' }}>
                    {!loading && "No METAR data available"}
                </div>
            )}
        </div>
    );
};

export default function MetarCards({ airports }) {
    if (!airports || airports.length === 0) return null;

    return (
        <div style={{ marginBottom: 'var(--space-2)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Current Weather at Latest Destinations</h3>
            <div className="metar-cards-container" style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                {airports.map((airportInfo, i) => (
                    <MetarCard key={`${airportInfo.icao}-${i}`} airportInfo={airportInfo} />
                ))}
            </div>
        </div>
    );
}
