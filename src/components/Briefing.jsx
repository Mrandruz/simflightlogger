import React, { useMemo } from 'react';
import airports from 'airport-data';
import customAirports from '../customAirports';
import SuggestedRoutes from './SuggestedRoutes';
import MetarCards from './MetarCards';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

export default function Briefing({ flights }) {

    const recentAirportsByAlliance = useMemo(() => {
        const sortedFlights = [...flights].sort((a, b) => new Date(b.date) - new Date(a.date));
        const result = [];
        const seenAlliances = new Set();

        for (const f of sortedFlights) {
            if (!f.alliance || seenAlliances.has(f.alliance)) continue;

            const icao = f.arrival ? f.arrival.toUpperCase() : f.departure ? f.departure.toUpperCase() : null;
            if (icao) {
                const airportData = findAirport(icao);
                const city = airportData ? (airportData.city || airportData.name.split(',')[0] || airportData.name) : 'Unknown City';
                result.push({
                    icao,
                    city,
                    alliance: f.alliance
                });
                seenAlliances.add(f.alliance);
            }
            if (result.length >= 3) break;
        }
        return result;
    }, [flights]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Suggested Routes */}
            <SuggestedRoutes flights={flights} />

            {/* METAR Cards */}
            {recentAirportsByAlliance.length > 0 && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                    <h3 className="card-title" style={{ paddingLeft: '4px' }}>Weather Feed</h3>
                    <MetarCards airports={recentAirportsByAlliance} />
                </div>
            )}

            {recentAirportsByAlliance.length === 0 && (
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '150px', color: 'var(--color-text-hint)' }}>
                    Add flights to your logbook to see weather updates for your recent destinations.
                </div>
            )}

        </div>
    );
}
