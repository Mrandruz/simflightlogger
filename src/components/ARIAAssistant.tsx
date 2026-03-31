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
import { sendOperationalAlert } from '../utils/discord';
import { fetchNpcRoster, calculateNetworkState, NetworkFlight, NpcPilot } from '../utils/networkSimulator';

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

interface ChatMessage {
  role: 'aria' | 'pilot';
  content: string;
  timestamp: Date;
}


// ─── Tipi Piano Operativo (caricato da /velar-ops-plan.json) ─────────────────

interface VelarRoute {
  dest: string; city: string; aircraft: string;
  freq: string; flight: string; note: string;
}
interface VelarHub {
  icao: string; city: string; role: string;
  description: string; routes: VelarRoute[];
}
interface VelarFleetItem {
  type: string; count: number; role: string; mission: string; capacity: number;
}
interface CrewMember {
  name: string; rank: string; base: string;
  todayFlight: {
    flightNumber: string; dep: string; arr: string;
    depCity: string; arrCity: string; aircraft: string; time: string;
  } | null;
}
interface RankDef { name: string; minXp: number; aircraft: string[]; }
interface VelarPlan {
  _meta: { version: string; name: string; updated: string; motto: string; };
  fleet: VelarFleetItem[];
  hubs: VelarHub[];
  crew: CrewMember[];
  aria_ops: { tone: string; language: string; priorities: string[]; rank_progression: RankDef[]; };
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

const ARIA_PROTOCOL = `
PROTOCOLLO ARIA OPS — Tono e Comportamento:
- Sintetico, tecnico, autoritativo ma collaborativo.
- Supporto, non comando: proponi soluzioni, l'ultima parola spetta sempre al Comandante.
- Priorità: 1) Sicurezza (safety first) 2) Puntualità 3) Efficienza carburante.
- Motto Velar: "Motion, simplified."
- Posizionamento: Boutique Tech-Luxury Airline.
- Esempio di tono: "Comandante [nome], il check della cabina per il volo VLR101 è completo. Ho rilevato [info]. Suggerisco [azione]."
`;


const DAYS_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

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

type ViewState = 'chat' | 'overview' | 'schedule' | 'fleet' | 'network';

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
  const [scheduleTab, setScheduleTab] = useState<'mine' | 'crew'>('mine');

  const [fleetBriefing, setFleetBriefing] = useState('');
  const [fleetBriefingLoading, setFleetBriefingLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [opsPlan, setOpsPlan] = useState<VelarPlan | null>(null);
  const [npcRoster, setNpcRoster] = useState<NpcPilot[]>([]);
  const [fleetState, setFleetState] = useState<any[]>([]);
  const [networkFlights, setNetworkFlights] = useState<NetworkFlight[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());

  // ── Base attuale del pilota (dall'ultimo arrivo nel logbook) ───────────────
  const currentBase = profile?.latestFlight?.arrival?.toUpperCase() ?? 'LIRF';
  const currentBaseCity = opsPlan?.hubs.find((h: VelarHub) => h.icao === currentBase)?.city
    ?? profile?.latestFlight?.arrival ?? currentBase;
  const currentHubRole = opsPlan?.hubs.find((h: VelarHub) => h.icao === currentBase)?.role ?? null;

  // ── Carica piano operativo e Roster ─────────────────────────────────────────
  useEffect(() => {
    fetch('/velar-ops-plan.json')
      .then(r => r.json())
      .then((plan: VelarPlan) => setOpsPlan(plan))
      .catch(() => console.warn('[ARIA Ops] Piano operativo non trovato'));
      
    fetchNpcRoster().then(setNpcRoster);

    fetch('/api/fleet')
      .then(r => r.json())
      .then(db => setFleetState(Array.isArray(db) ? db : []))
      .catch(() => console.warn('[ARIA Ops] Fleet DB non trovato'));
  }, []);

  // ── Heartbeat Engine ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!opsPlan || npcRoster.length === 0 || fleetState.length === 0) return;
    
    // Funzione di aggiornamento frame
    const tick = () => {
      const active = calculateNetworkState(opsPlan, npcRoster, Date.now(), fleetState);
      
      setNetworkFlights(prev => {
         active.forEach(flight => {
             const oldFlight = prev.find(f => f.id === flight.id);
             // Odometer trigger: volo appena atterrato
             if (oldFlight && oldFlight.status !== 'Arrived' && flight.status === 'Arrived') {
                 if (flight.tailNumber && flight.tailNumber !== 'Generic') {
                      const blockHours = (flight.arrivalTime - flight.departureTime) / 60;
                      fetch('/api/fleet/log-hours', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: flight.tailNumber, flightHours: blockHours })
                      }).then(() => {
                          fetch('/api/fleet').then(r => r.json()).then(db => setFleetState(Array.isArray(db) ? db : []));
                      }).catch(e => console.error(e));
                 }
             }
         });
         return active;
      });
      setLastHeartbeat(new Date());
    };
    
    if (networkFlights.length === 0) tick(); // primo avvio sincronizzato
    const interval = setInterval(tick, 60000); // Ogni 60 sec (Heartbeat)
    return () => clearInterval(interval);
  }, [opsPlan, npcRoster, fleetState]);

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
  const buildSystemPrompt = useCallback((p: PilotProfile) => {
    const planContext = opsPlan ? `
PIANO OPERATIVO VELAR v${opsPlan._meta.version} (${opsPlan._meta.updated}):
Motto: ${opsPlan._meta.motto}

FLOTTA (${opsPlan.fleet.reduce((s: number, f: VelarFleetItem) => s + f.count, 0)} aeromobili):
${opsPlan.fleet.map((f: VelarFleetItem) => `- ${f.count}x ${f.type} [${f.role}]: ${f.mission}`).join('\n')}

HUB E ROTTE:
${opsPlan.hubs.map((h: VelarHub) =>
  `${h.icao} ${h.city} (${h.role}):\n` +
  h.routes.map((r: VelarRoute) => `  - ${r.flight} ${h.icao}→${r.dest} ${r.aircraft} ${r.freq} [${r.note}]`).join('\n')
).join('\n')}
` : '';

    return `
Sei ARIA OPS, il co-pilota virtuale e coordinatore operativo della compagnia aerea virtuale Velar su Skydeck SimFlightLogger.

${ARIA_PROTOCOL}
${planContext}
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
`.trim();
  }, [pilotName, opsPlan]);

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

    // Base attuale del pilota = ultimo arrivo logbook
    const pilotBase = profile.latestFlight?.arrival?.toUpperCase() || 'LIRF';
    const pilotBaseHub = opsPlan?.hubs.find(h => h.icao === pilotBase);
    const isLongHaulQualified = ['Captain', 'Senior Captain', 'Chief Captain'].includes(profile.currentRank.name);

    const prompt = `
Sei ARIA, il sistema di pianificazione voli di Velar Virtual Airline.

${opsPlan ? `PIANO OPERATIVO v${opsPlan._meta.version}:
${opsPlan.hubs.map(h =>
  h.icao + ' ' + h.city + ':\n' +
  h.routes.map(r => '  ' + r.flight + ' ' + h.icao + '→' + r.dest + ' ' + r.aircraft + ' ' + r.freq).join('\n')
).join('\n')}` : 'Piano non disponibile'}

PILOTA: ${pilotName || 'Comandante'} — Rank: ${profile.currentRank.name} — Ore totali: ${profile.totalHours.toFixed(0)}h
BASE ATTUALE: ${pilotBase} (${pilotBaseHub?.city || pilotBase}) — ${pilotBaseHub?.role || 'Hub'}
ABILITAZIONE LUNGO RAGGIO: ${isLongHaulQualified ? 'SÌ (A350-900 disponibile)' : 'NO (solo A320-200 feeder)'}
AEROMOBILI ABILITATI PER IL RANK: ${opsPlan?.aria_ops.rank_progression.find(r => r.name === profile.currentRank.name)?.aircraft.join(', ') || 'A320'}

Genera la schedule settimanale (Lunedì → Domenica, 7 voli) rispettando RIGOROSAMENTE queste regole:
1. Il PRIMO volo DEVE partire da ${pilotBase} — base corrente del pilota
2. Ogni volo successivo parte dall'arrivo del volo precedente (catena geografica coerente)
3. Usa SOLO le rotte del piano operativo che partono dalla base corrente o dagli hub raggiunti
4. Usa SOLO aeromobili abilitati per il rank del pilota
5. Il campo "reason" deve spiegare la scelta operativa (stile ARIA Ops, conciso)

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

  // ── Test Discord ────────────────────────────────────────────────────────
  const testDiscord = async () => {
    await sendOperationalAlert(
      "Connessione Stabilita",
      `Sistemi Operativi Velar Airlines: Collegamento Discord stabilito per il Comandante **${pilotName || 'Pilota'}**. Pronto a monitorare la flotta.`,
      [{ name: "Stato", value: "🟢 Operativo", inline: true }, { name: "Hub", value: currentBase, inline: true }]
    );
    alert("Test inviato a Discord!");
  };



  // ── Genera Overview dinamico ──────────────────────────────────────────────
  const generateOverview = useCallback(async () => {
    if (!profile || overviewLoading || overviewData) return;
    setOverviewLoading(true);

    const activeRoutesList = opsPlan?.hubs?.map((hub: VelarHub) =>
      hub.routes.map((route: VelarRoute) => {
        const flights = route.flight.split(/[\\/-]/).map((f: string) => f.trim()).filter((f: string) => f.startsWith('VLR') || !isNaN(Number(f)));
        const baseRoute = route.flight.split(' ')[0];
        const capacity = opsPlan.fleet.find((f: VelarFleetItem) => f.type.includes(route.aircraft))?.capacity || 'N/A';
        return flights.map((f: string) => {
          let fullFlight = f.startsWith('VLR') ? f : `${baseRoute}${f}`;
          if (route.flight.includes('-')) {
              const parts = route.flight.split('-');
              const start = parseInt(parts[0].replace(/[^0-9]/g, ''));
              const end = parseInt(parts[1].replace(/[^0-9]/g, ''));
              let lines = [];
              for (let i = start; i <= end; i++) {
                   lines.push(`- VLR${i} ${hub.icao}→${route.dest} (${route.aircraft}, cap ${capacity} pax)`);
              }
              return lines.join('\n');
          } else {
               let fn = fullFlight.replace(' ', '');
               return `- ${fn} ${hub.icao}→${route.dest} (${route.aircraft}, cap ${capacity} pax)`;
          }
        }).join('\n');
      }).join('\n')
    ).join('\n') || 'Nessuna rotta attiva';

    const totalFleetCount = opsPlan?.fleet?.reduce((acc: number, f: VelarFleetItem) => acc + f.count, 0) || 25;
    const totalHubsCount = opsPlan?.hubs?.length || 3;

    const prompt = `Sei ARIA, il sistema operativo di Velar Airlines.
Genera un report operativo JSON per il Chief Officer ${pilotName || 'Comandante'} con dati realistici per OGGI.

La flotta Velar ha ${totalFleetCount} aeromobili su ${totalHubsCount} hub.

Rotte attive oggi (con relative capacità aeromobile):
${activeRoutesList}

Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown:
{
  "briefing": "Frase di stato operativo stile ARIA 2.0 — max 2 frasi concise",
  "operationalStatus": {
    "fleetOperational": <numero 23-25>,
    "fleetTotal": 25,
    "flightsToday": <numero 12-16>,
    "onTimePercentage": <numero 85-99>
  },
  "hubs": [
    {
      "icao": "LIRF",
      "role": "Global Hub",
      "status": "Operational",
      "activeFlights": <2-5>,
      "paxToday": <numero realistico>,
      "alertMessage": null
    },
    {
      "icao": "WIII",
      "role": "Asian Gateway",
      "status": "Operational",
      "activeFlights": <2-4>,
      "paxToday": <numero realistico>,
      "alertMessage": null
    },
    {
      "icao": "KBOS",
      "role": "Tech Corridor",
      "status": "Operational",
      "activeFlights": <1-3>,
      "paxToday": <numero realistico>,
      "alertMessage": null
    }
  ],
  "flights": [
    {
      "flightNumber": "VLR101",
      "dep": "LIRF",
      "arr": "KBOS",
      "aircraft": "A350-900",
      "paxBoarded": <0-369>,
      "paxCapacity": 369,
      "loadFactor": <percentuale 0-100>,
      "status": "On Time" | "Boarding" | "Departed" | "Delayed" | "Arrived",
      "depTime": "10:30"
    }
  ],
  "passengerSummary": {
    "totalPaxToday": <somma realistica>,
    "avgLoadFactor": <media percentuale>,
    "vipPax": <numero 0-12>,
    "connectionPax": <numero realisti>
  }
}`;

    try {
      const res = await fetch('/api/aria-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || '{}';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setOverviewData(parsed);
    } catch {
      setOverviewData(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [profile, pilotName, overviewLoading, overviewData]);

  useEffect(() => {
    if (view === 'overview' && profile && !overviewData && !overviewLoading) {
      generateOverview();
    }
  }, [view, profile, overviewData, overviewLoading, generateOverview]);

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
        <button onClick={view === 'network' ? () => setView('chat') : () => setView('network')} style={{...s.testBtn, background: view === 'network' ? 'var(--color-primary)' : 'var(--color-surface)', color: view === 'network' ? '#000' : 'var(--color-text-hint)'}}>📡 Network ({networkFlights.length})</button>
        <button onClick={testDiscord} style={s.testBtn}>🔔 Test Discord</button>
      </div>

      {/* ── Nav ── */}
      <div style={s.nav}>
        {(['chat', 'overview', 'schedule', 'fleet', 'network'] as ViewState[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ ...s.navBtn, ...(view === v ? s.navBtnActive : {}) }}>
            {v === 'chat' ? '💬 Chat' : v === 'overview' ? '📊 Overview' : v === 'schedule' ? '📅 Schedule' : v === 'fleet' ? '🛫 Fleet' : '📡 Network'}
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


      {/* ── OVERVIEW ── */}
      {view === 'overview' && (
        <div style={s.overviewContainer}>
          {overviewLoading || !overviewData ? (
            <div style={s.overviewLoading}>
              <div style={s.loadingSpinner} />
              <p style={s.loadingText}>ARIA sta compilando il report operativo...</p>
            </div>
          ) : (
            <>
              {/* Briefing ARIA */}
              <div style={s.ovBriefingCard}>
                <div style={s.fleetBriefingHeader}>
                  <div style={s.ariaAvatar}>A</div>
                  <div>
                    <p style={s.fleetBriefingLabel}>ARIA · Daily Operations Report</p>
                    <p style={s.fleetBriefingTime}>
                      {new Date().toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    style={s.ovRefreshBtn}
                    onClick={() => { setOverviewData(null); }}
                    title="Aggiorna report"
                  >↻</button>
                </div>
                <p style={s.fleetBriefingText}>{overviewData.briefing}</p>
              </div>

              {/* KPI bar */}
              {overviewData.operationalStatus && (
                <div style={s.ovKpiBar}>
                  <div style={s.ovKpi}>
                    <span style={s.ovKpiValue}>{overviewData.operationalStatus.fleetOperational}/{overviewData.operationalStatus.fleetTotal}</span>
                    <span style={s.ovKpiLabel}>Aeromobili operativi</span>
                  </div>
                  <div style={s.ovKpiDivider} />
                  <div style={s.ovKpi}>
                    <span style={s.ovKpiValue}>{overviewData.operationalStatus.flightsToday}</span>
                    <span style={s.ovKpiLabel}>Voli oggi</span>
                  </div>
                  <div style={s.ovKpiDivider} />
                  <div style={s.ovKpi}>
                    <span style={{ ...s.ovKpiValue, color: overviewData.operationalStatus.onTimePercentage >= 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {overviewData.operationalStatus.onTimePercentage}%
                    </span>
                    <span style={s.ovKpiLabel}>On-time performance</span>
                  </div>
                  <div style={s.ovKpiDivider} />
                  {overviewData.passengerSummary && (
                    <div style={s.ovKpi}>
                      <span style={s.ovKpiValue}>{overviewData.passengerSummary.totalPaxToday?.toLocaleString('it-IT')}</span>
                      <span style={s.ovKpiLabel}>Passeggeri oggi</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hub status */}
              {overviewData.hubs && (
                <div style={s.ovSection}>
                  <span style={s.fleetSectionTitle}>Stato Hub</span>
                  <div style={s.ovHubGrid}>
                    {overviewData.hubs.map((hub: any, i: number) => (
                      <div key={i} style={s.ovHubCard}>
                        <div style={s.ovHubHeader}>
                          <div>
                            <span style={s.ovHubIcao}>{hub.icao}</span>
                            <span style={s.ovHubRole}>{hub.role}</span>
                          </div>
                          <span style={{
                            ...s.ovHubStatus,
                            color: hub.status === 'Operational' ? 'var(--color-success)' : 'var(--color-warning)'
                          }}>● {hub.status}</span>
                        </div>
                        <div style={s.ovHubStats}>
                          <div style={s.ovHubStat}>
                            <span style={s.ovHubStatVal}>{hub.activeFlights}</span>
                            <span style={s.ovHubStatLbl}>Voli attivi</span>
                          </div>
                          <div style={s.ovHubStat}>
                            <span style={s.ovHubStatVal}>{hub.paxToday?.toLocaleString('it-IT')}</span>
                            <span style={s.ovHubStatLbl}>Pax oggi</span>
                          </div>
                        </div>
                        {hub.alertMessage && (
                          <p style={s.ovHubAlert}>⚠ {hub.alertMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flight board */}
              {overviewData.flights && (
                <div style={s.ovSection}>
                  <span style={s.fleetSectionTitle}>Voli in corso · Passeggeri & Load Factor</span>
                  <div style={s.ovFlightList}>
                    {overviewData.flights.map((f: any, i: number) => {
                      const lf = Number(f.loadFactor) || 0;
                      const lfColor = lf >= 85 ? 'var(--color-success)' : lf >= 60 ? 'var(--color-primary)' : 'var(--color-warning)';
                      const statusColor: Record<string, string> = {
                        'On Time': 'var(--color-success)', 'Departed': 'var(--color-primary)',
                        'Boarding': 'var(--color-warning)', 'Arrived': 'var(--color-text-hint)',
                        'Delayed': 'var(--color-danger)',
                      };
                      return (
                        <div key={i} style={s.ovFlightRow}>
                          <span style={s.ovFlightNum}>{f.flightNumber}</span>
                          <span style={s.ovFlightRoute}>{f.dep} → {f.arr}</span>
                          <span style={s.ovFlightAc}>{f.aircraft}</span>
                          <span style={s.ovFlightTime}>{f.depTime}</span>
                          <div style={s.ovLoadBar}>
                            <div style={{
                              ...s.ovLoadFill,
                              width: `${Math.min(lf, 100)}%`,
                              background: lfColor,
                            }} />
                          </div>
                          <span style={{ ...s.ovLoadPct, color: lfColor }}>{lf}%</span>
                          <span style={s.ovFlightPax}>{f.paxBoarded}/{f.paxCapacity}</span>
                          <span style={{ ...s.ovFlightStatus, color: statusColor[f.status] || 'var(--color-text-hint)' }}>
                            {f.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Passenger summary */}
              {overviewData.passengerSummary && (
                <div style={s.ovSection}>
                  <span style={s.fleetSectionTitle}>Riepilogo Passeggeri</span>
                  <div style={s.ovPaxGrid}>
                    <div style={s.ovPaxCard}>
                      <span style={s.ovPaxVal}>{overviewData.passengerSummary.avgLoadFactor}%</span>
                      <span style={s.ovPaxLbl}>Load Factor medio</span>
                    </div>
                    <div style={s.ovPaxCard}>
                      <span style={s.ovPaxVal}>{overviewData.passengerSummary.vipPax}</span>
                      <span style={s.ovPaxLbl}>Passeggeri VIP</span>
                    </div>
                    <div style={s.ovPaxCard}>
                      <span style={s.ovPaxVal}>{overviewData.passengerSummary.connectionPax?.toLocaleString('it-IT')}</span>
                      <span style={s.ovPaxLbl}>Pax in connessione</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {view === 'schedule' && (
        <div style={s.scheduleContainer}>

          {/* Sub-tab switcher */}
          <div style={s.schedSubNav}>
            <button
              style={{ ...s.schedSubBtn, ...(scheduleTab === 'mine' ? s.schedSubBtnActive : {}) }}
              onClick={() => setScheduleTab('mine')}>
              ✈️ I miei voli
            </button>
            <button
              style={{ ...s.schedSubBtn, ...(scheduleTab === 'crew' ? s.schedSubBtnActive : {}) }}
              onClick={() => setScheduleTab('crew')}>
              👨‍✈️ Crew Board
            </button>
          </div>

          {/* ── TAB: I MIEI VOLI ── */}
          {scheduleTab === 'mine' && (
            <>
              {/* Badge base corrente */}
              <div style={s.baseBadge}>
                <span style={s.baseDot}>📍</span>
                <span style={s.baseIcao}>{currentBase}</span>
                <span style={s.baseSep}>·</span>
                <span style={s.baseCity}>{currentBaseCity}</span>
                {currentHubRole && <span style={s.baseRole}>{currentHubRole}</span>}
              </div>

              {schedule.length === 0 ? (
                <div style={s.emptyState}>
                  <p style={s.emptyText}>Nessuna schedule generata.</p>
                  <p style={s.emptySubText}>
                    ARIA pianificherà la tua settimana partendo da <strong>{currentBase}</strong>,
                    rispettando le rotte ufficiali Velar v2.0.
                  </p>
                  <button style={s.generateBtn} onClick={generateSchedule} disabled={scheduleLoading}>
                    {scheduleLoading ? 'Generazione in corso...' : '✦ Genera Schedule Settimanale'}
                  </button>
                </div>
              ) : (
                <>
                  <div style={s.scheduleHeader}>
                    <span style={s.scheduleTitle}>Settimana · da {currentBase}</span>
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
                                <a href={buildSimbriefUrl(f)} target="_blank" rel="noopener noreferrer"
                                  style={s.simbriefBtn} onClick={e => e.stopPropagation()}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  Apri in SimBrief
                                </a>

                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── TAB: CREW BOARD ── */}
          {scheduleTab === 'crew' && (
            <>
              <div style={s.scheduleHeader}>
                <span style={s.scheduleTitle}>Live Crew Board · {DAYS_IT[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}</span>
                <span style={s.crewCount}>{networkFlights.length} piloti in servizio</span>
              </div>
              <div style={s.crewGrid}>
                {networkFlights.length === 0 && (
                  <p style={{ color: 'var(--color-text-secondary)', padding: '20px' }}>Nessun membro dell'equipaggio attualmente in servizio.</p>
                )}
                {networkFlights.map((nf) => (
                  <div key={nf.id} style={s.crewCard}>
                    <div style={s.crewCardHeader}>
                      <div style={s.crewAvatar}>
                        {(nf.pilot.name || 'CM').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={s.crewInfo}>
                        <span style={s.crewName}>{nf.pilot.name}</span>
                        <span style={s.crewRank}>{nf.pilot.rank}</span>
                      </div>
                      <div style={s.crewBase}>
                        <span style={s.crewBaseIcao}>{nf.pilot.base}</span>
                        <span style={s.crewBaseRole}>{opsPlan?.hubs.find(h => h.icao === nf.pilot.base)?.role || nf.pilot.base}</span>
                      </div>
                    </div>
                    <div style={s.crewFlight}>
                      <div style={s.crewFlightRoute}>
                        <span style={s.crewIcao}>{nf.departure}</span>
                        <svg width="24" height="10" viewBox="0 0 24 10" style={{ margin: '0 6px' }}>
                          <line x1="0" y1="5" x2="18" y2="5" stroke="var(--color-border)" strokeWidth="1.2"/>
                          <path d="M18 2l6 3-6 3" fill="none" stroke="var(--color-border)" strokeWidth="1.2"/>
                        </svg>
                        <span style={s.crewIcao}>{nf.arrival}</span>
                      </div>
                      <div style={s.crewFlightMeta}>
                        <span style={s.crewFlightNum}>{nf.flightNumber}</span>
                        <span style={s.crewFlightAc}>{nf.aircraft}</span>
                        <span style={s.crewFlightTime}>
                          {Math.floor(nf.departureTime / 60).toString().padStart(2, '0')}:{Math.floor(nf.departureTime % 60).toString().padStart(2, '0')} UTC
                        </span>
                      </div>
                      <p style={{...s.crewFlightCities, color: 'var(--color-primary)'}}>
                        {nf.status.toUpperCase()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
              {(opsPlan?.fleet || []).map((ac, i) => (
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
          {(opsPlan?.hubs || []).map((hub: VelarHub, hi: number) => (
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

      {/* ── Vista Network Heartbeat ────────────────────────────────────────── */}
      {view === 'network' && (
        <div style={s.overviewContainer}>
          <div style={s.fleetHeader}>
            <div>
              <h3 style={s.hubTitle}>Live Network Heartbeat</h3>
              <p style={s.hubRole}>Sistema Autonomo Operativo • {networkFlights.length} Voli Attivi</p>
            </div>
            <div style={s.hubStatus}>Aggiornato: {lastHeartbeat.toLocaleTimeString()}</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            {networkFlights.length === 0 && (
              <p style={{ color: 'var(--color-text-hint)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Nessun volo attivo in questo momento.</p>
            )}
            {networkFlights.map(nf => (
              <div key={nf.id} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px', padding: '12px',
                display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>{nf.flightNumber}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)' }}>{nf.departure} ✈️ {nf.arrival}</span>
                  </div>
                  <span style={{ 
                    fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold',
                    background: (nf.status === 'Arrived' || nf.status === 'Turnaround') ? '#2e7d32' : 
                                nf.status === 'En Route' ? '#0277bd' :
                                (nf.status === 'Approach' || nf.status === 'Taxi In') ? '#e65100' : 
                                (nf.status === 'Taxi Out' || nf.status === 'Pushback') ? '#f57c00' :
                                '#424242',
                    color: '#fff'
                  }}>{nf.status}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-hint)' }}>
                  <span>Cmdt. {nf.pilot.name} ({nf.pilot.rank})</span>
                  <span>{nf.aircraft}</span>
                </div>
                
                {['Boarding', 'Pushback', 'Taxi Out', 'En Route', 'Approach', 'Taxi In'].includes(nf.status) && (
                  <div style={{ width: '100%', height: '4px', background: 'var(--color-background)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ width: `${nf.progressPercent}%`, height: '100%', background: 'var(--color-primary)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
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
    fontFamily: 'var(--font-family-mono)',
  },
  testBtn: {
    fontSize: '10px', padding: '4px 8px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-hint)',
    cursor: 'pointer', marginLeft: '12px',
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

  // Schedule sub-nav
  schedSubNav: {
    display: 'flex', gap: '4px', padding: '4px',
    background: 'var(--color-background)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  schedSubBtn: {
    flex: 1, padding: '7px 12px', border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: '12px', fontWeight: 500, cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-family-sans)',
    transition: 'all 0.15s',
  },
  schedSubBtnActive: {
    background: 'var(--color-surface)',
    color: 'var(--color-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  // Base badge
  baseBadge: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px',
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
  baseDot: { fontSize: '13px' },
  baseIcao: {
    fontSize: '13px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-primary)',
  },
  baseSep: { color: 'var(--color-text-hint)', fontSize: '12px' },
  baseCity: {
    fontSize: '12px', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-sans)',
    flex: 1,
  },
  baseRole: {
    fontSize: '10px', fontWeight: 500,
    color: 'var(--color-primary)',
    background: 'var(--color-surface)',
    padding: '2px 8px', borderRadius: 'var(--radius-full)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  // Crew Board
  crewCount: {
    fontSize: '11px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
  crewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '8px',
  },
  crewCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    boxShadow: 'var(--shadow-sm)',
  },
  crewCardHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  crewAvatar: {
    width: '34px', height: '34px', borderRadius: '50%',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', fontWeight: 700,
    fontFamily: 'var(--font-family-display)',
    flexShrink: 0,
  },
  crewInfo: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 },
  crewName: {
    fontSize: '13px', fontWeight: 500,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family-sans)',
  },
  crewRank: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
  crewBase: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
  crewBaseIcao: {
    fontSize: '12px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
  },
  crewBaseRole: {
    fontSize: '9px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },
  crewFlight: {
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  crewFlightRoute: { display: 'flex', alignItems: 'center' },
  crewIcao: {
    fontSize: '15px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
  },
  crewFlightMeta: { display: 'flex', gap: '8px', alignItems: 'center' },
  crewFlightNum: {
    fontSize: '10px', fontWeight: 600,
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-family-mono)',
  },
  crewFlightAc: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
  crewFlightTime: {
    fontSize: '10px', fontWeight: 500,
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-mono)',
    marginLeft: 'auto',
  },
  crewFlightCities: {
    margin: 0, fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
  crewOffDuty: {
    margin: 0, fontSize: '11px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)', fontStyle: 'italic',
    textAlign: 'center' as const, padding: '6px 0',
  },
  // Overview
  overviewContainer: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    background: 'var(--color-background)',
  },
  overviewLoading: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '14px',
  },
  ovBriefingCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  ovRefreshBtn: {
    marginLeft: 'auto', background: 'transparent',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-hint)', cursor: 'pointer',
    fontSize: '14px', width: '26px', height: '26px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  ovKpiBar: {
    display: 'flex', alignItems: 'center',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: '12px 20px',
    gap: '0', boxShadow: 'var(--shadow-sm)',
  },
  ovKpi: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '3px',
  },
  ovKpiValue: {
    fontSize: '22px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
    lineHeight: 1,
  },
  ovKpiLabel: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },
  ovKpiDivider: {
    width: '1px', height: '36px',
    background: 'var(--color-border)', flexShrink: 0, margin: '0 4px',
  },
  ovSection: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '10px',
    boxShadow: 'var(--shadow-sm)',
  },
  ovHubGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
  },
  ovHubCard: {
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  ovHubHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  ovHubIcao: {
    display: 'block', fontSize: '16px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
  },
  ovHubRole: {
    display: 'block', fontSize: '9px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: '2px',
  },
  ovHubStatus: {
    fontSize: '10px', fontWeight: 500,
    fontFamily: 'var(--font-family-sans)',
  },
  ovHubStats: { display: 'flex', gap: '12px' },
  ovHubStat: { display: 'flex', flexDirection: 'column', gap: '1px' },
  ovHubStatVal: {
    fontSize: '18px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)', lineHeight: 1,
  },
  ovHubStatLbl: {
    fontSize: '9px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  },
  ovHubAlert: {
    margin: 0, fontSize: '11px', color: 'var(--color-warning)',
    fontFamily: 'var(--font-family-sans)',
  },
  ovFlightList: {
    display: 'flex', flexDirection: 'column', gap: '0',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', overflow: 'hidden',
  },
  ovFlightRow: {
    display: 'grid',
    gridTemplateColumns: '72px 110px 80px 48px 1fr 40px 72px 80px',
    gap: '8px', padding: '9px 12px',
    alignItems: 'center',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  },
  ovFlightNum: {
    fontSize: '11px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-primary)',
  },
  ovFlightRoute: {
    fontSize: '12px', fontWeight: 500,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-primary)',
  },
  ovFlightAc: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
  },
  ovFlightTime: {
    fontSize: '11px', fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-text-secondary)',
  },
  ovLoadBar: {
    height: '6px', background: 'var(--color-border)',
    borderRadius: '3px', overflow: 'hidden',
  },
  ovLoadFill: {
    height: '100%', borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  ovLoadPct: {
    fontSize: '11px', fontWeight: 600,
    fontFamily: 'var(--font-family-mono)',
    textAlign: 'right' as const,
  },
  ovFlightPax: {
    fontSize: '10px', color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-family-mono)',
    textAlign: 'center' as const,
  },
  ovFlightStatus: {
    fontSize: '10px', fontWeight: 500,
    fontFamily: 'var(--font-family-sans)',
    textAlign: 'right' as const,
  },
  ovPaxGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
  },
  ovPaxCard: {
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: '4px',
    alignItems: 'center',
  },
  ovPaxVal: {
    fontSize: '22px', fontWeight: 700,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-primary)', lineHeight: 1,
  },
  ovPaxLbl: {
    fontSize: '10px', color: 'var(--color-text-hint)',
    fontFamily: 'var(--font-family-sans)',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    textAlign: 'center' as const,
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
};
