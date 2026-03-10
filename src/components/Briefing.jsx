import React, { useMemo, useState, useEffect } from 'react';
import { Wind, Thermometer, Droplets, Gauge, Plane, PlaneTakeoff, Globe } from 'lucide-react';
import airports from 'airport-data';
import customAirports from '../customAirports';
import SuggestedRoutes from './SuggestedRoutes';
import MetarCards from './MetarCards';
import { getAllianceByAirline } from '../airlineAlliances';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

// Find airport by IATA code
const findAirportByIata = (iata) => {
    return airports.find(a => a.iata === iata) || customAirports.find(a => a.iata === iata);
};
const getAllianceColor = (alliance) => {
    const colors = {
        'Star Alliance': '#3A3A3A',
        'SkyTeam': '#4775D1',
        'Oneworld': '#D66A5A'
    };
    return colors[alliance] || '#3A3A3A';
};
// Haversine distance in nautical miles
const haversineNm = (lat1, lon1, lat2, lon2) => {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
};

// Major international airport ICAO codes
const MAJOR_ICAOS = new Set([
    'KATL', 'KLAX', 'KORD', 'KDFW', 'KDEN', 'KJFK', 'KSFO', 'KLAS', 'KMIA', 'KIAH',
    'KEWR', 'KSEA', 'KBOS', 'KPHX', 'KMCO', 'KFLL', 'KIAD', 'CYYZ', 'CYVR', 'CYUL',
    'MMMX', 'MMUN', 'EGLL', 'LFPG', 'EHAM', 'EDDF', 'LEMD', 'LEBL', 'LIRF', 'LSZH',
    'EDDM', 'LOWW', 'EKCH', 'ESSA', 'ENGM', 'EFHK', 'LPPT', 'LGAV', 'LTFM', 'LIMC',
    'EIDW', 'EGKK', 'EGCC', 'EDDL', 'EDDB', 'EBBR', 'EPWA', 'LKPR', 'LHBP', 'UUEE',
    'OMDB', 'OERK', 'OTHH', 'OMAA', 'LLBG', 'ZBAA', 'ZSPD', 'ZGGG', 'VHHH', 'RCTP',
    'RJTT', 'RJAA', 'RKSI', 'WSSS', 'VTBS', 'RPLL', 'WIII', 'WMKK', 'VIDP', 'VABB',
    'YSSY', 'YMML', 'NZAA', 'FAOR', 'HECA', 'GMMN', 'HKJK',
    'SBGR', 'SCEL', 'SAEZ', 'SKBO', 'SEQM', 'SPJC',
]);

const majorAirports = airports.filter(a =>
    a.icao && MAJOR_ICAOS.has(a.icao) && a.latitude && a.longitude && a.name
);

// Generate fallback suggestions when API fails
const generateFallbackSuggestions = (alliance, airport) => {
    const shortHaul = majorAirports
        .filter(dest => dest.icao !== airport.icao)
        .map(dest => ({
            ...dest,
            distance: haversineNm(airport.lat, airport.lon, dest.latitude, dest.longitude)
        }))
        .filter(d => d.distance >= 200 && d.distance <= 800)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(dest => ({ ...dest, duration: Math.round(dest.distance / 450 * 60), alliance, airline: 'N/A', airlineName: 'N/A' }));

    const mediumHaul = majorAirports
        .filter(dest => dest.icao !== airport.icao)
        .map(dest => ({
            ...dest,
            distance: haversineNm(airport.lat, airport.lon, dest.latitude, dest.longitude)
        }))
        .filter(d => d.distance > 800 && d.distance <= 2500)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(dest => ({ ...dest, duration: Math.round(dest.distance / 450 * 60), alliance, airline: 'N/A', airlineName: 'N/A' }));

    const longHaul = majorAirports
        .filter(dest => dest.icao !== airport.icao)
        .map(dest => ({
            ...dest,
            distance: haversineNm(airport.lat, airport.lon, dest.latitude, dest.longitude)
        }))
        .filter(d => d.distance > 2500)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(dest => ({ ...dest, duration: Math.round(dest.distance / 500 * 60), alliance, airline: 'N/A', airlineName: 'N/A' }));

    return {
        departure: airport,
        shortHaul,
        mediumHaul,
        longHaul,
        loading: false
    };
};

const ALLIANCES = ['Star Alliance', 'SkyTeam', 'Oneworld'];

export default function Briefing({ flights }) {
    const [allianceSuggestions, setAllianceSuggestions] = useState({});

    // Calculates the last arrival airport for each alliance
    const lastArrivalByAlliance = useMemo(() => {
        const sortedFlights = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
        const result = {};

        for (const f of sortedFlights) {
            if (!f.alliance || result[f.alliance]) continue;
            const icao = f.arrival ? f.arrival.toUpperCase() : null;
            if (!icao) continue;
            const airportData = findAirport(icao);
            if (!airportData) continue;
            const city = airportData.city || airportData.name.split(',')[0] || airportData.name;
            result[f.alliance] = {
                icao,
                city,
                alliance: f.alliance,
                lat: airportData.latitude,
                lon: airportData.longitude,
                tz: airportData.tz,
                timezone: airportData.timezone,
                iata: airportData.iata || (icao.length === 4 && icao.startsWith('K') ? icao.substring(1) : '')
            };
        }
        return result;
    }, [flights]);

    // openflights routes cache
    const openFlightsCache = React.useRef({});

    const fetchOpenFlightsFor = async (iata) => {
        if (openFlightsCache.current[iata]) return openFlightsCache.current[iata];
        try {
            const res = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat');
            const text = await res.text();
            const lines = text.split('\n');
            const routes = lines.map(l => l.split(',')).filter(a => a.length >= 6).map(cols => ({
                airline: cols[0].replace(/"/g, ''),
                airlineId: cols[1],
                source: cols[2].replace(/"/g, ''),
                sourceId: cols[3],
                dest: cols[4].replace(/"/g, ''),
                destId: cols[5]
            }));
            openFlightsCache.current[iata] = routes;
            return routes;
        } catch (e) {
            console.warn('Failed to load OpenFlights data', e);
            return [];
        }
    };

    // Fetch real flight data from Aviationstack API or fallback to OpenFlights CSV
    useEffect(() => {
        const fetchRealRoutes = async () => {
            const suggestions = {};
            const API_KEY = '83a07a029aebc51d34077fbc46e8b8d6';

            for (const [alliance, airport] of Object.entries(lastArrivalByAlliance)) {
                let allianceRoutes = [];
                const iataCode = airport.iata || (airport.icao.startsWith('K') ? airport.icao.substring(1) : airport.icao.substring(1));
                try {
                    const response = await fetch(
                        `/api/aviationstack/routes?departure_airport_iata=${iataCode}&limit=100&access_key=${API_KEY}`
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (!data.error) {
                            const routes = data.data || [];
                            allianceRoutes = routes
                                .filter(route => getAllianceByAirline(route.airline_iata) === alliance)
                                .map(route => {
                                    const destCode = route.arrival_airport_iata;
                                    const destAirport = findAirportByIata(destCode);
                                    if (!destAirport) return null;
                                    const distance = haversineNm(
                                        airport.lat,
                                        airport.lon,
                                        destAirport.latitude,
                                        destAirport.longitude
                                    );
                                    return {
                                        icao: destAirport.icao,
                                        iata: destCode,
                                        name: destAirport.name,
                                        city: destAirport.city || destAirport.name,
                                        latitude: destAirport.latitude,
                                        longitude: destAirport.longitude,
                                        distance,
                                        duration: Math.round(distance / 450 * 60),
                                        alliance,
                                        airline: route.airline_iata,
                                        airlineName: route.airline_name
                                    };
                                })
                                .filter(r => r !== null);
                        }
                    }
                } catch (err) {
                    console.warn('Aviationstack request failed', err);
                }

                let hasLongHaul = allianceRoutes.some(r => r.distance > 2500);

                if (!hasLongHaul || allianceRoutes.length < 5) {
                    // fallback to dataset
                    const lines = await fetchOpenFlightsFor(iataCode);
                    const openFlightsRoutes = lines
                        .filter(r => r.source === iataCode)
                        .filter(r => getAllianceByAirline(r.airline) === alliance)
                        .map(r => {
                            const destAirport = findAirportByIata(r.dest);
                            if (!destAirport) return null;
                            const distance = haversineNm(
                                airport.lat,
                                airport.lon,
                                destAirport.latitude,
                                destAirport.longitude
                            );
                            return {
                                icao: destAirport.icao,
                                iata: r.dest,
                                name: destAirport.name,
                                city: destAirport.city || destAirport.name,
                                latitude: destAirport.latitude,
                                longitude: destAirport.longitude,
                                distance,
                                duration: Math.round(distance / 450 * 60),
                                alliance,
                                airline: r.airline,
                                airlineName: r.airline
                            };
                        })
                        .filter(x => x);

                    // Merge, avoiding duplicates
                    const existingIcaos = new Set(allianceRoutes.map(r => r.icao));
                    for (const route of openFlightsRoutes) {
                        if (!existingIcaos.has(route.icao)) {
                            allianceRoutes.push(route);
                            existingIcaos.add(route.icao);
                        }
                    }
                }

                // categorize
                const shortHaul = allianceRoutes.filter(r => r.distance >= 200 && r.distance <= 800).slice(0, 3);
                const mediumHaul = allianceRoutes.filter(r => r.distance > 800 && r.distance <= 2500).slice(0, 3);
                const longHaul = allianceRoutes.filter(r => r.distance > 2500).slice(0, 3);

                suggestions[alliance] = {
                    departure: airport,
                    shortHaul,
                    mediumHaul,
                    longHaul,
                    loading: false
                };
            }

            setAllianceSuggestions(suggestions);
        };

        if (Object.keys(lastArrivalByAlliance).length > 0) {
            fetchRealRoutes();
        }
    }, [lastArrivalByAlliance]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Suggested Routes */}
            <SuggestedRoutes flights={flights} />

            {/* Weather Feed for alliance airports */}
            {Object.values(lastArrivalByAlliance).length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Weather Feed</h3>
                    <MetarCards airports={Object.values(lastArrivalByAlliance)} />
                </div>
            )}

            {/* Flight suggestions grouped by alliance */}
            {Object.keys(allianceSuggestions).length > 0 && (
                <div>
                    <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Flight Suggestions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {Object.entries(allianceSuggestions).map(([alliance, suggestion]) => (
                            <div key={alliance} className="card" style={{ padding: 'var(--space-4)' }}>
                                <div style={{
                                    marginBottom: 'var(--space-4)',
                                    padding: 'var(--space-3)',
                                    backgroundColor: getAllianceColor(alliance) + '15',
                                    borderRadius: '6px',
                                    borderLeft: `4px solid ${getAllianceColor(alliance)}`
                                }}>
                                    <h4 style={{
                                        margin: 0,
                                        fontSize: '1.2rem',
                                        fontFamily: 'var(--font-family-sans)',
                                        fontWeight: 700,
                                        color: getAllianceColor(alliance)
                                    }}>
                                        {alliance} – last arrival {suggestion.departure.icao} ({suggestion.departure.city})
                                    </h4>
                                </div>

                                {/* Short Haul */}
                                {suggestion.shortHaul.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-4)' }}>
                                        <h5 style={{
                                            margin: '0 0 var(--space-3) 0',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: 'var(--color-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <Plane size={18} />
                                            Short Haul (200-800 nm)
                                        </h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                                            {suggestion.shortHaul.map((dest, destIndex) => (
                                                <FlightSuggestionCard key={destIndex} destination={dest} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Medium Haul */}
                                {suggestion.mediumHaul.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-4)' }}>
                                        <h5 style={{
                                            margin: '0 0 var(--space-3) 0',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: 'var(--color-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <PlaneTakeoff size={18} />
                                            Medium Haul (800-2500 nm)
                                        </h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                                            {suggestion.mediumHaul.map((dest, destIndex) => (
                                                <FlightSuggestionCard key={destIndex} destination={dest} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Long Haul */}
                                {suggestion.longHaul.length > 0 && (
                                    <div>
                                        <h5 style={{
                                            margin: '0 0 var(--space-3) 0',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: 'var(--color-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <Globe size={18} />
                                            Long Haul (2500+ nm)
                                        </h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                                            {suggestion.longHaul.map((dest, destIndex) => (
                                                <FlightSuggestionCard key={destIndex} destination={dest} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

// Component for each flight suggestion
const FlightSuggestionCard = ({ destination }) => {
    const [metar, setMetar] = React.useState(null);
    const [taf, setTaf] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    // airline info will be passed via destination.airlineName
    const airlineName = destination.airlineName || '';

    React.useEffect(() => {
        let isMounted = true;
        const fetchMetar = async () => {
            if (!destination.icao) return;
            setLoading(true);
            try {
                const [metarRes, tafRes] = await Promise.all([
                    fetch(`/api/metar?ids=${destination.icao}&format=json`),
                    fetch(`/api/taf?ids=${destination.icao}&format=json`)
                ]);
                const metarData = await metarRes.json();
                const tafData = await tafRes.json();
                if (isMounted) {
                    if (metarData && metarData.length > 0) setMetar(metarData[0]);
                    if (tafData && tafData.length > 0) {
                        // raw field may be named rawTAF
                        const raw = tafData[0].raw || tafData[0].rawTAF || tafData[0].TAF || tafData[0];
                        setTaf(typeof raw === 'string' ? raw : JSON.stringify(raw));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch weather for', destination.icao, error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMetar();
    }, [destination.icao]);

    const city = destination.city || destination.name.split(',')[0] || destination.name;

    // No further processing needed: use API fields directly (altim, wdir, wspd, temp, dewp)

    const allianceColor = getAllianceColor(destination.alliance);

    return (
        <div style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '4px',
            border: '1px solid var(--color-border)',
            borderLeft: `4px solid ${allianceColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h6 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)'
                    }}>
                        {destination.icao} - {city}
                    </h6>
                    <span style={{
                        display: 'inline-block',
                        fontSize: '0.65rem',
                        backgroundColor: allianceColor,
                        color: '#ffffff',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        marginTop: '4px'
                    }}>
                        {destination.alliance}
                    </span>
                    {airlineName && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Operated by {airlineName}
                        </div>
                    )}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {destination.distance} nm
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-hint)' }}>
                        ~{Math.floor(destination.duration / 60)}h {destination.duration % 60}m
                    </div>
                </div>
            </div>

            {/* Weather Metrics Grid */}
            {loading ? (
                <div style={{ color: 'var(--color-text-hint)', textAlign: 'center', padding: 'var(--space-2)' }}>
                    Loading weather...
                </div>
            ) : metar ? (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2)',
                    backgroundColor: 'var(--color-bg)',
                    borderRadius: '3px',
                    border: '1px solid var(--color-border)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Gauge size={20} style={{ color: '#146AFF', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Air Pressure</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.altim !== undefined ? `${Math.round(metar.altim)} hPa` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Wind size={20} style={{ color: '#00CDFF', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Wind</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.wdir !== undefined ? `${metar.wdir}°` : '--'}/{metar.wspd !== undefined ? `${metar.wspd}kt` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Thermometer size={20} style={{ color: '#EF5746', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Temp</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.temp !== undefined ? `${Math.round(metar.temp)}°C` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Droplets size={20} style={{ color: '#3CC47D', marginBottom: '6px' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', marginBottom: '2px' }}>Dew Point</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className="data-mono">{metar.dewp !== undefined ? `${Math.round(metar.dewp)}°C` : '--'}</span>
                    </div>
                </div>
            ) : (
                <div style={{
                    color: 'var(--color-text-hint)',
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    padding: 'var(--space-2)'
                }}>
                    Weather data unavailable
                </div>
            )}

            {/* TAF text */}
            {taf && (
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'monospace',
                    padding: '4px 8px',
                    backgroundColor: 'var(--color-bg)',
                    borderRadius: '2px',
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap'
                }}>
                    {taf}
                </div>
            )}
        </div>
    );
};

// Helper component for weather metrics
const WeatherMetric = ({ icon: Icon, label, value, unit }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
        }}>
            <Icon size={20} style={{ color: 'var(--color-primary)' }} />
            <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-hint)',
                textAlign: 'center',
                lineHeight: '1.2'
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                textAlign: 'center'
            }}>
                {value}
            </div>
            {unit && (
                <div style={{
                    fontSize: '0.65rem',
                    color: 'var(--color-text-secondary)'
                }}>
                    {unit}
                </div>
            )}
        </div>
    );
};