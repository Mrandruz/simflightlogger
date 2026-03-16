import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Plane, Globe, Award, Star, Shield, Zap, TrendingUp, MapPin, RefreshCw, Plus, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { findAirport } from '../utils/airportUtils';


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
    'SBGR', 'SCEL', 'SAEZ', 'SKBO', 'SEQM', 'SPJC',
    // Added for more variety
    'KMSP', 'KDTW', 'KPHL', 'KBWI', 'KSLC', 'KPDX', 'KMDW', 'KCLT', 'KCLE',
    'CYC', 'CYYC', 'CYEG', 'LFMN', 'LFSB', 'LSGG', 'EDDS', 'EDDH', 'EDDV',
    'LIPE', 'LICC', 'LEPA', 'LEMG', 'LPPR', 'LIME', 'LIRQ', 'LEZL', 'LIML',
    'OEJN', 'OKBK', 'OBBI', 'ZGSZ', 'ZUCK', 'VMMC', 'VVTS', 'VTCC', 'VHHH',
    'RPVM', 'WABD', 'WAAA', 'WSAP', 'YBBN', 'YPPH', 'NZCH', 'NZQN',
    'KATK', 'PHNL', 'PANC', 'PAFA', 'SBGL', 'SBRJ', 'SUMU', 'SPQU'
];

export default function Schedule({ flights = [], user }) {
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState({});
    const [loadingPersistence, setLoadingPersistence] = useState(true);

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

            let alliance = f.alliance;
            if (!alliance) {
                if (f.airline === 'ITA Airways') {
                    alliance = new Date(f.date) >= new Date('2024-11-01') ? 'Star Alliance' : 'SkyTeam';
                } else {
                    alliance = ALLIANCE_MAP[f.airline];
                }
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

    const generateAllianceSuggestions = (allianceName, forceRandom = false) => {
        try {
            const lastFlight = analysis.allianceLastFlights[allianceName];
            if (!lastFlight || !lastFlight.arrival) return [];

            const originCode = String(lastFlight.arrival).toUpperCase();
            const originAp = findAirport(originCode);
            if (!originAp || originAp.latitude == null) return [];

            const ranges = [
                { type: 'SHORT', min: 300, max: 1500, label: 'SHORT', color: '#10b981' },
                { type: 'MEDIUM', min: 1500, max: 3000, label: 'MEDIUM', color: '#3b82f6' },
                { type: 'LONG', min: 3000, max: 9000, label: 'LONG', color: '#f59e0b' }
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
                        if (forceRandom) {
                            return Math.random() - 0.5;
                        }

                        const aVisited = analysis.visitedAirports.has(a.icao);
                        const bVisited = analysis.visitedAirports.has(b.icao);
                        if (aVisited !== bVisited) return aVisited ? 1 : -1;

                        if (range.type === 'LONG' && analysis.longHaulCount < 120) {
                            return b.distance - a.distance;
                        }

                        // Stable sort fallback instead of Math.random() for initial load/sync
                        return a.distance - b.distance || a.icao.localeCompare(b.icao);
                    });

                    const best = candidates[0];
                    if (!best) return null;

                    const durationHrs = best.distance / 450;
                    const h = Math.floor(durationHrs);
                    const m = Math.round((durationHrs - h) * 60);
                    const baseXP = Math.floor((best.distance / 10) + (durationHrs * 50) + 250);
                    
                    // Solution 1: XP Multipliers for Active Piloting (Logic now global, but kept here for UI preview)
                    let xpMultiplier = 1;
                    if (range.type === 'SHORT') xpMultiplier = 1.5;
                    else if (range.type === 'MEDIUM') xpMultiplier = 1.25;
                    
                    const totalXP = Math.round(baseXP * xpMultiplier);
                    const xpBoost = totalXP - baseXP;

                    let achievement = null;
                    if (range.type === 'LONG') {
                        achievement = "Long Haul Ace ✈️";
                    } else if (!analysis.visitedCountries.has(best.country)) {
                        achievement = "World Traveler 🌍";
                    } else if (!analysis.visitedAirports.has(best.icao)) {
                        achievement = "New Discovery 📍";
                    }

                    return {
                        ...range,
                        dest: best,
                        origin: originAp,
                        duration: `${h}h ${m}m`,
                        baseXP,
                        xpBoost,
                        xp: totalXP,
                        xpMultiplier,
                        achievement
                    };
                } catch (e) {
                    console.error(`Schedule: Range error (${range.type})`, e);
                    return null;
                }
            }).filter(Boolean);
        } catch (e) {
            console.error('Schedule: Alliance error', e);
            return [];
        }
    };

    useEffect(() => {
        const fetchAndSyncSuggestions = async () => {
            if (!user) return;
            setLoadingPersistence(true);

            try {
                // Fallback: Generate local suggestions FIRST so the user sees SOMETHING immediately
                const localSuggestions = {};
                ['Star Alliance', 'SkyTeam', 'Oneworld'].forEach(al => {
                    localSuggestions[al] = generateAllianceSuggestions(al);
                });
                setSuggestions(localSuggestions);

                // Then try to sync with Firestore
                const scheduleRef = doc(db, 'users', user.uid, 'settings', 'schedule');
                const scheduleSnap = await getDoc(scheduleRef);

                if (scheduleSnap.exists()) {
                    const persistedData = scheduleSnap.data();
                    const syncedSuggestions = { ...localSuggestions };
                    let needsSyncUpdate = false;

                    ['Star Alliance', 'SkyTeam', 'Oneworld'].forEach(al => {
                        const lastFlight = analysis.allianceLastFlights[al];
                        const currentBase = lastFlight?.arrival?.toUpperCase() || null;
                        const persistedBase = persistedData[al]?.baseAirport;

                        // If the persisted base matches current reality, use the persisted routes
                        if (persistedBase && currentBase === persistedBase) {
                            syncedSuggestions[al] = persistedData[al].suggestions;
                        } else if (currentBase) {
                            // Otherwise, the local ones we just generated are better, but we should update Firestore
                            needsSyncUpdate = true;
                            persistedData[al] = {
                                baseAirport: currentBase,
                                suggestions: localSuggestions[al]
                            };
                        }
                    });

                    if (needsSyncUpdate) {
                        await setDoc(scheduleRef, persistedData, { merge: true });
                    }
                    setSuggestions(syncedSuggestions);
                } else {
                    // If no document exists, save the local ones we just generated
                    const initialData = {};
                    ['Star Alliance', 'SkyTeam', 'Oneworld'].forEach(al => {
                        const lastFlight = analysis.allianceLastFlights[al];
                        initialData[al] = {
                            baseAirport: lastFlight?.arrival?.toUpperCase() || null,
                            suggestions: localSuggestions[al]
                        };
                    });
                    await setDoc(scheduleRef, initialData);
                }
            } catch (error) {
                console.error('Schedule: Sync error', error);
                // On error, we already called setSuggestions(localSuggestions) so the UI is not empty
            } finally {
                setLoadingPersistence(false);
            }
        };

        if (flights && flights.length > 0) {
            fetchAndSyncSuggestions();
        } else {
            setLoadingPersistence(false);
        }
    }, [flights, analysis, user]);

    const handleRegenerate = async (allianceName) => {
        const newS = generateAllianceSuggestions(allianceName, true);
        setSuggestions(prev => ({ ...prev, [allianceName]: newS }));

        if (user) {
            try {
                const scheduleRef = doc(db, 'users', user.uid, 'settings', 'schedule');
                const lastFlight = analysis.allianceLastFlights[allianceName];
                const currentBase = lastFlight?.arrival?.toUpperCase() || null;

                await setDoc(scheduleRef, {
                    [allianceName]: {
                        baseAirport: currentBase,
                        suggestions: newS
                    }
                }, { merge: true });
            } catch (error) {
                console.error('Error saving regenerated suggestions:', error);
            }
        }
    };


    const alliances = [
        { name: 'Star Alliance', color: 'var(--color-alliance-star)' },
        { name: 'SkyTeam', color: 'var(--color-alliance-skyteam)' },
        { name: 'Oneworld', color: 'var(--color-alliance-oneworld)' }
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
                    // Solution 5: Use Max XP instead of Sum
                    const maxPossibleXp = allianceSuggestions.length > 0 
                        ? Math.max(...allianceSuggestions.map(s => s.xp || 0)) 
                        : 0;

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
                                            {/* Solution 2: Visual Merit Badges (with fallback for legacy data) */}
                                            {(s.xpMultiplier > 1 || (!s.xpMultiplier && (s.type === 'SHORT' || s.type === 'MEDIUM'))) && (
                                                <span className="intensity-badge">
                                                    <Zap size={10} /> {s.xpMultiplier || (s.type === 'SHORT' ? 1.5 : 1.25)}x ACTIVE PILOT
                                                </span>
                                            )}
                                        </div>
                                        <div className="route-container">
                                            <div className="airport-info has-tooltip">
                                                <span className="icao">{s.origin.icao}</span>
                                                <span className="name">{s.origin.name}</span>
                                                <div className="tooltip-box">{s.origin.name}</div>
                                            </div>
                                            <div className="route-arrow">→</div>
                                            <div className="airport-info has-tooltip">
                                                <span className="icao">{s.dest.icao}</span>
                                                <span className="name">{s.dest.name}</span>
                                                <div className="tooltip-box">{s.dest.name}</div>
                                            </div>
                                        </div>
                                        <div className="flight-meta-grid">
                                            <div className="meta-item"><TrendingUp size={14} /><span>{s.dest.distance.toLocaleString()} nm</span></div>
                                            <div className="meta-item"><Plane size={14} /><span>{s.duration}</span></div>
                                            <div className="meta-item xp has-tooltip">
                                                <Zap size={14} />
                                                <span>+{s.xp} XP</span>
                                                {s.xpBoost > 0 && (
                                                    <div className="tooltip-box">
                                                        Base: {s.baseXP} + Boost: {s.xpBoost}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {s.achievement && <div className="achievement-helper">Helps: <strong>{s.achievement}</strong></div>}
                                        <div className="card-actions">
                                            <button onClick={() => navigate('/new-flight', { state: { prefillData: { departure: s.origin.icao, arrival: s.dest.icao, airline: '', miles: s.dest.distance, alliance: alliance.name } } })} className="btn btn-primary add-button">
                                                <Plus size={16} /> Add to Logbook
                                            </button>
                                            <a href="https://dispatch.simbrief.com/options/new" target="_blank" rel="noopener noreferrer" className="btn simbrief-button">
                                                <ExternalLink size={14} /> SimBrief
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="alliance-footer">
                                <div className="footer-info">Select a flight to earn up to <strong>{maxPossibleXp} XP</strong></div>
                                <button onClick={() => handleRegenerate(alliance.name)} className="btn regenerate-button">
                                    <RefreshCw size={14} /> Regenerate
                                </button>
                            </div>
                        </section>
                    );
                })}
            </div>

            {loadingPersistence && (
                <div className="persistence-loader">
                    <RefreshCw size={16} className="spin" />
                    <span>Syncing Schedule...</span>
                </div>
            )}

            <style>{`.schedule-page{animation:fadeIn .5s ease-out;max-width:1600px;margin:0 auto}.alliance-sections{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-6);margin-top:var(--space-8);align-items:start;width:100%}.alliance-section{display:flex;flex-direction:column;gap:var(--space-4);height:100%;min-width:0}.alliance-header{display:flex;flex-direction:column;align-items:flex-start;gap:var(--space-2);padding:var(--space-4);background:var(--color-surface);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);border-left-width:6px;border-left-style:solid;min-width:0}.header-main{width:100%;min-width:0}.alliance-title{font-family:var(--font-family-display);font-size:1.3rem;font-weight:800;margin:0;letter-spacing:-.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.alliance-subtitle{font-size:.8rem;color:var(--color-text-secondary);margin-top:4px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.header-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--color-surface-hover);border-radius:var(--radius-full);font-size:.7rem;font-weight:600;color:var(--color-primary);border:1px solid var(--color-border);margin-top:8px}.flight-cards-grid{display:flex;flex-direction:column;gap:var(--space-4);min-width:0}.flight-suggestion-card{padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);transition:all .3s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden;min-width:0}.flight-suggestion-card:hover{transform:translateY(-2px);border-color:var(--color-primary);box-shadow:var(--shadow-md)}.card-top{display:flex;justify-content:space-between;align-items:center;min-width:0}.type-badge{font-family:var(--font-family-display);font-size:.6rem;font-weight:800;color:#fff;padding:2px 8px;border-radius:4px;letter-spacing:.5px}.airline-tag{font-size:.7rem;font-weight:600;color:var(--color-text-hint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.route-container{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-3);background:var(--color-surface-hover);border-radius:var(--radius-lg);min-width:0}.airport-info{display:flex;flex-direction:column;flex:1;min-width:0}.icao{font-family:var(--font-family-sans);font-weight:800;font-size:1.1rem;color:var(--color-text-primary);letter-spacing:.5px}.name{font-size:.65rem;color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.route-arrow{color:var(--color-text-hint);font-weight:800;font-size:.9rem;flex-shrink:0}.flight-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;min-width:0}.meta-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);font-size:.65rem;font-weight:600;color:var(--color-text-secondary);min-width:0}.meta-item span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.meta-item.xp{color:var(--color-success);background:rgba(var(--color-success-rgb),.05);border-color:rgba(var(--color-success-rgb),.2)}.achievement-helper{font-size:.7rem;text-align:center;padding:8px;background:rgba(var(--color-primary-rgb),.03);color:var(--color-primary);border:1px dashed rgba(var(--color-primary-rgb),.2);border-radius:var(--radius-md);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.add-button{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;font-size:.85rem;font-weight:700;flex:2;font-family:var(--font-family-display)}.card-actions{display:flex;gap:var(--space-2);width:100%}.simbrief-button{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;font-size:.75rem;font-weight:600;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-hint);text-decoration:none;transition:all .2s;flex:1}.simbrief-button:hover{color:var(--color-primary);border-color:var(--color-primary);background:var(--color-primary-light)}.intensity-badge{display:flex;align-items:center;gap:4px;font-family:var(--font-family-display);font-size:.65rem;font-weight:800;color:var(--color-primary);background:var(--color-primary-light);padding:2px 8px;border-radius:var(--radius-full);letter-spacing:.3px;border:1px solid var(--color-primary)}.alliance-footer{display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-4);background:var(--color-surface-hover);border-radius:var(--radius-lg);margin-top:auto;min-width:0}.footer-info{font-size:.8rem;color:var(--color-text-secondary);text-align:center}.regenerate-button{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;font-size:.75rem;font-weight:600;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-hint);transition:all .2s;width:100%;font-family:var(--font-family-display)}.regenerate-button:hover{color:var(--color-primary);border-color:var(--color-primary)}.persistence-loader{position:fixed;bottom:var(--space-12);right:var(--space-6);background:var(--color-surface);border:1px solid var(--color-border);padding:var(--space-2) var(--space-4);border-radius:var(--radius-full);display:flex;align-items:center;gap:var(--space-2);font-size:.75rem;font-weight:600;color:var(--color-text-secondary);box-shadow:var(--shadow-lg);z-index:100}.spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@media (max-width:1200px){.alliance-sections{grid-template-columns:1fr;gap:var(--space-10)}}`}</style>
        </div>
    );
}
