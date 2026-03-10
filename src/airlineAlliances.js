// Mapping of airlines to alliances
export const airlineAlliances = {
  // Star Alliance
  'LH': 'Star Alliance',   // Lufthansa
  'UA': 'Star Alliance',   // United Airlines
  'NH': 'Star Alliance',   // All Nippon Airways (ANA)
  'SQ': 'Star Alliance',   // Singapore Airlines
  'TG': 'Star Alliance',   // Thai Airways
  'OS': 'Star Alliance',   // Austrian Airlines
  'AZ': 'Star Alliance',   // Alitalia
  'BR': 'Star Alliance',   // EVA Air
  'CA': 'Star Alliance',   // Air China
  'CO': 'Star Alliance',   // Continental Airlines
  'AC': 'Star Alliance',   // Air Canada
  'SK': 'Star Alliance',   // SAS
  'SA': 'Star Alliance',   // SATA
  'CX': 'Star Alliance',   // Cathay Pacific
  'EK': 'Star Alliance',   // Emirates
  'ET': 'Star Alliance',   // Ethiopian Airlines
  'MS': 'Star Alliance',   // EgyptAir
  'XJ': 'Star Alliance',   // Air Chicagoexpress
  'AD': 'Star Alliance',   // ADRIA Airways
  'BA': 'Star Alliance',   // British Airways
  'IB': 'Star Alliance',   // Iberia
  'AB': 'Star Alliance',   // Air Berlin

  // SkyTeam
  'AF': 'SkyTeam',         // Air France
  'KL': 'SkyTeam',         // KLM
  'DL': 'SkyTeam',         // Delta Air Lines
  'AM': 'SkyTeam',         // Aeromexico
  'MU': 'SkyTeam',         // China Eastern
  'CZ': 'SkyTeam',         // China Southern
  'XJ': 'SkyTeam',         // XOJET
  'CX': 'SkyTeam',         // Cathay Pacific
  'CI': 'SkyTeam',         // China Airlines
  'KE': 'SkyTeam',         // Korean Air
  'AR': 'SkyTeam',         // Aerolíneas Argentinas
  'AV': 'SkyTeam',         // Avianca
  'FC': 'SkyTeam',         // Finncomm Airlines
  'FI': 'SkyTeam',         // Icelandair
  'RO': 'SkyTeam',         // TAROM
  'TP': 'SkyTeam',         // TAP Air Portugal
  'VN': 'SkyTeam',         // Vietnam Airlines
  'SV': 'SkyTeam',         // Saudia

  // Oneworld
  'AA': 'Oneworld',        // American Airlines
  'BA': 'Oneworld',        // British Airways
  'QF': 'Oneworld',        // Qantas
  'JL': 'Oneworld',        // Japan Airlines
  'AY': 'Oneworld',        // Finnair
  'IB': 'Oneworld',        // Iberia
  'LA': 'Oneworld',        // LATAM
  'MH': 'Oneworld',        // Malaysia Airlines
  'RJ': 'Oneworld',        // Royal Jordanian
  'S7': 'Oneworld',        // S7 Airlines
  'AS': 'Oneworld',        // Alaska Air
  'EY': 'Oneworld',        // Etihad Airways
  'WN': 'Oneworld',        // Southwest Airlines
  'QR': 'Oneworld',        // Qatar Airways
  'AX': 'Oneworld',        // Air Namibia
  'SR': 'Oneworld',        // Swissair
  'SN': 'Oneworld',        // Brussels Airlines
  'BA': 'Oneworld',        // British Airways
};

// Get alliance by airline code
export const getAllianceByAirline = (airlineCode) => {
  return airlineAlliances[airlineCode] || null;
};
