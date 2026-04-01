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
import { useTheme } from '../hooks/useTheme';
import { 
  collection, 
  getDocs, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  query,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { sendOperationalAlert } from '../utils/discord';
import { fetchNpcRoster, calculateNetworkState, NetworkFlight, NpcPilot } from '../utils/networkSimulator';
import { findAirport } from '../utils/airportUtils';
import { 
  MessageSquare, 
  LayoutDashboard, 
  Calendar, 
  Users,
  Plane, 
  Activity, 
  ChevronRight, 
  Map as MapIcon, 
  Navigation,
  Clock,
  Maximize2,
  RefreshCw,
  Search,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// ─── Componente Mappa ─────────────────────────────────────────────────────────

interface ARIAMapProps {
    flights: NetworkFlight[];
    selectedFlight: any | null;
    isDarkMode: boolean;
    onCloseFlight?: () => void;
}

const ARIAMap = ({ flights, selectedFlight, isDarkMode, onCloseFlight }: ARIAMapProps) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        // Cleanup
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }

        const tileUrl = isDarkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        
        const map = L.map(mapRef.current, { 
            attributionControl: false,
            zoomControl: false,
            minZoom: 2,
            maxZoom: 12
        }).setView([30, 10], 2);
        
        mapInstance.current = map;
        L.tileLayer(tileUrl).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const bounds = L.latLngBounds([]);

        // Icone personalizzate - Migliorate per visibilità e forma
        const planeIcon = L.divIcon({
            className: 'custom-plane-icon',
            html: `
                <div style="transform: rotate(0deg); color: var(--color-primary); filter: drop-shadow(0 0 2px white);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="0.5">
                        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
                    </svg>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const hubIcon = L.divIcon({
            className: 'custom-hub-icon',
            html: `<div style="width: 10px; height: 10px; background: var(--color-primary); border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px var(--color-primary);"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5]
        });

        // Helper per ottenere posizione interpolata
        const getFlightPos = (f: any): [number, number] | null => {
            const dep = findAirport(f.departure);
            const arr = findAirport(f.arrival);
            if (!dep || !arr) return null;
            
            const pct = (f.progressPercent || 0) / 100;
            const lat = dep.latitude + (arr.latitude - dep.latitude) * pct;
            const lon = dep.longitude + (arr.longitude - dep.longitude) * pct;
            return [lat, lon];
        };

        // Stile comune per tooltips
        const tooltipOptions = {
            permanent: true,
            direction: 'top' as any,
            className: 'aria-map-tooltip',
            offset: [0, -10] as any
        };

        // Se c'è un volo selezionato, disegna la rotta
        if (selectedFlight) {
            const dep = findAirport(selectedFlight.departure);
            const arr = findAirport(selectedFlight.arrival);
            
            if (dep && arr) {
                const depPos: [number, number] = [dep.latitude, dep.longitude];
                const arrPos: [number, number] = [arr.latitude, arr.longitude];
                
                L.polyline([depPos, arrPos], {
                    color: 'var(--color-primary)',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 10'
                }).addTo(map);

                L.circleMarker(depPos, { radius: 6, color: 'var(--color-success)', fillOpacity: 1 }).addTo(map)
                    .bindTooltip(selectedFlight.departure, { ...tooltipOptions, direction: 'bottom' });
                L.circleMarker(arrPos, { radius: 6, color: 'var(--color-danger)', fillOpacity: 1 }).addTo(map)
                    .bindTooltip(selectedFlight.arrival, { ...tooltipOptions, direction: 'bottom' });
                
                bounds.extend(depPos);
                bounds.extend(arrPos);
                
                const planePos = getFlightPos(selectedFlight);
                if (planePos) {
                    L.marker(planePos, { icon: planeIcon }).addTo(map)
                        .bindTooltip(selectedFlight.flightNumber, tooltipOptions);
                    bounds.extend(planePos);
                }
                
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
            }
        } else {
            // Network view
            flights.forEach(f => {
                const pos = getFlightPos(f);
                if (pos) {
                    L.marker(pos, { icon: planeIcon })
                        .addTo(map)
                        .bindTooltip(f.flightNumber, tooltipOptions)
                        .bindPopup(`<b>${f.flightNumber}</b><br>${f.departure} → ${f.arrival}<br>${f.status}`);
                    bounds.extend(pos);
                }
            });

            // Aggiungi Hubs principali
            ['LIRF', 'KBOS', 'VHHH', 'EGLL'].forEach(icao => {
                const apt = findAirport(icao);
                if (apt) {
                    const pos: [number, number] = [apt.latitude, apt.longitude];
                    L.marker(pos, { icon: hubIcon }).addTo(map)
                        .bindTooltip(icao, { ...tooltipOptions, offset: [0, 5], direction: 'bottom' });
                    bounds.extend(pos);
                }
            });

            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [100, 100], maxZoom: 3 });
            }
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [flights, selectedFlight, isDarkMode]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* CSS Iniezione per Leaflet Overrides */}
            <style dangerouslySetInnerHTML={{ __html: `
                .leaflet-container {
                    font-family: var(--font-family-sans) !important;
                }
                .aria-map-tooltip {
                    background: rgba(var(--color-surface-rgb), 0.85) !important;
                    backdrop-filter: blur(8px);
                    border: 1px solid var(--color-border) !important;
                    border-radius: 4px !important;
                    padding: 2px 6px !important;
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    font-family: var(--font-family-mono) !important;
                    color: var(--color-text-primary) !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
                }
                .aria-map-tooltip::before {
                    display: none !important;
                }
                .leaflet-popup-content-wrapper {
                    background: var(--color-surface) !important;
                    color: var(--color-text-primary) !important;
                    border-radius: var(--radius-md) !important;
                    font-family: var(--font-family-sans) !important;
                }
                .leaflet-popup-tip {
                    background: var(--color-surface) !important;
                }
            `}} />
            <div ref={mapRef} style={{ width: '100%', height: '100%', background: 'var(--color-background)' }} />
            {selectedFlight && (
                <div style={{ 
                    position: 'absolute', top: '16px', left: '16px', zIndex: 1000,
                    display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                    <div style={{ 
                        background: 'rgba(var(--color-surface-rgb), 0.9)', backdropFilter: 'blur(10px)',
                        padding: '12px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: '12px'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 600, textTransform: 'uppercase' }}>Focus Flight</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)' }}>{selectedFlight.flightNumber}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--color-divider)', paddingLeft: '12px' }}>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '9px', color: 'var(--color-text-hint)' }}>Route</span>
                                <span style={{ fontSize: '12px', fontWeight: 600 }}>{selectedFlight.departure} → {selectedFlight.arrival}</span>
                            </div>
                        </div>
                        <button 
                            onClick={onCloseFlight}
                            style={{ 
                                marginLeft: '8px', background: 'var(--color-background)', border: '1px solid var(--color-border)',
                                borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--color-text-secondary)'
                            }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function ARIAAssistant({ userId, pilotName }: ARIAProps) {
  const { isDarkMode } = useTheme();
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
  
  // Mappa
  const [selectedFlightForMap, setSelectedFlightForMap] = useState<any | null>(null);
  const [isMapZoomed, setIsMapZoomed] = useState(false);
  const [mapMode, setMapMode] = useState<'network' | 'flight'>('network');
  const [isStandbyActive, setIsStandbyActive] = useState(false);
  const [standbyAlerts, setStandbyAlerts] = useState<any[]>([]);
  
  // Refs per prevenire double-counting
  const networkFlightsRef = useRef<NetworkFlight[]>([]);
  const processedArrivedFlights = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('velar_processed_flights') || '[]')
  ));

  const sendDailyReport = useCallback(() => {
    const activeVols = networkFlights.length;
    const totalFH = fleetState.reduce((acc, ac) => acc + ac.totalFlightHours, 0);
    const aogCount = fleetState.filter(ac => ac.status === 'AOG').length;

    fetch('/api/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'daily',
        payload: {
          embeds: [{
            title: "📊 Velar Ops Center — Daily Network Report",
            description: "Chiusura operazioni e riassunto statistico della giornata.",
            color: 0x0d151e,
            fields: [
              { name: "Voli Operati", value: `${activeVols + 12} (Simulati)`, inline: true },
              { name: "Flotta AOG", value: `${aogCount} aeromobili`, inline: true },
              { name: "Accumulo Totale", value: `${Math.floor(totalFH)} FH`, inline: true },
              { name: "Stato Network", value: "✅ REGOLARE", inline: false }
            ],
            footer: { text: `Velar Hub Ops • ${new Date().toLocaleDateString()}` }
          }]
        }
      })
    }).then(() => alert("Daily Report inviato correttamente su Discord (#daily-reports)!"));
  }, [networkFlights, fleetState]);

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

    // ── Caricamento Flotta (Offline-First / Init Firestore) ──
    const initFleet = async () => {
      try {
        const r = await fetch('/api/fleet');
        const localFleet = await r.json();
        if (Array.isArray(localFleet)) {
          setFleetState(localFleet); // Dati immediati in UI
          console.log('[ARIA Ops] Flotta locale caricata:', localFleet.length);

          // Sincronizziamo Firestore se vuoto o se sono tutti a zero (migrazione a dati reali)
          const snap = await getDocs(collection(db, 'fleet'));
          const cloudFleet = snap.docs.map(d => d.data());
          const totalCloudHours = cloudFleet.reduce((acc: number, val: any) => acc + (val.totalFlightHours || 0), 0);

          if (snap.empty || totalCloudHours < 1) {
            console.log('[ARIA Ops] Inizializzazione Cloud con dati realistici in corso...');
            for (const ac of localFleet) {
               await setDoc(doc(db, 'fleet', ac.id), ac, { merge: true });
            }
            console.log('[ARIA Ops] Cloud popolato con successo.');
          }
        }
      } catch (err) {
        console.warn('[ARIA Ops] Errore caricamento flotta locale:', err);
      }
    };

    initFleet();

    // 📡 Listener Flotta (Cloud Firestore)
    const fleetCollection = collection(db, 'fleet');
    const unsubscribeFleet = onSnapshot(fleetCollection, (snapshot) => {
      if (!snapshot.empty) {
        const fleetData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFleetState(fleetData);
        // networkFlightsRef.current = []; // RIMOSSO: Evita glitch visivi e loop durante update flotta
        console.log('[ARIA Cloud] Flotta sincronizzata:', fleetData.length);
      } else {
        // Se Firestore è vuoto, lo popoliamo dal locale già caricato
        console.log('[ARIA Cloud] Database vuoto. Sincronizzazione in corso...');
      }
    });

    return () => {
      unsubscribeFleet();
    };
  }, []);

  // ── Heartbeat Engine ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!opsPlan || npcRoster.length === 0) return;
    console.log('[ARIA Heartbeat] Starting engine...', { hasFleet: fleetState.length > 0 });

    
    const tick = async () => {
      const active = calculateNetworkState(opsPlan, npcRoster, Date.now(), fleetState);
      const prev = networkFlightsRef.current;
      
      const sendDiscord = async (channel: string, payload: any) => {
        try {
          await fetch('/api/discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, payload })
          });
        } catch (e) {
          console.error('[ARIA Ops] Discord Notification failed:', e);
        }
      };

      for (const flight of active) {
          const oldFlight = prev.find(f => f.id === flight.id);
          
          if (oldFlight && oldFlight.status !== 'Arrived' && flight.status === 'Arrived') {
              if (flight.tailNumber && flight.tailNumber !== 'Generic' && !processedArrivedFlights.current.has(flight.id)) {
                   processedArrivedFlights.current.add(flight.id);
                   localStorage.setItem('velar_processed_flights', JSON.stringify(Array.from(processedArrivedFlights.current)));
                   
                   // Calcolo ore basato su flight plan (in ore)
                   const blockHours = (flight.arrivalTime - flight.departureTime) / 60; 
                   const ac = fleetState.find(a => a.id === flight.tailNumber);
                   
                   if (ac) {
                      const newTotalHours = (ac.totalFlightHours || 0) + blockHours;
                      const prevMaint = ac.lastMaintenanceHour || 0;
                      let newStatus = 'Idle';
                      let isAOG = false;
                      let aogTime = 0;
                      let wentAOG = false;

                      if (newTotalHours - prevMaint >= 500) {
                         newStatus = 'AOG';
                         isAOG = true;
                         aogTime = Date.now() + (24 * 60 * 60 * 1000);
                         wentAOG = true;
                      }

                      try {
                         await updateDoc(doc(db, 'fleet', ac.id), {
                            totalFlightHours: newTotalHours,
                            status: newStatus,
                            isAOG,
                            aogUntilTimeMs: aogTime
                         });

                         if (wentAOG) {
                           sendDiscord('ops', {
                              content: `🚨 **MAINTENANCE ALERT (CHECK-A)**\nL'aeromobile **${ac.id}** (${ac.type}) ha superato la soglia critica delle 500 ore. Sospeso per 24h.\n\n⚠️ **URGENZA OPS**: Volo ${flight.flightNumber} completato. Rotazione successiva scoperta.`
                           });
                           setStandbyAlerts(p => [...p, { 
                             id: Date.now().toString(), 
                             tailNumber: ac.id, 
                             aircraft: ac.type, 
                             flightNum: flight.flightNumber, 
                             time: new Date() 
                           }]);
                         }
                      } catch (err) {
                         console.error('[ARIA Ops] Fallito update Firestore fleet:', err);
                      }
                   }
              }
          }
      }

      networkFlightsRef.current = active;
      setNetworkFlights(active);
      setLastHeartbeat(new Date());
    };
    
    tick();
    const interval = setInterval(tick, 30000); 
    return () => clearInterval(interval);
  }, [opsPlan, npcRoster, fleetState]);

  // ── Carica voli da Firestore ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        console.log('[ARIA Logbook] Caricamento voli per:', userId);
        const snap = await getDocs(collection(db, 'users', userId, 'flights'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Flight));
        console.log('[ARIA Logbook] Voli trovati:', data.length);
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

  // ── Cleanup settimanale del registro voli processati ──
  useEffect(() => {
    const lastCleanup = localStorage.getItem('velar_last_cleanup');
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    if (!lastCleanup || now - parseInt(lastCleanup) > SEVEN_DAYS) {
      console.log('[ARIA Ops] Cleanup settimanale registro arrivi eseguito.');
      localStorage.setItem('velar_processed_flights', '[]');
      localStorage.setItem('velar_last_cleanup', now.toString());
      processedArrivedFlights.current = new Set();
    }
  }, []);

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

    const aogCount = fleetState.filter(ac => ac.status === 'AOG' || ac.isAOG).length;
    const activeVols = networkFlights.length;
    const hubStats = opsPlan?.hubs?.map((hub: VelarHub) => {
       const activeAtHub = networkFlights.filter(f => f.departure === hub.icao).length;
       return `${hub.icao} (${hub.city}): ${activeAtHub} voli attivi ora.`;
    }).join('\n') || '';

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

La flotta Velar ha ${totalFleetCount} aeromobili (${totalFleetCount - aogCount} operativi, ${aogCount} in manutenzione AOG).
Hub attivi e stato network:
${hubStats}
Voli totali attivi nel network ora: ${activeVols}

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
      
      {/* ── SIDEBAR INTERNA (FISSA) ── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={s.logoContainer}>
            <div style={s.ariaIcon}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h2 style={s.sidebarTitle}>ARIA</h2>
          </div>
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 600, letterSpacing: '0.05em' }}>
            OPERATIONAL DASHBOARD
          </div>
        </div>

        <nav style={s.sidebarNav}>
          {(['chat', 'overview', 'schedule', 'fleet', 'network'] as ViewState[]).map(v => (
            <button 
              key={v} 
              onClick={() => setView(v)}
              style={{ ...s.sidebarBtn, ...(view === v ? s.sidebarBtnActive : {}) }}
            >
              {v === 'chat' && <MessageSquare style={s.sidebarBtnIcon} />}
              {v === 'overview' && <LayoutDashboard style={s.sidebarBtnIcon} />}
              {v === 'schedule' && <Calendar style={s.sidebarBtnIcon} />}
              {v === 'fleet' && <Plane style={s.sidebarBtnIcon} />}
              {v === 'network' && <Activity style={s.sidebarBtnIcon} />}
              <span style={{ textTransform: 'capitalize' }}>{v}</span>
              {view === v && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </button>
          ))}
        </nav>

        {profile && (
          <div style={s.pilotInfo}>
            <div style={s.pilotAvatar}>
              {pilotName ? pilotName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div style={s.pilotText}>
              <span style={s.pilotName}>{pilotName || 'Comandante'}</span>
              <span style={s.pilotRank}>{profile.currentRank.name}</span>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
               <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>{profile.totalXp.toLocaleString()}</span>
               <div style={{ fontSize: '9px', color: 'var(--color-text-hint)', fontWeight: 600 }}>XP</div>
            </div>
          </div>
        )}
        
        <div style={{ padding: '0 16px 16px' }}>
             <button onClick={testDiscord} style={{ ...s.sidebarBtn, width: '100%', border: '1px solid var(--color-border)', fontSize: '11px', padding: '8px 12px', marginTop: '12px' }}>
                <Activity size={14} /> Discord Test
             </button>
        </div>
      </aside>

      {/* ── AREA PRINCIPALE ── */}
      <main style={s.mainArea}>
        
        {/* MAPPA IN ALTO */}
        <div style={s.mapWrapper}>
          <ARIAMap 
            flights={networkFlights} 
            selectedFlight={selectedFlightForMap} 
            isDarkMode={isDarkMode} 
            onCloseFlight={() => { setSelectedFlightForMap(null); setMapMode('network'); }}
          />
          <div style={s.mapOverlay}>
            <div style={s.mapBadge}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', animation: 'pulse 2s infinite' }} />
                LIVE NETWORK: {networkFlights.length} VOLI
            </div>
            <div style={s.mapBadge}>
                <Clock size={12} />
                {new Date().getUTCHours().toString().padStart(2, '0')}:{new Date().getUTCMinutes().toString().padStart(2, '0')} ZULU
            </div>
          </div>
        </div>

        {/* CONTENUTO SCROLLABILE */}
        <div style={s.contentScroller}>

          {/* 💬 CHAT VIEW */}
          {view === 'chat' && (
            <div style={s.chatContent}>
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
                       <RefreshCw size={16} className="spin" style={{ color: 'var(--color-text-hint)' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={s.chatFooter}>
                <div style={s.quickActions}>
                  {[
                    'Analisi rotte XP',
                    'Stato flotta attiva',
                    'Prossimo rank',
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
                    placeholder="Invia un comando tattico ad ARIA..."
                  />
                  <button style={s.sendBtn} onClick={sendMessage} disabled={isTyping || !input.trim()}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* 📊 OVERVIEW VIEW */}
          {view === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={s.kpiGrid}>
                 <div style={s.kpiCard}>
                    <span style={s.sectionTitle}>Total XP</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>{profile?.totalXp.toLocaleString()}</span>
                 </div>
                 <div style={s.kpiCard}>
                    <span style={s.sectionTitle}>Block Hours</span>
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{profile?.totalHours.toFixed(1)}h</span>
                 </div>
                 <div style={s.kpiCard}>
                    <span style={s.sectionTitle}>Total Flights</span>
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{profile?.totalFlights}</span>
                 </div>
                 <div style={s.kpiCard}>
                    <span style={s.sectionTitle}>Network Traffic</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{networkFlights.length}</span>
                 </div>
              </div>

              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Hub Performance</h3>
                  <button onClick={generateOverview} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px' }}>
                    <RefreshCw size={14} style={{ marginRight: '6px' }} /> Update AI analysis
                  </button>
                </div>
                
                {overviewData ? (
                  <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
                     {typeof overviewData === 'string' ? (
                       overviewData.split('\n').map((line: string, i: number) => <p key={i} style={{ margin: '0 0 12px' }}>{line}</p>)
                     ) : (
                       <p>Dati non disponibili nel formato corretto.</p>
                     )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-hint)' }}>
                     {overviewLoading ? <RefreshCw className="spin" size={24} /> : 'Nessuna analisi generata. Clicca su Aggiorna.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 📅 SCHEDULE VIEW */}
          {view === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  style={{ ...s.sidebarBtn, ...(scheduleTab === 'mine' ? s.sidebarBtnActive : {}), width: 'auto' }}
                  onClick={() => setScheduleTab('mine')}
                >
                  <Calendar size={16} /> I miei voli
                </button>
                <button
                  style={{ ...s.sidebarBtn, ...(scheduleTab === 'crew' ? s.sidebarBtnActive : {}), width: 'auto' }}
                  onClick={() => setScheduleTab('crew')}
                >
                  <Users size={16} /> Crew Board
                </button>
              </div>

              {scheduleTab === 'mine' && (
                <div style={s.flightGrid}>
                  {schedule.length > 0 ? (
                    schedule.map((f, i) => (
                      <div key={i} style={{ ...s.card, ...s.flightCard, ...(selectedFlight === f ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary)' } : {}) }} onClick={() => { setSelectedFlight(f); setSelectedFlightForMap(f); setIsMapZoomed(true); }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={s.sectionTitle}>{f.day} • {f.flightNumber}</span>
                            <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0' }}>{f.departure} → {f.arrival}</div>
                          </div>
                          <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: 'var(--color-background)', color: 'var(--color-text-secondary)' }}>{f.aircraft}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                           <span>{f.distance}</span>
                           <span>{f.estimatedDuration}</span>
                        </div>
                        {selectedFlight === f && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                            <p style={{ margin: '0 0 12px' }}>{f.reason}</p>
                            <a href={buildSimbriefUrl(f)} target="_blank" rel="noopener noreferrer" style={{ ...s.sendBtn, width: '100%', height: '36px', fontSize: '13px', textDecoration: 'none', gap: '8px' }}>
                              <ExternalLink size={14} /> Briefing in SimBrief
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--color-text-hint)' }}>
                       <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                       <p>Nessun volo programmato. Genera una nuova schedule settimanale.</p>
                       <button onClick={generateSchedule} style={{ ...s.sendBtn, width: 'auto', padding: '0 24px', margin: '16px auto' }}>Genera Schedule</button>
                    </div>
                  )}
                </div>
              )}

              {scheduleTab === 'crew' && (
                <div style={s.flightGrid}>
                  {Array.from(new Map(networkFlights.filter(f => !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)).map(f => [f.pilot.id, f])).values()).map((nf: any) => (
                    <div key={nf.id} style={s.card}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={s.ariaAvatar}>{(nf.pilot.name || 'CM').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 600 }}>{nf.pilot.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>{nf.pilot.rank} • {nf.pilot.base}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontFamily: 'var(--font-family-mono)', fontWeight: 600 }}>{nf.flightNumber}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>{nf.status.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{nf.departure} → {nf.arrival}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ✈️ FLEET VIEW */}
          {view === 'fleet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={s.card}>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <div style={s.ariaAvatar}>A</div>
                   <div>
                      <span style={s.sectionTitle}>ARIA Fleet Intelligence</span>
                      <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                        {fleetBriefingLoading ? 'Analisi stato flotta in corso...' : fleetBriefing}
                      </p>
                   </div>
                </div>
              </div>

              <div style={s.flightGrid}>
                {fleetState.map((ac) => {
                  // Trova se l'aereo è attualmente in volo nel network
                  const activeFlight = networkFlights.find(nf => nf.tailNumber === ac.id);
                  const isFlying = activeFlight && !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(activeFlight.status);
                  const liveStatus = isFlying ? activeFlight.status.toUpperCase() : ac.status;
                  const statusColor = ac.status === 'AOG' ? 'var(--color-danger)' : 
                                     isFlying ? 'var(--color-primary)' : 'var(--color-success)';

                  return (
                    <div key={ac.id} style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-family-mono)' }}>{ac.id}</span>
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          background: `${statusColor}22`, 
                          color: statusColor, 
                          fontWeight: 700,
                          border: `1px solid ${statusColor}44`
                        }}>
                          {liveStatus}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{ac.type}</div>
                      
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-hint)', marginBottom: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{ac.totalFlightHours.toFixed(1)}h</span>
                            <span>totali</span>
                          </div>
                          <span>Check: {Math.floor(((ac.totalFlightHours % 500) / 500) * 100)}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${((ac.totalFlightHours % 500) / 500) * 100}%`, 
                            background: ac.status === 'AOG' ? 'var(--color-danger)' : 
                                       ((ac.totalFlightHours % 500) > 450) ? 'var(--color-warning)' : 'var(--color-primary)',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                      
                      {isFlying && (
                        <div style={{ marginTop: '10px', padding: '6px', borderRadius: '6px', background: 'var(--color-primary-light)', fontSize: '10px' }}>
                          <span style={{ fontWeight: 600 }}>{activeFlight?.flightNumber}</span>: {activeFlight?.departure} → {activeFlight?.arrival}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 📡 NETWORK VIEW */}
          {view === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Live Operations</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Ultimo segnale: {lastHeartbeat.toLocaleTimeString()}</div>
                     <button onClick={() => setIsStandbyActive(!isStandbyActive)} style={{ ...s.sidebarBtn, background: isStandbyActive ? 'rgba(255, 107, 129, 0.1)' : 'transparent', color: isStandbyActive ? '#ff6b81' : 'var(--color-text-hint)', border: '1px solid currentColor', padding: '6px 12px', height: 'auto', width: 'auto' }}>
                        {isStandbyActive ? 'DISATTIVA STANDBY' : 'ATTIVA STANDBY'}
                     </button>
                  </div>
               </div>

               <div style={s.flightGrid}>
                  {[...networkFlights].sort((a, b) => {
                    const statusPrio: Record<string, number> = {
                      'En Route': 100,
                      'Approach': 90,
                      'Taxi Out': 80,
                      'Pushback': 70,
                      'Boarding': 60,
                      'Taxi In': 50,
                      'Arrived': 40,
                      'Turnaround': 30,
                      'Scheduled': 20,
                      'AOG/Cancel': 10
                    };
                    const pa = statusPrio[a.status] || 0;
                    const pb = statusPrio[b.status] || 0;
                    if (pa !== pb) return pb - pa;
                    return a.departureTime - b.departureTime;
                  }).map((nf) => (
                    <div key={nf.id} style={s.card} onClick={() => { setSelectedFlightForMap(nf); setIsMapZoomed(true); }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>{nf.flightNumber}</div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: nf.status === 'En Route' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{nf.status.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, margin: '4px 0' }}>{nf.departure} → {nf.arrival}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-hint)' }}>
                        <span>Cmdt. {nf.pilot.name}</span>
                        <span>{nf.aircraft} ({nf.tailNumber})</span>
                      </div>
                      {nf.progressPercent > 0 && nf.progressPercent < 100 && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ height: '3px', background: 'var(--color-background)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${nf.progressPercent}%`, background: 'var(--color-primary)' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Stili — usa variabili CSS Skydeck, funziona in light e dark mode ────────

const s: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'var(--font-family-sans)',
    background: 'var(--color-surface)',
    display: 'flex',
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
  },
  
  // Sidebar Interna
  sidebar: {
    width: '240px',
    background: 'var(--color-background)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    zIndex: 10,
    padding: '24px 0',
  },
  sidebarHeader: {
    padding: '0 24px',
    marginBottom: '32px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  ariaIcon: {
    width: '32px',
    height: '32px',
    background: 'var(--color-primary)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    boxShadow: '0 4px 12px rgba(20, 106, 255, 0.3)',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'var(--font-family-display)',
    letterSpacing: '0.02em',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 12px',
  },
  sidebarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--color-text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    textAlign: 'left',
  },
  sidebarBtnActive: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
  },
  sidebarBtnIcon: {
    width: '18px',
    height: '18px',
  },

  // Main Content Area
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-surface)',
    overflow: 'hidden',
    position: 'relative',
  },

  // Map Container
  mapWrapper: {
    width: '100%',
    height: '320px',
    background: 'var(--color-background)',
    borderBottom: '1px solid var(--color-border)',
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    zIndex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mapBadge: {
    background: 'rgba(var(--color-surface-rgb), 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--color-border)',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: 'var(--shadow-sm)',
  },

  // Content Scroller (under the map)
  contentScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },

  // Chat View
  chatContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  msgRow: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  msgRowPilot: { flexDirection: 'row-reverse' },
  ariaAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    flexShrink: 0,
    background: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    fontFamily: 'var(--font-family-display)',
    boxShadow: '0 4px 12px rgba(20, 106, 255, 0.2)',
  },
  bubble: {
    maxWidth: '70%',
    padding: '16px 20px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
    animation: 'fadeSlideUp 0.3s ease-out',
  },
  bubbleAria: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderTopLeftRadius: '4px',
  },
  bubblePilot: {
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
    color: 'white',
    borderTopRightRadius: '4px',
    boxShadow: '0 8px 24px rgba(20, 106, 255, 0.25)',
  },
  msgLine: {
    margin: 0,
    fontSize: '14.5px',
    lineHeight: '1.6',
    fontFamily: 'var(--font-family-sans)',
  },
  msgTime: {
    fontSize: '10px',
    opacity: 0.6,
    alignSelf: 'flex-end',
    marginTop: '4px',
    fontFamily: 'var(--font-family-mono)',
  },
  
  chatFooter: {
    padding: '24px',
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
  },
  quickActions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickBtn: {
    fontSize: '12px',
    padding: '8px 16px',
    background: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-full)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-family-sans)',
    fontWeight: 500,
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    background: 'var(--color-background)',
    padding: '8px',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-primary)',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'var(--font-family-sans)',
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    flexShrink: 0,
    background: 'var(--color-primary)',
    border: 'none',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },

  // Common UI Elements (from Briefing/Hangar)
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  glassCard: {
    background: 'rgba(var(--color-surface-rgb), 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-text-hint)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '8px',
    fontFamily: 'var(--font-family-sans)',
  },
  monoData: {
    fontFamily: 'var(--font-family-mono)',
    fontWeight: 500,
  },

  // KPI UI
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    padding: '16px 20px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  // Flight Lists
  flightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  flightCard: {
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Pilot Profile Mini
  pilotInfo: {
    marginTop: 'auto',
    padding: '24px 16px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pilotAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--color-primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-primary)',
    fontWeight: 700,
  },
  pilotText: {
    display: 'flex',
    flexDirection: 'column',
  },
  pilotName: {
    fontSize: '14px',
    fontWeight: 600,
  },
  pilotRank: {
    fontSize: '11px',
    color: 'var(--color-text-hint)',
  }
};
