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
  tailNumber?: string;
  pilot: NpcPilot;
  departureTime: number; // minuti da mezzanotte UTC
  arrivalTime: number; // minuti da mezzanotte UTC
  status: 'Scheduled' | 'Boarding' | 'Pushback' | 'Taxi Out' | 'En Route' | 'Approach' | 'Taxi In' | 'Arrived' | 'Turnaround' | 'AOG/Cancel';
  progressPercent: number;
}

// Helper: parse dei minuti da stringa "HH:MM" a minuti
export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function parseBlock(blockStr: string): number {
  if (!blockStr) return 120;
  const hMatch = blockStr.match(/(\d+)h/);
  const mMatch = blockStr.match(/(\d+)m/);
  const h = hMatch ? parseInt(hMatch[1]) : 0;
  const m = mMatch ? parseInt(mMatch[1]) : 0;
  return h * 60 + m;
}

// Assegna proceduralmente un pilota limitando al rank corretto e alla BASE di appartenenza
export function assignPilot(flightNumber: string, aircraft: string, time: number, roster: NpcPilot[], base: string): NpcPilot {
  if (!roster || roster.length === 0) return { id: 'N/A', name: 'Unknown', rank: 'Captain', base: 'N/A' };
  
  // Seed deterministico più granulare: numero volo + orario + prima lettera targa 
  const acSeed = (aircraft || '').charCodeAt(0) || 0;
  const seed = (flightNumber || '').length + (time || 0) + acSeed;
  
  // 1. Filtriamo prioritariamente per BASE (Hub)
  let eligible = roster.filter(p => p.base === base);
  if (eligible.length === 0) eligible = roster; // Fallback globale se l'hub è vuoto

  // 2. Per i widebody, usiamo Senior/Chief Captains
  const requiresSenior = aircraft && (aircraft.includes('A350') || aircraft.includes('A330'));
  if (requiresSenior) {
    const seniorGroup = eligible.filter(p => p.rank === 'Senior Captain' || p.rank === 'Chief Captain');
    if (seniorGroup.length > 0) eligible = seniorGroup;
  }
  if (!eligible || eligible.length === 0) eligible = roster;
  
  const pilot = eligible[Math.abs(seed) % eligible.length];
  return pilot || { id: 'N/A', name: 'Unknown', rank: 'Captain', base: 'N/A' };
}

/**
 * Funzione principale Heartbeat
 * Calcola lo stato di tutto il network istantaneamente per un dato orario UTC.
 */
export function calculateNetworkState(opsPlan: any, roster: NpcPilot[], currentUtcTimeMs: number, fleetState: any[] = []): NetworkFlight[] {
  const d = new Date(currentUtcTimeMs);
  const currentMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  
  const activeFlights: NetworkFlight[] = [];
  
  if (!opsPlan || !opsPlan.hubs) return [];

  opsPlan.hubs.forEach((hub: any) => {
    if (!hub.routes) return;
    hub.routes.forEach((route: any) => {
      if (!route.legs) return;

      const suitableAircraft = fleetState.filter(ac => ac.type === route.aircraft || ac.type.includes(route.aircraft));

      route.legs.forEach((leg: any, index: number) => {
        const t = parseTime(leg.dep_utc);
        const duration = parseBlock(leg.block);
        const id = `${leg.flight}-${index}`;
        const baseNum = leg.flight;

        let assignedTail = 'Generic';
        let isAOG = false;
        const slot = leg.ac_slot || 1;
        
        if (suitableAircraft.length >= slot) {
            const ac = suitableAircraft[slot - 1];
            assignedTail = ac.id;
            isAOG = ac.status === 'AOG' || ac.isAOG;
        } else if (suitableAircraft.length > 0) {
            assignedTail = suitableAircraft[0].id;
            isAOG = suitableAircraft[0].status === 'AOG';
        }

        const pilot = assignPilot(id, route.aircraft, t, roster, hub.icao);
        
        let status: NetworkFlight['status'] = 'Scheduled';
        let progressPercent = 0;
        
        if (isAOG) {
           status = 'AOG/Cancel';
           progressPercent = 0;
        } else {
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
        }

        // Finestra di visibilità (dalle -2h alle +duration+2h)
        // Se è AOG lo mostriamo comunque se sarebbe dovuto partire oggi
        if (currentMins >= t - 120 && currentMins <= t + duration + 120) {
          activeFlights.push({
            id,
            flightNumber: baseNum,
            departure: leg.dep_icao || hub.icao,
            arrival: leg.arr_icao || route.dest,
            aircraft: route.aircraft,
            tailNumber: assignedTail,
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
      
      if (line.startsWith('| VLR-')) {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length >= 4) {
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
