/**
 * ARIA — Adaptive Route Intelligence Assistant
 * Velar Virtual Airline · Skydeck SimFlightLogger
 *
 * Variabili d'ambiente da aggiungere in .env:
 *   VITE_ANTHROPIC_API_KEY=sk-ant-...
 *
 * Uso:
 *   import ARIAAssistant from './ARIAAssistant';
 *   <ARIAAssistant userId={user.uid} pilotName={user.displayName} />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Flight {
  id: string;
  date: string;
  departure: string;
  arrival: string;
  aircraft: string;
  airline: string;
  alliance: string;
  flightTime: number;
  miles: number;
  createdAt?: number;
}

interface Rank {
  name: string;
  minXp: number;
}

interface PilotProfile {
  totalXp: number;
  totalHours: number;
  totalFlights: number;
  currentRank: Rank;
  nextRank: Rank | null;
  progress: number;
  favoriteAirport: string;
  topAircraft: string;
  latestFlight: { departure: string; arrival: string; date: string } | null;
}

interface ScheduledFlight {
  day: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureCity: string;
  arrivalCity: string;
  aircraft: string;
  estimatedDuration: string;
  distance: string;
  departureTime: string;
  arrivalTime: string;
  reason: string;
}

// Usa Record<string,any> per tollerare qualsiasi variazione di schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WeatherData = Record<string, any>;

interface ChatMessage {
  role: 'aria' | 'pilot';
  content: string;
  timestamp: Date;
}

// ─── Costanti (speculari a usePilotData.js) ───────────────────────────────────

const RANKS: Rank[] = [
  { name: 'Cadet', minXp: 0 },
  { name: 'Junior F.O.', minXp: 5000 },
  { name: 'First Officer', minXp: 15000 },
  { name: 'Captain', minXp: 75000 },
  { name: 'Senior Captain', minXp: 400000 },
  { name: 'Chief Captain', minXp: 700000 },
];

const ONE_DAY_MS = 86400000;

// ─── Piano Operativo Velar v1.0 ───────────────────────────────────────────────

const VELAR_FLEET = `
FLOTTA VELAR (Fase di Lancio v1.0):
- 1x Airbus A350-900 (Flagship): rotte intercontinentali LIRF↔KBOS e LIRF↔WIII
- 3x Airbus A320-200 (Feeders): connessioni europee verso l'hub di Roma Fiumicino (LIRF)
`;

const VELAR_ROUTES_LONGHAUL = `
ROTTE LUNGO RAGGIO (A350-900) — rotazione settimanale:
- Lunedì:    VLR101 LIRF→KBOS dep 10:30 arr 13:00 | VLR102 KBOS→LIRF dep 15:30 arr 05:00(+1) [red-eye]
- Martedì:   VLR201 LIRF→WIII dep 11:30 arr 07:00(+1) "Nusantara Soul"
- Mercoledì: VLR202 WIII→LIRF dep 10:30 arr 19:00
- Giovedì:   BUFFER / MANUTENZIONE (Fleet Check)
- Venerdì:   VLR101 LIRF→KBOS dep 10:30 arr 13:00 | VLR102 KBOS→LIRF dep 15:30 arr 05:00(+1)
- Sabato:    VLR201 LIRF→WIII dep 11:30 arr 07:00(+1)
- Domenica: VLR202 WIII→LIRF dep 10:30 arr 19:00
`;

const VELAR_ROUTES_SHORTHAUL = `
ROTTE CORTO/MEDIO RAGGIO (A320-200) — operatività giornaliera:
- A320-1: VLR311 LIML→LIRF dep 07:00 arr 08:10 | VLR312 LIRF→LIML dep 20:30 arr 21:40
- A320-2: VLR411 EGLL→LIRF dep 06:00 arr 09:20 | VLR412 LIRF→EGLL dep 20:00 arr 21:40
- A320-3: VLR511 LFPG→LIRF dep 06:45 arr 08:45 | VLR512 LIRF→LFPG dep 20:15 arr 22:15
`;

const ARIA_PROTOCOL = `
PROTOCOLLO ARIA — Tono e Comportamento:
- Empatia Professionale: amichevole e rassicurante, ma estremamente conciso. Non interferire con le fasi critiche del volo.
- Supporto, non comando: proponi soluzioni, l'ultima parola spetta sempre al Comandante.
- Priorità: 1) Sicurezza (safety first) 2) Puntualità 3) Pianificazione crew.
- Motto Velar: "Motion, simplified."
- Esempio di tono: "Comandante [nome], il check della cabina per il volo VLR101 è completo. Ho rilevato [info]. Suggerisco [azione]."
`;


// ─── Piano Operativo Velar v2.0 ──────────────────────────────────────────────

const VELAR_FLEET_V2 = [
  { type: 'Airbus A319', count: 5, role: 'Executive Shuttle', mission: 'Rotte regionali ad alto rendimento' },
  { type: 'Airbus A320', count: 10, role: 'Core Fleet', mission: 'Europeo e asiatico ad alta frequenza' },
  { type: 'Airbus A321LR', count: 5, role: 'Long Range NB', mission: 'Transcontinentale a densità media' },
  { type: 'Airbus A330neo', count: 2, role: 'High Cap Long Haul', mission: 'Transatlantico e oceanico' },
  { type: 'Airbus A350-900', count: 3, role: 'Flagship', mission: 'Ultra-long-haul Hub-to-Hub' },
];

const VELAR_HUBS = [
  {
    icao: 'LIRF', city: 'Roma Fiumicino', role: 'Global Hub',
    description: 'Baricentro operativo Velar, collegando l'Europa al mondo.',
    routes: [
      { dest: 'KBOS', city: 'Boston', aircraft: 'A350-900', freq: 'Daily', flight: 'VLR 101/102', note: 'Hub-to-Hub' },
      { dest: 'WIII', city: 'Giacarta', aircraft: 'A350-900', freq: 'Daily', flight: 'VLR 201/202', note: 'Hub-to-Hub' },
      { dest: 'KJFK', city: 'New York JFK', aircraft: 'A330neo', freq: 'Daily', flight: 'VLR 111/112', note: 'Premium Business' },
      { dest: 'OMDB', city: 'Dubai', aircraft: 'A321LR', freq: 'Daily', flight: 'VLR 211/212', note: 'ME Gateway' },
      { dest: 'EGLL', city: 'Londra', aircraft: 'A320', freq: '3x Daily', flight: 'VLR 411-416', note: 'Feeders' },
      { dest: 'LFPG', city: 'Parigi CDG', aircraft: 'A320', freq: '3x Daily', flight: 'VLR 511-516', note: 'Luxury' },
      { dest: 'LIML', city: 'Milano Linate', aircraft: 'A320', freq: '4x Daily', flight: 'VLR 311-318', note: 'Domestic Executive' },
      { dest: 'LSZH', city: 'Zurigo', aircraft: 'A319', freq: '2x Daily', flight: 'VLR 611-614', note: 'Finance Shuttle' },
      { dest: 'EDDB', city: 'Berlino', aircraft: 'A320', freq: 'Daily', flight: 'VLR 711/712', note: 'Tech Feeder' },
    ],
  },
  {
    icao: 'WIII', city: 'Giacarta Soekarno-Hatta', role: 'Asian Gateway',
    description: 'Cuore dell'ospitalità Nusantara e porta per l'Oceania.',
    routes: [
      { dest: 'LIRF', city: 'Roma', aircraft: 'A350-900', freq: 'Daily', flight: 'VLR 201/202', note: 'Hub-to-Hub' },
      { dest: 'YSSY', city: 'Sydney', aircraft: 'A330neo', freq: '4x Weekly', flight: 'VLR 811/812', note: 'Oceania' },
      { dest: 'WSSS', city: 'Singapore', aircraft: 'A320', freq: '3x Daily', flight: 'VLR 821-826', note: 'Asian Business' },
      { dest: 'RJTT', city: 'Tokyo Haneda', aircraft: 'A321LR', freq: 'Daily', flight: 'VLR 831/832', note: 'Tech Capital' },
      { dest: 'WADD', city: 'Bali', aircraft: 'A320', freq: '2x Daily', flight: 'VLR 841-844', note: 'Premium Leisure' },
    ],
  },
  {
    icao: 'KBOS', city: 'Boston Logan', role: 'Tech Corridor',
    description: 'Porto d'ingresso per l'innovazione e il mercato Nord Americano.',
    routes: [
      { dest: 'LIRF', city: 'Roma', aircraft: 'A350-900', freq: 'Daily', flight: 'VLR 101/102', note: 'Hub-to-Hub' },
      { dest: 'KSFO', city: 'San Francisco', aircraft: 'A321LR', freq: 'Daily', flight: 'VLR 911/912', note: 'Tech Bridge' },
      { dest: 'KAUS', city: 'Austin', aircraft: 'A321LR', freq: '4x Weekly', flight: 'VLR 921/922', note: 'Silicon Hills' },
      { dest: 'CYYZ', city: 'Toronto', aircraft: 'A319', freq: 'Daily', flight: 'VLR 931/932', note: 'NE Connection' },
      { dest: 'EGLL', city: 'Londra', aircraft: 'A330neo', freq: 'Daily', flight: 'VLR 941/942', note: 'Academic/Finance' },
    ],
  },
];

// ─── Calcolo profilo pilota ───────────────────────────────────────────────────

function computePilotProfile(flights: Flight[]): PilotProfile {
  let totalHours = 0, totalMiles = 0, totalXp = 0;
  const airportCounts: Record<string, number> = {};
  const aircraftCounts: Record<string, number> = {};
  let currentStreak = 0, maxStreak = 0, lastFlightDateMs: number | null = null;
  let lastFlight: { departure: string; arrival: string; date: string } | null = null;

  const sorted = [...flights].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  sorted.forEach(f => {
    const fTime = f.flightTime || 0;
    const fMiles = f.miles || 0;
    totalHours += fTime;
    totalMiles += fMiles;

    if (f.departure) airportCounts[f.departure] = (airportCounts[f.departure] || 0) + 1;
    if (f.arrival) airportCounts[f.arrival] = (airportCounts[f.arrival] || 0) + 1;
    if (f.aircraft) aircraftCounts[f.aircraft] = (aircraftCounts[f.aircraft] || 0) + 1;

    const fDate = f.date?.substring(0, 10);
    if (fDate) {
      const d = new Date(fDate);
      const ms = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (lastFlightDateMs === null) currentStreak = 1;
      else {
        const diff = Math.round((ms - lastFlightDateMs) / ONE_DAY_MS);
        if (diff === 1) currentStreak++;
        else if (diff > 1) currentStreak = 1;
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      lastFlightDateMs = ms;
    }

    let xp = Math.floor((fMiles / 10) + (fTime * 50) + 250);
    if (fMiles > 0 && fMiles < 1500) xp = Math.round(xp * 1.5);
    else if (fMiles >= 1500 && fMiles < 3000) xp = Math.round(xp * 1.25);
    if (maxStreak >= 7) xp *= 2;
    if (totalXp >= 600000) xp = Math.floor(xp * 1.5);
    totalXp += xp;

    lastFlight = { departure: f.departure, arrival: f.arrival, date: f.date };
  });

  let favoriteAirport = 'LIRF', maxVisits = 0;
  for (const [icao, count] of Object.entries(airportCounts)) {
    if (count > maxVisits) { maxVisits = count; favoriteAirport = icao; }
  }

  let topAircraft = 'Airbus A320', maxAcCount = 0;
  for (const [ac, count] of Object.entries(aircraftCounts)) {
    if (count > maxAcCount) { maxAcCount = count; topAircraft = ac; }
  }

  let currentRankIndex = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalXp >= RANKS[i].minXp) { currentRankIndex = i; break; }
  }
  const currentRank = RANKS[currentRankIndex];
  const nextRank = currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;
  let progress = 100;
  if (nextRank) {
    progress = Math.min(100, ((totalXp - currentRank.minXp) / (nextRank.minXp - currentRank.minXp)) * 100);
  }

  return {
    totalXp, totalHours, totalFlights: flights.length,
    currentRank, nextRank, progress,
    favoriteAirport, topAircraft, latestFlight: lastFlight,
  };
}

// ─── Weather ──────────────────────────────────────────────────────────────────

// Normalizza un record METAR raw nel formato semplice usato internamente
function normalizeMETAR(m: Record<string, any>): WeatherData {
  return {
    icaoId: m.icaoId || m.icao || '',
    name: m.name || '',
    pres: m.altim != null ? Math.round(m.altim) : null,
    wind: m.wdir != null && m.wspd != null ? `${m.wdir}°/${m.wspd}kt` : null,
    temp: m.temp != null ? Math.round(m.temp) : null,
    dew: m.dewp != null ? Math.round(m.dewp) : null,
    fltCat: m.fltCat || null,
    cover: m.cover || null,
    rawOb: m.rawOb || m.raw_text || null,
  };
}

async function fetchMetar(icaoCodes: string[]): Promise<WeatherData[]> {
  // Usa lo stesso endpoint di Schedule.jsx — /api/metar è già configurato
  // nel vite.config.js come proxy verso aviationweather.gov
  const ids = icaoCodes.join(',');
  try {
    const res = await fetch(`/api/metar?ids=${ids}&format=json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map(normalizeMETAR);
  } catch (e) {
    console.warn('[ARIA] METAR fetch failed:', e);
    return [];
  }
}

function computeFlightCategory(w: WeatherData): string {
  // Se già disponibile nel payload, usalo
  if (w.flight_category) return w.flight_category.toUpperCase();

  // Calcola da visibilità e ceiling (standard FAA)
  const vis = typeof w.visib === 'string' ? parseFloat(w.visib) : (w.visib ?? w.visibility_statute_mi ?? 10);
  
  // Estrai ceiling dal campo clouds nuovo schema (es. "BKN045 OVC080") o sky_condition
  let ceilingFt = 99999;
  if (w.clouds) {
    const matches = w.clouds.matchAll(/(BKN|OVC)(\d{3})/g);
    for (const m of matches) {
      const ft = parseInt(m[2]) * 100;
      if (ft < ceilingFt) ceilingFt = ft;
    }
  } else if (w.sky_condition) {
    for (const s of w.sky_condition) {
      if ((s.sky_cover === 'BKN' || s.sky_cover === 'OVC') && s.cloud_base_ft_agl) {
        if (s.cloud_base_ft_agl < ceilingFt) ceilingFt = s.cloud_base_ft_agl;
      }
    }
  }

  if (vis < 1 || ceilingFt < 500) return 'LIFR';
  if (vis < 3 || ceilingFt < 1000) return 'IFR';
  if (vis <= 5 || ceilingFt <= 3000) return 'MVFR';
  return 'VFR';
}

function flightCategory(w: WeatherData): { label: string; color: string } {
  const cat = computeFlightCategory(w);
  if (cat === 'VFR') return { label: 'VFR', color: 'var(--color-success)' };
  if (cat === 'MVFR') return { label: 'MVFR', color: 'var(--color-primary)' };
  if (cat === 'IFR') return { label: 'IFR', color: 'var(--color-danger)' };
  if (cat === 'LIFR') return { label: 'LIFR', color: '#a855f7' };
  return { label: 'N/A', color: 'var(--color-text-hint)' };
}

// ─── SimBrief ─────────────────────────────────────────────────────────────────

// Altitudini di crociera ottimali per tipo aeromobile
const CRUISE_ALTITUDE: Record<string, string> = {
  'Airbus A319': '350', 'Airbus A320': '370', 'Airbus A320-200': '370',
  'Airbus A321': '370', 'Airbus A330': '350', 'Airbus A350': '390',
  'Airbus A350-900': '390', 'Airbus A380': '350',
  'Boeing 777': '350', 'Boeing 787': '390',
};

const AC_TYPE_MAP: Record<string, string> = {
  'Airbus A319': 'A319', 'Airbus A320': 'A320', 'Airbus A320-200': 'A320',
  'Airbus A321': 'A321', 'Airbus A330': 'A332', 'Airbus A350': 'A359',
  'Airbus A350-900': 'A359', 'Airbus A380': 'A388',
  'Boeing 777': 'B77W', 'Boeing 787': 'B789',
};

function buildSimbriefUrl(flight: ScheduledFlight): string {
  const acType = AC_TYPE_MAP[flight.aircraft] || 'A320';
  const cruise = CRUISE_ALTITUDE[flight.aircraft] || '370';
  // Estrai numero volo numerico da es. "VLR101" → "101"
  const fltnum = flight.flightNumber.replace(/[^0-9]/g, '');
  const params = new URLSearchParams({
    airline: 'VLR',
    fltnum,
    orig: flight.departure,
    dest: flight.arrival,
    type: acType,
    cruise,
  });
  return `https://dispatch.simbrief.com/options/custom?${params.toString()}`;
}

// ─── Componente principale ────────────────────────────────────────────────────

interface ARIAProps {
  userId: string;
  pilotName?: string;
}

type ViewState = 'chat' | 'schedule' | 'weather' | 'fleet';

export default function ARIAAssistant({ userId, pilotName }: ARIAProps) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>('chat');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [schedule, setSchedule] = useState<ScheduledFlight[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<ScheduledFlight | null>(null);

  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherAirports, setWeatherAirports] = useState('');
  const [fleetBriefing, setFleetBriefing] = useState('');
  const [fleetBriefingLoading, setFleetBriefingLoading] = useState(false);


  // ── Carica voli da Firestore ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', userId, 'flights'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Flight));
        setFlights(data);
        const p = computePilotProfile(data);
        setProfile(p);

        setMessages([{
          role: 'aria',
          content: `Comandante ${pilotName || 'Pilota'}, sistema ARIA operativo.\n\nHo analizzato il tuo logbook: **${data.length} voli**, **${p.totalHours.toFixed(0)} ore** di volo, rank **${p.currentRank.name}**.\n\nPosso generare la tua schedule settimanale basata sulle rotte ufficiali Velar, suggerirti la rotta ottimale per la giornata, o controllare il meteo per i tuoi aeroporti. Come posso supportarti?`,
          timestamp: new Date(),
        }]);
      } catch (e) {
        console.error('Firestore error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, pilotName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── System prompt ─────────────────────────────────────────────────────────
  const buildSystemPrompt = useCallback((p: PilotProfile) => `
Sei ARIA (Adaptive Route Intelligence Assistant), il co-pilota virtuale e coordinatore operativo della compagnia aerea virtuale Velar su Skydeck SimFlightLogger.

${ARIA_PROTOCOL}
${VELAR_FLEET}
${VELAR_ROUTES_LONGHAUL}
${VELAR_ROUTES_SHORTHAUL}

PROFILO PILOTA ATTIVO:
- Nome: ${pilotName || 'Comandante'}
- Rank: ${p.currentRank.name}
- XP totale: ${p.totalXp.toLocaleString()}
- Ore di volo: ${p.totalHours.toFixed(0)}h
- Voli completati: ${p.totalFlights}
- Aeroporto preferito: ${p.favoriteAirport}
- Ultimo volo: ${p.latestFlight ? `${p.latestFlight.departure} → ${p.latestFlight.arrival}` : 'N/D'}

REGOLE:
- Parla sempre in italiano
- Sii conciso e professionale, mai ridondante
- Fai riferimento alle rotte e alla flotta ufficiale Velar quando pertinente
- Non generare schedule nella chat: rimanda al tab "Schedule" dedicato
- Il motto di Velar è "Motion, simplified" — riflettilo nel tuo stile comunicativo
`.trim(), [pilotName]);

  // ── Invia messaggio ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !profile || isTyping) return;
    const userMsg: ChatMessage = { role: 'pilot', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const history = messages.slice(-10).map(m => ({
      role: m.role === 'aria' ? 'assistant' : 'user',
      content: m.content,
    }));

    try {
      const res = await fetch('/api/aria-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildSystemPrompt(profile),
          messages: [...history, { role: 'user', content: userMsg.content }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || 'Nessuna risposta ricevuta.';
      setMessages(prev => [...prev, { role: 'aria', content: text, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'aria', content: 'Errore di comunicazione. Riprova.', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, profile, isTyping, messages, buildSystemPrompt]);

  // ── Genera schedule ───────────────────────────────────────────────────────
  const generateSchedule = useCallback(async () => {
    if (!profile) return;
    setScheduleLoading(true);
    setSchedule([]);

    const isLongHaulQualified = ['Captain', 'Senior Captain', 'Chief Captain'].includes(profile.currentRank.name);

    const prompt = `
Sei ARIA, il sistema di pianificazione voli di Velar Virtual Airline.

${VELAR_FLEET}
${VELAR_ROUTES_LONGHAUL}
${VELAR_ROUTES_SHORTHAUL}

PILOTA: ${pilotName || 'Comandante'} — Rank: ${profile.currentRank.name} — Ore totali: ${profile.totalHours.toFixed(0)}h
ABILITAZIONE LUNGO RAGGIO: ${isLongHaulQualified ? 'SÌ (A350-900 disponibile)' : 'NO (solo A320-200 feeder)'}

Genera la schedule settimanale (Lunedì → Domenica, 7 voli) rispettando RIGOROSAMENTE queste regole:
1. Usa SOLO le rotte e gli aeromobili ufficiali Velar elencati sopra
2. Se il pilota è abilitato al lungo raggio: includi almeno 2 rotte A350 e completa con feeder A320
3. Se non abilitato: usa solo le rotte feeder A320 (VLR311/312, VLR411/412, VLR511/512)
4. Rispetta gli orari di partenza/arrivo ufficiali
5. Giovedì può essere buffer/manutenzione se serve bilanciare la rotazione A350
6. Il campo "reason" deve spiegare perché ARIA ha assegnato quel volo quel giorno (stile co-pilota professionale)

Rispondi SOLO con JSON valido, nessun testo aggiuntivo, nessun markdown:
[
  {
    "day": "Lunedì",
    "flightNumber": "VLR101",
    "departure": "LIRF",
    "arrival": "KBOS",
    "departureCity": "Roma Fiumicino",
    "arrivalCity": "Boston Logan",
    "aircraft": "Airbus A350-900",
    "estimatedDuration": "9h 30m",
    "distance": "4,232 nm",
    "departureTime": "10:30",
    "arrivalTime": "13:00",
    "reason": "Apertura settimana sul flagship intercontinentale. The First Port."
  }
]
`.trim();

    try {
      const res = await fetch('/api/aria-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || '[]';
      // Estrai JSON anche se il modello aggiunge testo prima/dopo
      const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const clean = jsonMatch ? jsonMatch[0] : raw.replace(/```json|```/g, '').trim();
      const parsed: ScheduledFlight[] = JSON.parse(clean);
      setSchedule(parsed);
    } catch (e) {
      console.error('Schedule generation error:', e);
    } finally {
      setScheduleLoading(false);
    }
  }, [profile, pilotName]);


  // ── Genera briefing flotta ────────────────────────────────────────────────
  const generateFleetBriefing = useCallback(async () => {
    if (!profile || fleetBriefingLoading || fleetBriefing) return;
    setFleetBriefingLoading(true);

    const systemPrompt = buildSystemPrompt(profile);
    const prompt = `Genera un messaggio di stato operativo della flotta Velar per il Comandante ${pilotName || 'Comandante'}.
Flotta: 25 aeromobili (5xA319, 10xA320, 5xA321LR, 2xA330neo, 3xA350-900).
Hub attivi: Roma Fiumicino (Global Hub), Giacarta (Asian Gateway), Boston (Tech Corridor).
Tutte le rotte sono operative.
Stile: professionale, sintetico, esattamente come nell'esempio del Protocollo ARIA 2.0. Max 3 frasi. Inizia con "Buongiorno Comandante".`;

    try {
      const res = await fetch('/api/aria-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      setFleetBriefing(text);
    } catch {
      setFleetBriefing('Sistemi ARIA operativi. Flotta Velar al 100%. Motion, simplified.');
    } finally {
      setFleetBriefingLoading(false);
    }
  }, [profile, pilotName, buildSystemPrompt, fleetBriefingLoading, fleetBriefing]);

  // Auto-genera briefing quando si apre la tab fleet
  useEffect(() => {
    if (view === 'fleet' && profile && !fleetBriefing && !fleetBriefingLoading) {
      generateFleetBriefing();
    }
  }, [view, profile, fleetBriefing, fleetBriefingLoading, generateFleetBriefing]);

  // ── Fetch meteo ───────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    const codes = weatherAirports.toUpperCase().split(/[\s,]+/).filter(s => s.length === 4);
    if (!codes.length) return;
    setWeatherLoading(true);
    const data = await fetchMetar(codes);
    setWeatherData(data);
    setWeatherLoading(false);
  }, [weatherAirports]);

  useEffect(() => {
    if (view === 'weather' && schedule.length > 0 && weatherAirports === '') {
      const airports = [...new Set(schedule.flatMap(f => [f.departure, f.arrival]))];
      setWeatherAirports(airports.join(' '));
    }
  }, [view, schedule, weatherAirports]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <div style={s.loadingSpinner} />
        <p style={s.loadingText}>ARIA sta analizzando il logbook...</p>
      </div>
    );
  }

  return (
    <div style={s.container}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.ariaLogo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 style={s.title}>ARIA</h2>
            <p style={s.subtitle}>Co-Pilot Virtuale · Velar Virtual Airline</p>
          </div>
        </div>
        {profile && (
          <div style={s.pilotBadge}>
            <span style={s.rankLabel}>{profile.currentRank.name}</span>
            <span style={s.xpLabel}>{profile.totalXp.toLocaleString()} XP</span>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <div style={s.nav}>
        {(['chat', 'schedule', 'weather'] as ViewState[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ ...s.navBtn, ...(view === v ? s.navBtnActive : {}) }}>
            {v === 'chat' ? '💬 Chat' : v === 'schedule' ? '📅 Schedule' : '🌤 Meteo'}
          </button>
        ))}
      </div>

      {/* ── CHAT ── */}
      {view === 'chat' && (
        <div style={s.chatContainer}>
          <div style={s.messageList}>
            {messages.map((msg, i) => (
              <div key={i} style={{ ...s.msgRow, ...(msg.role === 'pilot' ? s.msgRowPilot : {}) }}>
                {msg.role === 'aria' && <div style={s.ariaAvatar}>A</div>}
                <div style={{ ...s.bubble, ...(msg.role === 'pilot' ? s.bubblePilot : s.bubbleAria) }}>
                  {msg.content.split('\n').map((line, j) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                      <p key={j} style={s.msgLine}>
                        {parts.map((p, k) => k % 2 === 1 ? <strong key={k}>{p}</strong> : p)}
                      </p>
                    );
                  })}
                  <span style={s.msgTime}>
                    {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={s.msgRow}>
                <div style={s.ariaAvatar}>A</div>
                <div style={{ ...s.bubble, ...s.bubbleAria }}>
                  <div style={s.typingDots}>
                    <span style={{ ...s.dot, animationDelay: '0s' }} />
                    <span style={{ ...s.dot, animationDelay: '0.2s' }} />
                    <span style={{ ...s.dot, animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={s.quickActions}>
            {[
              'Qual è la rotta più redditizia in XP?',
              'Aggiornami sulle rotte Velar attive',
              'Come salgo di rank più velocemente?',
            ].map(q => (
              <button key={q} style={s.quickBtn} onClick={() => setInput(q)}>{q}</button>
            ))}
          </div>

          <div style={s.inputRow}>
            <input
              style={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Messaggio ad ARIA..."
            />
            <button style={s.sendBtn} onClick={sendMessage} disabled={isTyping || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {view === 'schedule' && (
        <div style={s.scheduleContainer}>
          {schedule.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyText}>Nessuna schedule generata.</p>
              <p style={s.emptySubText}>
                ARIA costruirà la tua settimana rispettando il Piano Operativo Velar v1.0 e il tuo rank attuale.
              </p>
              <button style={s.generateBtn} onClick={generateSchedule} disabled={scheduleLoading}>
                {scheduleLoading ? 'Generazione in corso...' : '✦ Genera Schedule Settimanale'}
              </button>
            </div>
          ) : (
            <>
              <div style={s.scheduleHeader}>
                <span style={s.scheduleTitle}>Schedule settimanale · Velar</span>
                <button style={s.regenBtn} onClick={generateSchedule} disabled={scheduleLoading}>
                  {scheduleLoading ? '...' : '↻ Rigenera'}
                </button>
              </div>
              <div style={s.flightList}>
                {schedule.map((f, i) => {
                  const isLongHaul = f.aircraft.includes('A350') || f.aircraft.includes('A330') ||
                    f.aircraft.includes('777') || f.aircraft.includes('787');
                  const isSelected = selectedFlight === f;
                  return (
                    <div key={i}
                      style={{ ...s.flightCard, ...(isSelected ? s.flightCardSelected : {}) }}
                      onClick={() => setSelectedFlight(isSelected ? null : f)}>

                      <div style={s.flightCardTop}>
                        <span style={s.flightDay}>{f.day}</span>
                        <span style={s.flightNumber}>{f.flightNumber}</span>
                        {isLongHaul && <span style={s.longHaulBadge}>LONG HAUL</span>}
                        <span style={s.flightAircraft}>{f.aircraft}</span>
                      </div>

                      <div style={s.flightRoute}>
                        <div style={s.routePoint}>
                          <span style={s.icao}>{f.departure}</span>
                          <span style={s.routeCity}>{f.departureCity}</span>
                          {f.departureTime && <span style={s.flightTime}>{f.departureTime}</span>}
                        </div>
                        <div style={s.routeArrow}>
                          <svg width="40" height="12" viewBox="0 0 40 12">
                            <line x1="0" y1="6" x2="34" y2="6" stroke="var(--color-border)" strokeWidth="1.5"/>
                            <path d="M34 2l6 4-6 4" fill="none" stroke="var(--color-border)" strokeWidth="1.5"/>
                          </svg>
                          <span style={s.routeMeta}>{f.distance} · {f.estimatedDuration}</span>
                        </div>
                        <div style={{ ...s.routePoint, textAlign: 'right' as const }}>
                          <span style={s.icao}>{f.arrival}</span>
                          <span style={s.routeCity}>{f.arrivalCity}</span>
                          {f.arrivalTime && <span style={s.flightTime}>{f.arrivalTime}</span>}
                        </div>
                      </div>

                      {isSelected && (
                        <div style={s.flightDetail}>
                          <p style={s.flightReason}>💬 {f.reason}</p>
                          <div style={s.flightActions}>
                            <a
                              href={buildSimbriefUrl(f)}
                              target="_blank" rel="noopener noreferrer"
                              style={s.simbriefBtn}
                              onClick={e => e.stopPropagation()}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Apri in SimBrief
                            </a>
                            <button style={s.meteoBtn}
                              onClick={e => {
                                e.stopPropagation();
                                setWeatherAirports(`${f.departure} ${f.arrival}`);
                                setView('weather');
                              }}>
                              🌤 Meteo rotta
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WEATHER ── */}
      {view === 'weather' && (
        <div style={s.weatherContainer}>
          <div style={s.weatherSearch}>
            <input
              style={s.weatherInput}
              value={weatherAirports}
              onChange={e => setWeatherAirports(e.target.value)}
              placeholder="Codici ICAO separati da spazio (es. LIRF EGLL LFPG KBOS)"
            />
            <button style={s.weatherFetchBtn} onClick={fetchWeather} disabled={weatherLoading}>
              {weatherLoading ? '...' : 'Fetch METAR'}
            </button>
          </div>

          {weatherData.length > 0 && (
            <div style={s.weatherGrid}>
              {weatherData.map((w, i) => {
                const cat = flightCategory(w);
                return (
                  <div key={i} style={s.weatherCard}>
                    <div style={s.weatherCardHeader}>
                      <span style={s.weatherIcao}>{w.icaoId || '—'}</span>
                      <span style={{ ...s.weatherCat, color: cat.color, borderColor: cat.color }}>
                        {cat.label}
                      </span>
                    </div>
                    {w.name && <p style={s.weatherName}>{w.name}</p>}
                    <div style={s.weatherStats}>
                      {w.pres != null && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Pres</span>
                          <span style={s.wStatVal}>{w.pres}</span>
                        </div>
                      )}
                      {w.wind != null && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Wind</span>
                          <span style={s.wStatVal}>{w.wind}</span>
                        </div>
                      )}
                      {w.temp != null && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Temp</span>
                          <span style={s.wStatVal}>{w.temp}°</span>
                        </div>
                      )}
                      {w.dew != null && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Dew</span>
                          <span style={s.wStatVal}>{w.dew}°</span>
                        </div>
                      )}
                    </div>
                    {w.rawOb && (
                      <div style={s.rawMetar}>
                        <span style={s.rawLabel}>METAR</span>
                        <code style={s.rawCode}>{w.rawOb}</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {weatherData.length === 0 && !weatherLoading && (
            <div style={s.emptyState}>
              <p style={s.emptyText}>Inserisci i codici ICAO e premi Fetch METAR.</p>
              <p style={s.emptySubText}>Dati in tempo reale · aviationweather.gov</p>
            </div>
          )}
        </div>
      )}

      {/* ── FLEET STATUS ── */}
      {view === 'fleet' && (
        <div style={s.fleetContainer}>

          {/* Briefing ARIA */}
          <div style={s.fleetBriefingCard}>
            <div style={s.fleetBriefingHeader}>
              <div style={s.ariaAvatar}>A</div>
              <div>
                <p style={s.fleetBriefingLabel}>ARIA · Fleet Status Briefing</p>
                <p style={s.fleetBriefingTime}>
                  {new Date().toLocaleString('it-IT', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div style={s.fleetBriefingBody}>
              {fleetBriefingLoading ? (
                <div style={s.typingDots}>
                  <span style={{ ...s.dot, animationDelay: '0s' }} />
                  <span style={{ ...s.dot, animationDelay: '0.2s' }} />
                  <span style={{ ...s.dot, animationDelay: '0.4s' }} />
                </div>
              ) : (
                <p style={s.fleetBriefingText}>{fleetBriefing}</p>
              )}
            </div>
          </div>

          {/* Composizione Flotta */}
          <div style={s.fleetSection}>
            <span style={s.fleetSectionTitle}>Composizione Flotta · 25 Aeromobili</span>
            <div style={s.fleetGrid}>
              {VELAR_FLEET_V2.map((ac, i) => (
                <div key={i} style={s.fleetAcCard}>
                  <div style={s.fleetAcTop}>
                    <span style={s.fleetAcCount}>{ac.count}×</span>
                    <span style={s.fleetAcType}>{ac.type}</span>
                  </div>
                  <span style={s.fleetAcRole}>{ac.role}</span>
                  <span style={s.fleetAcMission}>{ac.mission}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hub operativi */}
          {VELAR_HUBS.map((hub, hi) => (
            <div key={hi} style={s.fleetSection}>
              <div style={s.hubHeader}>
                <div>
                  <span style={s.fleetSectionTitle}>{hub.icao} · {hub.city}</span>
                  <span style={s.hubRole}>{hub.role}</span>
                </div>
                <span style={s.hubStatus}>● Operativo</span>
              </div>
              <p style={s.hubDesc}>{hub.description}</p>
              <div style={s.routeTable}>
                {hub.routes.map((r, ri) => (
                  <div key={ri} style={{ ...s.routeRow, ...(ri % 2 === 0 ? {} : s.routeRowAlt) }}>
                    <span style={s.routeIcao}>{r.dest}</span>
                    <span style={s.routeCity}>{r.city}</span>
                    <span style={s.routeAc}>{r.aircraft}</span>
                    <span style={s.routeFreq}>{r.freq}</span>
                    <span style={s.routeFlight}>{r.flight}</span>
                    <span style={s.routeNote}>{r.note}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stili — usa variabili CSS Skydeck, funziona in light e dark mode ────────

const s: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'var(--font-family-sans)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '72vh',
    minHeight: '600px',
    maxHeight: '860px',
    color: 'var(--color-text-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  loadingContainer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '300px', gap: '16px',
    background: 'var(--color-surface)',
  },
  loadingSpinner: {
    width: '28px', height: '28px',
    border: '2px solid var(--color-border)',
    borderTop: '2px solid var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: { color: 'var(--color-text-secondary)', fontSize: '14px' },

  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  ariaLogo: {
    width: '34px', height: '34px', borderRadius: 'var(--radius-md)',
    background: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
    flexShrink: 0,
  },
  title: {
    margin: 0, fontSize: '15px', fontWeight: 600,
    fontFamily: 'var(--font-family-display)',
    color: 'var(--color-text-primary)',
    letterSpacing: '0.04em',
  },
  subtitle: {
    margin: 0, fontSize: '11px',
    color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
    letterSpacing: '0.02em',
  },
  pilotBadge: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' },
  rankLabel: {
    fontSize: '11px', fontWeight: 500,
    color: 'var(--color-primary)',
    background: 'var(--color-primary-light)',
    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-family-sans)',
  },
  xpLabel: {
    fontSize: '11px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-mono)',
  },

  // Nav
  nav: {
    display: 'flex',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-background)',
  },
  navBtn: {
    flex: 1, padding: '10px 8px', border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: '12.5px', fontWeight: 400,
    fontFamily: 'var(--font-family-sans)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  navBtnActive: {
    color: 'var(--color-primary)',
    borderBottomColor: 'var(--color-primary)',
    fontWeight: 500,
    background: 'var(--color-surface)',
  },

  // Chat
  chatContainer: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  messageList: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    background: 'var(--color-background)',
  },
  msgRow: { display: 'flex', gap: '10px', alignItems: 'flex-end' },
  msgRowPilot: { flexDirection: 'row-reverse' },
  ariaAvatar: {
    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
    background: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 600, color: 'white',
    fontFamily: 'var(--font-family-display)',
  },
  bubble: {
    maxWidth: '75%', padding: '10px 14px', borderRadius: '14px',
    display: 'flex', flexDirection: 'column', gap: '3px',
  },
  bubbleAria: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderBottomLeftRadius: '4px',
  },
  bubblePilot: {
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderBottomRightRadius: '4px',
  },
  msgLine: {
    margin: 0, fontSize: '13.5px', lineHeight: '1.55',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-sans)',
  },
  msgTime: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    alignSelf: 'flex-end', marginTop: '2px',
    fontFamily: 'var(--font-family-mono)',
  },
  typingDots: { display: 'flex', gap: '4px', padding: '4px 0' },
  dot: {
    width: '5px', height: '5px', borderRadius: '50%',
    background: 'var(--color-text-hint)',
    animation: 'bounce 1.2s infinite',
  },
  quickActions: {
    display: 'flex', gap: '6px', padding: '8px 16px',
    flexWrap: 'wrap', background: 'var(--color-background)',
    borderTop: '1px solid var(--color-border)',
  },
  quickBtn: {
    fontSize: '11px', padding: '4px 10px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-full)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--font-family-sans)',
  },
  inputRow: {
    display: 'flex', gap: '8px', padding: '12px 16px',
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
  },
  input: {
    flex: 1, padding: '9px 14px',
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '13.5px', outline: 'none',
    fontFamily: 'var(--font-family-sans)',
  },
  sendBtn: {
    width: '38px', height: '38px', borderRadius: 'var(--radius-md)', flexShrink: 0,
    background: 'var(--color-primary)', border: 'none', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },

  // Schedule
  scheduleContainer: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    background: 'var(--color-background)',
  },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '8px', padding: '40px',
  },
  emptyText: {
    fontSize: '14px', fontWeight: 500,
    color: 'var(--color-text-secondary)', margin: 0,
    fontFamily: 'var(--font-family-sans)',
  },
  emptySubText: {
    fontSize: '12.5px', color: 'var(--color-text-hint)',
    margin: 0, textAlign: 'center', lineHeight: '1.5',
    fontFamily: 'var(--font-family-sans)',
  },
  generateBtn: {
    marginTop: '16px', padding: '11px 28px',
    background: 'var(--color-primary)',
    border: 'none', borderRadius: 'var(--radius-md)', color: 'white',
    fontSize: '13.5px', fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    letterSpacing: '0.02em',
  },
  scheduleHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '4px',
  },
  scheduleTitle: {
    fontSize: '11px', fontWeight: 500,
    color: 'var(--color-text-hint)',
    textTransform: 'uppercase', letterSpacing: 'var(--type-label-spacing)',
    fontFamily: 'var(--font-family-sans)',
  },
  regenBtn: {
    fontSize: '12px', padding: '4px 12px',
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-secondary)', cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
  },
  flightList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  flightCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    cursor: 'pointer', transition: 'all 0.15s',
    boxShadow: 'var(--shadow-sm)',
  },
  flightCardSelected: {
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
  },
  flightCardTop: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
  },
  flightDay: {
    fontSize: '12px', fontWeight: 500,
    color: 'var(--color-primary)',
    minWidth: '72px',
    fontFamily: 'var(--font-family-sans)',
  },
  flightNumber: {
    fontSize: '11px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-mono)',
  },
  longHaulBadge: {
    fontSize: '9px', fontWeight: 500,
    color: 'var(--color-warning)',
    background: 'var(--color-warning-bg)',
    borderRadius: 'var(--radius-sm)',
    padding: '1px 6px', letterSpacing: '0.06em',
    fontFamily: 'var(--font-family-sans)',
  },
  flightAircraft: {
    fontSize: '11px', color: 'var(--color-text-hint)',
    marginLeft: 'auto',
    fontFamily: 'var(--font-family-sans)',
  },
  flightRoute: { display: 'flex', alignItems: 'center', gap: '8px' },
  routePoint: { display: 'flex', flexDirection: 'column', minWidth: '72px' },
  icao: {
    fontSize: '17px', fontWeight: 500,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.01em',
  },
  routeCity: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    marginTop: '2px', fontFamily: 'var(--font-family-sans)',
  },
  flightTime: {
    fontSize: '11px', color: 'var(--color-text-secondary)',
    marginTop: '2px', fontFamily: 'var(--font-family-mono)',
  },
  routeArrow: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
  routeMeta: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
  flightDetail: {
    marginTop: '12px', paddingTop: '12px',
    borderTop: '1px solid var(--color-divider)',
  },
  flightReason: {
    fontSize: '12.5px', color: 'var(--color-text-secondary)',
    margin: '0 0 10px', lineHeight: '1.55',
    fontFamily: 'var(--font-family-sans)',
  },
  flightActions: { display: 'flex', gap: '8px' },
  simbriefBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', background: '#f97316',
    border: 'none', borderRadius: 'var(--radius-md)',
    color: 'white', fontSize: '12px', fontWeight: 500,
    textDecoration: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
  },
  meteoBtn: {
    padding: '7px 14px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-secondary)',
    fontSize: '12px', cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
  },

  // Weather
  weatherContainer: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    background: 'var(--color-background)',
  },
  weatherSearch: { display: 'flex', gap: '8px' },
  weatherInput: {
    flex: 1, padding: '9px 14px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    fontSize: '13px', outline: 'none',
    fontFamily: 'var(--font-family-mono)',
  },
  weatherFetchBtn: {
    padding: '9px 18px', background: 'var(--color-primary)',
    border: 'none', borderRadius: 'var(--radius-md)',
    color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
  },
  weatherGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '10px',
  },
  weatherCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: '14px',
    boxShadow: 'var(--shadow-sm)',
  },
  weatherCardHeader: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: '4px',
  },
  weatherName: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    margin: '0 0 10px', fontFamily: 'var(--font-family-sans)',
  },
  weatherIcao: {
    fontSize: '18px', fontWeight: 500,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
  },
  weatherCat: {
    fontSize: '10px', fontWeight: 500, padding: '2px 8px',
    borderRadius: 'var(--radius-sm)', border: '1px solid',
    fontFamily: 'var(--font-family-sans)',
  },
  weatherStats: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '8px', marginBottom: '10px',
  },
  wStat: { display: 'flex', flexDirection: 'column', gap: '2px' },
  wStatLabel: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    fontFamily: 'var(--font-family-sans)',
  },
  wStatVal: {
    fontSize: '13px', fontWeight: 500,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-mono)',
  },
  rawMetar: {
    display: 'flex', flexDirection: 'column', gap: '4px',
    paddingTop: '10px', borderTop: '1px solid var(--color-divider)',
  },
  rawLabel: {
    fontSize: '9px', color: 'var(--color-text-hint)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    fontFamily: 'var(--font-family-sans)',
  },
  rawCode: {
    fontSize: '10px', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-mono)',
    wordBreak: 'break-all', lineHeight: '1.6',
  },
  // Fleet Status
  fleetContainer: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '16px',
    background: 'var(--color-background)',
  },
  fleetBriefingCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    boxShadow: 'var(--shadow-sm)',
  },
  fleetBriefingHeader: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
  },
  fleetBriefingLabel: {
    margin: 0, fontSize: '12px', fontWeight: 600,
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-family-sans)',
  },
  fleetBriefingTime: {
    margin: 0, fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-mono)',
    textTransform: 'capitalize',
  },
  fleetBriefingBody: { minHeight: '32px' },
  fleetBriefingText: {
    margin: 0, fontSize: '13.5px', lineHeight: '1.65',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-sans)',
    fontStyle: 'italic',
  },
  fleetSection: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    boxShadow: 'var(--shadow-sm)',
  },
  fleetSectionTitle: {
    fontSize: '11px', fontWeight: 500,
    color: 'var(--color-text-hint)',
    textTransform: 'uppercase', letterSpacing: 'var(--type-label-spacing)',
    fontFamily: 'var(--font-family-sans)',
  },
  fleetGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px',
  },
  fleetAcCard: {
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: '3px',
  },
  fleetAcTop: { display: 'flex', alignItems: 'baseline', gap: '6px' },
  fleetAcCount: {
    fontSize: '18px', fontWeight: 700,
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-family-mono)',
  },
  fleetAcType: {
    fontSize: '12px', fontWeight: 500,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-sans)',
  },
  fleetAcRole: {
    fontSize: '10px', fontWeight: 600,
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  fleetAcMission: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)', lineHeight: '1.4',
  },
  hubHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  hubRole: {
    display: 'block', fontSize: '10px', fontWeight: 500,
    color: 'var(--color-primary)', marginTop: '2px',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  hubStatus: {
    fontSize: '11px', fontWeight: 500, color: 'var(--color-success)',
    fontFamily: 'var(--font-family-sans)',
  },
  hubDesc: {
    margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-sans)', lineHeight: '1.5',
  },
  routeTable: {
    display: 'flex', flexDirection: 'column',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
  },
  routeRow: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 90px 70px 90px 90px',
    gap: '8px', padding: '8px 12px',
    alignItems: 'center',
    background: 'var(--color-surface)',
  },
  routeRowAlt: { background: 'var(--color-background)' },
  routeIcao: {
    fontSize: '12px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
  },
  routeCity: {
    fontSize: '12px', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-sans)',
  },
  routeAc: {
    fontSize: '11px', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-sans)',
  },
  routeFreq: {
    fontSize: '11px', fontWeight: 500,
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-family-sans)',
  },
  routeFlight: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-mono)',
  },
  routeNote: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
};
