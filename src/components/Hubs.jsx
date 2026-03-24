import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    MapPin, Clock, Route, TrendingUp, Star, Plane, Calendar,
    ExternalLink, Building2, Globe, RefreshCw, ChevronRight,
    Award, BarChart2, Layers, Gauge, Wind, Thermometer, Droplets
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

// Coordinate geografiche degli aeroporti — usate per centrare la mappa Leaflet.
// lat/lng = centro dell'aeroporto, zoom = livello ottimale per vedere le piste.
const AIRPORT_COORDS = {
    LFPG: { lat: 49.0097,  lng:  2.5479,  zoom: 15 },
    LIRF: { lat: 41.8003,  lng: 12.2389,  zoom: 15 },
    KLAX: { lat: 33.9425,  lng:-118.4081, zoom: 15 },
    EGLL: { lat: 51.4775,  lng: -0.4614,  zoom: 15 },
    EDDF: { lat: 50.0379,  lng:  8.5622,  zoom: 15 },
    EHAM: { lat: 52.3086,  lng:  4.7639,  zoom: 15 },
    EDDM: { lat: 48.3538,  lng: 11.7861,  zoom: 15 },
    OMAA: { lat: 24.4330,  lng: 54.6511,  zoom: 15 },
    KJFK: { lat: 40.6413,  lng:-73.7781,  zoom: 15 },
    VTBS: { lat: 13.6900,  lng:100.7501,  zoom: 15 },
    LEMD: { lat: 40.4719,  lng: -3.5626,  zoom: 15 },
    LEBL: { lat: 41.2971,  lng:  2.0785,  zoom: 15 },
    LIMC: { lat: 45.6306,  lng:  8.7281,  zoom: 15 },
    EGKK: { lat: 51.1537,  lng: -0.1821,  zoom: 15 },
    EGCC: { lat: 53.3537,  lng: -2.2750,  zoom: 15 },
    LSZH: { lat: 47.4647,  lng:  8.5492,  zoom: 15 },
    OMDB: { lat: 25.2532,  lng: 55.3657,  zoom: 15 },
    OTHH: { lat: 25.2731,  lng: 51.6080,  zoom: 15 },
    VHHH: { lat: 22.3080,  lng:113.9185,  zoom: 15 },
    WSSS: { lat:  1.3644,  lng:103.9915,  zoom: 15 },
    KORD: { lat: 41.9742,  lng:-87.9073,  zoom: 15 },
    KATL: { lat: 33.6407,  lng:-84.4277,  zoom: 15 },
};

// Fallback per aeroporti non nel dizionario
const DEFAULT_COORDS = { lat: 48.0, lng: 10.0, zoom: 4 };

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

// ---------------------------------------------------------------------------
// useLeafletMap — hook condiviso che gestisce il ciclo di vita di una mappa Leaflet.
// Entrambe le card mappa (Overview e Chart) lo usano con parametri diversi.
// Separare il hook dal rendering evita duplicazione di logica e permette a
// ciascuna card di avere il proprio stato Leaflet indipendente.
// ---------------------------------------------------------------------------
function useLeafletMap({ mapRef, icao, zoom, isDarkMode, showMarker }) {
    const mapInstanceRef = useRef(null);
    const baseTileRef = useRef(null);
    const markerRef = useRef(null);
    const prevIcaoRef = useRef(null);

    const coords = AIRPORT_COORDS[icao] || DEFAULT_COORDS;

    // Effetto 1: inizializzazione e cambio hub
    useEffect(() => {
        if (!mapRef.current) return;

        if (!mapInstanceRef.current) {
            const L = window.L;
            if (!L) return;

            const map = L.map(mapRef.current, {
                center: [coords.lat, coords.lng],
                zoom,
                zoomControl: true,
                attributionControl: true,
                scrollWheelZoom: false,
            });

            const tileUrl = isDarkMode
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            const baseTile = L.tileLayer(tileUrl, {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19,
            });
            baseTile.addTo(map);
            baseTileRef.current = baseTile;

            // Il marker appare solo sulla card Overview, non sulla Chart
            if (showMarker) {
                const markerHtml = `<div style="
                    width: 24px; height: 24px;
                    background: var(--marker-color, #4d8eff);
                    border: 3px solid #fff;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
                "></div>`;
                const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 24] });
                const marker = L.marker([coords.lat, coords.lng], { icon })
                    .addTo(map)
                    .bindTooltip(icao, {
                        permanent: true, direction: 'right',
                        className: 'hub-map-tooltip',
                        offset: [8, -12],
                    });
                markerRef.current = marker;
            }

            mapInstanceRef.current = map;
            prevIcaoRef.current = icao;

        } else if (prevIcaoRef.current !== icao) {
            mapInstanceRef.current.flyTo([coords.lat, coords.lng], zoom, {
                duration: 1.2, easeLinearity: 0.4,
            });
            if (markerRef.current) {
                markerRef.current.setLatLng([coords.lat, coords.lng]);
                markerRef.current.setTooltipContent(icao);
            }
            prevIcaoRef.current = icao;
        }
    }, [icao, coords, zoom, showMarker]);

    // Effetto 2: cambio tema — swappa solo il tile layer base
    useEffect(() => {
        if (!mapInstanceRef.current || !baseTileRef.current) return;
        const L = window.L;
        if (!L) return;
        mapInstanceRef.current.removeLayer(baseTileRef.current);
        const newTileUrl = isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        const newBaseTile = L.tileLayer(newTileUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
        });
        newBaseTile.addTo(mapInstanceRef.current);
        newBaseTile.bringToBack();
        baseTileRef.current = newBaseTile;
    }, [isDarkMode]);

    // Cleanup alla smontatura
    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                baseTileRef.current = null;
                markerRef.current = null;
            }
        };
    }, []);

    return coords;
}

// ---------------------------------------------------------------------------
// HubMapOverview — zoom ampio (livello 8) per il contesto geografico.
// Mostra dove si trova l'aeroporto all'interno della nazione/regione.
// ---------------------------------------------------------------------------
const HubMapOverview = ({ icao, color, isDarkMode }) => {
    const mapRef = useRef(null);
    const coords = useLeafletMap({ mapRef, icao, zoom: 8, isDarkMode, showMarker: true });

    return (
        <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignSelf: 'stretch',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={13} style={{ color }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)' }}>
                        Location
                    </span>
                </div>
                <a
                    href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                    onMouseEnter={e => e.currentTarget.style.color = color}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-hint)'}
                >
                    Open in Maps <ExternalLink size={10} />
                </a>
            </div>
            {/* flex:1 fa sì che la mappa occupi tutto lo spazio verticale rimasto
                nella card, allineandosi automaticamente all'altezza della card destra */}
            <div ref={mapRef} style={{ flex: 1, width: '100%', minHeight: '220px', '--marker-color': color }} />
            <style>{`
                .hub-map-tooltip {
                    background: ${color} !important;
                    color: #fff !important; border: none !important;
                    border-radius: 6px !important;
                    font-family: var(--font-family-mono) !important;
                    font-weight: 700 !important; font-size: 0.78rem !important;
                    padding: 2px 8px !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
                }
                .hub-map-tooltip::before { display: none !important; }
            `}</style>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Dati statici per la card operativa — frequenze, IATA code, fuso orario, piste.
// Hardcodati per i 10 hub principali, completamente zero-dependency.
// ---------------------------------------------------------------------------
const AIRPORT_INFO = {
    LFPG: { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France',
             tz: 'CET', utcOffset: '+1', runways: ['09L/27R', '09R/27L', '08L/26R', '08R/26L'],
             tower: '120.900', ground: '121.650', atis: '126.500' },
    LIRF: { iata: 'FCO', name: 'Leonardo da Vinci', city: 'Rome', country: 'Italy',
             tz: 'CET', utcOffset: '+1', runways: ['07/25', '16L/34R', '16R/34L'],
             tower: '118.700', ground: '121.800', atis: '121.775' },
    KLAX: { iata: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', country: 'USA',
             tz: 'PST', utcOffset: '-8', runways: ['06L/24R', '06R/24L', '07L/25R', '07R/25L'],
             tower: '133.900', ground: '121.750', atis: '133.800' },
    EGLL: { iata: 'LHR', name: 'Heathrow', city: 'London', country: 'UK',
             tz: 'GMT', utcOffset: '+0', runways: ['09L/27R', '09R/27L'],
             tower: '118.500', ground: '121.900', atis: '128.075' },
    EDDF: { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'Germany',
             tz: 'CET', utcOffset: '+1', runways: ['07L/25R', '07C/25C', '07R/25L', '18'],
             tower: '119.900', ground: '121.800', atis: '118.025' },
    EHAM: { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'Netherlands',
             tz: 'CET', utcOffset: '+1', runways: ['04/22', '06/24', '09/27', '18L/36R', '18C/36C', '18R/36L'],
             tower: '118.100', ground: '121.800', atis: '132.975' },
    EDDM: { iata: 'MUC', name: 'Munich', city: 'Munich', country: 'Germany',
             tz: 'CET', utcOffset: '+1', runways: ['08L/26R', '08R/26L'],
             tower: '120.775', ground: '121.975', atis: '123.125' },
    OMAA: { iata: 'AUH', name: 'Abu Dhabi Intl', city: 'Abu Dhabi', country: 'UAE',
             tz: 'GST', utcOffset: '+4', runways: ['13L/31R', '13R/31L'],
             tower: '118.200', ground: '121.900', atis: '127.350' },
    KJFK: { iata: 'JFK', name: 'John F. Kennedy', city: 'New York', country: 'USA',
             tz: 'EST', utcOffset: '-5', runways: ['04L/22R', '04R/22L', '13L/31R', '13R/31L'],
             tower: '119.100', ground: '121.900', atis: '128.725' },
    VTBS: { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand',
             tz: 'ICT', utcOffset: '+7', runways: ['01L/19R', '01R/19L'],
             tower: '118.100', ground: '121.800', atis: '128.150' },
    LEMD: { iata: 'MAD', name: 'Barajas', city: 'Madrid', country: 'Spain',
             tz: 'CET', utcOffset: '+1', runways: ['14L/32R', '14R/32L', '18L/36R', '18R/36L'],
             tower: '118.150', ground: '121.700', atis: '127.175' },
};

// Costruisce il link Navigraph per un ICAO e una sezione specifica.
// Il formato del link è stabile — Navigraph Charts usa query params standard.
const navigraphUrl = (icao, section = 'Charts', category = 'ARR') =>
    `https://charts.navigraph.com/airport/${icao}?section=${section}&chartCategory=${category}&informationSection=General&procedureSection=Departures&weatherSection=METAR&networksSection=Gates&ATISSection=Real`;

// ---------------------------------------------------------------------------
// HubWeather — widget METAR identico a WxStrip in Schedule.
// Fetcha /api/metar?ids={icao}&format=json e mostra PRES, WIND, TEMP, DEW
// con la stessa griglia a 4 colonne e gli stessi skeleton di caricamento.
// ---------------------------------------------------------------------------
const HubWeather = ({ icao }) => {
    const [wx, setWx] = useState('loading'); // 'loading' | 'unavailable' | { pres, wind, temp, dew }

    useEffect(() => {
        if (!icao) return;
        setWx('loading');
        fetch(`/api/metar?ids=${icao}&format=json`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                const m = Array.isArray(data) ? data[0] : data;
                if (!m) { setWx('unavailable'); return; }
                setWx({
                    pres: m.altim  != null ? Math.round(m.altim)  : null,
                    wind: m.wdir   != null && m.wspd != null
                        ? `${m.wdir}°/${m.wspd}kt` : null,
                    temp: m.temp   != null ? Math.round(m.temp)   : null,
                    dew:  m.dewp   != null ? Math.round(m.dewp)   : null,
                });
            })
            .catch(() => setWx('unavailable'));
    }, [icao]);

    // Skeleton di caricamento — stili inline con animazione shimmer
    if (wx === 'loading') return (
        <>
            <style>{`
                @keyframes hub-shimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position:  200% 0; }
                }
                .hub-skel {
                    background: linear-gradient(
                        90deg,
                        var(--color-border) 25%,
                        var(--color-background) 50%,
                        var(--color-border) 75%
                    );
                    background-size: 200% 100%;
                    animation: hub-shimmer 1.5s infinite;
                    border-radius: 4px;
                }
            `}</style>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                background: 'var(--color-background)',
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
            }}>
                {[0,1,2,3].map(i => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <div className="hub-skel" style={{ width: 16, height: 16 }} />
                        <div className="hub-skel" style={{ width: 24, height: 8 }} />
                        <div className="hub-skel" style={{ width: 34, height: 12 }} />
                    </div>
                ))}
            </div>
        </>
    );

    // Dati non disponibili — messaggio discreto con icona
    if (wx === 'unavailable' || !wx) return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 12px',
            background: 'var(--color-background)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-hint)',
            fontSize: '0.75rem',
        }}>
            <Gauge size={13} style={{ flexShrink: 0 }} />
            No weather data available
        </div>
    );

    const fields = [
        { icon: <Gauge size={14} />,       label: 'PRES', value: wx.pres ?? '--' },
        { icon: <Wind size={14} />,        label: 'WIND', value: wx.wind ?? '--' },
        { icon: <Thermometer size={14} />, label: 'TEMP', value: wx.temp != null ? `${wx.temp}°` : '--' },
        { icon: <Droplets size={14} />,    label: 'DEW',  value: wx.dew  != null ? `${wx.dew}°`  : '--' },
    ];

    return (
        <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
            background: 'var(--color-background)',
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
        }}>
            {fields.map(({ icon, label, value }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <span style={{ color: 'var(--color-text-hint)' }}>{icon}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-hint)' }}>
                        {label}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)' }}>
                        {value}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// HubInfoCard — card destra: dati operativi dell'aeroporto + accesso rapido
// a Navigraph Charts con link contestuali per ARR, DEP, METAR, Gates.
// ---------------------------------------------------------------------------
const HubInfoCard = ({ icao, color, activeHub }) => {
    const info = AIRPORT_INFO[icao] || {};
    const maxFlights = activeHub?.totalFlights || 1;

    // Bottoni Navigraph con icone testuali e link diretti alle sezioni
    const navLinks = [
        { label: 'ARR',     url: navigraphUrl(icao, 'Charts', 'ARR') },
        { label: 'DEP',     url: navigraphUrl(icao, 'Charts', 'DEP') },
        // TAXI punta alla scheda Ground/Taxi di Navigraph Charts
        { label: 'APT',     url: `https://charts.navigraph.com/airport/${icao}?informationSection=General&section=Charts&chartCategory=APT&procedureSection=Departures&weatherSection=METAR&networksSection=Gates&ATISSection=Real` },
        { label: 'INFO',    url: `https://charts.navigraph.com/airport/${icao}?section=Information&informationSection=General` },
    ];

    return (
        <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: '280px',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={13} style={{ color }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)' }}>
                        Airport Info
                    </span>
                </div>
                {/* ICAO + IATA badge affiancati */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {info.iata && (
                        <span style={{
                            fontSize: '0.7rem', fontWeight: 600,
                            fontFamily: 'var(--font-family-mono)',
                            color: 'var(--color-text-hint)',
                            background: 'var(--color-background)',
                            padding: '2px 7px', borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-border)',
                        }}>
                            {info.iata}
                        </span>
                    )}
                    <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        fontFamily: 'var(--font-family-mono)',
                        color,
                        background: `${color}15`,
                        padding: '2px 7px', borderRadius: 'var(--radius-full)',
                        border: `1px solid ${color}30`,
                    }}>
                        {icao}
                    </span>
                </div>
            </div>

            <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Riga paese + fuso orario */}
                {info.city && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                            {info.city}, {info.country}
                        </span>
                        {info.tz && (
                            <span style={{
                                fontSize: '0.72rem', fontFamily: 'var(--font-family-mono)',
                                color: 'var(--color-text-hint)',
                            }}>
                                {info.tz} (UTC{info.utcOffset})
                            </span>
                        )}
                    </div>
                )}

                {/* Frequenze radio */}
                {(info.tower || info.ground || info.atis) && (
                    <div style={{
                        background: 'var(--color-background)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: '6px',
                    }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)', marginBottom: '2px' }}>
                            Radio Frequencies
                        </div>
                        {[
                            { label: 'TWR', value: info.tower },
                            { label: 'GND', value: info.ground },
                            { label: 'ATIS', value: info.atis },
                        ].filter(f => f.value).map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', fontWeight: 500 }}>{label}</span>
                                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-family-mono)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                    {value} MHz
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Piste */}
                {info.runways && info.runways.length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)', marginBottom: '6px' }}>
                            Runways
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {info.runways.map(rwy => (
                                <span key={rwy} style={{
                                    fontSize: '0.72rem', fontFamily: 'var(--font-family-mono)', fontWeight: 600,
                                    color, background: `${color}12`,
                                    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${color}25`,
                                }}>
                                    {rwy}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── METAR weather widget — stesso stile di Schedule ── */}
                <HubWeather icao={icao} />

                {/* ── Navigraph Charts quick-access ── */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={color}>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        <span style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)' }}>
                            Navigraph Charts
                        </span>
                    </div>
                    {/* 4 bottoni equidistribuiti su una riga — flex con flex:1 per fittare la card */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {navLinks.map(({ label, url }) => (
                            <a
                                key={label}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    flex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '4px',
                                    padding: '8px 4px',
                                    background: 'var(--color-background)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.72rem', fontWeight: 700,
                                    color: 'var(--color-text-secondary)',
                                    textDecoration: 'none',
                                    transition: 'all 0.15s ease',
                                    letterSpacing: '0.04em',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = `${color}12`;
                                    e.currentTarget.style.borderColor = `${color}50`;
                                    e.currentTarget.style.color = color;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--color-background)';
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                                }}
                            >
                                {label}
                                <ExternalLink size={8} style={{ opacity: 0.45, flexShrink: 0 }} />
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


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

// Sezioni Wikipedia da mostrare (per rilevanza per un aeroporto/città)
// Tutto il resto (References, See also, Notes, ecc.) viene scartato
const RELEVANT_SECTIONS = [
    'history', 'storia', 'overview', 'background', 'description',
    'terminals', 'terminal', 'infrastructure', 'infrastrutture',
    'statistics', 'statistiche', 'traffic', 'traffico',
    'facilities', 'services', 'servizi',
    'geography', 'geografia', 'climate', 'clima',
    'culture', 'cultura', 'economy', 'economia',
    'transport', 'trasporti', 'architecture', 'architettura',
    'founding', 'foundation', 'development', 'sviluppo',
];

function isSectionRelevant(title) {
    if (!title) return false;
    const t = title.toLowerCase();
    return RELEVANT_SECTIONS.some(k => t.includes(k));
}

// Converte i link interni Wikipedia (/wiki/Foo) in link assoluti,
// e rimuove i tag <sup> (note a piè di pagina) per pulire la lettura
function cleanWikiHtml(html) {
    if (!html) return '';
    return html
        // Link interni → link assoluti Wikipedia
        .replace(/href="\/wiki\//g, 'href="https://en.wikipedia.org/wiki/')
        // Rimuove note a piè di pagina <sup>...</sup>
        .replace(/<sup[^>]*>.*?<\/sup>/gs, '')
        // Rimuove i tag <style> inlined
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        // Rimuove table (spesso disallineate fuori dal layout Wikipedia)
        .replace(/<table[^>]*>.*?<\/table>/gs, '');
}

async function fetchWikiSections(slug) {
    // Usiamo l'Action API con origin=* — l'unica Wikipedia API garantita CORS-safe.
    // L'endpoint /api/rest_v1/page/mobile-sections/ blocca le richieste cross-origin
    // dal browser, causando il "Could not load full article" che vedevi.

    // Step 1: ottieni l'indice delle sezioni dell'articolo
    const tocUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&prop=sections&format=json&origin=*`;
    const tocRes = await fetch(tocUrl);
    if (!tocRes.ok) throw new Error(`Wiki TOC ${tocRes.status}`);
    const tocData = await tocRes.json();
    if (tocData.error) throw new Error(tocData.error.info || 'Wiki API error');

    const allSections = tocData?.parse?.sections || [];

    // Teniamo solo le sezioni di primo livello (toclevel=1) che siano rilevanti per l'utente
    const relevantSections = allSections
        .filter(s => s.toclevel === 1 && isSectionRelevant(s.line))
        .slice(0, 5);

    // Step 2: fetch parallela dell'introduzione (section=0) + sezioni rilevanti
    const fetchSection = async (num) => {
        const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(slug)}&prop=text&section=${num}&format=json&origin=*&disableeditsection=1`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.parse?.text?.['*'] || null;
    };

    const sectionNumbers = [0, ...relevantSections.map(s => s.index)];
    const htmlResults = await Promise.all(sectionNumbers.map(fetchSection));

    const intro = cleanWikiHtml(htmlResults[0] || '');
    const sections = relevantSections
        .map((s, i) => ({
            title: s.line,
            html: cleanWikiHtml(htmlResults[i + 1] || ''),
        }))
        .filter(s => s.html.length > 50); // scarta sezioni vuote o quasi

    return { intro, sections };
}

const WikiCard = ({ data, type, color, wikiSlug }) => {
    const [mode, setMode] = useState('preview'); // 'preview' | 'summary' | 'full'
    const [fullContent, setFullContent] = useState(null); // { intro, sections }
    const [fullLoading, setFullLoading] = useState(false);
    const [fullError, setFullError] = useState(false);
    const [openSection, setOpenSection] = useState(null); // titolo sezione aperta

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

    const fullSummary = data.extract || '';
    const previewEnd = fullSummary.indexOf('. ', 180);
    const previewText = previewEnd > 0 ? fullSummary.slice(0, previewEnd + 1) : fullSummary.slice(0, 220);
    const hasSummaryMore = fullSummary.length > previewText.length;

    // Carica l'articolo completo via mobile-sections quando l'utente vuole leggerlo
    const loadFullArticle = async () => {
        if (fullContent) { setMode('full'); return; }
        if (!wikiSlug) { setFullError(true); return; }
        setFullLoading(true);
        setFullError(false);
        try {
            const content = await fetchWikiSections(wikiSlug);
            setFullContent(content);
            setMode('full');
            // Apri automaticamente la prima sezione disponibile
            if (content.sections.length > 0) setOpenSection(content.sections[0].title);
        } catch {
            setFullError(true);
        } finally {
            setFullLoading(false);
        }
    };

    return (
        <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Hero image */}
            {data.thumbnail && (
                <div style={{
                    height: '140px',
                    background: `url(${data.thumbnail}) center/cover`,
                    position: 'relative', flexShrink: 0,
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, transparent 40%, var(--color-surface))',
                    }} />
                </div>
            )}

            <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {type === 'airport' ? <Building2 size={13} style={{ color }} /> : <Globe size={13} style={{ color }} />}
                    <span style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-hint)' }}>
                        {type === 'airport' ? 'Airport' : 'City'}
                    </span>
                    {mode === 'full' && (
                        <span style={{
                            marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 600,
                            color, background: `${color}18`,
                            padding: '1px 7px', borderRadius: 'var(--radius-full)',
                        }}>
                            Full article
                        </span>
                    )}
                </div>

                <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-family-display)', color: 'var(--color-text-primary)' }}>
                    {data.title}
                </div>

                {/* ── PREVIEW MODE ── anteprima del summary */}
                {mode === 'preview' && (
                    <>
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.65, position: 'relative' }}>
                            {previewText}
                            {hasSummaryMore && (
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px',
                                    background: 'linear-gradient(to bottom, transparent, var(--color-surface))',
                                    pointerEvents: 'none',
                                }} />
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {hasSummaryMore && (
                                <button onClick={() => setMode('summary')} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                    fontSize: '0.75rem', fontWeight: 600, color,
                                }}>
                                    ↓ Read summary
                                </button>
                            )}
                            <button onClick={loadFullArticle} disabled={fullLoading} style={{
                                background: 'none', border: 'none', cursor: fullLoading ? 'wait' : 'pointer', padding: 0,
                                fontSize: '0.75rem', fontWeight: 600,
                                color: fullLoading ? 'var(--color-text-hint)' : color,
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                                {fullLoading
                                    ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</>
                                    : '↓ Read full article'
                                }
                            </button>
                            {data.url && <WikiLink url={data.url} color={color} />}
                        </div>
                        {fullError && <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)' }}>Could not load full article.</div>}
                    </>
                )}

                {/* ── SUMMARY MODE ── estratto completo del summary */}
                {mode === 'summary' && (
                    <>
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
                            {fullSummary}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <button onClick={() => setMode('preview')} style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                fontSize: '0.75rem', fontWeight: 600, color,
                            }}>↑ Show less</button>
                            <button onClick={loadFullArticle} disabled={fullLoading} style={{
                                background: 'none', border: 'none', cursor: fullLoading ? 'wait' : 'pointer', padding: 0,
                                fontSize: '0.75rem', fontWeight: 600,
                                color: fullLoading ? 'var(--color-text-hint)' : color,
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                                {fullLoading
                                    ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</>
                                    : '↓ Read full article'
                                }
                            </button>
                            {data.url && <WikiLink url={data.url} color={color} />}
                        </div>
                        {fullError && <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)' }}>Could not load full article.</div>}
                    </>
                )}

                {/* ── FULL MODE ── articolo completo con sezioni accordion */}
                {mode === 'full' && fullContent && (
                    <>
                        {/* Introduzione completa */}
                        <div
                            className="wiki-article-body"
                            style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}
                            dangerouslySetInnerHTML={{ __html: fullContent.intro }}
                        />

                        {/* Sezioni in accordion */}
                        {fullContent.sections.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
                                {fullContent.sections.map(section => (
                                    <div key={section.title} style={{
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                    }}>
                                        {/* Sezione header — clicca per aprire/chiudere */}
                                        <button
                                            onClick={() => setOpenSection(s => s === section.title ? null : section.title)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 14px',
                                                background: openSection === section.title ? `${color}10` : 'transparent',
                                                border: 'none', cursor: 'pointer',
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <span style={{
                                                fontSize: '0.8rem', fontWeight: 600,
                                                color: openSection === section.title ? color : 'var(--color-text-primary)',
                                                fontFamily: 'var(--font-family-display)',
                                                transition: 'color 0.15s',
                                            }}>
                                                {section.title}
                                            </span>
                                            <span style={{
                                                fontSize: '0.7rem', color,
                                                transform: openSection === section.title ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.2s ease',
                                                display: 'inline-block',
                                            }}>▾</span>
                                        </button>
                                        {/* Sezione body */}
                                        {openSection === section.title && (
                                            <div
                                                className="wiki-article-body"
                                                style={{
                                                    padding: '4px 14px 14px',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--color-text-secondary)',
                                                    lineHeight: 1.7,
                                                    borderTop: `1px solid var(--color-border)`,
                                                    animation: 'fadeIn 0.15s ease',
                                                }}
                                                dangerouslySetInnerHTML={{ __html: section.html }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                            <button onClick={() => setMode('preview')} style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                fontSize: '0.75rem', fontWeight: 600, color,
                            }}>↑ Show less</button>
                            {data.url && <WikiLink url={data.url} color={color} />}
                        </div>
                    </>
                )}
            </div>

            {/* CSS per il body dell'articolo Wikipedia */}
            <style>{`
                .wiki-article-body p { margin-bottom: 0.75em; }
                .wiki-article-body p:last-child { margin-bottom: 0; }
                .wiki-article-body a { color: ${color}; text-decoration: none; }
                .wiki-article-body a:hover { text-decoration: underline; }
                .wiki-article-body b { color: var(--color-text-primary); font-weight: 600; }
            `}</style>
        </div>
    );
};

// Piccolo componente riutilizzabile per il link "Open on Wikipedia"
const WikiLink = ({ url, color }) => (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '0.72rem', color: 'var(--color-text-hint)',
        textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s',
    }}
        onMouseEnter={e => e.currentTarget.style.color = color}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-hint)'}
    >
        Open on Wikipedia <ExternalLink size={10} />
    </a>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Hubs() {
    const { flights, isDarkMode } = useOutletContext();
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

                    {/* ── Maps: Location overview + Airport chart ──
                        align-items:stretch fa sì che le due card abbiano la stessa altezza,
                        così la mappa (flex:1) si estende fino a riempire quella della card destra */}
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'stretch' }}>
                        <HubMapOverview icao={activeIcao} color={activeColor} isDarkMode={isDarkMode} />
                        <HubInfoCard icao={activeIcao} color={activeColor} activeHub={activeHub} />
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
                            <WikiCard
                                data={wiki?.airport}
                                type="airport"
                                color={activeColor}
                                wikiSlug={WIKI_SLUGS[activeIcao]?.airport}
                            />
                            <WikiCard
                                data={wiki?.city}
                                type="city"
                                color={activeColor}
                                wikiSlug={WIKI_SLUGS[activeIcao]?.city}
                            />
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
