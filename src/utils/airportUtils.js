import airports from 'airport-data';
import customAirports from '../customAirports';

/**
 * Finds an airport by its ICAO code, searching both the standard airport-data 
 * and our customAirports definitions.
 * 
 * @param {string} icao - The ICAO code of the airport to find.
 * @returns {object|undefined} The airport object if found, otherwise undefined.
 */
const airportCache = new Map();

export const findAirport = (icao) => {
    if (!icao) return undefined;
    const searchIcao = icao.toUpperCase();
    
    if (airportCache.has(searchIcao)) {
        return airportCache.get(searchIcao);
    }

    const found = airports.find(a => a.icao === searchIcao) || 
                  customAirports.find(a => a.icao === searchIcao);
    
    if (found) {
        airportCache.set(searchIcao, found);
    }
    
    return found;
};
