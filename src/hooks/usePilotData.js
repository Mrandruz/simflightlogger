import { useMemo } from 'react';
import { findAirport } from '../utils/airportUtils';

// Constants
export const RANKS = [
    { name: 'Cadet', minXp: 0, color: 'text-secondary' },
    { name: 'Junior F.O.', minXp: 5000, color: 'text-primary' },
    { name: 'First Officer', minXp: 15000, color: 'text-primary' },
    { name: 'Captain', minXp: 75000, color: 'text-warning' },
    { name: 'Senior Captain', minXp: 400000, color: 'text-warning' },
    { name: 'Chief Captain', minXp: 700000, color: 'text-warning' }
];

export const FUEL_CONSUMPTION_PER_NM = {
    'Airbus A319': 2.4,
    'Airbus A320': 2.6,
    'Airbus A321': 3.0,
    'Airbus A330': 5.8,
    'Airbus A350': 5.2,
    'Airbus A380': 10.5,
    'Boeing 777': 7.5,
    'Boeing 787': 5.6,
    'Altro': 3.5,
};


const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const NEW_DISCOVERY_THRESHOLD_MS = 1773701100000; // 2026-03-16 23:45 Local

export function usePilotData(flights) {
    return useMemo(() => {
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
        const visitedAirportsHistory = new Set();
        const newDiscoveriesSet = new Set();
        const visitedAirportsAllTime = new Set(); // To track all unique airports for historical reference

        // For "Long Haul Ace" progression
        let longHaulCount = 0;

        // For "Airline Loyal" progression
        let maxConsecutiveAirline = 0;
        let currentConsecutiveAirlineCount = 0;
        let lastAirline = null;

        const sortedFlights = [...flights].sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            const dateDiff = dateA - dateB;
            if (dateDiff !== 0) return dateDiff;
            
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            if (timeA !== timeB) return timeA - timeB;
            
            return flights.indexOf(a) - flights.indexOf(b);
        });

        let currentStreak = 0;
        let maxStreak = 0;
        let lastFlightDateMs = null;
        let maxAirlineCount = 0;
        let maxAircraftCount = 0;
        let worldTravelerUnlockedDateMs = null;
        let longHaulAceUnlockedDateMs = null;
        let airlineLoyalUnlockedDateMs = null;
        let typeRatingMasterUnlockedDateMs = null;

        sortedFlights.forEach(f => {
            const fTime = f.flightTime || 0;
            const fMiles = f.miles || 0;
            const fDate = f.date ? f.date.substring(0, 10) : null;
            let flightDateMs = null;

            if (f.aircraft) {
                aircraftCounts[f.aircraft] = (aircraftCounts[f.aircraft] || 0) + 1;
                if (aircraftCounts[f.aircraft] > maxAircraftCount) {
                    maxAircraftCount = aircraftCounts[f.aircraft];
                }
            }

            if (f.airline) {
                airlineCounts[f.airline] = (airlineCounts[f.airline] || 0) + 1;
                if (airlineCounts[f.airline] > maxAirlineCount) {
                    maxAirlineCount = airlineCounts[f.airline];
                }

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
                const flightDateObj = new Date(fDate);
                flightDateMs = new Date(flightDateObj.getFullYear(), flightDateObj.getMonth(), flightDateObj.getDate()).getTime();

                if (lastFlightDateMs === null) {
                    currentStreak = 1;
                } else {
                    const diffDays = Math.round((flightDateMs - lastFlightDateMs) / ONE_DAY_MS);
                    if (diffDays === 1) {
                        currentStreak++;
                    } else if (diffDays > 1) {
                        currentStreak = 1;
                    }
                }

                if (currentStreak > maxStreak) {
                    maxStreak = currentStreak;
                }
                lastFlightDateMs = flightDateMs;
                dateCounts[fDate] = (dateCounts[fDate] || 0) + 1;
            }

            if (fMiles > 5000) {
                longHaulCount++;
            }

            if (f.departure) {
                const depCode = f.departure.toUpperCase();
                const depAirport = findAirport(depCode);
                if (depAirport?.country) countriesSet.add(depAirport.country);
                airportCounts[f.departure] = (airportCounts[f.departure] || 0) + 1;
                visitedAirportsAllTime.add(depCode);
            }
            if (f.arrival) {
                const arrCode = f.arrival.toUpperCase();
                const arrAirport = findAirport(arrCode);
                if (arrAirport?.country) countriesSet.add(arrAirport.country);
                airportCounts[f.arrival] = (airportCounts[f.arrival] || 0) + 1;

                // New Discovery Achievement Logic (Non-retroactive)
                // Use createdAt as the primary source of truth for "when" it was logged
                const logTimeMs = f.createdAt || flightDateMs;
                if (logTimeMs >= NEW_DISCOVERY_THRESHOLD_MS) {
                    // Check if this arrival was NEVER seen before in the entire sequence up to this flight
                    if (!visitedAirportsAllTime.has(arrCode)) {
                        newDiscoveriesSet.add(arrCode);
                    }
                }
                visitedAirportsAllTime.add(arrCode);
            }

            if (worldTravelerUnlockedDateMs === null && countriesSet.size >= 100 && flightDateMs) {
                worldTravelerUnlockedDateMs = flightDateMs;
            }
            if (longHaulAceUnlockedDateMs === null && longHaulCount >= 120 && flightDateMs) {
                longHaulAceUnlockedDateMs = flightDateMs;
            }
            if (airlineLoyalUnlockedDateMs === null && maxAirlineCount >= 70 && flightDateMs) {
                airlineLoyalUnlockedDateMs = flightDateMs;
            }
            if (typeRatingMasterUnlockedDateMs === null && maxAircraftCount >= 120 && flightDateMs) {
                typeRatingMasterUnlockedDateMs = flightDateMs;
            }

            totalHours += fTime;
            totalMiles += fMiles;

            let inBonusPeriod = false;
            const checkBonus = (unlockDateMs) => {
                if (unlockDateMs !== null && flightDateMs && flightDateMs <= (unlockDateMs + 30 * ONE_DAY_MS)) {
                    inBonusPeriod = true;
                }
            };
            checkBonus(worldTravelerUnlockedDateMs);
            checkBonus(longHaulAceUnlockedDateMs);
            checkBonus(airlineLoyalUnlockedDateMs);
            checkBonus(typeRatingMasterUnlockedDateMs);

            let flightXp = Math.floor((fMiles / 10) + (fTime * 50) + 250);
            
            // Apply "Active Pilot" multipliers for Short and Medium haul flights
            // Short: < 1500nm (1.5x)
            // Medium: 1500nm - 3000nm (1.25x)
            if (fMiles > 0 && fMiles < 1500) {
                flightXp = Math.round(flightXp * 1.5);
            } else if (fMiles >= 1500 && fMiles < 3000) {
                flightXp = Math.round(flightXp * 1.25);
            }

            if (inBonusPeriod) {
                flightXp *= 10;
            } else if (currentStreak >= 7) {
                flightXp *= 2;
            }

            if (totalXp >= 600000) {
                flightXp = Math.floor(flightXp * 1.5);
            }
            
            totalXp += flightXp;

            const fuelRate = FUEL_CONSUMPTION_PER_NM[f.aircraft] || FUEL_CONSUMPTION_PER_NM['Altro'];
            totalFuel += fMiles * fuelRate;

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
            if (totalXp >= RANKS[i].minXp) {
                currentRankIndex = i;
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

        const countriesCount = countriesSet.size;
        const worldTravelerGoal = 100;
        const hasWorldTraveler = countriesCount >= worldTravelerGoal;
        const worldTravelerProgress = Math.min(100, (countriesCount / worldTravelerGoal) * 100);

        const longHaulGoal = 120;
        const hasLongHaulAce = longHaulCount >= longHaulGoal;
        const longHaulProgress = Math.min(100, (longHaulCount / longHaulGoal) * 100);

        let topAirline = 'None';
        let maxTotalAnyAirline = 0;
        for (const [airline, count] of Object.entries(airlineCounts)) {
            if (count > maxTotalAnyAirline) {
                maxTotalAnyAirline = count;
                topAirline = airline;
            }
        }
        const hasAirlineLoyal = maxTotalAnyAirline >= 70;
        const airlineLoyalGoal = 70;
        const airlineLoyalProgress = Math.min(100, (maxTotalAnyAirline / airlineLoyalGoal) * 100);
        const airlineLoyalCurrent = maxTotalAnyAirline;

        const maxFlightsInDay = Object.values(dateCounts).reduce((max, val) => Math.max(max, val), 0);
        const tirelessGoal = 3;
        const hasTireless = maxFlightsInDay >= tirelessGoal;
        const tirelessProgress = Math.min(100, (maxFlightsInDay / tirelessGoal) * 100);

        let topAircraft = 'None';
        let maxTotalAnyAircraft = 0;
        for (const [aircraft, count] of Object.entries(aircraftCounts)) {
            if (count > maxTotalAnyAircraft) {
                maxTotalAnyAircraft = count;
                topAircraft = aircraft;
            }
        }
        const typeRatingGoal = 120;
        const hasTypeRatingMaster = maxTotalAnyAircraft >= typeRatingGoal;
        const typeRatingProgress = Math.min(100, (maxTotalAnyAircraft / typeRatingGoal) * 100);

        const streakGoal = 7;
        const hasDailyStreak = maxStreak >= streakGoal;
        const streakProgress = Math.min(100, (maxStreak / streakGoal) * 100);

        const newDiscoveryCount = newDiscoveriesSet.size;
        const newDiscoveryGoal = 50;
        const hasNewDiscovery = newDiscoveryCount >= newDiscoveryGoal;
        const newDiscoveryProgress = Math.min(100, (newDiscoveryCount / newDiscoveryGoal) * 100);

        const todayMs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
        let latestExpiryMs = null;
        const checkExpiry = (unlockDateMs) => {
            if (unlockDateMs !== null) {
                const expiry = unlockDateMs + 30 * ONE_DAY_MS;
                if (todayMs <= expiry) {
                    if (latestExpiryMs === null || expiry > latestExpiryMs) {
                        latestExpiryMs = expiry;
                    }
                }
            }
        };

        checkExpiry(worldTravelerUnlockedDateMs);
        checkExpiry(longHaulAceUnlockedDateMs);
        checkExpiry(airlineLoyalUnlockedDateMs);
        checkExpiry(typeRatingMasterUnlockedDateMs);

        const isMasterBonusActive = latestExpiryMs !== null;
        const activeBonusExpiryMs = latestExpiryMs;
        const isStreakBonusActive = !isMasterBonusActive && hasDailyStreak;

        // Unified active bonuses list for UI
        const activeBonuses = [];
        if (isMasterBonusActive) {
            const expiryDate = new Date(activeBonusExpiryMs);
            const expiryStr = expiryDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            activeBonuses.push({ label: '10x XP', color: '#ff6b35', bg: 'rgba(255,107,53,.12)', description: `Achievement bonus — expires ${expiryStr}` });
        }
        if (isStreakBonusActive) {
            activeBonuses.push({ label: '2x XP', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', description: '7-day streak active' });
        }

        let latestFlight = null;
        if (sortedFlights.length > 0) {
            const last = sortedFlights[sortedFlights.length - 1];
            latestFlight = {
                departure: last.departure,
                arrival: last.arrival,
                date: last.date
            };
        }

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
            latestFlight,
            isMasterBonusActive,
            activeBonusExpiryMs,
            isStreakBonusActive,
            activeBonuses,
            achievements: {
                worldTraveler: { unlocked: hasWorldTraveler, progress: worldTravelerProgress, current: countriesCount, goal: worldTravelerGoal },
                longHaulAce: { unlocked: hasLongHaulAce, progress: longHaulProgress, current: longHaulCount, goal: longHaulGoal },
                airlineLoyal: { unlocked: hasAirlineLoyal, progress: airlineLoyalProgress, current: airlineLoyalCurrent, goal: airlineLoyalGoal, extraInfo: airlineLoyalCurrent > 0 ? `Leading with: ${topAirline}` : null },
                tireless: { unlocked: hasTireless, progress: tirelessProgress, current: maxFlightsInDay, goal: tirelessGoal },
                typeRatingMaster: { unlocked: hasTypeRatingMaster, progress: typeRatingProgress, current: maxTotalAnyAircraft, goal: typeRatingGoal, extraInfo: maxTotalAnyAircraft > 0 ? `Leading with: ${topAircraft}` : null },
                dailyStreak: { unlocked: hasDailyStreak, progress: streakProgress, current: maxStreak, goal: streakGoal },
                newDiscovery: { unlocked: hasNewDiscovery, progress: newDiscoveryProgress, current: newDiscoveryCount, goal: newDiscoveryGoal }
            }
        };
    }, [flights]);
}
