// Custom airport data for airports missing from the 'airport-data' npm package.
// This list supplements the main database with major international airports
// that are either newly built or have updated ICAO codes.

const customAirports = [
    {
        icao: "OTHH",
        name: "Hamad International Airport",
        city: "Doha",
        country: "Qatar",
        latitude: 25.2731,
        longitude: 51.6081,
        iata: "DOH"
    },
    {
        icao: "OMDB",
        name: "Dubai International Airport",
        city: "Dubai",
        country: "United Arab Emirates",
        latitude: 25.2528,
        longitude: 55.3644,
        iata: "DXB"
    },
    {
        icao: "OEJN",
        name: "King Abdulaziz International Airport",
        city: "Jeddah",
        country: "Saudi Arabia",
        latitude: 21.6796,
        longitude: 39.1565,
        iata: "JED"
    },
    {
        icao: "VIDP",
        name: "Indira Gandhi International Airport",
        city: "New Delhi",
        country: "India",
        latitude: 28.5562,
        longitude: 77.1000,
        iata: "DEL"
    },
    {
        icao: "OERK",
        name: "King Khalid International Airport",
        city: "Riyadh",
        country: "Saudi Arabia",
        latitude: 24.9576,
        longitude: 46.6988,
        iata: "RUH"
    },
    {
        icao: "OBBI",
        name: "Bahrain International Airport",
        city: "Muharraq",
        country: "Bahrain",
        latitude: 26.2708,
        longitude: 50.6336,
        iata: "BAH"
    },
    {
        icao: "OMSJ",
        name: "Sharjah International Airport",
        city: "Sharjah",
        country: "United Arab Emirates",
        latitude: 25.3286,
        longitude: 55.5172,
        iata: "SHJ"
    },
    {
        icao: "OMAA",
        name: "Abu Dhabi International Airport",
        city: "Abu Dhabi",
        country: "United Arab Emirates",
        latitude: 24.4430,
        longitude: 54.6511,
        iata: "AUH"
    },
    {
        icao: "LTFM",
        name: "Istanbul Airport",
        city: "Istanbul",
        country: "Turkey",
        latitude: 41.2753,
        longitude: 28.7519,
        iata: "IST"
    },
    {
        icao: "VHHH",
        name: "Hong Kong International Airport",
        city: "Hong Kong",
        country: "Hong Kong",
        latitude: 22.3080,
        longitude: 113.9185,
        iata: "HKG"
    },
    {
        icao: "SPJC",
        name: "Jorge Chávez International Airport",
        city: "Lima",
        country: "Peru",
        latitude: -12.0219,
        longitude: -77.1143,
        iata: "LIM"
    }
];

export default customAirports;
