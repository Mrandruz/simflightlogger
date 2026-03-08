import React, { useMemo } from 'react';
import { Award, Star, Shield, Medal, MapPin, Clock, Plane as PlaneIcon, Fuel, Globe, Trophy, Users, Zap } from 'lucide-react';
import airports from 'airport-data';
import customAirports from '../customAirports';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

const RANKS = [
    { name: 'Cadet', minXp: 0, icon: <Star size={24} className="text-secondary" /> },
    { name: 'Junior F.O.', minXp: 5000, icon: <Medal size={24} className="text-primary" /> },
    { name: 'First Officer', minXp: 15000, icon: <Award size={24} className="text-primary" /> },
    { name: 'Captain', minXp: 50000, icon: <Shield size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} /> },
    { name: 'Senior Captain', minXp: 150000, icon: <Shield size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} /> },
    { name: 'Chief Captain', minXp: Infinity, icon: <Award size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} /> }
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
        let totalXp = 0;
        const airportCounts = {};
        const allianceCounts = {};
        const dateCounts = {};
        const countriesSet = new Set();
        let longestFlight = { miles: 0, departure: '', arrival: '' };

        // For "Long Haul Ace" progression
        let longHaulCount = 0;

        // For "Alliance Loyal" progression (consecutive and total)
        let maxConsecutiveAlliance = 0;
        let currentConsecutiveAllianceCount = 0;
        let lastAlliance = null;

        // Sort flights chronologically to correctly check consecutive logic
        const sortedFlights = [...flights].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedFlights.forEach(f => {
            const fTime = f.flightTime || 0;
            const fMiles = f.miles || 0;
            const fDate = f.date ? f.date.substring(0, 10) : null;

            totalHours += fTime;
            totalMiles += fMiles;
            totalXp += Math.floor((fMiles / 10) + (fTime * 50));

            const fuelRate = FUEL_CONSUMPTION_PER_NM[f.aircraft] || FUEL_CONSUMPTION_PER_NM['Altro'];
            totalFuel += fMiles * fuelRate;

            if (f.alliance) {
                allianceCounts[f.alliance] = (allianceCounts[f.alliance] || 0) + 1;

                if (f.alliance === lastAlliance) {
                    currentConsecutiveAllianceCount++;
                } else {
                    currentConsecutiveAllianceCount = 1;
                    lastAlliance = f.alliance;
                }

                if (currentConsecutiveAllianceCount > maxConsecutiveAlliance) {
                    maxConsecutiveAlliance = currentConsecutiveAllianceCount;
                }
            } else {
                currentConsecutiveAllianceCount = 0;
                lastAlliance = null;
            }

            if (fDate) {
                dateCounts[fDate] = (dateCounts[fDate] || 0) + 1;
            }

            if (fMiles > 5000) {
                longHaulCount++;
            }

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

            if (fMiles > longestFlight.miles) {
                longestFlight = { miles: fMiles, departure: f.departure, arrival: f.arrival };
            }
        });

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

        let currentRankIndex = 0;
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (totalXp >= RANKS[i].minXp && RANKS[i].minXp !== Infinity) {
                currentRankIndex = i;
                if (totalXp >= 150000) currentRankIndex = RANKS.length - 1;
                break;
            }
        }

        const currentRank = RANKS[currentRankIndex];
        const nextRank = currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;

        let progress = 100;
        let xpRemaining = 0;
        if (nextRank) {
            const xpInCurrentRankLevel = totalXp - currentRank.minXp;
            const rankXpSpan = nextRank.minXp - currentRank.minXp;
            progress = Math.min(100, Math.max(0, (xpInCurrentRankLevel / rankXpSpan) * 100));
            xpRemaining = nextRank.minXp - totalXp;
        }

        const avgFuelPerNm = totalMiles > 0 ? (totalFuel / totalMiles) : 0;

        // Progress Calculations for Achievements

        // World Traveler (50 countries)
        const countriesCount = countriesSet.size;
        const worldTravelerGoal = 50;
        const hasWorldTraveler = countriesCount >= worldTravelerGoal;
        const worldTravelerProgress = Math.min(100, (countriesCount / worldTravelerGoal) * 100);

        // Long Haul Ace (20 flights > 5000nm)
        const longHaulGoal = 20;
        const hasLongHaulAce = longHaulCount >= longHaulGoal;
        const longHaulProgress = Math.min(100, (longHaulCount / longHaulGoal) * 100);

        // Alliance Loyal (5 consecutive OR 100 total)
        const maxTotalAnyAlliance = Object.values(allianceCounts).reduce((max, val) => Math.max(max, val), 0);
        const hasAllianceLoyal = maxConsecutiveAlliance >= 5 || maxTotalAnyAlliance >= 100;
        // Progress bar logic: use whichever percentage is closer to its goal
        const consecutivePct = Math.min(100, (maxConsecutiveAlliance / 5) * 100);
        const totalPct = Math.min(100, (maxTotalAnyAlliance / 100) * 100);
        const allianceLoyalProgress = Math.max(consecutivePct, totalPct);

        // Tireless (3 flights in the same day)
        const maxFlightsInDay = Object.values(dateCounts).reduce((max, val) => Math.max(max, val), 0);
        const tirelessGoal = 3;
        const hasTireless = maxFlightsInDay >= tirelessGoal;
        const tirelessProgress = Math.min(100, (maxFlightsInDay / tirelessGoal) * 100);

        return {
            totalHours,
            totalXp,
            currentRank,
            nextRank,
            progress,
            xpRemaining,
            avgTime: avgTime.toFixed(1),
            avgMiles: Math.round(avgMiles),
            favoriteAirport,
            totalFuel: Math.round(totalFuel),
            avgFuelPerNm: avgFuelPerNm.toFixed(1),
            countriesVisited: countriesCount,
            longestFlight,
            achievements: {
                worldTraveler: { unlocked: hasWorldTraveler, progress: worldTravelerProgress, current: countriesCount, goal: worldTravelerGoal },
                longHaulAce: { unlocked: hasLongHaulAce, progress: longHaulProgress, current: longHaulCount, goal: longHaulGoal },
                allianceLoyal: { unlocked: hasAllianceLoyal, progress: allianceLoyalProgress, current: maxConsecutiveAlliance, goal: 5 },
                tireless: { unlocked: hasTireless, progress: tirelessProgress, current: maxFlightsInDay, goal: tirelessGoal }
            }
        };
    }, [flights]);

    // Reusable component for the achievements
    const AchievementBadge = ({ id, title, description, icon: Icon, data }) => {
        const { unlocked, progress, current, goal } = data;
        const isCompleted = progress >= 100;

        return (
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                padding: '12px', borderRadius: 'var(--radius-md)',
                backgroundColor: isCompleted ? 'rgba(20, 106, 255, 0.08)' : 'rgba(255,255,255, 0.4)',
                border: `1px solid ${isCompleted ? 'var(--color-primary-light)' : 'var(--color-border)'}`,
                boxShadow: isCompleted ? '0 0 12px rgba(20, 106, 255, 0.15)' : 'none',
                minWidth: '160px', flex: 1,
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
            }} title={description}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        padding: '6px', borderRadius: '50%',
                        backgroundColor: isCompleted ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                        color: isCompleted ? '#ffffff' : 'var(--color-text-secondary)',
                        boxShadow: isCompleted ? '0 2px 8px rgba(20, 106, 255, 0.4)' : 'none'
                    }}>
                        <Icon size={16} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isCompleted ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{title}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                            {isCompleted ? 'Unlocked!' : `${current} / ${goal}`}
                        </div>
                    </div>
                </div>

                {/* Achievement mini progress bar */}
                <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--color-divider)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{
                        height: '100%',
                        backgroundColor: isCompleted ? 'var(--color-success)' : 'var(--color-primary)',
                        width: `${progress}%`,
                        transition: 'width 1s ease',
                        borderRadius: 'var(--radius-full)'
                    }}></div>
                </div>
            </div>
        );
    };

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
                                <span className="data-mono" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{stats.totalXp.toLocaleString()}</span> XP &bull; <span className="data-mono">{stats.totalHours.toFixed(1)}</span> h
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.875rem' }}>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>XP Progression</span>
                            <span style={{ fontWeight: 600 }} className="data-mono">{Math.round(stats.progress)}%</span>
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
                                ? `${stats.xpRemaining.toLocaleString()} XP remaining to ${stats.nextRank.name}`
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
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.favoriteAirport}</div>
                        </div>
                    </div>

                    {/* Column 2, Row 1: Paesi Visitati */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#8e44ad', backgroundColor: 'rgba(142, 68, 173, 0.1)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Globe size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Countries Visited</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.countriesVisited}</div>
                        </div>
                    </div>

                    {/* Column 1, Row 2: Media Ore / Volo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Clock size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Hours / Flight</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.avgTime} h</div>
                        </div>
                    </div>

                    {/* Column 2, Row 2: Media Distanza / Volo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <PlaneIcon size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Distance / Flight</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.avgMiles} nm</div>
                        </div>
                    </div>

                    {/* Column 1, Row 3: Fuel Stimato */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#e8710a', backgroundColor: 'rgba(232, 113, 10, 0.1)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Fuel size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Estimated Fuel</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.totalFuel.toLocaleString()} kg <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400, fontFamily: 'var(--font-family-sans)' }}>({stats.avgFuelPerNm} kg/nm)</span></div>
                        </div>
                    </div>

                    {/* Column 2, Row 3: Volo più Lungo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
                            <Trophy size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Longest Flight</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">
                                {stats.longestFlight.miles > 0
                                    ? <>{stats.longestFlight.miles.toLocaleString()} nm <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400, fontFamily: 'var(--font-family-sans)' }}>({stats.longestFlight.departure}→{stats.longestFlight.arrival})</span></>
                                    : 'N/A'
                                }
                            </div>
                        </div>
                    </div>

                </div>

                {/* Achievements Section */}
                <div style={{ flex: '1 1 100%', marginTop: 'var(--space-2)', paddingTop: 'var(--space-4)', borderTop: '1px dashed var(--color-divider)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>Recent Achievements</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>

                        <AchievementBadge
                            id="worldTraveler"
                            title="World Traveler"
                            description="Visit 50 different countries"
                            icon={Globe}
                            data={stats.achievements.worldTraveler}
                        />
                        <AchievementBadge
                            id="longHaulAce"
                            title="Long Haul Ace"
                            description="Complete 20 flights over 5000nm"
                            icon={PlaneIcon}
                            data={stats.achievements.longHaulAce}
                        />
                        <AchievementBadge
                            id="allianceLoyal"
                            title="Alliance Loyal"
                            description="Fly 5 consecutive times or 100 times total with the same alliance"
                            icon={Users}
                            data={stats.achievements.allianceLoyal}
                        />
                        <AchievementBadge
                            id="tireless"
                            title="Tireless"
                            description="Complete 3 flights in a single day"
                            icon={Zap}
                            data={stats.achievements.tireless}
                        />

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
