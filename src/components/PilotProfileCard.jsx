import React, { useMemo, useState } from 'react';
import { Award, Star, Shield, Medal, MapPin, Clock, Plane as PlaneIcon, Fuel, Globe, Trophy, Users, Zap, CalendarDays, ChevronRight } from 'lucide-react';
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
        const airlineCounts = {};
        const aircraftCounts = {};
        const dateCounts = {};
        const countriesSet = new Set();
        let longestFlight = { miles: 0, departure: '', arrival: '' };

        // For "Long Haul Ace" progression
        let longHaulCount = 0;

        // For "Airline Loyal" progression (consecutive and total)
        let maxConsecutiveAirline = 0;
        let currentConsecutiveAirlineCount = 0;
        let lastAirline = null;

        // Sort flights chronologically to correctly check consecutive logic and streaks
        const sortedFlights = [...flights].sort((a, b) => new Date(a.date) - new Date(b.date));

        // For "Daily Streak"
        let currentStreak = 0;
        let maxStreak = 0;
        let lastFlightDateMs = null;
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        sortedFlights.forEach(f => {
            const fTime = f.flightTime || 0;
            const fMiles = f.miles || 0;
            const fDate = f.date ? f.date.substring(0, 10) : null;

            // Track Aircraft for Type Rating Master
            if (f.aircraft) {
                aircraftCounts[f.aircraft] = (aircraftCounts[f.aircraft] || 0) + 1;
            }

            // Calculate sequence for daily streak based on unique days
            if (fDate) {
                const flightDateObj = new Date(fDate);
                // normalized to midnight
                const flightDateMs = new Date(flightDateObj.getFullYear(), flightDateObj.getMonth(), flightDateObj.getDate()).getTime();

                if (lastFlightDateMs === null) {
                    currentStreak = 1;
                } else {
                    const diffDays = Math.round((flightDateMs - lastFlightDateMs) / ONE_DAY_MS);
                    if (diffDays === 1) {
                        currentStreak++;
                    } else if (diffDays > 1) {
                        currentStreak = 1; // reset streak
                    }
                    // if diffDays === 0, it's the same day, streak continues but doesn't increment
                }

                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                }
                lastFlightDateMs = flightDateMs;
            }

            totalHours += fTime;
            totalMiles += fMiles;

            // Base XP
            let flightXp = Math.floor((fMiles / 10) + (fTime * 50));
            // xp Multiplier if streak >= 7 (applied after the 7 streak is established by evaluating if currentStreak at the time of flight was >= 7)
            if (currentStreak >= 7) {
                flightXp *= 2;
            }
            totalXp += flightXp;

            const fuelRate = FUEL_CONSUMPTION_PER_NM[f.aircraft] || FUEL_CONSUMPTION_PER_NM['Altro'];
            totalFuel += fMiles * fuelRate;

            if (f.airline) {
                airlineCounts[f.airline] = (airlineCounts[f.airline] || 0) + 1;

                if (f.airline === lastAirline) {
                    currentConsecutiveAirlineCount++;
                } else {
                    currentConsecutiveAirlineCount = 1;
                    lastAirline = f.airline;
                }

                if (currentConsecutiveAirlineCount > maxConsecutiveAirline) {
                    maxConsecutiveAirline = currentConsecutiveAirlineCount;
                }
            } else {
                currentConsecutiveAirlineCount = 0;
                lastAirline = null;
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

        // Airline Loyal (50 total)
        let topAirline = 'None';
        let maxTotalAnyAirline = 0;
        for (const [airline, count] of Object.entries(airlineCounts)) {
            if (count > maxTotalAnyAirline) {
                maxTotalAnyAirline = count;
                topAirline = airline;
            }
        }
        const hasAirlineLoyal = maxTotalAnyAirline >= 50;
        const airlineLoyalGoal = 50;
        const airlineLoyalProgress = Math.min(100, (maxTotalAnyAirline / airlineLoyalGoal) * 100);
        const airlineLoyalCurrent = maxTotalAnyAirline;

        // Tireless (3 flights in the same day)
        const maxFlightsInDay = Object.values(dateCounts).reduce((max, val) => Math.max(max, val), 0);
        const tirelessGoal = 3;
        const hasTireless = maxFlightsInDay >= tirelessGoal;
        const tirelessProgress = Math.min(100, (maxFlightsInDay / tirelessGoal) * 100);

        // Type Rating Master (50 total with same aircraft)
        let topAircraft = 'None';
        let maxTotalAnyAircraft = 0;
        for (const [aircraft, count] of Object.entries(aircraftCounts)) {
            if (count > maxTotalAnyAircraft) {
                maxTotalAnyAircraft = count;
                topAircraft = aircraft;
            }
        }
        const typeRatingGoal = 50;
        const hasTypeRatingMaster = maxTotalAnyAircraft >= typeRatingGoal;
        const typeRatingProgress = Math.min(100, (maxTotalAnyAircraft / typeRatingGoal) * 100);

        // Daily Streak (7 days consecutive)
        const streakGoal = 7;
        const hasDailyStreak = maxStreak >= streakGoal;
        const streakProgress = Math.min(100, (maxStreak / streakGoal) * 100);

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
                airlineLoyal: { unlocked: hasAirlineLoyal, progress: airlineLoyalProgress, current: airlineLoyalCurrent, goal: airlineLoyalGoal, extraInfo: airlineLoyalCurrent > 0 ? `Leading with: ${topAirline}` : null },
                tireless: { unlocked: hasTireless, progress: tirelessProgress, current: maxFlightsInDay, goal: tirelessGoal },
                typeRatingMaster: { unlocked: hasTypeRatingMaster, progress: typeRatingProgress, current: maxTotalAnyAircraft, goal: typeRatingGoal, extraInfo: maxTotalAnyAircraft > 0 ? `Leading with: ${topAircraft}` : null },
                dailyStreak: { unlocked: hasDailyStreak, progress: streakProgress, current: maxStreak, goal: streakGoal }
            }
        };
    }, [flights]);

    // Reusable component for the achievements
    const AchievementBadge = ({ id, title, description, icon: Icon, data }) => {
        const { current, goal, extraInfo } = data;
        let progress = data.progress;
        if (progress > 100) progress = 100;
        const isCompleted = progress >= 100;

        return (
            <div className={`achievement-card ${isCompleted ? 'completed' : ''}`}>
                <div className="achievement-tooltip">
                    <div style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>{description}</div>
                    {extraInfo && !isCompleted && (
                        <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            {extraInfo}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, textAlign: 'center' }}>
                    <div className="achievement-icon-wrapper">
                        <Icon size={16} />
                    </div>
                    <div style={{ width: '100%', zIndex: 1 }}>
                        <div className="achievement-title">{title}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                            {isCompleted ? <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>UNLOCKED!</span> : `${current} / ${goal}`}
                        </div>
                    </div>
                </div>

                <div className="achievement-progress-bg" style={{ zIndex: 1 }}>
                    <div className="achievement-progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        );
    };

    return (
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', backgroundImage: 'linear-gradient(to right, var(--color-surface), rgba(26, 115, 232, 0.05))', border: '1px solid var(--color-primary-light)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'stretch' }}>

                {/* Ranking Section */}
                <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <img
                            src="/avatar.jpg"
                            alt="Andrea"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary-light)', boxShadow: 'var(--shadow-sm)' }}
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Andrea&background=1a73e8&color=fff&size=80' }}
                        />
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
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
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                                <span className="data-mono" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{stats.totalXp.toLocaleString()}</span> XP &bull; <span className="data-mono">{stats.totalHours.toFixed(1)}</span> h
                                {stats.achievements.dailyStreak.unlocked && (
                                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                                        2x XP Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>XP Progression</span>
                            <span style={{ fontWeight: 600 }} className="data-mono">{Math.round(stats.progress)}%</span>
                        </div>

                        {/* Progress Bar background */}
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-divider)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            {/* Progress Fill */}
                            <div style={{
                                height: '100%',
                                backgroundColor: 'var(--color-primary)',
                                width: `${stats.progress}%`,
                                transition: 'width 1s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                borderRadius: 'var(--radius-full)'
                            }}></div>
                        </div>

                        <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--color-text-hint)', textAlign: 'right' }}>
                            {stats.nextRank
                                ? `${stats.xpRemaining.toLocaleString()} XP remaining to ${stats.nextRank.name}`
                                : 'You have reached the maximum rank!'}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', backgroundColor: 'var(--color-divider)', margin: 'var(--space-2) 0' }} className="hide-on-mobile"></div>

                {/* Extra Stats Section - 2 columns x 3 rows */}
                <div style={{ flex: '1 1 400px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', alignContent: 'center' }}>

                    {/* Column 1, Row 1: Hub Preferito */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                            <MapPin size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Favorite Hub</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.favoriteAirport}</div>
                        </div>
                    </div>

                    {/* Column 2, Row 1: Paesi Visitati */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#8e44ad', backgroundColor: 'rgba(142, 68, 173, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                            <Globe size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Countries Visited</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.countriesVisited}</div>
                        </div>
                    </div>

                    {/* Column 1, Row 2: Media Ore / Volo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                            <Clock size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Hours / Flight</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.avgTime} h</div>
                        </div>
                    </div>

                    {/* Column 2, Row 2: Media Distanza / Volo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                            <PlaneIcon size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Distance / Flight</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.avgMiles} nm</div>
                        </div>
                    </div>

                    {/* Column 1, Row 3: Fuel Stimato */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#e8710a', backgroundColor: 'rgba(232, 113, 10, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                            <Fuel size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Estimated Fuel</div>
                            <div style={{ fontWeight: 600 }} className="data-mono">{stats.totalFuel.toLocaleString()} kg <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400, fontFamily: 'var(--font-family-sans)' }}>({stats.avgFuelPerNm} kg/nm)</span></div>
                        </div>
                    </div>

                    {/* Column 2, Row 3: Volo più Lungo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{ color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
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
                <div style={{
                    flex: '1 1 100%',
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-4)',
                    borderRadius: '14px',
                    background: 'linear-gradient(145deg, rgba(20, 106, 255, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
                    position: 'relative'
                }}>
                    {/* Decorative background element */}
                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(20, 106, 255, 0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'stretch', position: 'relative', zIndex: 1 }}>
                        <div className="achievement-card" style={{
                            flex: '0 0 65px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            background: 'rgba(20, 106, 255, 0.08)',
                            border: '1px solid rgba(20, 106, 255, 0.2)',
                            padding: 'var(--space-3) 0',
                            borderRadius: '12px'
                        }}>
                            <div className="achievement-icon-wrapper" style={{
                                background: 'linear-gradient(135deg, var(--color-primary), #00d2ff)',
                                color: 'white',
                                boxShadow: '0 4px 10px rgba(20, 106, 255, 0.3)'
                            }}>
                                <Trophy size={18} />
                            </div>
                            <ChevronRight size={18} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
                        </div>

                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>

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
                                id="airlineLoyal"
                                title="Airline Loyal"
                                description="Fly 50 times total with the same airline"
                                icon={Users}
                                data={stats.achievements.airlineLoyal}
                            />
                            <AchievementBadge
                                id="tireless"
                                title="Tireless"
                                description="Complete 3 flights in a single day"
                                icon={Zap}
                                data={stats.achievements.tireless}
                            />
                            <AchievementBadge
                                id="typeRatingMaster"
                                title="Type Rating Master"
                                description="Fly 50 times with the same aircraft type"
                                icon={Award}
                                data={stats.achievements.typeRatingMaster}
                            />
                            <AchievementBadge
                                id="dailyStreak"
                                title="7-Day Streak"
                                description="Log at least one flight per day for 7 consecutive days"
                                icon={CalendarDays}
                                data={stats.achievements.dailyStreak}
                            />
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

                .achievement-card {
                    display: flex;
                    flex-direction: column;
                    gap: 9px;
                    padding: 9px 12px;
                    border-radius: 12px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    position: relative;
                    cursor: default;
                }

                .achievement-card:hover {
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
                    border-color: var(--color-primary-light);
                    z-index: 20;
                }

                .achievement-card.completed {
                    background: linear-gradient(135deg, rgba(20, 106, 255, 0.1), var(--color-surface));
                    border: 1px solid rgba(20, 106, 255, 0.3);
                    box-shadow: 0 4px 16px rgba(20, 106, 255, 0.08);
                }

                .achievement-card.completed:hover {
                    box-shadow: 0 10px 25px rgba(20, 106, 255, 0.2);
                    border-color: rgba(20, 106, 255, 0.6);
                }

                .achievement-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: var(--color-surface-hover);
                    color: var(--color-text-secondary);
                    transition: all 0.4s ease;
                }

                .achievement-card.completed .achievement-icon-wrapper {
                    background: linear-gradient(135deg, var(--color-primary), #00d2ff);
                    color: white;
                    box-shadow: 0 4px 10px rgba(20, 106, 255, 0.4);
                }

                .achievement-title {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--color-text-primary);
                    transition: color 0.3s ease;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .achievement-card.completed .achievement-title {
                    background: linear-gradient(135deg, var(--color-primary), #3b82f6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                :root[data-theme='dark'] .achievement-card.completed .achievement-title {
                    background: linear-gradient(135deg, #ffffff, #a5b4fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .achievement-progress-bg {
                    width: 100%;
                    height: 6px;
                    background-color: var(--color-divider);
                    border-radius: 8px;
                    overflow: hidden;
                    margin-top: 4px;
                }

                .achievement-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--color-primary), #00d2ff);
                    border-radius: 8px;
                    transition: width 1.2s cubic-bezier(0.25, 0.8, 0.25, 1);
                    position: relative;
                }
                
                .achievement-card.completed .achievement-progress-fill {
                    background: var(--color-success);
                }

                .achievement-progress-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    right: 0;
                    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
                    animation: shimmer 2s infinite linear;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .achievement-tooltip {
                    position: absolute;
                    bottom: calc(100% + 15px);
                    left: 50%;
                    transform: translateX(-50%) translateY(10px) scale(0.95);
                    opacity: 0;
                    visibility: hidden;
                    padding: 12px 16px;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    z-index: 100;
                    width: max-content;
                    max-width: 260px;
                    text-align: center;
                    pointer-events: none;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    color: rgba(255,255,255,0.9);
                }

                .achievement-card:hover .achievement-tooltip {
                    opacity: 1;
                    visibility: visible;
                    transform: translateX(-50%) translateY(0) scale(1);
                }

                .achievement-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 6px solid rgba(15, 23, 42, 0.95);
                }
            `}</style>
        </div>
    );
}
