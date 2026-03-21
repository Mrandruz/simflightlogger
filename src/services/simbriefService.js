export const fetchSimBriefData = async (identifier = { username: 'mrandruz' }) => {
  console.log('SimBrief: Fetching data for', identifier);
  try {
    const params = new URLSearchParams();
    if (identifier.userid) {
      params.append('userid', identifier.userid);
    } else {
      params.append('username', identifier.username || 'mrandruz');
    }
    
    // We append json=v2 in the proxy/Vite config, but let's be safe
    const url = `/api/simbrief?${params.toString()}`;
    console.log('SimBrief: Request URL', url);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SimBrief: API error response', errorText);
      let errorMsg = 'SimBrief connection error.';
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.fetch?.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    console.log('SimBrief: Raw API Data (JSON v2):', data);
    console.log('--- DEBUG INFO ---');
    console.log('Times field:', data.times);
    console.log('Navlog field:', data.navlog);
    console.log('--- END DEBUG INFO ---');
    
    if (data.fetch && data.fetch.status === 'error') {
      console.warn('SimBrief: Fetch status error', data.fetch.message);
      throw new Error(data.fetch.message || 'No flight plan found.');
    }
    
    return data;
  } catch (error) {
    console.error('SimBrief: Error in service', error);
    throw error;
  }
};

export const formatDuration = (val) => {
  if (!val) return 'N/D';
  
  // Handle HH:MM:SS (SimBrief primary format e.g. "08:58:25")
  if (typeof val === 'string' && val.includes(':')) {
    const parts = val.split(':');
    if (parts.length === 3) {
      const h = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      return `${h}h ${m}m`;
    }
    if (parts.length === 2) {
      const h = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      return `${h}h ${m}m`;
    }
  }

  // Handle "HHMM"
  if (typeof val === 'string' && val.length >= 3 && val.length <= 4 && !isNaN(parseInt(val))) {
    return `${parseInt(val.slice(0, -2))}h ${parseInt(val.slice(-2))}m`;
  }

  const durationSec = parseInt(val);
  if (isNaN(durationSec)) return val;

  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.floor((durationSec % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// Parse any SimBrief duration value → decimal hours
const parseDurationToHours = (val) => {
  if (!val) return null;
  const s = String(val).trim();

  // "HH:MM:SS" → most common SimBrief format
  const hmsMatch = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hmsMatch) return parseInt(hmsMatch[1]) + parseInt(hmsMatch[2]) / 60 + parseInt(hmsMatch[3]) / 3600;

  // "HH:MM"
  const hmColonMatch = s.match(/^(\d+):(\d{2})$/);
  if (hmColonMatch) return parseInt(hmColonMatch[1]) + parseInt(hmColonMatch[2]) / 60;

  // "8+58"
  const plusMatch = s.match(/^(\d+)\+(\d{2})$/);
  if (plusMatch) return parseInt(plusMatch[1]) + parseInt(plusMatch[2]) / 60;

  // Pure number: if > 1440 → seconds, if > 24 → minutes, else → hours
  if (!isNaN(Number(s))) {
    const n = Number(s);
    if (n > 1440) return n / 3600;
    if (n > 24)   return n / 60;
    return n;
  }
  return null;
};

export const parseSimBriefData = (data) => {
  if (!data || !data.origin || !data.destination) {
    console.warn('SimBrief: Missing origin or destination in data');
    return null;
  }

  const safeFloat = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getLat = (obj) => {
    if (!obj) return 0;
    const val = obj.pos_lat ?? obj.latitude ?? obj.lat_deg ?? obj.lat ?? obj.pos_lat_deg ?? obj.lat_decimal;
    return safeFloat(val);
  };
  
  const getLon = (obj) => {
    if (!obj) return 0;
    // VERY IMPORTANT: SimBrief often uses pos_long (with a 'g')
    const val = obj.pos_long ?? obj.pos_lon ?? obj.longitude ?? obj.lon_deg ?? obj.lon ?? obj.lng ?? obj.long ?? obj.pos_lon_deg ?? obj.lon_decimal ?? obj.pos_long_deg;
    return safeFloat(val);
  };

  console.log('SimBrief: Origin object:', data.origin);
  console.log('SimBrief: Destination object:', data.destination);
  console.log('SimBrief: Origin parsed:', getLat(data.origin), getLon(data.origin));
  console.log('SimBrief: Destination parsed:', getLat(data.destination), getLon(data.destination));

  // Duration fallbacks
  const rawDuration = 
    data.times?.est_time_enroute || 
    data.times?.enroute_time || 
    data.times?.ete ||
    data.params?.time_enroute ||
    data.general?.est_time_enroute || 
    null;

  console.log('SimBrief: Raw duration found:', rawDuration);
  console.log('SimBrief: Full times object:', JSON.stringify(data.times));

  // Waypoints fallbacks - User says data.navlog is the array itself
  let waypointsRaw = [];
  if (Array.isArray(data.navlog)) {
    waypointsRaw = data.navlog;
  } else if (data.navlog?.fix) {
    waypointsRaw = Array.isArray(data.navlog.fix) ? data.navlog.fix : [data.navlog.fix];
  } else if (data.navlog?.waypoint) {
    waypointsRaw = Array.isArray(data.navlog.waypoint) ? data.navlog.waypoint : [data.navlog.waypoint];
  }

  if (waypointsRaw.length > 0) {
    console.log('SimBrief: Waypoint keys log:', Object.keys(waypointsRaw[0]));
    console.log('SimBrief: First waypoint data:', waypointsRaw[0]);
  }

  const waypoints = waypointsRaw
    .map(fix => ({
      lat: getLat(fix),
      lon: getLon(fix)
    }))
    .filter(fix => {
      return (fix.lat !== 0 || fix.lon !== 0);
    });

  const getAirlineName = (icao) => {
    if (!icao) return '';
    const airlines = {
      'DLH': 'Lufthansa',
      'KLM': 'KLM',
      'AZA': 'ITA Airways',
      'BAW': 'British Airways',
      'AFR': 'Air France',
      'UAL': 'United Airlines',
      'AAL': 'American Airlines',
      'DAL': 'Delta Air Lines',
      'RYR': 'Ryanair',
      'EZY': 'EasyJet',
      'UAE': 'Emirates',
      'QTR': 'Qatar Airways',
      'SWR': 'Swiss International Air Lines',
      'BEL': 'Brussels Airlines',
      'THY': 'Turkish Airlines',
      'VLG': 'Vueling',
      'IBE': 'Iberia',
      'TAP': 'TAP Air Portugal',
      'FIN': 'Finnair',
      'SAS': 'SAS',
      'ACA': 'Air Canada',
      'ANA': 'All Nippon Airways',
      'JAL': 'Japan Airlines',
      'QFA': 'Qantas',
      'ANZ': 'Air New Zealand',
      'WZZ': 'Wizz Air',
      'VRI': 'Volotea',
      'EJU': 'EasyJet Europe',
      'EIN': 'Aer Lingus',
      'LHR': 'Lufthansa CityLine'
    };
    return airlines[icao.toUpperCase()] || '';
  };

  const callsign = data.atc?.callsign || 'N/A';
  const airlineIcao = data.general?.icao_airline || '';
  const airlineName = getAirlineName(airlineIcao);

  return {
    origin: {
      icao: data.origin.icao_code || '---',
      name: data.origin.name || 'Unknown',
      lat: getLat(data.origin),
      lon: getLon(data.origin)
    },
    destination: {
      icao: data.destination.icao_code || '---',
      name: data.destination.name || 'Unknown',
      lat: getLat(data.destination),
      lon: getLon(data.destination)
    },
    callsign,
    airlineName,
    aircraft: data.aircraft?.icaocode || 'N/A',
    route: data.general?.route || 'N/A',
    cruiseAltitude: data.general?.initial_altitude || 0,
    distance: data.general?.air_distance || 0,
    fuel: data.fuel?.plan_ramp || 0,
    duration: rawDuration ? formatDuration(rawDuration) : 'N/D',
    durationSeconds: rawDuration ? parseDurationToHours(rawDuration) : null,
    passengers: data.general?.passengers || '0',
    costIndex: data.general?.costindex || '0',
    zfw: data.weights?.est_zfw || '0',
    departureTime: data.times?.est_off || data.times?.sched_off || data.params?.time_off || data.general?.sched_departure || null,
    arrivalTime: data.times?.est_on || data.times?.sched_on || data.params?.time_on || data.general?.sched_arrival || null,
    departureRunway: data.origin?.plan_rwy || '--',
    arrivalRunway: data.destination?.plan_rwy || '--',
    sid: data.general?.sid || '--',
    star: data.general?.star || '--',
    ofpUrl: data.files?.html?.link || data.files?.pdf?.link || null,
    waypoints: waypoints
  };
};
