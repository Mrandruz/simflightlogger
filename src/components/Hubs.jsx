import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    MapPin, Clock, Route, TrendingUp, Star, Plane, Calendar,
    ExternalLink, Building2, Globe, RefreshCw, ChevronRight,
    Award, BarChart2, Layers
} from 'lucide-react';

// ---------------------------------------------------------------------------
// ICAO → Wikipedia slug dictionary
// All 10 airports confirmed to have strong Wikipedia coverage
// ---------------------------------------------------------------------------
const WIKI_SLUGS = {
    LFPG: { airport: 'Charles_de_Gaulle_Airport',       city: 'Paris' },
    LIRF: { airport: 'Leonardo_da_Vinci_International_Airport', city: 'Rome' },
    KLAX: { airport: 'Los_Angeles_International_Airport', city: 'Los_Angeles' },
    EGLL: { airport: 'Heathrow_Airport',                 city: 'London' },
    EDDF: { airport: 'Frankfurt_Airport',                city: 'Frankfurt' },
    EHAM: { airport: 'Amsterdam_Airport_Schiphol',       city: 'Amsterdam' },
    EDDM: { airport: 'Munich_Airport',                   city: 'Munich' },
    OMAA: { airport: 'Abu_Dhabi_International_Airport',  city: 'Abu_Dhabi' },
    KJFK: { airport: 'John_F._Kennedy_International_Airport', city: 'New_York_City' },
    VTBS: { airport: 'Suvarnabhumi_Airport',             city: 'Bangkok' },
    // Spain
    LEMD: { airport: 'Adolfo_Suárez_Madrid–Barajas_Airport', city: 'Madrid' },
    LEBL: { airport: 'Barcelona–El_Prat_Airport',        city: 'Barcelona' },
    LEMG: { airport: 'Málaga_Airport',                   city: 'Málaga' },
    // Italy
    LIMC: { airport: 'Milan_Malpensa_Airport',           city: 'Milan' },
    LIME: { airport: 'Milan_Bergamo_Airport',            city: 'Bergamo' },
    LIPZ: { airport: 'Venice_Marco_Polo_Airport',        city: 'Venice' },
    LIRN: { airport: 'Naples_International_Airport',     city: 'Naples' },
    // UK
    EGKK: { airport: 'Gatwick_Airport',                  city: 'London' },
    EGCC: { airport: 'Manchester_Airport',               city: 'Manchester' },
    // Germany
    EDDL: { airport: 'Düsseldorf_Airport',               city: 'Düsseldorf' },
    EDDB: { airport: 'Berlin_Brandenburg_Airport',       city: 'Berlin' },
    // Other Europe
    LSZH: { airport: 'Zurich_Airport',                   city: 'Zurich' },
    LFPO: { airport: 'Paris_Orly_Airport',               city: 'Paris' },
    LPPT: { airport: 'Humberto_Delgado_Airport',         city: 'Lisbon' },
    EIDW: { airport: 'Dublin_Airport',                   city: 'Dublin' },
    EKCH: { airport: 'Copenhagen_Airport',               city: 'Copenhagen' },
    ENGM: { airport: 'Oslo_Airport,_Gardermoen',         city: 'Oslo' },
    ESSA: { airport: 'Stockholm_Arlanda_Airport',        city: 'Stockholm' },
    EFHK: { airport: 'Helsinki_Airport',                 city: 'Helsinki' },
    LOWW: { airport: 'Vienna_International_Airport',     city: 'Vienna' },
    LKPR: { airport: 'Václav_Havel_Airport_Prague',      city: 'Prague' },
    EPWA: { airport: 'Warsaw_Chopin_Airport',            city: 'Warsaw' },
    LHBP: { airport: 'Budapest_Ferenc_Liszt_International_Airport', city: 'Budapest' },
    LGAV: { airport: 'Athens_International_Airport',     city: 'Athens' },
    LTBA: { airport: 'Atatürk_Airport',                  city: 'Istanbul' },
    LTFM: { airport: 'Istanbul_Airport',                 city: 'Istanbul' },
    // Middle East
    OMDB: { airport: 'Dubai_International_Airport',      city: 'Dubai' },
    OMDW: { airport: 'Al_Maktoum_International_Airport', city: 'Dubai' },
    OTHH: { airport: 'Hamad_International_Airport',      city: 'Doha' },
    OERK: { airport: 'King_Khalid_International_Airport', city: 'Riyadh' },
    OEDF: { airport: 'King_Fahd_International_Airport',  city: 'Dammam' },
    // Asia
    VHHH: { airport: 'Hong_Kong_International_Airport',  city: 'Hong_Kong' },
    RJTT: { airport: 'Tokyo_International_Airport',      city: 'Tokyo' },
    RJAA: { airport: 'Narita_International_Airport',     city: 'Tokyo' },
    RKSI: { airport: 'Incheon_International_Airport',    city: 'Seoul' },
    WSSS: { airport: 'Singapore_Changi_Airport',         city: 'Singapore' },
    VIDP: { airport: 'Indira_Gandhi_International_Airport', city: 'Delhi' },
    VABB: { airport: 'Chhatrapati_Shivaji_Maharaj_International_Airport', city: 'Mumbai' },
    ZBAA: { airport: 'Beijing_Capital_International_Airport', city: 'Beijing' },
    ZSPD: { airport: 'Shanghai_Pudong_International_Airport', city: 'Shanghai' },
    // Americas
    KJFK: { airport: 'John_F._Kennedy_International_Airport', city: 'New_York_City' },
    KEWR: { airport: 'Newark_Liberty_International_Airport', city: 'Newark,_New_Jersey' },
    KORD: { airport: "O'Hare_International_Airport",     city: 'Chicago' },
    KATL: { airport: 'Hartsfield–Jackson_Atlanta_International_Airport', city: 'Atlanta' },
    KDFW: { airport: 'Dallas/Fort_Worth_International_Airport', city: 'Dallas' },
    KMIA: { airport: 'Miami_International_Airport',      city: 'Miami' },
    CYYZ: { airport: 'Toronto_Pearson_International_Airport', city: 'Toronto' },
    SBGR: { airport: 'São_Paulo/Guarulhos_International_Airport', city: 'São_Paulo' },
    SAEZ: { airport: 'Ministro_Pistarini_International_Airport', city: 'Buenos_Aires' },
    // Africa & Oceania
    FAOR: { airport: 'O._R._Tambo_International_Airport', city: 'Johannesburg' },
    HECA: { airport: 'Cairo_International_Airport',      city: 'Cairo' },
    YSSY: { airport: 'Sydney_Airport',                   city: 'Sydney' },
    YMML: { airport: 'Melbourne_Airport',                city: 'Melbourne' },
};

// Airport display names
const AIRPORT_NAMES = {
    LFPG: 'Charles de Gaulle',
    LIRF: 'Leonardo da Vinci',
    KLAX: 'Los Angeles Intl',
    EGLL: 'London Heathrow',
    EDDF: 'Frankfurt Airport',
    EHAM: 'Amsterdam Schiphol',
    EDDM: 'Munich Airport',
    OMAA: 'Abu Dhabi Intl',
    KJFK: 'John F. Kennedy',
    VTBS: 'Suvarnabhumi',
};

const CITY_NAMES = {
    LFPG: 'Paris', LIRF: 'Rome', KLAX: 'Los Angeles', EGLL: 'London',
    EDDF: 'Frankfurt', EHAM: 'Amsterdam', EDDM: 'Munich',
    OMAA: 'Abu Dhabi', KJFK: 'New York', VTBS: 'Bangkok',
};

// Accent colors per airport (unique hue for each hub)
const HUB_COLORS = {
    LFPG: { h: 220, label: '#4d8eff' },
    LIRF: { h: 0,   label: '#ff6b6b' },
    KLAX: { h: 200, label: '#00c4f4' },
    EGLL: { h: 355, label: '#ff5c7a' },
    EDDF: { h: 30,  label: '#ffaa44' },
    EHAM: { h: 150, label: '#3de0a0' },
    EDDM: { h: 260, label: '#a78bfa' },
    OMAA: { h: 45,  label: '#ffd166' },
    KJFK: { h: 190, label: '#2dd4bf' },
    VTBS: { h: 120, label: '#6ee06e' },
};

// ---------------------------------------------------------------------------
// Wikipedia cache layer — Firestore-backed, lazy fetch
// ---------------------------------------------------------------------------
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function fetchWikiSummary(slug) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
    const res = await fetch(url, { headers: { 'Api-User-Agent': 'Skydeck/1.0' } });
    if (!res.ok) throw new Error(`Wiki ${res.status}`);
    return res.json();
}

// For unknown ICAOs, search Wikipedia and return the best match summary
async function searchWikiSummary(query) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
    const searchRes = await fetch(searchUrl, { headers: { 'Api-User-Agent': 'Skydeck/1.0' } });
    if (!searchRes.ok) throw new Error(`Wiki search ${searchRes.status}`);
    const searchData = await searchRes.json();
    const title = searchData?.query?.search?.[0]?.title;
    if (!title) throw new Error('No results');
    return fetchWikiSummary(title.replace(/ /g, '_'));
}

async function getHubWikiData(icao, airportName, cityName) {
    const slugs = WIKI_SLUGS[icao];

    const cacheRef = doc(db, 'hubsCache', icao);
    try {
        const snap = await getDoc(cacheRef);
        if (snap.exists()) {
            const d = snap.data();
            if (Date.now() - (d.fetchedAt || 0) < CACHE_TTL_MS) return d;
        }
    } catch (_) {}

    // Use dictionary slugs if available, otherwise fall back to search
    const fetchAirport = slugs
        ? fetchWikiSummary(slugs.airport)
        : searchWikiSummary(`${airportName || icao} airport`);

    const fetchCity = slugs
        ? fetchWikiSummary(slugs.city)
        : searchWikiSummary(cityName || icao);

    const [airportData, cityData] = await Promise.all([
        fetchAirport.catch(() => null),
        fetchCity.catch(() => null),
    ]);

    const payload = {
        icao,
        fetchedAt: Date.now(),
        airport: airportData ? {
            title: airportData.title,
            extract: airportData.extract,
            thumbnail: airportData.thumbnail?.source || null,
            url: airportData.content_urls?.desktop?.page || null,
        } : null,
        city: cityData ? {
            title: cityData.title,
            extract: cityData.extract,
            thumbnail: cityData.thumbnail?.source || null,
            url: cityData.content_urls?.desktop?.page || null,
        } : null,
    };

    // Save to Firestore cache (best-effort)
    try { await setDoc(cacheRef, payload); } catch (_) {}
    return payload;
}

// ---------------------------------------------------------------------------
// Stats aggregation — per-airport breakdown
// ---------------------------------------------------------------------------
function computeHubStats(flights) {
    const now = new Date();
    const airportMap = {};

    flights.forEach(f => {
        const processAirport = (icao, isDep) => {
            if (!icao) return;
            const code = icao.toUpperCase();
            if (!airportMap[code]) {
                airportMap[code] = {
                    icao: code,
                    totalFlights: 0,
                    totalHours: 0,
                    totalMiles: 0,
                    airlines: {},
                    aircraft: {},
                    routes: {},
                    byMonth: {},
                    firstDate: null,
                    lastDate: null,
                };
            }
            const s = airportMap[code];
            s.totalFlights++;
            s.totalHours += f.flightTime || 0;
            s.totalMiles += f.miles || 0;
            if (f.airline) s.airlines[f.airline] = (s.airlines[f.airline] || 0) + 1;
            if (f.aircraft) s.aircraft[f.aircraft] = (s.aircraft[f.aircraft] || 0) + 1;
            const route = isDep
                ? `${f.departure}→${f.arrival}`
                : `${f.departure}→${f.arrival}`;
            s.routes[route] = (s.routes[route] || 0) + 1;
            if (f.date) {
                const m = f.date.slice(0, 7);
                s.byMonth[m] = (s.byMonth[m] || 0) + 1;
                if (!s.firstDate || f.date < s.firstDate) s.firstDate = f.date;
                if (!s.lastDate || f.date > s.lastDate) s.lastDate = f.date;
            }
        };
        processAirport(f.departure, true);
        processAirport(f.arrival, false);
    });

    // Sort by totalFlights desc, take top 10
    return Object.values(airportMap)
        .sort((a, b) => b.totalFlights - a.totalFlights)
        .slice(0, 10)
        .map((s, i) => ({
            ...s,
            rank: i + 1,
            topAirline: Object.entries(s.airlines).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
            topAirlines: Object.entries(s.airlines).sort(([, a], [, b]) => b - a).slice(0, 3),
            topAircraft: Object.entries(s.aircraft).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
            topAircrafts: Object.entries(s.aircraft).sort(([, a], [, b]) => b - a).slice(0, 3),
            topRoutes: Object.entries(s.routes).sort(([, a], [, b]) => b - a).slice(0, 5),
            monthlyTrend: Object.entries(s.byMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-6),
        }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const KpiCard = ({ icon: Icon, label, value, color }) => (
    <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
    }}>
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: color || 'var(--color-primary)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-hint)' }}>
            <Icon size={13} />
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-family-sans)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
            </span>
        </div>
        <div style={{ fontSize: '1.45rem', fontFamily: 'var(--font-family-mono)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
            {value}
        </div>
    </div>
);

const MiniBar = ({ value, max, color }) => (
    <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
            width: `${Math.min(100, (value / max) * 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
    </div>
);

const MonthlyChart = ({ data, color }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data.map(([, v]) => v), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '40px' }}>
            {data.map(([month, count]) => (
                <div key={month} title={`${month}: ${count} ops`} style={{
                    flex: 1,
                    height: `${Math.max(10, (count / max) * 100)}%`,
                    background: color,
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.85,
                    transition: 'height 0.5s ease',
                    cursor: 'default',
                }} />
            ))}
        </div>
    );
};

const WikiCard = ({ data, type, color }) => {
    const [expanded, setExpanded] = useState(false);

    if (!data) return (
        <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            flex: 1,
        }}>
            <div style={{ color: 'var(--color-text-hint)', fontSize: '0.82rem' }}>Wikipedia data unavailable</div>
        </div>
    );

    const fullText = data.extract || '';
    // Preview: first ~200 chars, cutting at a sentence boundary
    const previewEnd = fullText.indexOf('. ', 180);
    const previewText = previewEnd > 0 ? fullText.slice(0, previewEnd + 1) : fullText.slice(0, 220);
    const hasMore = fullText.length > previewText.length;

    return (
        <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            transition: 'box-shadow 0.2s ease',
        }}>
            {data.thumbnail && (
                <div style={{
                    height: '140px',
                    background: `url(${data.thumbnail}) center/cover`,
                    position: 'relative',
                    flexShrink: 0,
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, transparent 40%, var(--color-surface))',
                    }} />
                </div>
            )}
            <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {type === 'airport' ? <Building2 size={13} style={{ color }} /> : <Globe size={13} style={{ color }} />}
                    <span style={{
                        fontSize: '0.68rem', fontWeight: 500,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        color: 'var(--color-text-hint)',
                    }}>
                        {type === 'airport' ? 'Airport' : 'City'}
                    </span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-family-display)', color: 'var(--color-text-primary)' }}>
                    {data.title}
                </div>

                {/* Text body — toggles between preview and full */}
                <div style={{
                    fontSize: '0.82rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.65,
                    flex: 1,
                    overflow: 'hidden',
                    position: 'relative',
                }}>
                    <span>{expanded ? fullText : previewText}</span>
                    {/* Fade-out gradient when collapsed */}
                    {!expanded && hasMore && (
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            height: '40px',
                            background: 'linear-gradient(to bottom, transparent, var(--color-surface))',
                            pointerEvents: 'none',
                        }} />
                    )}
                </div>

                {/* Action row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {hasMore && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                fontSize: '0.75rem', fontWeight: 600, color,
                                display: 'flex', alignItems: 'center', gap: '4px',
                                transition: 'opacity 0.15s',
                            }}
                        >
                            {expanded ? '↑ Show less' : '↓ Read more'}
                        </button>
                    )}
                    {data.url && (
                        <a
                            href={data.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '0.72rem', color: 'var(--color-text-hint)',
                                textDecoration: 'none', fontWeight: 500,
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = color}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-hint)'}
                        >
                            Full article <ExternalLink size={10} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Hubs() {
    const { flights } = useOutletContext();
    const hubs = useMemo(() => computeHubStats(flights || []), [flights]);

    const [activeIcao, setActiveIcao] = useState(null);
    const [wikiData, setWikiData] = useState({});
    const [wikiLoading, setWikiLoading] = useState(false);

    // Auto-select first hub
    useEffect(() => {
        if (hubs.length > 0 && !activeIcao) {
            setActiveIcao(hubs[0].icao);
        }
    }, [hubs]);

    // Lazy-fetch Wikipedia when hub changes
    useEffect(() => {
        if (!activeIcao || wikiData[activeIcao] !== undefined) return;
        const hasSlug = !!WIKI_SLUGS[activeIcao];
        if (!hasSlug) { setWikiData(p => ({ ...p, [activeIcao]: null })); return; }

        setWikiLoading(true);
        getHubWikiData(activeIcao, AIRPORT_NAMES[activeIcao], CITY_NAMES[activeIcao])
            .then(data => setWikiData(p => ({ ...p, [activeIcao]: data })))
            .catch(() => setWikiData(p => ({ ...p, [activeIcao]: null })))
            .finally(() => setWikiLoading(false));
    }, [activeIcao]);

    const activeHub = hubs.find(h => h.icao === activeIcao);
    const activeColor = HUB_COLORS[activeIcao]?.label || 'var(--color-primary)';
    const activeH = HUB_COLORS[activeIcao]?.h ?? 220;
    const wiki = wikiData[activeIcao];

    if (hubs.length === 0) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: '400px', gap: '12px',
                color: 'var(--color-text-hint)',
            }}>
                <MapPin size={40} strokeWidth={1} />
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>No hub data yet</div>
                <div style={{ fontSize: '0.82rem' }}>Log some flights to see your top airports here.</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: '40px' }}>

            {/* ── Page header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: 'var(--color-text-hint)',
                        fontSize: '0.7rem', fontWeight: 500,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        marginBottom: '4px',
                    }}>
                        <Layers size={12} /> Hubs
                    </div>
                    <h1 style={{
                        fontFamily: 'var(--font-family-display)',
                        fontWeight: 600, fontSize: '1.7rem',
                        color: 'var(--color-text-primary)', margin: 0,
                    }}>
                        Your Top Airports
                    </h1>
                </div>
                <div style={{
                    fontSize: '0.75rem', color: 'var(--color-text-hint)',
                    fontFamily: 'var(--font-family-mono)',
                }}>
                    {hubs.length} hubs · {(flights || []).length} total ops
                </div>
            </div>

            {/* ── Tab strip ── */}
            <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: '6px',
                display: 'flex',
                gap: '4px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
            }}>
                {hubs.map((hub) => {
                    const isActive = hub.icao === activeIcao;
                    const c = HUB_COLORS[hub.icao]?.label || 'var(--color-primary)';
                    const h = HUB_COLORS[hub.icao]?.h ?? 220;
                    return (
                        <button
                            key={hub.icao}
                            onClick={() => setActiveIcao(hub.icao)}
                            style={{
                                flex: '0 0 auto',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: '3px',
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-lg)',
                                border: 'none',
                                background: isActive ? `hsla(${h}, 80%, 55%, 0.12)` : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.18s ease',
                                outline: isActive ? `1.5px solid hsla(${h}, 80%, 55%, 0.35)` : '1.5px solid transparent',
                            }}
                        >
                            <div style={{
                                fontFamily: 'var(--font-family-mono)',
                                fontWeight: 700, fontSize: '0.82rem',
                                color: isActive ? c : 'var(--color-text-primary)',
                                letterSpacing: '0.04em',
                                transition: 'color 0.18s',
                            }}>
                                {hub.icao}
                            </div>
                            <div style={{
                                width: '18px', height: '2px',
                                borderRadius: '1px',
                                background: isActive ? c : 'var(--color-border)',
                                transition: 'background 0.18s',
                            }} />
                            <div style={{
                                fontSize: '0.62rem',
                                fontWeight: 500,
                                color: isActive ? c : 'var(--color-text-hint)',
                                fontFamily: 'var(--font-family-mono)',
                                transition: 'color 0.18s',
                            }}>
                                #{hub.rank}
                            </div>
                        </button>
                    );
                })}
            </div>

            {activeHub && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', animation: 'fadeIn 0.25s ease' }}>

                    {/* ── Hero ── */}
                    <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '20px 24px',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* Background glow */}
                        <div style={{
                            position: 'absolute', top: '-60px', right: '-60px',
                            width: '220px', height: '220px',
                            borderRadius: '50%',
                            background: `hsla(${activeH}, 80%, 55%, 0.06)`,
                            pointerEvents: 'none',
                        }} />

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
                            {/* ICAO badge */}
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: '4px', flexShrink: 0,
                            }}>
                                <div style={{
                                    background: `hsla(${activeH}, 80%, 55%, 0.12)`,
                                    border: `1.5px solid hsla(${activeH}, 80%, 55%, 0.3)`,
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '12px 16px',
                                    fontFamily: 'var(--font-family-mono)',
                                    fontWeight: 700, fontSize: '1.8rem',
                                    color: activeColor,
                                    letterSpacing: '0.06em',
                                    lineHeight: 1,
                                }}>
                                    {activeHub.icao}
                                </div>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    background: activeColor,
                                    color: '#fff',
                                    borderRadius: 'var(--radius-full)',
                                    padding: '2px 8px',
                                    fontSize: '0.62rem', fontWeight: 700,
                                    letterSpacing: '0.06em',
                                }}>
                                    <Award size={9} /> #{activeHub.rank}
                                </div>
                            </div>

                            {/* Name + dates */}
                            <div style={{ flex: 1, minWidth: '160px' }}>
                                <div style={{
                                    fontFamily: 'var(--font-family-display)',
                                    fontWeight: 600, fontSize: '1.15rem',
                                    color: 'var(--color-text-primary)',
                                }}>
                                    {AIRPORT_NAMES[activeHub.icao] || activeHub.icao}
                                </div>
                                <div style={{
                                    fontSize: '0.8rem', color: 'var(--color-text-secondary)',
                                    marginTop: '2px',
                                }}>
                                    {CITY_NAMES[activeHub.icao] || ''}
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    marginTop: '8px', color: 'var(--color-text-hint)',
                                    fontSize: '0.72rem', fontFamily: 'var(--font-family-mono)',
                                }}>
                                    <Calendar size={11} />
                                    {activeHub.firstDate} → {activeHub.lastDate}
                                </div>
                            </div>

                            {/* KPI row */}
                            <div style={{ display: 'flex', gap: '10px', flex: 2, minWidth: '280px', flexWrap: 'wrap' }}>
                                <KpiCard icon={Plane} label="Operations" value={activeHub.totalFlights} color={activeColor} />
                                <KpiCard icon={Clock} label="Hours" value={activeHub.totalHours.toFixed(0)} color={activeColor} />
                                <KpiCard icon={Route} label="Nautical mi" value={activeHub.totalMiles.toLocaleString()} color={activeColor} />
                            </div>
                        </div>
                    </div>

                    {/* ── Main grid ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 'var(--space-4)',
                    }}>

                        {/* Top Routes */}
                        <div style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-xl)',
                            padding: '18px 20px',
                            display: 'flex', flexDirection: 'column', gap: '14px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Route size={14} style={{ color: activeColor }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-hint)' }}>
                                    Top Routes
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {activeHub.topRoutes.map(([route, count]) => {
                                    const maxCount = activeHub.topRoutes[0]?.[1] || 1;
                                    return (
                                        <div key={route} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                                    {route}
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: activeColor, fontFamily: 'var(--font-family-mono)', fontWeight: 600 }}>
                                                    ×{count}
                                                </span>
                                            </div>
                                            <MiniBar value={count} max={maxCount} color={activeColor} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Top Airlines */}
                        <div style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-xl)',
                            padding: '18px 20px',
                            display: 'flex', flexDirection: 'column', gap: '14px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Star size={14} style={{ color: activeColor }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-hint)' }}>
                                    Airlines
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {activeHub.topAirlines.length > 0 ? activeHub.topAirlines.map(([airline, count]) => {
                                    const maxCount = activeHub.topAirlines[0]?.[1] || 1;
                                    return (
                                        <div key={airline} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>{airline}</span>
                                                <span style={{ fontSize: '0.72rem', color: activeColor, fontFamily: 'var(--font-family-mono)', fontWeight: 600 }}>×{count}</span>
                                            </div>
                                            <MiniBar value={count} max={maxCount} color={activeColor} />
                                        </div>
                                    );
                                }) : (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-hint)' }}>No airline data</div>
                                )}
                            </div>
                        </div>

                        {/* Aircraft + Monthly trend */}
                        <div style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-xl)',
                            padding: '18px 20px',
                            display: 'flex', flexDirection: 'column', gap: '14px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plane size={14} style={{ color: activeColor }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-hint)' }}>
                                    Aircraft Flown
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {activeHub.topAircrafts.map(([ac, count]) => (
                                    <div key={ac} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>{ac}</span>
                                        <span style={{
                                            background: `hsla(${activeH}, 80%, 55%, 0.12)`,
                                            color: activeColor,
                                            borderRadius: 'var(--radius-full)',
                                            padding: '1px 8px',
                                            fontSize: '0.7rem', fontFamily: 'var(--font-family-mono)', fontWeight: 600,
                                        }}>
                                            {count}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {activeHub.monthlyTrend.length > 0 && (
                                <>
                                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                            <BarChart2 size={12} style={{ color: 'var(--color-text-hint)' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-hint)' }}>
                                                Activity (last 6 mo)
                                            </span>
                                        </div>
                                        <MonthlyChart data={activeHub.monthlyTrend} color={activeColor} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                            {activeHub.monthlyTrend.map(([m]) => (
                                                <span key={m} style={{ fontSize: '0.58rem', color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>
                                                    {m.slice(5)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Wikipedia section ── */}
                    <div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            marginBottom: '12px',
                        }}>
                            <Globe size={13} style={{ color: 'var(--color-text-hint)' }} />
                            <span style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)' }}>
                                From Wikipedia
                            </span>
                            {wikiLoading && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-hint)', fontSize: '0.72rem' }}>
                                    <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                            <WikiCard data={wiki?.airport} type="airport" color={activeColor} />
                            <WikiCard data={wiki?.city} type="city" color={activeColor} />
                        </div>
                    </div>

                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
