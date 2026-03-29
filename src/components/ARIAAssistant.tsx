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

interface WeatherData {
  icao: string;
  raw_text?: string;
  flight_category?: string;
  wind_speed_kt?: number;
  wind_dir_degrees?: number;
  visibility_statute_mi?: number;
  sky_condition?: { sky_cover: string; cloud_base_ft_agl?: number }[];
  temp_c?: number;
}

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

async function fetchMetar(icaoCodes: string[]): Promise<WeatherData[]> {
  const ids = icaoCodes.join(',');
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=json`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function flightCategory(w: WeatherData): { label: string; color: string } {
  const cat = w.flight_category?.toUpperCase();
  if (cat === 'VFR') return { label: 'VFR', color: 'var(--color-success)' };
  if (cat === 'MVFR') return { label: 'MVFR', color: 'var(--color-primary)' };
  if (cat === 'IFR') return { label: 'IFR', color: 'var(--color-danger)' };
  if (cat === 'LIFR') return { label: 'LIFR', color: '#a855f7' };
  return { label: 'N/A', color: 'var(--color-text-hint)' };
}

// ─── SimBrief ─────────────────────────────────────────────────────────────────

function buildSimbriefUrl(dep: string, arr: string, aircraft: string): string {
  const acMap: Record<string, string> = {
    'Airbus A319': 'A319', 'Airbus A320': 'A320', 'Airbus A320-200': 'A320',
    'Airbus A321': 'A321', 'Airbus A330': 'A332', 'Airbus A350': 'A359',
    'Airbus A350-900': 'A359', 'Airbus A380': 'A388',
    'Boeing 777': 'B77W', 'Boeing 787': 'B789',
  };
  const acType = acMap[aircraft] || 'A320';
  return `https://dispatch.simbrief.com/options/custom?type=${acType}&orig=${dep}&dest=${arr}`;
}

// ─── Componente principale ────────────────────────────────────────────────────

interface ARIAProps {
  userId: string;
  pilotName?: string;
}

type ViewState = 'chat' | 'schedule' | 'weather';

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
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || '[]';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed: ScheduledFlight[] = JSON.parse(clean);
      setSchedule(parsed);
    } catch (e) {
      console.error('Schedule generation error:', e);
    } finally {
      setScheduleLoading(false);
    }
  }, [profile, pilotName]);

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
                              href={buildSimbriefUrl(f.departure, f.arrival, f.aircraft)}
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
                      <span style={s.weatherIcao}>{w.icao}</span>
                      <span style={{ ...s.weatherCat, color: cat.color, borderColor: cat.color }}>
                        {cat.label}
                      </span>
                    </div>
                    <div style={s.weatherStats}>
                      {w.wind_speed_kt !== undefined && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Vento</span>
                          <span style={s.wStatVal}>{w.wind_dir_degrees || 0}° / {w.wind_speed_kt} kt</span>
                        </div>
                      )}
                      {w.visibility_statute_mi !== undefined && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Visibilità</span>
                          <span style={s.wStatVal}>{w.visibility_statute_mi} SM</span>
                        </div>
                      )}
                      {w.temp_c !== undefined && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Temp</span>
                          <span style={s.wStatVal}>{w.temp_c}°C</span>
                        </div>
                      )}
                      {w.sky_condition && w.sky_condition.length > 0 && (
                        <div style={s.wStat}>
                          <span style={s.wStatLabel}>Sky</span>
                          <span style={s.wStatVal}>
                            {w.sky_condition.map(sc =>
                              `${sc.sky_cover}${sc.cloud_base_ft_agl ? ` @${sc.cloud_base_ft_agl}ft` : ''}`
                            ).join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                    {w.raw_text && (
                      <div style={s.rawMetar}>
                        <span style={s.rawLabel}>METAR</span>
                        <code style={s.rawCode}>{w.raw_text}</code>
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
    height: '680px',
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
    justifyContent: 'space-between', marginBottom: '12px',
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
};
