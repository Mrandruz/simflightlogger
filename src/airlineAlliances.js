// Airline alliance mapping — updated March 2026
// Sources: official alliance websites
// Notable changes:
//   - SAS (SK) moved from Star Alliance → SkyTeam (September 2024)
//   - ITA Airways (AZ) left SkyTeam (April 2025), joining Star Alliance in early 2026 (in transition)
//   - Removed defunct airlines (Alitalia, Swissair, Air Berlin, Continental)
//   - Fixed misassigned codes (CX, BA, IB moved to correct alliances)
//   - Removed non-alliance carriers (EK, EY, WN)

export const airlineAlliances = {

    // ── Star Alliance ──────────────────────────────────────────────
    'LH': 'Star Alliance',   // Lufthansa
    'UA': 'Star Alliance',   // United Airlines
    'AC': 'Star Alliance',   // Air Canada
    'NH': 'Star Alliance',   // All Nippon Airways (ANA)
    'SQ': 'Star Alliance',   // Singapore Airlines
    'TG': 'Star Alliance',   // Thai Airways
    'OS': 'Star Alliance',   // Austrian Airlines
    'LX': 'Star Alliance',   // Swiss International Air Lines
    'SN': 'Star Alliance',   // Brussels Airlines
    'TP': 'Star Alliance',   // TAP Air Portugal
    'CA': 'Star Alliance',   // Air China
    'ET': 'Star Alliance',   // Ethiopian Airlines
    'MS': 'Star Alliance',   // EgyptAir
    'BR': 'Star Alliance',   // EVA Air
    'OZ': 'Star Alliance',   // Asiana Airlines
    'TK': 'Star Alliance',   // Turkish Airlines
    'SA': 'Star Alliance',   // South African Airways
    'AI': 'Star Alliance',   // Air India
    'AV': 'Star Alliance',   // Avianca
    'CM': 'Star Alliance',   // Copa Airlines
    'LO': 'Star Alliance',   // LOT Polish Airlines
    'ZH': 'Star Alliance',   // Shenzhen Airlines
    'A3': 'Star Alliance',   // Aegean Airlines
    'NZ': 'Star Alliance',   // Air New Zealand
    'OU': 'Star Alliance',   // Croatia Airlines
    // ITA Airways (AZ) — exited SkyTeam April 2025, joining Star Alliance April 1, 2026
    'AZ': 'Star Alliance',

    // ── SkyTeam ───────────────────────────────────────────────────
    'AF': 'SkyTeam',         // Air France
    'KL': 'SkyTeam',         // KLM
    'DL': 'SkyTeam',         // Delta Air Lines
    'AM': 'SkyTeam',         // Aeromexico
    'AR': 'SkyTeam',         // Aerolíneas Argentinas
    'MU': 'SkyTeam',         // China Eastern
    'CI': 'SkyTeam',         // China Airlines
    'KE': 'SkyTeam',         // Korean Air
    'SK': 'SkyTeam',         // SAS (joined September 2024)
    'UX': 'SkyTeam',         // Air Europa
    'ME': 'SkyTeam',         // Middle East Airlines
    'RO': 'SkyTeam',         // TAROM
    'VN': 'SkyTeam',         // Vietnam Airlines
    'GA': 'SkyTeam',         // Garuda Indonesia
    'VS': 'SkyTeam',         // Virgin Atlantic
    'SV': 'SkyTeam',         // Saudia
    'MF': 'SkyTeam',         // Xiamen Airlines
    'KQ': 'SkyTeam',         // Kenya Airways

    // ── Oneworld ──────────────────────────────────────────────────
    'AA': 'Oneworld',        // American Airlines
    'BA': 'Oneworld',        // British Airways
    'QF': 'Oneworld',        // Qantas
    'JL': 'Oneworld',        // Japan Airlines
    'AY': 'Oneworld',        // Finnair
    'IB': 'Oneworld',        // Iberia
    'CX': 'Oneworld',        // Cathay Pacific
    'QR': 'Oneworld',        // Qatar Airways
    'MH': 'Oneworld',        // Malaysia Airlines
    'RJ': 'Oneworld',        // Royal Jordanian
    'AT': 'Oneworld',        // Royal Air Maroc
    'AS': 'Oneworld',        // Alaska Airlines
    'UL': 'Oneworld',        // SriLankan Airlines
    'FJ': 'Oneworld',        // Fiji Airways
    'WY': 'Oneworld',        // Oman Air
};

// Get alliance by airline IATA code
export const getAllianceByAirline = (airlineCode) => {
    if (!airlineCode) return null;
    return airlineAlliances[airlineCode.toUpperCase()] || null;
};
