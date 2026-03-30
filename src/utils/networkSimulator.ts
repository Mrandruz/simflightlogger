// src/utils/networkSimulator.ts

// Tipi
export interface NpcPilot {
  id: string;
  name: string;
  rank: string;
  base: string;
}

export interface NetworkFlight {
  id: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  aircraft: string;
  pilot: NpcPilot;
  departureTime: number; // minuti da mezzanotte UTC
  arrivalTime: number; // minuti da mezzanotte UTC
  status: 'Scheduled' | 'Boarding' | 'Pushback' | 'Taxi Out' | 'En Route' | 'Approach' | 'Taxi In' | 'Arrived' | 'Turnaround';
  progressPercent: number;
}

// Helper: parse dei minuti da stringa "HH:MM" a minuti
export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Genera orari deterministici in base alla frequenza
function generateFlightTimes(freq: string, flightBaseId: string, baseSeed: number): number[] {
  if (!freq) freq = 'Daily';
  if (!flightBaseId) flightBaseId = 'VLR000';
  let count = 1;
  
  if (freq.includes('Weekly')) {
    // 4x Weekly etc -> significa voli in giorni diversi, quindi simuliamo 1 solo volo per oggi
    count = 1;
  } else {
    if (freq.includes('2x')) count = 2;
    else if (freq.includes('3x')) count = 3;
    else if (freq.includes('4x')) count = 4;
    else if (freq.includes('5x')) count = 5;
    else if (freq.includes('6x')) count = 6;
  }
  
  // Semplice seed basato sull'ID del volo per dare orari "fissi" ma distribuiti
  const seed = flightBaseId.split('').reduce((acc, char) => acc + char.charCodeAt(0), baseSeed) || 0;
  const startHour = 6 + (Math.abs(seed) % 4); // i voli iniziano tra le 06:00 e le 09:00 UTC
  
  const times = [];
  for (let i = 0; i < count; i++) {
    // Spaziatura equa durante la giornata. Es: se count=2, start=7 -> 07:00, 19:00
    times.push((startHour + i * (16 / count)) * 60);
  }
  return times;
}

// Durata media stimata in base al tipo di aereo (molto approssimativa, proof of concept)
function estimateFlightDurationMins(aircraft: string): number {
  if (!aircraft) return 120;
  if (aircraft.includes('A319') || aircraft.includes('A320')) return 120; // 2 ore
  if (aircraft.includes('A321LR')) return 360; // 6 ore
  if (aircraft.includes('A330') || aircraft.includes('A350')) return 600; // 10 ore
  return 120;
}

// Assegna proceduralmente un pilota limitando al rank corretto
function assignPilot(flightNumber: string, aircraft: string, time: number, roster: NpcPilot[]): NpcPilot {
  if (!roster || roster.length === 0) return { id: 'N/A', name: 'Unknown', rank: 'Captain', base: 'N/A' };
  
  // Semplice hash deterministico 
  const seed = (flightNumber || '').length + (time || 0);
  // Per i widebody, usiamo Senior Captains
  const requiresSenior = aircraft && (aircraft.includes('A350') || aircraft.includes('A330'));
  let eligible = roster;
  if (requiresSenior) {
    eligible = roster.filter(p => p.rank === 'Senior Captain' || p.rank === 'Chief Captain');
  }
  if (!eligible || eligible.length === 0) eligible = roster;
  
  const pilot = eligible[Math.abs(seed) % eligible.length];
  return pilot || { id: 'N/A', name: 'Unknown', rank: 'Captain', base: 'N/A' };
}

/**
 * Funzione principale Heartbeat
 * Calcola lo stato di tutto il network istantaneamente per un dato orario UTC.
 */
export function calculateNetworkState(opsPlan: any, roster: NpcPilot[], currentUtcTimeMs: number): NetworkFlight[] {
  const d = new Date(currentUtcTimeMs);
  const currentMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  
  const activeFlights: NetworkFlight[] = [];
  
  // Iteriamo tutti gli hub e le rotte del JSON
  if (!opsPlan || !opsPlan.hubs) return [];

  opsPlan.hubs.forEach((hub: any) => {
    if (!hub.routes) return;
    hub.routes.forEach((route: any) => {
      // Estrai volo base es: "VLR 101/102" -> ["VLR101", "VLR102"]
      const routeFlight = route.flight || `VLR${Math.floor(Math.random() * 1000)}`;
      const baseNum = routeFlight.replace(/ /g, '').split('/')[0]; 
      const times = generateFlightTimes(route.freq, baseNum, 0);
      const duration = estimateFlightDurationMins(route.aircraft);
      
      times.forEach((t, index) => {
        const id = `${baseNum}-${index}`;
        const pilot = assignPilot(id, route.aircraft, t, roster);
        
        let status: NetworkFlight['status'] = 'Scheduled';
        let progressPercent = 0;
        
        // Calcolo dello stato
        if (currentMins >= t - 60 && currentMins < t - 25) {
          status = 'Boarding';
        } else if (currentMins >= t - 25 && currentMins < t - 15) {
          status = 'Pushback';
        } else if (currentMins >= t - 15 && currentMins < t) {
          status = 'Taxi Out';
        } else if (currentMins >= t && currentMins < t + duration - 30) {
          status = 'En Route';
          progressPercent = ((currentMins - t) / duration) * 100;
        } else if (currentMins >= t + duration - 30 && currentMins < t + duration) {
          status = 'Approach';
          progressPercent = ((currentMins - t) / duration) * 100;
        } else if (currentMins >= t + duration && currentMins < t + duration + 15) {
          status = 'Taxi In';
          progressPercent = 100;
        } else if (currentMins >= t + duration + 15 && currentMins < t + duration + 45) {
          status = 'Arrived';
          progressPercent = 100;
        } else if (currentMins >= t + duration + 45 && currentMins < t + duration + 120) {
          status = 'Turnaround';
          progressPercent = 100;
        }

        // Filtriamo e mostriamo solo voli non totalmente passati/futuri (finestra di -2h a + duration + 2h)
        if (currentMins >= t - 120 && currentMins <= t + duration + 120) {
          activeFlights.push({
            id,
            flightNumber: baseNum,
            departure: hub.icao,
            arrival: route.dest,
            aircraft: route.aircraft,
            pilot,
            departureTime: t,
            arrivalTime: t + duration,
            status,
            progressPercent: Number(progressPercent.toFixed(1))
          });
        }
      });
    });
  });

  return activeFlights;
}

// Utility per caricare il roster testuale MD e convertirlo
export async function fetchNpcRoster(): Promise<NpcPilot[]> {
  try {
    const res = await fetch('/roster_velar.md');
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split('\n');
    const roster: NpcPilot[] = [];
    let currentBase = 'LIRF'; // default
    
    lines.forEach(line => {
      if (line.includes('HUB ROMA')) currentBase = 'LIRF';
      else if (line.includes('HUB BOSTON')) currentBase = 'KBOS';
      else if (line.includes('HUB GIACARTA')) currentBase = 'WIII';
      
      if (line.startsWith('| VLR-PIC-')) {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length >= 5) {
          roster.push({
            id: parts[1],
            name: parts[2],
            rank: parts[3],
            base: currentBase
          });
        }
      }
    });
    return roster;
  } catch (error) {
    console.error('Error parsing roster:', error);
    return [];
  }
}
