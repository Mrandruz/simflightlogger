import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Plane, Globe, Award, Star, Shield, Zap, TrendingUp, MapPin, RefreshCw, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import airportsRaw from 'airport-data';
import customAirportsRaw from '../customAirports';

// Handle potential ESM/CJS import discrepancies for airport data
const airports = Array.isArray(airportsRaw) ? airportsRaw : (airportsRaw?.default || []);
const customAirports = Array.isArray(customAirportsRaw) ? customAirportsRaw : (customAirportsRaw?.default || []);

const ALLIANCE_MAP = {
  'United Airlines': 'Star Alliance', 'Lufthansa': 'Star Alliance', 'Air Canada': 'Star Alliance',
  'Singapore Airlines': 'Star Alliance', 'ANA': 'Star Alliance', 'Thai Airways': 'Star Alliance',
  'Turkish Airlines': 'Star Alliance', 'Swiss': 'Star Alliance', 'Austrian Airlines': 'Star Alliance',
  'Brussels Airlines': 'Star Alliance', 'TAP Air Portugal': 'Star Alliance', 'LOT Polish Airlines': 'Star Alliance',
  'Scandinavian Airlines': 'Star Alliance', 'Air China': 'Star Alliance', 'Shenzhen Airlines': 'Star Alliance',
  'Air India': 'Star Alliance', 'Copa Airlines': 'Star Alliance', 'Avianca': 'Star Alliance',
  'South African Airways': 'Star Alliance', 'Ethiopian Airlines': 'Star Alliance', 'Egyptair': 'Star Alliance',
  'Croatia Airlines': 'Star Alliance', 'Adria Airways': 'Star Alliance',
  'Air France': 'SkyTeam', 'KLM': 'SkyTeam', 'Delta Air Lines': 'SkyTeam', 'Alitalia': 'SkyTeam',
  'Korean Air': 'SkyTeam', 'China Southern': 'SkyTeam', 'China Eastern': 'SkyTeam',
  'Aeromexico': 'SkyTeam', 'Czech Airlines': 'SkyTeam', 'Air Europa': 'SkyTeam', 'TAROM': 'SkyTeam',
  'Vietnam Airlines': 'SkyTeam', 'Garuda Indonesia': 'SkyTeam', 'Middle East Airlines': 'SkyTeam',
  'Kenya Airways': 'SkyTeam', 'Saudia': 'SkyTeam', 'Etihad': 'SkyTeam',
  'American Airlines': 'Oneworld', 'British Airways': 'Oneworld', 'Iberia': 'Oneworld',
  'Cathay Pacific': 'Oneworld', 'Qatar Airways': 'Oneworld', 'Japan Airlines': 'Oneworld',
  'Finnair': 'Oneworld', 'Malaysia Airlines': 'Oneworld', 'Royal Jordanian': 'Oneworld',
  'Royal Air Maroc': 'Oneworld', 'Alaska Airlines': 'Oneworld', 'SriLankan Airlines': 'Oneworld',
};

const findAirport = (icao) => {
    if (!icao) return null;
    const code = icao.toUpperCase();
    return airports.find(a => a && a.icao === code) || customAirports.find(a => a && a.icao === code);
};

const haversineNm = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
};

const MAJOR_DESTINATIONS = [
    'KATL', 'KLAX', 'KORD', 'KDFW', 'KDEN', 'KJFK', 'KSFO', 'KLAS', 'KMIA', 'KIAH',
    'KEWR', 'KSEA', 'KBOS', 'KPHX', 'KMCO', 'KFLL', 'KIAD', 'CYYZ', 'CYVR', 'CYUL',
    'MMMX', 'MMUN', 'EGLL', 'LFPG', 'EHAM', 'EDDF', 'LEMD', 'LEBL', 'LIRF', 'LSZH',
    'EDDM', 'LOWW', 'EKCH', 'ESSA', 'ENGM', 'EFHK', 'LPPT', 'LGAV', 'LTFM', 'LIMC',
    'EIDW', 'EGKK', 'EGCC', 'EDDL', 'EDDB', 'EBBR', 'EPWA', 'LKPR', 'LHBP', 'UUEE',
    'OMDB', 'OERK', 'OTHH', 'OMAA', 'LLBG', 'ZBAA', 'ZSPD', 'ZGGG', 'VHHH', 'RCTP',
    'RJTT', 'RJAA', 'RKSI', 'WSSS', 'VTBS', 'RPLL', 'WIII', 'WMKK', 'VIDP', 'VABB',
    'YSSY', 'YMML', 'NZAA', 'FAOR', 'HECA', 'GMMN', 'HKJK',
    'SBGR', 'SCEL', 'SAEZ', 'SKBO', 'SEQM', 'SPJC'
];

export default function Schedule({ flights = [] }) {
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState({});

    const analysis = useMemo(() => {
        const res = {
            visitedAirports: new Set(),
            visitedCountries: new Set(),
            longHaulCount: 0,
            allianceLastFlights: { 'Star Alliance': null, 'SkyTeam': null, 'Oneworld': null },
            allianceFlightCounts: { 'Star Alliance': 0, 'SkyTeam': 0, 'Oneworld': 0 },
        };

        if (!Array.isArray(flights)) return res;

        flights.forEach(f => {
            if (!f) return;
            const depCode = String(f.departure || '').toUpperCase();
            const arrCode = String(f.arrival || '').toUpperCase();
            if (depCode) res.visitedAirports.add(depCode);
            if (arrCode) res.visitedAirports.add(arrCode);

            const depAp = findAirport(depCode);
            const arrAp = findAirport(arrCode);
            if (depAp?.country) res.visitedCountries.add(depAp.country);
            if (arrAp?.country) res.visitedCountries.add(arrAp.country);

            const distance = Number(f.distance) || 0;
            if (distance > 5000) res.longHaulCount++;

            let alliance = null;
            if (f.airline === 'ITA Airways') {
                alliance = new Date(f.date) >= new Date('2024-11-01') ? 'Star Alliance' : 'SkyTeam';
            } else {
                alliance = ALLIANCE_MAP[f.airline];
            }

            if (alliance && res.allianceLastFlights.hasOwnProperty(alliance)) {
                res.allianceFlightCounts[alliance]++;
                if (!res.allianceLastFlights[alliance] || new Date(f.date) > new Date(res.allianceLastFlights[alliance].date)) {
                    res.allianceLastFlights[alliance] = f;
                }
            }
        });
        return res;
    }, [flights]);

    const generateAllianceSuggestions = (allianceName) => {
        try {
            const lastFlight = analysis.allianceLastFlights[allianceName];
            if (!lastFlight || !lastFlight.arrival) return [];

            const originCode = String(lastFlight.arrival).toUpperCase();
            const originAp = findAirport(originCode);
            if (!originAp || originAp.latitude == null) return [];

            const ranges = [
                { type: 'SHORT', min: 300, max: 1500, label: 'SHORT', color: '#10b981' },
                { type: 'MEDIUM', min: 1500, max: 4000, label: 'MEDIUM', color: '#3b82f6' },
                { type: 'LONG', min: 4500, max: 9000, label: 'LONG', color: '#f59e0b' }
            ];

            const allPossibleDests = MAJOR_DESTINATIONS
                .map(icao => findAirport(icao))
                .filter(ap => ap && ap.icao && ap.latitude != null);

            return ranges.map(range => {
                try {
                    let candidates = allPossibleDests.filter(ap => {
                        if (ap.icao === originCode) return false;
                        const d = haversineNm(originAp.latitude, originAp.longitude, ap.latitude, ap.longitude);
                        return d >= range.min && d <= range.max;
                    }).map(ap => ({
                        icao: ap.icao,
                        name: ap.name,
                        city: ap.city,
                        country: ap.country,
                        latitude: ap.latitude,
                        longitude: ap.longitude,
                        distance: haversineNm(originAp.latitude, originAp.longitude, ap.latitude, ap.longitude)
                    }));

                    if (candidates.length === 0) return null;

                    candidates.sort((a, b) => {
                        const aVisited = analysis.visitedAirports.has(a.icao);
                        const bVisited = analysis.visitedAirports.has(b.icao);
                        if (aVisited !== bVisited) return aVisited ? 1 : -1;

                        if (range.type === 'LONG' && analysis.longHaulCount < 120) {
                            return b.distance - a.distance;
                        }
                        return Math.random() - 0.5;
                    });

                    const best = candidates[0];
                    if (!best) return null;

                    const durationHrs = best.distance / 450;
                    const h = Math.floor(durationHrs);
                    const m = Math.round((durationHrs - h) * 60);
                    const xp = Math.floor((best.distance / 10) + (durationHrs * 50));

                    const airlines = Object.entries(ALLIANCE_MAP)
                        .filter(([k, v]) => v === allianceName)
                        .map(([k]) => k);
                    const airline = airlines[Math.floor(Math.random() * airlines.length)] || allianceName;

                    return {
                        ...range,
                        dest: best,
                        origin: originAp,
                        airline,
                        duration: `${h}h ${m}m`,
                        xp,
                        achievement: range.type === 'LONG' ? "Long Haul Ace ✈️" : 
                                    (analysis.visitedAirports.has(best.icao) ? null : "World Traveler 🌍")
                    };
                } catch (e) {
                    console.error('Schedule: Range error', e);
                    return null;
                }
            }).filter(Boolean);
        } catch (e) {
            console.error('Schedule: Alliance error', e);
            return [];
        }
    };

    useEffect(() => {
        if (flights && flights.length > 0 && Object.keys(suggestions).length === 0) {
            const s = {};
            ['Star Alliance', 'SkyTeam', 'Oneworld'].forEach(al => {
                s[al] = generateAllianceSuggestions(al);
            });
            setSuggestions(s);
        }
    }, [flights, analysis]);

    const alliances = [
        { name: 'Star Alliance', color: '#1a1a2e' },
        { name: 'SkyTeam', color: '#003087' },
        { name: 'Oneworld', color: '#c00' }
    ];

    if (!flights || flights.length === 0) {
        return (
            <div className="schedule-page">
                <header className="page-header">
                    <h1 className="page-title"><Calendar className="title-icon" /> Flight Schedule</h1>
                </header>
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p>No flights logged yet. Add your first flight to get started.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="schedule-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title"><Calendar className="title-icon" /> Flight Schedule</h1>
                    <p className="page-subtitle">Personalized route suggestions based on your logbook history and airline alliances.</p>
                </div>
            </header>

            <div className="alliance-sections">
                {alliances.map(alliance => {
                    const lastFlight = analysis.allianceLastFlights[alliance.name];
                    const allianceSuggestions = suggestions[alliance.name] || [];
                    const count = analysis.allianceFlightCounts[alliance.name];
                    const totalXp = allianceSuggestions.reduce((acc, s) => acc + (s.xp || 0), 0);

                    if (!lastFlight) return null;

                    return (
                        <section key={alliance.name} className="alliance-section">
                            <div className="alliance-header" style={{ borderLeft: `6px solid ${alliance.color}` }}>
                                <div className="header-main">
                                    <h2 className="alliance-title" style={{ color: alliance.color }}>{alliance.name}</h2>
                                    <p className="alliance-subtitle">
                                        Departing from <strong>{String(lastFlight.arrival).toUpperCase()}</strong> — {findAirport(lastFlight.arrival)?.name || lastFlight.arrival}
                                    </p>
                                </div>
                                <div className="header-badge">
                                    <Plane size={14} />
                                    <span>{count} flights</span>
                                </div>
                            </div>

                            <div className="flight-cards-grid">
                                {allianceSuggestions.map(s => (
                                    <div key={s.type} className="flight-suggestion-card card">
                                        <div className="card-top">
                                            <span className="type-badge" style={{ backgroundColor: s.color }}>{s.label}</span>
                                            <span className="airline-tag">{s.airline}</span>
                                        </div>
                                        <div className="route-container">
                                            <div className="airport-info">
                                                <span className="icao">{s.origin.icao}</span>
                                                <span className="name">{s.origin.name}</span>
                                            </div>
                                            <div className="route-arrow">→</div>
                                            <div className="airport-info">
                                                <span className="icao">{s.dest.icao}</span>
                                                <span className="name">{s.dest.name}</span>
                                            </div>
                                        </div>
                                        <div className="flight-meta-grid">
                                            <div className="meta-item"><TrendingUp size={14} /><span>{s.dest.distance.toLocaleString()} nm</span></div>
                                            <div className="meta-item"><Plane size={14} /><span>{s.duration}</span></div>
                                            <div className="meta-item xp"><Zap size={14} /><span>+{s.xp} XP</span></div>
                                        </div>
                                        {s.achievement && <div className="achievement-helper">Help: <strong>{s.achievement}</strong></div>}
                                        <button onClick={() => navigate('/new-flight', { state: { prefillData: { departure: s.origin.icao, arrival: s.dest.icao, airline: '', miles: s.dest.distance, alliance: alliance.name } } })} className="btn btn-primary add-button">
                                            <Plus size={16} /> Add to Logbook
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="alliance-footer">
                                <div className="footer-info">Complete all 3 flights to earn up to <strong>{totalXp} XP</strong></div>
                                <button onClick={() => setSuggestions(prev => ({ ...prev, [alliance.name]: generateAllianceSuggestions(alliance.name) }))} className="btn regenerate-button">
                                    <RefreshCw size={14} /> Regenerate
                                </button>
                            </div>
                        </section>
                    );
                })}
            </div>

            <style>{`.schedule-page{animation:fadeIn .5s ease-out;max-width:1200px;margin:0 auto}.alliance-sections{display:flex;flex-direction:column;gap:var(--space-10);margin-top:var(--space-8)}.alliance-section{display:flex;flex-direction:column;gap:var(--space-6)}.alliance-header{display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) var(--space-4);background:var(--color-surface);border-radius:var(--radius-md);box-shadow:var(--shadow-sm)}.alliance-title{font-size:1.5rem;font-weight:800;margin:0;letter-spacing:-.5px}.alliance-subtitle{font-size:.9rem;color:var(--color-text-secondary);margin:0}.header-badge{display:flex;align-items:center;gap:6px;padding:6px 14px;background:var(--color-surface-hover);border-radius:var(--radius-full);font-size:.8rem;font-weight:600;color:var(--color-primary);border:1px solid var(--color-border)}.flight-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--space-6)}.flight-suggestion-card{padding:var(--space-6);display:flex;flex-direction:column;gap:var(--space-5);transition:all .3s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}.flight-suggestion-card:hover{transform:translateY(-4px);border-color:var(--color-primary);box-shadow:var(--shadow-lg)}.card-top{display:flex;justify-content:space-between;align-items:center}.type-badge{font-size:.65rem;font-weight:800;color:#fff;padding:3px 10px;border-radius:4px;letter-spacing:.5px}.airline-tag{font-size:.75rem;font-weight:600;color:var(--color-text-hint)}.route-container{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding:var(--space-4);background:var(--color-surface-hover);border-radius:var(--radius-lg)}.airport-info{display:flex;flex-direction:column;flex:1;min-width:0}.icao{font-family:var(--font-family-mono);font-weight:800;font-size:1.2rem;color:var(--color-text-primary)}.name{font-size:.7rem;color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.route-arrow{color:var(--color-text-hint);font-weight:800}.flight-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.meta-item{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);font-size:.75rem;font-weight:600;color:var(--color-text-secondary)}.meta-item.xp{color:var(--color-success);background:rgba(var(--color-success-rgb),.05);border-color:rgba(var(--color-success-rgb),.2)}.achievement-helper{font-size:.75rem;text-align:center;padding:6px;background:rgba(var(--color-primary-rgb),.05);color:var(--color-primary);border-radius:var(--radius-md);font-weight:500}.add-button{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;font-size:.9rem;font-weight:700}.alliance-footer{display:flex;justify-content:space-between;align-items:center;padding:var(--space-4);background:var(--color-surface-hover);border-radius:var(--radius-lg)}.footer-info{font-size:.9rem;color:var(--color-text-secondary)}.regenerate-button{display:flex;align-items:center;gap:6px;padding:6px 16px;font-size:.8rem;font-weight:600;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-hint);transition:all .2s}.regenerate-button:hover{color:var(--color-primary);border-color:var(--color-primary)}@media (max-width:768px){.alliance-header{flex-direction:column;align-items:flex-start;gap:var(--space-3)}.header-badge{width:100%;justify-content:center}.flight-meta-grid{grid-template-columns:1fr}.alliance-footer{flex-direction:column;gap:var(--space-3);text-align:center}}`}</style>
        </div>
    );
}
