import React, { useMemo } from 'react';
import { Award, Star, Shield, Medal, MapPin, Clock, Plane as PlaneIcon, Fuel, Globe, Trophy } from 'lucide-react';
import airports from 'airport-data';
import customAirports from '../customAirports';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

const RANKS = [
    { name: 'Student Pilot', minHours: 0, icon: <Star size={24} className="text-secondary" /> },
    { name: 'Junior First Officer', minHours: 50, icon: <Medal size={24} className="text-primary" /> },
    { name: 'First Officer', minHours: 150, icon: <Award size={24} className="text-primary" /> },
    { name: 'Captain', minHours: 500, icon: <Shield size={24} className="text-warning" /> },
    { name: 'Senior Captain', minHours: 1500, icon: <Shield size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} /> },
    { name: 'Chief Captain', minHours: 3000, icon: <Award size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} /> }
];

// Average fuel consumption in kg per nautical mile by aircraft type
const FUEL_CONSUMPTION_PER_NM = {
    'Airbus A319': 2.4,
    'Airbus A320': 2.6,
    'Airbus A321': 3.0,
    'Airbus A330': 5.8,
    'Airbus A350': 5.2,
    'Airbus A380': 10.5,
    'Boeing 777': 7.5,
    'Boeing 787': 5.6,
    'Altro': 3.5,    // default estimate
};

export default function PilotProfileCard({ flights }) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Good morning';
        if (hour >= 12 && hour < 18) return 'Good afternoon';
        if (hour >= 18 || hour < 5) return 'Good evening';
        return 'Hello';
    };

    const stats = useMemo(() => {
        let totalHours = 0;
        let totalMiles = 0;
        let totalFuel = 0;
        const airportCounts = {};
        const countriesSet = new Set();
        let longestFlight = { miles: 0, departure: '', arrival: '' };

        flights.forEach(f => {
            totalHours += (f.flightTime || 0);
            totalMiles += (f.miles || 0);

            // Estimate fuel consumption based on aircraft type and miles
            const fuelRate = FUEL_CONSUMPTION_PER_NM[f.aircraft] || FUEL_CONSUMPTION_PER_NM['Altro'];
            totalFuel += (f.miles || 0) * fuelRate;

            // Track countries
            if (f.departure) {
                const depAirport = findAirport(f.departure.toUpperCase());
                if (depAirport?.country) countriesSet.add(depAirport.country);
                airportCounts[f.departure] = (airportCounts[f.departure] || 0) + 1;
            }
            if (f.arrival) {
                const arrAirport = findAirport(f.arrival.toUpperCase());
                if (arrAirport?.country) countriesSet.add(arrAirport.country);
                airportCounts[f.arrival] = (airportCounts[f.arrival] || 0) + 1;
            }

            // Track longest flight
            if ((f.miles || 0) > longestFlight.miles) {
                longestFlight = { miles: f.miles, departure: f.departure, arrival: f.arrival };
            }
        });

        // Determine favorite airport
        let favoriteAirport = 'N/A';
        let maxVisits = 0;
        for (const [icao, count] of Object.entries(airportCounts)) {
            if (count > maxVisits) {
                maxVisits = count;
                favoriteAirport = icao;
            }
        }

        const avgTime = flights.length > 0 ? (totalHours / flights.length) : 0;
        const avgMiles = flights.length > 0 ? (totalMiles / flights.length) : 0;

        // Determine current rank
        let currentRankIndex = 0;
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (totalHours >= RANKS[i].minHours) {
                currentRankIndex = i;
                break;
            }
        }

        const currentRank = RANKS[currentRankIndex];
        const nextRank = currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;

        // Calculate progress percentage
        let progress = 100;
        let hoursRemaining = 0;
        if (nextRank) {
            const hoursInCurrentRankLevel = totalHours - currentRank.minHours;
            const rankHoursSpan = nextRank.minHours - currentRank.minHours;
            progress = Math.min(100, Math.max(0, (hoursInCurrentRankLevel / rankHoursSpan) * 100));
            hoursRemaining = nextRank.minHours - totalHours;
        }

        const avgFuelPerNm = totalMiles > 0 ? (totalFuel / totalMiles) : 0;

        return {
            totalHours,
            currentRank,
            nextRank,
            progress,
            hoursRemaining,
            avgTime: avgTime.toFixed(1),
            avgMiles: Math.round(avgMiles),
            favoriteAirport,
            totalFuel: Math.round(totalFuel),
            avgFuelPerNm: avgFuelPerNm.toFixed(1),
            countriesVisited: countriesSet.size,
            longestFlight
        };
    }, [flights]);

    return (
        <div className="card" style={{ marginBottom: 'var(--space-6)', backgroundImage: 'linear-gradient(to right, var(--color-surface), rgba(26, 115, 232, 0.05))', border: '1px solid var(--color-primary-light)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', alignItems: 'stretch' }}>

                {/* Ranking Section */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <img
                            src="/avatar.jpg"
                            alt="Andrea"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary-light)', boxShadow: 'var(--shadow-sm)' }}
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Andrea&background=1a73e8&color=fff&size=80' }}
                        />
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                                {getGreeting()} Andrea
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                                    {stats.currentRank.icon}
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-family-display)', color: 'var(--color-primary)' }}>
                                    {stats.currentRank.name}
                                </h2>
                            </div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                                {stats.totalHours.toFixed(1)} flight hours logged
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.875rem' }}>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>Rank Progression</span>
                            <span style={{ fontWeight: 600 }}>{Math.round(stats.progress)}%</span>
                        </div>

                        {/* Progress Bar background */}
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-divider)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            {/* Progress Fill */}
                            <div style={{
                                height: '100%',
                                backgroundColor: 'var(--color-primary)',
                                width: `${stats.progress}%`,
                                transition: 'width 1s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                borderRadius: 'var(--radius-full)'
                            }}></div>
                        </div>

                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-hint)', textAlign: 'right' }}>
                            {stats.nextRank
                                ? `${stats.hoursRemaining.toFixed(1)}h remaining to ${stats.nextRank.name}`
                                : 'You have reached the maximum rank!'}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', backgroundColor: 'var(--color-divider)', margin: 'var(--space-2) 0' }} className="hide-on-mobile"></div>

                {/* Extra Stats Section - 2 columns x 3 rows */}
                <div style={{ flex: '1 1 400px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', alignContent: 'center' }}>

                    {/* Column 1, Row 1: Hub Preferito */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <MapPin size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Favorite Hub</div>
                            <div style={{ fontWeight: 600 }}>{stats.favoriteAirport}</div>
                        </div>
                    </div>

                    {/* Column 2, Row 1: Paesi Visitati */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#8e44ad', backgroundColor: 'rgba(142, 68, 173, 0.1)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Globe size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Countries Visited</div>
                            <div style={{ fontWeight: 600 }}>{stats.countriesVisited}</div>
                        </div>
                    </div>

                    {/* Column 1, Row 2: Media Ore / Volo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Clock size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Hours / Flight</div>
                            <div style={{ fontWeight: 600 }}>{stats.avgTime} h</div>
                        </div>
                    </div>

                    {/* Column 2, Row 2: Media Distanza / Volo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <PlaneIcon size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Distance / Flight</div>
                            <div style={{ fontWeight: 600 }}>{stats.avgMiles} nm</div>
                        </div>
                    </div>

                    {/* Column 1, Row 3: Fuel Stimato */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#e8710a', backgroundColor: 'rgba(232, 113, 10, 0.1)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Fuel size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Estimated Fuel</div>
                            <div style={{ fontWeight: 600 }}>{stats.totalFuel.toLocaleString()} kg <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400 }}>({stats.avgFuelPerNm} kg/nm)</span></div>
                        </div>
                    </div>

                    {/* Column 2, Row 3: Volo più Lungo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Trophy size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Longest Flight</div>
                            <div style={{ fontWeight: 600 }}>
                                {stats.longestFlight.miles > 0
                                    ? <>{stats.longestFlight.miles.toLocaleString()} nm <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400 }}>({stats.longestFlight.departure}→{stats.longestFlight.arrival})</span></>
                                    : 'N/A'
                                }
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            <style>{`
                @media (max-width: 640px) {
                    .hide-on-mobile {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}
