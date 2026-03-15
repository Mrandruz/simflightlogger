import React, { useMemo, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import airports from 'airport-data';

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

const ALLIANCES = ['Star Alliance', 'SkyTeam', 'Oneworld'];

export default function SuggestedRoutes({ flights }) {
    const [shuffleKey, setShuffleKey] = useState(0);
    const [suggestion, setSuggestion] = useState(null);

    const handleShuffle = useCallback(() => {
        setShuffleKey(prev => prev + 1);
    }, []);

    const visitedSet = useMemo(() => {
        const set = new Set();
        flights.forEach(f => {
            if (f.departure) set.add(f.departure.toUpperCase());
            if (f.arrival) set.add(f.arrival.toUpperCase());
        });
        return set;
    }, [flights]);

    const generateSuggestion = useCallback(() => {
        // Pick a random alliance that has flights
        const alliancesWithFlights = ALLIANCES.filter(al =>
            flights.some(f => f.alliance === al && f.arrival)
        );
        if (alliancesWithFlights.length === 0) {
            setSuggestion(null);
            return;
        }

        const alliance = alliancesWithFlights[Math.floor(Math.random() * alliancesWithFlights.length)];

        // Get last airport for this alliance
        const allianceFlights = flights
            .filter(f => f.alliance === alliance && f.arrival)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (allianceFlights.length === 0) {
            setSuggestion(null);
            return;
        }

        const lastAirportCode = allianceFlights[0].arrival.toUpperCase();
        const originAirport = airports.find(a => a.icao === lastAirportCode);
        if (!originAirport) {
            setSuggestion(null);
            return;
        }

        // Pick a random major airport not visited
        const candidates = majorAirports
            .filter(ap => !visitedSet.has(ap.icao))
            .map(ap => ({
                ...ap,
                distance: haversineNm(originAirport.latitude, originAirport.longitude, ap.latitude, ap.longitude)
            }))
            .filter(ap => ap.distance > 100);

        if (candidates.length === 0) {
            setSuggestion(null);
            return;
        }

        const dest = candidates[Math.floor(Math.random() * candidates.length)];

        setSuggestion({
            alliance,
            fromCode: lastAirportCode,
            fromCity: originAirport.city || originAirport.name,
            toCode: dest.icao,
            toCity: dest.city || dest.name,
            toCountry: dest.country,
            distance: dest.distance,
        });
    }, [flights, visitedSet]);

    useEffect(() => {
        generateSuggestion();
    }, [generateSuggestion, shuffleKey]);

    if (!suggestion) return null;

    return (
        <div className="suggested-route-banner">
            <div className="suggested-route-banner-content">
                <span className="suggested-route-emoji">🌍</span>
                <div className="suggested-route-text">
                    <span className="suggested-route-message">
                        How about flying from <strong className="data-mono">{suggestion.fromCode}</strong> ({suggestion.fromCity}) to{' '}
                        <strong className="data-mono">{suggestion.toCode}</strong> ({suggestion.toCity}, {suggestion.toCountry})?
                    </span>
                    <span className="suggested-route-meta">
                        <span className="data-mono">{suggestion.distance.toLocaleString()}</span> nm • {suggestion.alliance}
                    </span>
                </div>
            </div>
            <button
                onClick={handleShuffle}
                className="suggested-route-shuffle has-tooltip"
                style={{ position: 'relative' }}
                aria-label="Generate new route suggestion"
            >
                <RefreshCw size={16} aria-hidden="true" />
                <span className="tooltip-box">New Suggestion</span>
            </button>
        </div>
    );
}
