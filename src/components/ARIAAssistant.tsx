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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme';
import styles from './ARIAAssistant.module.css';
import { 
  collection, 
  getDocs, 
  getDoc,
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  query,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { sendOperationalAlert } from '../utils/discord';
import { fetchNpcRoster, calculateNetworkState, NetworkFlight, NpcPilot, assignPilot, parseTime, parseBlock } from '../utils/networkSimulator';
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
  ExternalLink,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Tablet,
  Fuel,
  Wind,
  Gauge,
  ArrowUp,
  Route,
  Copy,
  Check,
  CheckSquare,
  FileText,
  Weight
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

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
  legIndex?: number; // posizione del leg nel giorno (0-based)
}

// Struttura per giorni con più legs (turnaround)
interface ScheduleDay {
  day: string;
  legs: ScheduledFlight[];
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
    // Fix: applica x2 solo se la streak è attiva in questo volo (non retroattiva)
    if (currentStreak >= 7) xp *= 2;
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

type ViewState = 'chat' | 'overview' | 'schedule' | 'fleet' | 'network' | 'roster' | 'financials' | 'efb';

// ─── Financial Simulator Specs (Real-world based) ──────────────────────────
const FINANCIAL_CONFIG = {
  REVENUE_PER_NM_PAX: 0.12,     // $0.12 per miglio per passeggero
  ANCILLARY_REVENUE_PER_PAX: 22, // Bagagli, food, wifi
  CREW_COST_PER_HOUR: 850,       // Totale cockpit + cabin
  LANDING_FEE_FIXED: 1200,       // Tassa fissa a scalo
  FUEL_PRICE_PER_KG: 0.90,       // $0.90/kg Jet-A simulato (realistico 2024)
};

// Velocità di crociera tipica per tipo (nodi) — usata per stimare distanza voli live
const CRUISE_SPEED_KT: Record<string, number> = {
  'Airbus A319': 430,
  'Airbus A320': 450,
  'Airbus A320-200': 450,
  'Airbus A321': 450,
  'Airbus A321LR': 450,
  'Airbus A330': 480,
  'Airbus A330neo': 480,
  'Airbus A350': 490,
  'Airbus A350-900': 490,
  'Airbus A380': 480,
  'Boeing 777': 490,
  'Boeing 787': 485,
};

// Soglia ore per ciclo di manutenzione (Check-A simulato)
const MAINTENANCE_CYCLE_HOURS = 5000;

const AIRCRAFT_FINANCIALS: Record<string, { capacity: number; fuelBurnHr: number; maintenanceDay: number }> = {
  'Airbus A319': { capacity: 144, fuelBurnHr: 2400, maintenanceDay: 1200 },
  'Airbus A320': { capacity: 180, fuelBurnHr: 2600, maintenanceDay: 1500 },
  'Airbus A320-200': { capacity: 180, fuelBurnHr: 2600, maintenanceDay: 1500 },
  'Airbus A321': { capacity: 220, fuelBurnHr: 2800, maintenanceDay: 1800 },
  'Airbus A321LR': { capacity: 210, fuelBurnHr: 2850, maintenanceDay: 2000 },
  'Airbus A330': { capacity: 300, fuelBurnHr: 5500, maintenanceDay: 4500 },
  'Airbus A330neo': { capacity: 300, fuelBurnHr: 5200, maintenanceDay: 4800 },
  'Airbus A350': { capacity: 325, fuelBurnHr: 6000, maintenanceDay: 6000 },
  'Airbus A350-900': { capacity: 325, fuelBurnHr: 6000, maintenanceDay: 6000 },
  'Airbus A380': { capacity: 525, fuelBurnHr: 12000, maintenanceDay: 15000 },
  'Boeing 777': { capacity: 360, fuelBurnHr: 6500, maintenanceDay: 6500 },
  'Boeing 787': { capacity: 290, fuelBurnHr: 4800, maintenanceDay: 5800 },
};
type MapMode = 'network' | 'route' | 'focused';

// ─── EFB Checklist Data ────────────────────────────────────────────────────

const CHECKLIST_DATA: Record<string, { label: string; items: { id: string; text: string; response: string }[] }> = {
  preflight: {
    label: 'Pre-Flight',
    items: [
      { id: 'pf01', text: 'OFP & Weather Brief', response: 'COMPLETED' },
      { id: 'pf02', text: 'NOTAM Review', response: 'CHECKED' },
      { id: 'pf03', text: 'Fuel Upload', response: 'CHECKED' },
      { id: 'pf04', text: 'Battery 1 & 2', response: 'ON' },
      { id: 'pf05', text: 'External Power', response: 'ON / AS RQRD' },
      { id: 'pf06', text: 'Emergency Equipment', response: 'CHECKED' },
      { id: 'pf07', text: 'Fire Protection', response: 'TESTED / NORMAL' },
      { id: 'pf08', text: 'ADIRS', response: 'NAV' },
      { id: 'pf09', text: 'Oxygen', response: 'CHECKED / 100%' },
      { id: 'pf10', text: 'MCDU Performance Data', response: 'INSERTED' },
      { id: 'pf11', text: 'V-Speeds', response: 'SET' },
      { id: 'pf12', text: 'Flight Controls', response: 'CHECKED' },
      { id: 'pf13', text: 'Flaps / Slats', response: 'SET TO T/O CONFIG' },
      { id: 'pf14', text: 'Parking Brake', response: 'SET' },
    ],
  },
  before_takeoff: {
    label: 'Before Takeoff',
    items: [
      { id: 'bt01', text: 'TCAS', response: 'TA/RA' },
      { id: 'bt02', text: 'Transponder', response: 'ALT / ON' },
      { id: 'bt03', text: 'Cabin Report', response: 'RECEIVED' },
      { id: 'bt04', text: 'Doors', response: 'CLOSED & ARMED' },
      { id: 'bt05', text: 'Runway Confirmed', response: 'CONFIRMED' },
      { id: 'bt06', text: 'Takeoff Briefing', response: 'COMPLETED' },
      { id: 'bt07', text: 'ENG Anti-Ice (if rqrd)', response: 'ON / AS RQRD' },
      { id: 'bt08', text: 'Thrust Levers', response: 'SET FLEX/TOGA' },
      { id: 'bt09', text: 'Flight Directors', response: 'ON' },
      { id: 'bt10', text: 'Autothrust', response: 'ARMED' },
      { id: 'bt11', text: 'Strobes', response: 'ON' },
      { id: 'bt12', text: 'Landing Lights', response: 'ON' },
    ],
  },
  approach: {
    label: 'Approach',
    items: [
      { id: 'ap01', text: 'ATIS Received', response: 'NOTED' },
      { id: 'ap02', text: 'Approach Briefing', response: 'COMPLETED' },
      { id: 'ap03', text: 'Arrival Fuel Check', response: 'CHECKED' },
      { id: 'ap04', text: 'STAR & Transition', response: 'CONFIRMED' },
      { id: 'ap05', text: 'ILS / Approach Frequency', response: 'SET & IDENT' },
      { id: 'ap06', text: 'Minimums', response: 'SET' },
      { id: 'ap07', text: 'Seat Belt Signs', response: 'ON' },
      { id: 'ap08', text: 'Landing Lights', response: 'ON' },
      { id: 'ap09', text: 'Auto-Brake', response: 'MED / SET' },
      { id: 'ap10', text: 'GPWS & TCAS', response: 'CHECKED / ARMED' },
    ],
  },
  landing: {
    label: 'After Landing',
    items: [
      { id: 'la01', text: 'Reversers', response: 'STOWED' },
      { id: 'la02', text: 'Auto-Brake', response: 'DISARMED' },
      { id: 'la03', text: 'Spoilers', response: 'DISARMED' },
      { id: 'la04', text: 'Landing Lights', response: 'OFF' },
      { id: 'la05', text: 'Strobe Lights', response: 'OFF' },
      { id: 'la06', text: 'Transponder', response: 'STBY' },
      { id: 'la07', text: 'Flaps / Slats', response: 'RETRACT' },
      { id: 'la08', text: 'APU', response: 'START' },
      { id: 'la09', text: 'Parking Brake', response: 'SET / AS RQRD' },
      { id: 'la10', text: 'Engines', response: 'SHUTDOWN' },
      { id: 'la11', text: 'Seat Belt Signs', response: 'OFF' },
      { id: 'la12', text: 'Flight Log OUT/OFF/ON/IN', response: 'LOGGED' },
    ],
  },
};

// ─── EFB V-Speeds Tables (A320 family reference, semplificato per sim) ────────
// Basato su FCOM A320 — valori approssimati per uso simulatore
const computeVSpeeds = (tow: number, oat: number, elevation: number, headwind: number, flapsConfig: string) => {
  // Densità altitude correction
  const pressureAlt = elevation + (15 - oat) * 27; // rough ISA correction in ft
  const densityFactor = Math.max(0.85, 1 - pressureAlt / 145000);

  // Base V-speeds per TOW (kg) — curva linearizzata FCOM A320
  const towT = Math.min(Math.max(tow, 40000), 80000);
  const baseV1  = 100 + (towT - 40000) / 40000 * 40; // 100–140 kt range
  const baseVR  = baseV1 + 4;
  const baseV2  = baseVR + 8;

  // Flap config reduction
  const flapReduction: Record<string, number> = { '1+F': 0, '2': -4, '3': -8 };
  const flapDelta = flapReduction[flapsConfig] ?? 0;

  // Density altitude adjustment
  const da = 1 / densityFactor;

  // Headwind reduction (max 10kt reduction for 20kt+ headwind)
  const hwReduction = Math.min(Math.floor(headwind / 5), 10);

  const v1  = Math.round((baseV1  + flapDelta) * da) - hwReduction;
  const vr  = Math.round((baseVR  + flapDelta) * da) - Math.floor(hwReduction * 0.5);
  const v2  = Math.round((baseV2  + flapDelta) * da);

  // Flex temp: rough approximation — reduce by 1°C per 500kg below MTOW
  const mtow = 78000;
  const weightMargin = Math.max(0, mtow - tow);
  const flexTemp = Math.min(60, Math.round(oat + weightMargin / 500));
  const flexAvailable = flexTemp > oat + 5;

  return { v1, vr, v2, flexTemp: flexAvailable ? flexTemp : null, flexAvailable };
};

// ─── Componente Mappa ─────────────────────────────────────────────────────────

interface ARIAMapProps {
    flights: NetworkFlight[];
    selectedFlight: any | null;
    isDarkMode: boolean;
    onCloseFlight?: () => void;
    hubIcaos?: string[];
}

const ARIAMap = ({ flights, selectedFlight, isDarkMode, onCloseFlight, hubIcaos = ['LIRF', 'KBOS', 'WIII'] }: ARIAMapProps) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);

    // Inizializzazione Mappa (una sola volta)
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const map = L.map(mapRef.current, { 
            attributionControl: false,
            zoomControl: false,
            minZoom: 2,
            maxZoom: 12
        }).setView([30, 10], 2);
        
        mapInstance.current = map;
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // Update Tiles (quando cambia il tema)
    useEffect(() => {
        if (!mapInstance.current) return;

        if (tileLayerRef.current) {
            tileLayerRef.current.remove();
        }

        const tileUrl = isDarkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        
        tileLayerRef.current = L.tileLayer(tileUrl).addTo(mapInstance.current);
    }, [isDarkMode]);

    // Update Markers & Rotte
    useEffect(() => {
        if (!mapInstance.current || !markersLayerRef.current || !routeLayerRef.current) return;

        const map = mapInstance.current;
        markersLayerRef.current.clearLayers();
        routeLayerRef.current.clearLayers();

        const bounds = L.latLngBounds([]);

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
        const getFlightPos = (f: any): [number, number] | null => {
            const dep = findAirport(f.departure);
            const arr = findAirport(f.arrival);
            if (!dep || !arr) return null;
            const pct = (f.progressPercent || 0) / 100;
            const lat = dep.latitude + (arr.latitude - dep.latitude) * pct;
            const lon = dep.longitude + (arr.longitude - dep.longitude) * pct;
            return [lat, lon];
        };

        const tooltipOptions = {
            permanent: true,
            direction: 'top' as any,
            className: 'aria-map-tooltip',
            offset: [0, -10] as any
        };

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
                }).addTo(routeLayerRef.current);

                L.circleMarker(depPos, { radius: 6, color: 'var(--color-success)', fillOpacity: 1 }).addTo(routeLayerRef.current)
                    .bindTooltip(selectedFlight.departure, { ...tooltipOptions, direction: 'bottom' });
                L.circleMarker(arrPos, { radius: 6, color: 'var(--color-danger)', fillOpacity: 1 }).addTo(routeLayerRef.current)
                    .bindTooltip(selectedFlight.arrival, { ...tooltipOptions, direction: 'bottom' });
                
                bounds.extend(depPos);
                bounds.extend(arrPos);
                
                const planePos = getFlightPos(selectedFlight);
                if (planePos) {
                    L.marker(planePos, { icon: planeIcon }).addTo(routeLayerRef.current)
                        .bindTooltip(selectedFlight.flightNumber, tooltipOptions);
                    bounds.extend(planePos);
                }
                
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
            }
        } else {
            flights.forEach(f => {
                const pos = getFlightPos(f);
                if (pos) {
                    L.marker(pos, { icon: planeIcon })
                        .addTo(markersLayerRef.current!)
                        .bindTooltip(f.flightNumber, tooltipOptions)
                        .bindPopup(`<b>${f.flightNumber}</b><br>${f.departure} → ${f.arrival}<br>${f.status}`);
                    bounds.extend(pos);
                }
            });

            hubIcaos.forEach(icao => {
                const apt = findAirport(icao);
                if (apt) {
                    const pos: [number, number] = [apt.latitude, apt.longitude];
                    L.marker(pos, { icon: hubIcon }).addTo(markersLayerRef.current!)
                        .bindTooltip(icao, { ...tooltipOptions, offset: [0, 5], direction: 'bottom' });
                    bounds.extend(pos);
                }
            });

            if (bounds.isValid() && flights.length > 0) {
                map.fitBounds(bounds, { padding: [100, 100], maxZoom: 3 });
            }
        }
    }, [flights, selectedFlight, hubIcaos]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <style dangerouslySetInnerHTML={{ __html: `
                .leaflet-container { font-family: var(--font-family-sans) !important; }
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
                    pointer-events: none !important;
                }
                .aria-map-tooltip::before { display: none !important; }
                .leaflet-popup-content-wrapper {
                    background: var(--color-surface) !important;
                    color: var(--color-text-primary) !important;
                    border-radius: var(--radius-md) !important;
                    font-family: var(--font-family-sans) !important;
                }
                .leaflet-popup-tip { background: var(--color-surface) !important; }
            `}} />
            <div ref={mapRef} style={{ width: '100%', height: '100%', background: 'var(--color-background)' }} />
            {selectedFlight && (
                <div className={styles.mapFocusOverlay}>
                    <div className={styles.mapFocusCard}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={styles.sectionTitle} style={{ marginBottom: '2px' }}>Focus Flight</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)' }}>{selectedFlight.flightNumber}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '9px', color: 'var(--color-text-hint)' }}>Route</span>
                                <span style={{ fontSize: '12px', fontWeight: 600 }}>{selectedFlight.departure} → {selectedFlight.arrival}</span>
                            </div>
                        </div>
                        <button onClick={onCloseFlight} className={styles.mapCloseBtn}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Componente Financials ────────────────────────────────────────────────────

interface FinancialsViewProps {
  data: any;
}

const FinancialsView = ({ data, selectedHub, onHubSelect, period, setPeriod }: { 
  data: any, 
  selectedHub: string | null, 
  onHubSelect: (hub: string | null) => void,
  period: any,
  setPeriod: (p: any) => void
}) => {
  // FIX: fallback robusto — hub+periodo, poi hub+total, poi global+periodo, poi global+total
  const baseData = (selectedHub && data.hubStats?.[selectedHub])
    ? (data.hubStats[selectedHub][period] || data.hubStats[selectedHub].total)
    : (data.periods?.[period] || data.periods?.total);

  if (!baseData) return <div className={styles.card}>Caricamento dati finanziari...</div>;
  const current = baseData;

  // Label contestuale per l'header
  const contextLabel = selectedHub
    ? `Hub ${selectedHub} · ${period.toUpperCase()}`
    : `Global Network · ${period.toUpperCase()}`;
  
  const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'];
  const costData = [
    { name: 'Fuel', value: Math.round(current.fuelCosts || 0) },
    { name: 'Crew', value: Math.round(current.crewCosts || 0) },
    { name: 'Fees', value: Math.round(current.landingFees || 0) },
    { name: 'Maint/Fixed', value: Math.round(current.fixedCosts || 0) },
  ];

  const formatCurrency = (val: number) => {
    if (!isFinite(val)) return '$0';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Accounting & Profitability</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-hint)' }}>
            {contextLabel} — Analisi finanziaria deterministica delle operazioni Velar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-hint)', marginLeft: '4px' }}>Timeline</span>
            <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px' }}>
                {(['today', 'week', 'month', 'year', 'total'] as const).map(p => (
                    <button 
                      key={p} 
                      onClick={() => setPeriod(p)}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        textTransform: 'uppercase',
                        border: 'none',
                        borderRadius: '6px',
                        background: period === p ? 'var(--color-primary)' : 'transparent',
                        color: period === p ? 'white' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                        {p}
                    </button>
                ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-hint)', marginLeft: '4px' }}>Global Hubs</span>
            <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px' }}>
                <button 
                  onClick={() => onHubSelect(null)}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    border: 'none',
                    borderRadius: '6px',
                    background: !selectedHub ? 'var(--color-success)' : 'transparent',
                    color: !selectedHub ? 'white' : 'var(--color-text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  GLOBAL
                </button>
                {Object.keys(data.hubStats).map(hub => (
                    <button 
                      key={hub} 
                      onClick={() => onHubSelect(hub)}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        border: 'none',
                        borderRadius: '6px',
                        background: selectedHub === hub ? 'var(--color-primary)' : 'transparent',
                        color: selectedHub === hub ? 'white' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                        {hub}
                    </button>
                ))}
            </div>
          </div>
        </div>
      </header>

      {/* KPI GRID */}
      <div className={styles.kpiGrid}>
         <div className={styles.kpiCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={styles.sectionTitle}>Total Revenue</span>
                <DollarSign size={16} style={{ color: 'var(--color-success)' }} />
            </div>
            <span style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(current.revenue)}</span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>
                {/* FIX 11: rimosso delta "+12%" hardcoded non calcolato dai dati reali */}
                {current.flights > 0 ? `${current.flights} voli nel periodo` : 'Nessun volo nel periodo'}
            </div>
         </div>
         <div className={styles.kpiCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={styles.sectionTitle}>Operating Costs</span>
                <BarChart3 size={16} style={{ color: 'var(--color-danger)' }} />
            </div>
            <span style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(current.fuelCosts + current.crewCosts + current.landingFees + current.fixedCosts)}</span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>
                Inc. Fixed Maint: {formatCurrency(current.fixedCosts)}
            </div>
         </div>
         <div className={styles.kpiCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={styles.sectionTitle}>Net Profit</span>
                {current.netProfit >= 0 ? <TrendingUp size={16} style={{ color: 'var(--color-success)' }} /> : <TrendingDown size={16} style={{ color: 'var(--color-danger)' }} />}
            </div>
            <span style={{ fontSize: '24px', fontWeight: 700, color: current.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(current.netProfit)}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>
                Efficiency: { (current.revenue > 0) ? Math.round((current.netProfit / current.revenue) * 100) : 0 }% Margin
            </div>
         </div>
         <div className={styles.kpiCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={styles.sectionTitle}>Traffic Volume</span>
                <Plane size={16} style={{ color: 'var(--color-primary)' }} />
            </div>
            <span style={{ fontSize: '24px', fontWeight: 700 }}>{current.flights} flights</span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>
                Passengers: {current.pax.toLocaleString()}
            </div>
         </div>
      </div>

      {/* HUB & FLEET HEALTH SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        <div className={styles.card}>
            <h3 className={styles.sectionTitle} style={{ marginBottom: '16px' }}>Network Hub Performance</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(data.hubStats).map(([icao, hStats]: [string, any]) => {
                    const stats = hStats[period] || hStats.total;
                    return (
                        <div key={icao} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '13px' }}>{icao}</span>
                                <span style={{ color: (stats.netProfit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                                    {formatCurrency(stats.netProfit)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-hint)' }}>
                                <span>{stats.flights || 0} voli effettuati</span>
                                <span>{(stats.pax || 0).toLocaleString()} pax</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className={styles.card}>
            <h3 className={styles.sectionTitle} style={{ marginBottom: '16px' }}>Fleet Health & Maintenance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {Object.entries(data.fleetCondition).map(([id, stats]: [string, any]) => (
                    <div key={id} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                            <span style={{ fontWeight: 600 }}>{id}</span>
                            <span style={{ 
                                color: stats.condition > 70 ? 'var(--color-success)' : stats.condition > 30 ? 'var(--color-warning)' : 'var(--color-danger)',
                                fontWeight: 800
                            }}>
                                {stats.condition}%
                            </span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                            <div style={{ 
                                width: `${stats.condition}%`, 
                                height: '100%', 
                                background: stats.condition > 70 ? 'var(--color-success)' : stats.condition > 30 ? 'var(--color-warning)' : 'var(--color-danger)',
                                transition: 'width 1s ease-in-out'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-hint)' }}>
                            <span>Hours: {Math.round(stats.hours)}h</span>
                            <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{stats.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
         <div className={styles.card} style={{ padding: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Asset Management</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Costo Fisso Flotta: <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(data.fleetFixedDaily)}</span> /giorno</div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>Maintenance, Leasing & Ground Operations.</p>
         </div>
         <div className={styles.card} style={{ padding: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Efficiency KPI</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Breakeven Load: <span style={{ color: 'var(--color-primary)' }}>64% Pax</span></div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>Percentuale minima di riempimento per profitto.</p>
         </div>
         <div className={styles.card} style={{ padding: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Yield Analysis</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Average Yield: <span style={{ color: 'var(--color-success)' }}>{formatCurrency(current.revenue / (current.pax || 1))}/pax</span></div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>Ricavo medio per singolo passeggero trasportato.</p>
         </div>
      </div>
    </div>
  );
};

// Helper di formattazione tempo per il simulatore (minuti UTC -> HH:MM)
const formatMinutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleAccepted, setScheduleAccepted] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<ScheduledFlight | null>(null);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'total'>('month');
  const processedArrivedFlights = useRef<Set<string>>(new Set());
  const [scheduleTab, setScheduleTab] = useState<'mine' | 'crew'>('mine');
  const [scheduleType, setScheduleType] = useState<'short' | 'medium' | 'long'>('medium');

  const [fleetBriefing, setFleetBriefing] = useState('');
  const [fleetBriefingLoading, setFleetBriefingLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [opsPlan, setOpsPlan] = useState<VelarPlan | null>(null);
  const [npcRoster, setNpcRoster] = useState<NpcPilot[]>([]);
  const [fleetState, setFleetState] = useState<any[]>([]);
  const [networkFlights, setNetworkFlights] = useState<NetworkFlight[]>([]);
  const [userLiveFlight, setUserLiveFlight] = useState<(NetworkFlight & { isUserFlight?: boolean; telemetry?: any }) | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());
  
  // Mappa
  const [selectedFlightForMap, setSelectedFlightForMap] = useState<any | null>(null);
  const [isMapZoomed, setIsMapZoomed] = useState(false);
  const [rosterHubFilter, setRosterHubFilter] = useState<string>('ALL');
  const [rosterRankFilter, setRosterRankFilter] = useState<string>('ALL');
  const [mapMode, setMapMode] = useState<'network' | 'flight'>('network');
  const [isStandbyActive, setIsStandbyActive] = useState(false);
  const [standbyAlerts, setStandbyAlerts] = useState<any[]>([]);
  const [discordTesting, setDiscordTesting] = useState(false);

  // ── EFB State ──────────────────────────────────────────────────────────────
  const [efbData, setEfbData] = useState<any>(null);
  const [efbLoading, setEfbLoading] = useState(false);
  const [efbError, setEfbError] = useState<string | null>(null);
  const [efbRouteCopied, setEfbRouteCopied] = useState(false);
  const [efbSection, setEfbSection] = useState<'dispatch' | 'weights' | 'wind' | 'route' | 'map' | 'vspeeds' | 'checklist'>('dispatch');
  const SIMBRIEF_USERNAME = 'mrandruz';

  // EFB — V-speeds calculator state
  const [vspeedsInput, setVspeedsInput] = useState({ oat: '15', elevation: '0', wind: '0', flaps: '1+F' });
  const [vspeedsResult, setVspeedsResult] = useState<any>(null);
  const [vspeedsLoading, setVspeedsLoading] = useState(false);

  // EFB — Checklist state
  const [checklistPhase, setChecklistPhase] = useState<'preflight' | 'before_takeoff' | 'approach' | 'landing'>('preflight');
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});

  // EFB — Mappa ref
  const efbMapRef = useRef<HTMLDivElement>(null);
  const efbMapInstance = useRef<L.Map | null>(null);

  // Stato riga espansa per le quattro list views
  const [expandedScheduleId, setExpandedScheduleId] = useState<number | null>(null);
  const [expandedFleetId, setExpandedFleetId] = useState<string | null>(null);
  const [expandedNetworkId, setExpandedNetworkId] = useState<string | null>(null);
  const [expandedRosterId, setExpandedRosterId] = useState<string | null>(null);
  
  // Refs per prevenire double-counting e sincronizzare Cloud
    const networkFlightsRef = useRef<NetworkFlight[]>([]);

  // ─── Financial Accounting Engine ──────────────────────────────────────────
  const financialStatements = useMemo(() => {
    if (!flights.length || !opsPlan) return null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = todayStart.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400000);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const thisYear = now.getFullYear();

    const parseDate = (d: any) => {
        if (!d) return new Date();
        if (d.toDate) return d.toDate(); // Firestore Timestamp
        return new Date(d);
    };

    const statsTemplate = () => ({
      flights: 0,
      pax: 0,
      revenue: 0,
      fuelCosts: 0,
      crewCosts: 0,
      landingFees: 0,
      fixedCosts: 0,
      netProfit: 0,
    });

    const periods = {
      today: statsTemplate(),
      week: statsTemplate(),
      month: statsTemplate(),
      year: statsTemplate(),
      total: statsTemplate(),
    };

    const hubStatsTemplate = () => ({
      today: statsTemplate(),
      week: statsTemplate(),
      month: statsTemplate(),
      year: statsTemplate(),
      total: statsTemplate(),
    });

    const hubStats: Record<string, any> = {};
    opsPlan.hubs.forEach((h: any) => {
      hubStats[h.icao.toUpperCase().trim()] = hubStatsTemplate();
    });

    const fleetCondition: Record<string, { hours: number; condition: number; status: string; lastMaint: number }> = {};
    fleetState.forEach(ac => {
      // Inizializziamo con le ore totali persistenti da Firestore/Cloud
      const totalHours = ac.totalFlightHours || 0;
      const lastMaint = ac.lastMaintenanceHour || 0;
      const cycleHours = totalHours - lastMaint;
      
      // Calcolo condizione: scende a 0% al raggiungimento della soglia di manutenzione (5000h)
      const condition = Math.max(0, Math.round(100 - (cycleHours / MAINTENANCE_CYCLE_HOURS * 100)));
      
      fleetCondition[ac.id] = { 
        hours: totalHours, 
        condition: condition, 
        status: ac.status || 'Idle',
        lastMaint: lastMaint
      };
    });

    const dailyHistory: Record<string, any> = {};
    // Inizializza gli ultimi 30 giorni per il grafico
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const s = d.toISOString().split('T')[0];
        dailyHistory[s] = { date: s, profit: 0, revenue: 0, flights: 0 };
    }

    const updatePeriod = (p: any, rev: number, profit: number, pax: number, fuel: number, crew: number, fees: number) => {
        p.flights++;
        p.pax += pax;
        p.revenue += rev;
        p.fuelCosts += fuel;
        p.crewCosts += crew;
        p.landingFees += fees;
        p.netProfit += profit;
    };

    let oldestDateMs = now.getTime();

    flights.forEach(f => {
      const fDate = parseDate(f.date);
      const fDateStr = fDate.toISOString().split('T')[0];
      const isToday = fDateStr === todayStr;
      const isThisWeek = fDate >= sevenDaysAgo;
      const isThisMonth = fDate >= thirtyDaysAgo;
      const isThisYear = fDate.getFullYear() === thisYear;
      
      if (fDate.getTime() < oldestDateMs) oldestDateMs = fDate.getTime();

      const specs = AIRCRAFT_FINANCIALS[f.aircraft] || AIRCRAFT_FINANCIALS['Airbus A320'];
      const pax = Math.round(specs.capacity * 0.82);
      const rev = (f.miles * FINANCIAL_CONFIG.REVENUE_PER_NM_PAX * pax) + (pax * FINANCIAL_CONFIG.ANCILLARY_REVENUE_PER_PAX);
      
      const fuelCost = f.flightTime * specs.fuelBurnHr * FINANCIAL_CONFIG.FUEL_PRICE_PER_KG;
      const crewCost = f.flightTime * FINANCIAL_CONFIG.CREW_COST_PER_HOUR;
      const fees = FINANCIAL_CONFIG.LANDING_FEE_FIXED;
      
      const opCosts = fuelCost + crewCost + fees;
      const profit = rev - opCosts;

      const fDep = f.departure?.toUpperCase().trim();
      const fArr = f.arrival?.toUpperCase().trim();
      
      updatePeriod(periods.total, rev, profit, pax, fuelCost, crewCost, fees);
      if (isToday) updatePeriod(periods.today, rev, profit, pax, fuelCost, crewCost, fees);
      if (isThisWeek) updatePeriod(periods.week, rev, profit, pax, fuelCost, crewCost, fees);
      if (isThisMonth) updatePeriod(periods.month, rev, profit, pax, fuelCost, crewCost, fees);
      if (isThisYear) updatePeriod(periods.year, rev, profit, pax, fuelCost, crewCost, fees);

      // Smart Attribution: Priorità Hub di origine, poi Hub di destinazione
      const targetHubIcao = hubStats[fDep] ? fDep : (hubStats[fArr] ? fArr : null);

      if (targetHubIcao && hubStats[targetHubIcao]) {
        const hs = hubStats[targetHubIcao];
        updatePeriod(hs.total, rev, profit, pax, fuelCost, crewCost, fees);
        if (isToday) updatePeriod(hs.today, rev, profit, pax, fuelCost, crewCost, fees);
        if (isThisWeek) updatePeriod(hs.week, rev, profit, pax, fuelCost, crewCost, fees);
        if (isThisMonth) updatePeriod(hs.month, rev, profit, pax, fuelCost, crewCost, fees);
        if (isThisYear) updatePeriod(hs.year, rev, profit, pax, fuelCost, crewCost, fees);
      }

      if (dailyHistory[fDateStr]) {
        dailyHistory[fDateStr].profit += profit;
        dailyHistory[fDateStr].revenue += rev;
        dailyHistory[fDateStr].flights++;
      }
    });

    // ─── AGGIUNTA VOLI LIVE (NETWORK) ───────────────────────────────────────
    networkFlights.forEach(f => {
      const isArrived = ['Arrived', 'Turnaround', 'Taxi In'].includes(f.status);
      const isLive = ['En Route', 'Approach', 'Taxi Out', 'Pushback', 'Boarding'].includes(f.status);

      if ((isArrived && !processedArrivedFlights.current.has(f.id)) || isLive) {
        const specs = AIRCRAFT_FINANCIALS[f.aircraft] || AIRCRAFT_FINANCIALS['Airbus A320'];
        const pax = Math.round(specs.capacity * 0.82);

        const durationMins = f.arrivalTime - f.departureTime;
        const fHours = durationMins / 60;
        // FIX: velocità per tipo aeromobile invece di 450 fissi
        const speed = CRUISE_SPEED_KT[f.aircraft] || 450;
        const miles = Math.round(fHours * speed);

        const rev = (miles * FINANCIAL_CONFIG.REVENUE_PER_NM_PAX * pax) + (pax * FINANCIAL_CONFIG.ANCILLARY_REVENUE_PER_PAX);
        // FIX: formula carburante con prezzo per kg
        const fuelCost = fHours * specs.fuelBurnHr * FINANCIAL_CONFIG.FUEL_PRICE_PER_KG;
        const crewCost = fHours * FINANCIAL_CONFIG.CREW_COST_PER_HOUR;
        const fees = FINANCIAL_CONFIG.LANDING_FEE_FIXED;
        const profit = rev - (fuelCost + crewCost + fees);

        // FIX: un solo blocco updatePeriod — rimosso il secondo blocco duplicato
        updatePeriod(periods.total, rev, profit, pax, fuelCost, crewCost, fees);
        updatePeriod(periods.today, rev, profit, pax, fuelCost, crewCost, fees);
        updatePeriod(periods.week, rev, profit, pax, fuelCost, crewCost, fees);
        updatePeriod(periods.month, rev, profit, pax, fuelCost, crewCost, fees);
        updatePeriod(periods.year, rev, profit, pax, fuelCost, crewCost, fees);

        const fDep = f.departure?.toUpperCase().trim();
        const fArr = f.arrival?.toUpperCase().trim();
        const acObj = fleetState.find(a => a.id === f.tailNumber);
        const acBase = acObj?.base?.toUpperCase().trim();

        // Attribuzione Live: 1. Base dell'aereo, 2. Hub di origine, 3. Hub di destinazione
        const liveHubIcao = (acBase && hubStats[acBase]) ? acBase : (hubStats[fDep] ? fDep : (hubStats[fArr] ? fArr : null));

        if (liveHubIcao && hubStats[liveHubIcao]) {
          const hs = hubStats[liveHubIcao];
          updatePeriod(hs.total, rev, profit, pax, fuelCost, crewCost, fees);
          updatePeriod(hs.today, rev, profit, pax, fuelCost, crewCost, fees);
          updatePeriod(hs.week, rev, profit, pax, fuelCost, crewCost, fees);
          updatePeriod(hs.month, rev, profit, pax, fuelCost, crewCost, fees);
          updatePeriod(hs.year, rev, profit, pax, fuelCost, crewCost, fees);
        }

        if (dailyHistory[todayStr]) {
          dailyHistory[todayStr].profit += profit;
          dailyHistory[todayStr].revenue += rev;
          dailyHistory[todayStr].flights++;
        }

        // FIX: marca il volo come processato dentro il useMemo per evitare ri-accumulo
        if (isArrived) {
          processedArrivedFlights.current.add(f.id);
        }
      }
    });

    // Calcolo dei COSTI FISSI (Maintenance & Leasing)
    const daysOfOps = Math.max(1, Math.ceil((now.getTime() - oldestDateMs) / 86400000));
    
    const fleetFixedDaily = opsPlan.fleet.reduce((acc, item) => {
        const specs = AIRCRAFT_FINANCIALS[item.type] || AIRCRAFT_FINANCIALS['Airbus A320'];
        return acc + (specs.maintenanceDay * item.count);
    }, 0);

    periods.total.fixedCosts = fleetFixedDaily * daysOfOps;
    periods.today.fixedCosts = fleetFixedDaily;
    periods.week.fixedCosts = fleetFixedDaily * 7;
    periods.month.fixedCosts = fleetFixedDaily * 30;
    periods.year.fixedCosts = fleetFixedDaily * 365; // FIX: era mancante

    // Calcolo costi manutenzione straordinaria basato sugli aerei che sono AOG o lo diventano
    fleetState.forEach(ac => {
        const stats = fleetCondition[ac.id];
        const hb = (ac.base || 'LIRF').toUpperCase().trim();
        const specs = AIRCRAFT_FINANCIALS[ac.type] || AIRCRAFT_FINANCIALS['Airbus A320'];
        const dailyFc = specs.maintenanceDay;

        // Distribuiamo i COSTI FISSI ORDINARI per Hub
        if (hubStats[hb]) {
           const hs = hubStats[hb];
           hs.today.fixedCosts += dailyFc;
           hs.week.fixedCosts += dailyFc * 7;
           hs.month.fixedCosts += dailyFc * 30;
           hs.year.fixedCosts += dailyFc * 365; // FIX 11: era mancante — hub year period mostrava profitto gonfiato
           hs.total.fixedCosts += dailyFc * daysOfOps;
        }
        
        if (stats.status === 'AOG' || stats.condition < 5) {
            stats.status = 'AOG';
            const extra = 12500; // Ammortamento C-Check
            periods.today.fixedCosts += extra;
            periods.total.fixedCosts += extra;
            
            // Addebita la manutenzione straordinaria all'Hub dell'aereo
            if (hubStats[hb]) {
               hubStats[hb].today.fixedCosts += extra;
               hubStats[hb].total.fixedCosts += extra;
            }
        }
    });

    // Sottrai i costi fissi dal profitto netto per HUB e PERIODI
    Object.values(periods).forEach(p => {
        p.netProfit -= p.fixedCosts;
    });

    Object.values(hubStats).forEach((hs: any) => {
        Object.values(hs).forEach((p: any) => {
            p.netProfit -= p.fixedCosts;
        });
    });

    // Applica i costi fissi anche alla storia giornaliera
    Object.keys(dailyHistory).forEach(date => {
        dailyHistory[date].profit -= fleetFixedDaily;
        dailyHistory[date].margin = dailyHistory[date].revenue > 0 
            ? Math.round((dailyHistory[date].profit / dailyHistory[date].revenue) * 100) 
            : 0;
    });

    return { 
      periods, 
      chartData: Object.values(dailyHistory), 
      hubStats, 
      fleetCondition,
      fleetFixedDaily
    };
  }, [flights, opsPlan, networkFlights, fleetState]);

  // Caricamento iniziale Processed Flights da Cloud/Local
  useEffect(() => {
    if (!userId) return;
    const loadProcessed = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users', userId, 'operations'), limit(1)));
        if (!snap.empty) {
          const cloudData = snap.docs[0].data().processed_ids || [];
          processedArrivedFlights.current = new Set(cloudData);
          console.log('[ARIA Ops] Registro Cloud sincronizzato:', cloudData.length);
        } else {
          // Fallback Migration from LocalStorage
          const local = JSON.parse(localStorage.getItem('velar_processed_flights') || '[]');
          if (local.length > 0) {
            processedArrivedFlights.current = new Set(local);
            await setDoc(doc(db, 'users', userId, 'operations', 'processed_flights'), {
              processed_ids: local,
              last_sync: Date.now()
            });
            console.log('[ARIA Ops] Migrazione Cloud completata.');
          }
        }
      } catch (err) {
        console.warn('[ARIA Ops] Sincronizzazione Cloud fallita, uso local fallback.');
        const local = JSON.parse(localStorage.getItem('velar_processed_flights') || '[]');
        processedArrivedFlights.current = new Set(local);
      }
    };
    loadProcessed();
  }, [userId]);

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
    }).then(() => toast.success('Daily Report inviato su #daily-reports ✅'));
  }, [networkFlights, fleetState]);

  // ── Merge voli NPC + volo live utente ────────────────────────────────────
  const allNetworkFlights = useMemo(() => {
    if (!userLiveFlight) return networkFlights;
    // Rimuovi eventuali versioni precedenti del volo utente e inserisci in cima
    const withoutUser = networkFlights.filter(f => f.id !== 'user-live');
    return [userLiveFlight as NetworkFlight, ...withoutUser];
  }, [networkFlights, userLiveFlight]);

  // ── Base attuale del pilota (dall'ultimo arrivo nel logbook) ───────────────
  const currentBase = profile?.latestFlight?.arrival?.toUpperCase() ?? 'LIRF';
  const currentBaseCity = opsPlan?.hubs.find((h: VelarHub) => h.icao === currentBase)?.city
    ?? profile?.latestFlight?.arrival ?? currentBase;
  const currentHubRole = opsPlan?.hubs.find((h: VelarHub) => h.icao === currentBase)?.role ?? null;

  // ── Generazione Roster Combinato (User + NPCs) con Live Sync ──────────────
  const fullRoster = useMemo(() => {
    if (!profile || !opsPlan) return [];
    
    // 1. Data di riferimento: 01 Gennaio 2026
    const startDate = new Date('2026-01-01T00:00:00Z').getTime();
    const now = Date.now();
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    
    // Calcolo minuti UTC correnti dall'inizio della giornata
    const d = new Date();
    const currentMinsUtc = d.getUTCHours() * 60 + d.getUTCMinutes();

    // 1. Dati Utente (Andrea Lana) - REALI da Firestore
    // pilotName potrebbe contenere solo il first name (es. "Andrea" da Firebase displayName).
    // Se ha una sola parola, aggiungiamo il cognome Lana.
    const fullDisplayName = (() => {
      if (!pilotName || !pilotName.trim()) return 'Andrea Lana';
      const trimmed = pilotName.trim();
      return trimmed.includes(' ') ? trimmed : `${trimmed} Lana`;
    })();

    const userPilot = {
      id: "VLR-A01",
      name: fullDisplayName,
      rank: profile.currentRank.name,
      base: currentBase,
      totalFlights: profile.totalFlights,
      totalHours: profile.totalHours,
      isUser: true
    };

    // 2. Dati NPCs (con simulazione FH dinamica e sincrona)
    // FIX 1: costruiamo la mappa legId→pilota una sola volta con usedPilotIds,
    // speculare a calculateNetworkState, per evitare ore duplicate da hash collision.
    const legPilotMap = new Map<string, string>(); // legId → pilotId
    {
      const usedPilotIdsForRoster = new Set<string>();
      opsPlan.hubs.forEach((hub: any) => {
        hub.routes?.forEach((route: any) => {
          route.legs?.forEach((leg: any, idx: number) => {
            const depTime = parseTime(leg.dep_utc);
            const legId = `${leg.flight}-${idx}`;
            const p = assignPilot(legId, route.aircraft, depTime, npcRoster, hub.icao, usedPilotIdsForRoster);
            if (p.id !== 'N/A') {
              usedPilotIdsForRoster.add(p.id);
              legPilotMap.set(legId, p.id);
            }
          });
        });
      });
    }

    const npcList = npcRoster.map(npc => {
      // A. ORE STORICHE (Dall'inizio al giorno precedente)
      let avgDailyHours = 0;
      if (npc.rank.includes('Chief')) avgDailyHours = 4.5;
      else if (npc.rank.includes('Senior')) avgDailyHours = 3.5;
      else if (npc.rank.includes('Captain')) avgDailyHours = 3.0;
      else if (npc.rank.includes('First Officer')) avgDailyHours = 2.5;
      else avgDailyHours = 1.5;

      const historicalHours = daysSinceStart * avgDailyHours;
      const seed = (npc.id.split('-')[1] || "0").split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const randomVariante = (seed % 200); // Variante fissa per pilota per differenziare l'anzianità

      // B. ORE ODIERNE (Sincronizzate con il network live oggi, usando la mappa precalcolata)
      let todayHours = 0;
      opsPlan.hubs.forEach((hub: any) => {
        hub.routes?.forEach((route: any) => {
          route.legs?.forEach((leg: any, idx: number) => {
            const depTime = parseTime(leg.dep_utc);
            const blockMins = parseBlock(leg.block);
            const arrTime = depTime + blockMins;
            const legId = `${leg.flight}-${idx}`;

            // FIX 1: usa la mappa precalcolata invece di richiamare assignPilot per ogni NPC×leg
            if (legPilotMap.get(legId) === npc.id) {
              if (currentMinsUtc >= arrTime) {
                todayHours += (blockMins / 60);
              } else if (currentMinsUtc >= depTime) {
                todayHours += ((currentMinsUtc - depTime) / 60);
              }
            }
          });
        });
      });

      const totalHours = historicalHours + randomVariante + todayHours;

      return {
        ...npc,
        totalFlights: Math.floor(totalHours / 1.5),
        totalHours: totalHours,
        isUser: false
      };
    });

    const combined = [userPilot, ...npcList];

    // 3. Filtraggio
    let filtered = combined;
    if (rosterHubFilter !== 'ALL') {
      filtered = filtered.filter(p => p.base === rosterHubFilter);
    }
    if (rosterRankFilter !== 'ALL') {
      filtered = filtered.filter(p => p.rank === rosterRankFilter);
    }

    // 4. Ordinamento DESC per ore
    return filtered.sort((a, b) => b.totalHours - a.totalHours);
  }, [profile, npcRoster, pilotName, currentBase, rosterHubFilter, rosterRankFilter, opsPlan]);

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
          const cloudFleet = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          const totalCloudHours = cloudFleet.reduce((acc: number, val: any) => acc + (val.totalFlightHours || 0), 0);

          if (snap.empty || totalCloudHours < 1) {
            console.log('[ARIA Ops] Inizializzazione Cloud con dati realistici in corso...');
            for (const ac of localFleet) {
               await setDoc(doc(db, 'fleet', ac.id), ac, { merge: true });
            }
            console.log('[ARIA Ops] Cloud popolato con successo.');
          } else {
            // MIGRATION: ripristina gli aerei erroneamente in AOG per la vecchia soglia 500h.
            // Un aereo è davvero AOG solo se (totalFlightHours - lastMaintenanceHour) >= MAINTENANCE_CYCLE_HOURS.
            const fixedAircraft: string[] = [];
            for (const ac of cloudFleet) {
              const cycleHours = (ac.totalFlightHours || 0) - (ac.lastMaintenanceHour || 0);
              const isReallyAog = cycleHours >= MAINTENANCE_CYCLE_HOURS;
              const isMarkedAog = ac.status === 'AOG' || ac.isAOG;
              if (isMarkedAog && !isReallyAog) {
                // Aereo marcato AOG con vecchia soglia — ripristina
                await updateDoc(doc(db, 'fleet', ac.id), {
                  status: 'Idle',
                  isAOG: false,
                  aogUntilTimeMs: 0,
                });
                fixedAircraft.push(ac.id);
              }
            }
            if (fixedAircraft.length > 0) {
              console.log('[ARIA Migration] Ripristinati', fixedAircraft.length, 'aerei da AOG (soglia aggiornata a', MAINTENANCE_CYCLE_HOURS, 'h):', fixedAircraft.join(', '));
            }
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
                   
                   // Sync Firestore
                   setDoc(doc(db, 'users', userId, 'operations', 'processed_flights'), {
                      processed_ids: Array.from(processedArrivedFlights.current),
                      last_sync: Date.now()
                   }, { merge: true }).catch(e => console.error('[ARIA Sync] Failed:', e));

                   // Calcolo profitto per il report Discord (Format richiesto dal Comandante)
                   const specs = AIRCRAFT_FINANCIALS[flight.aircraft] || AIRCRAFT_FINANCIALS['Airbus A320'];
                   const pax = Math.round(specs.capacity * 0.82);
                   const blockHours = (flight.arrivalTime - flight.departureTime) / 60;
                   // FIX 4: velocità per tipo aeromobile invece di 450kt fisso
                   const discordSpeed = CRUISE_SPEED_KT[flight.aircraft] || 450;
                   const miles = Math.round(blockHours * discordSpeed);
                   const rev = (miles * FINANCIAL_CONFIG.REVENUE_PER_NM_PAX * pax) + (pax * FINANCIAL_CONFIG.ANCILLARY_REVENUE_PER_PAX);
                   const costs = (blockHours * specs.fuelBurnHr * FINANCIAL_CONFIG.FUEL_PRICE_PER_KG) + (blockHours * FINANCIAL_CONFIG.CREW_COST_PER_HOUR) + FINANCIAL_CONFIG.LANDING_FEE_FIXED;
                   const profit = Math.round(rev - costs);

                   sendDiscord('ops', {
                      embeds: [{
                        title: `✈️ Volo ${flight.flightNumber} Atterrato`,
                        description: `Il volo **${flight.departure}** ➔ **${flight.arrival}** è atterrato regolarmente.`,
                        color: 0x22c55e,
                        fields: [
                          { name: 'Aeromobile', value: `${flight.aircraft} (${flight.tailNumber})`, inline: true },
                          { name: 'Passeggeri', value: `${pax} (82%)`, inline: true },
                          { name: 'Profitto Netto', value: `+$${profit.toLocaleString()}`, inline: true }
                        ],
                        footer: { text: "ARIA Ops Center · Report Real-time" },
                        timestamp: new Date().toISOString()
                      }]
                   });

                   localStorage.setItem('velar_processed_flights', JSON.stringify(Array.from(processedArrivedFlights.current)));
                   
                   const ac = fleetState.find(a => a.id === flight.tailNumber);
                   
                   if (ac) {
                      const newTotalHours = (ac.totalFlightHours || 0) + blockHours;
                      const prevMaint = ac.lastMaintenanceHour || 0;
                      let newStatus = 'Idle';
                      let isAOG = false;
                      let aogTime = 0;
                      let wentAOG = false;

                      if (newTotalHours - prevMaint >= MAINTENANCE_CYCLE_HOURS) {
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
                            aogUntilTimeMs: aogTime,
                            lastMaintenanceHour: isAOG ? newTotalHours : ac.lastMaintenanceHour || 0
                         });

                         if (wentAOG) {
                           sendDiscord('ops', {
                              content: `🚨 **MAINTENANCE ALERT (CHECK-A)**\nL'aeromobile **${ac.id}** (${ac.type}) ha superato la soglia di manutenzione (${MAINTENANCE_CYCLE_HOURS}h). Sospeso per 24h.\n\n⚠️ **URGENZA OPS**: Volo ${flight.flightNumber} completato. Rotazione successiva scoperta.`
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

  // ── Listener volo live utente (Volanta Bridge → Firestore) ──────────────
  useEffect(() => {
    if (!userId) return;
    const liveRef = doc(db, 'users', userId, 'live_flight', 'active');
    const unsub = onSnapshot(liveRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as NetworkFlight & { isUserFlight?: boolean; telemetry?: any };
        // Valida che i dati abbiano i campi minimi necessari
        if (data.departure && data.arrival && data.flightNumber) {
          setUserLiveFlight({ ...data, isUserFlight: true });
          console.log('[ARIA Live] Volo Volanta ricevuto:', data.flightNumber, data.status);
        }
      } else {
        // Documento rimosso = volo terminato
        setUserLiveFlight(null);
        console.log('[ARIA Live] Volo Volanta terminato.');
      }
    }, (err) => {
      console.warn('[ARIA Live] Errore listener live_flight:', err);
    });
    return () => unsub();
  }, [userId]);

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
      // FIX 2: non azzerare processedArrivedFlights.current — causerebbe re-billing
      // di tutti i voli NPC già arrivati al prossimo render del useMemo finanziario.
      // Puliamo solo il localStorage; il Set in memoria resta intatto per la sessione corrente.
      localStorage.setItem('velar_processed_flights', '[]');
      localStorage.setItem('velar_last_cleanup', now.toString());
      // processedArrivedFlights.current = new Set(); // ← RIMOSSO intenzionalmente
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
      
      if (!res.ok) throw new Error('API Error');
      
      const data = await res.json();
      const text = data.content?.[0]?.text || 'Nessuna risposta ricevuta.';
      setMessages(prev => [...prev, { role: 'aria', content: text, timestamp: new Date() }]);
    } catch (err) {
      console.error('[ARIA Chat] Error:', err);
      // Fallback: Risposta basata sui dati reali se l'IA fallisce
      const activeCount = networkFlights.length;
      const fallbackMsg = `Comandante, i miei sistemi di comunicazione IA sono temporaneamente offline. \n\nPosso però confermarti che il network è operativo con **${activeCount} voli attivi**. La tua base attuale è **${currentBase}**.`;
      setMessages(prev => [...prev, { role: 'aria', content: fallbackMsg, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, profile, isTyping, messages, buildSystemPrompt]);

  // ── Carica schedule salvata da Firestore ────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const loadSavedSchedule = async () => {
      try {
        // Legge il documento esatto 'active' — path speculare a acceptSchedule
        const snap = await getDoc(doc(db, 'users', userId, 'schedule', 'active'));
        if (snap.exists()) {
          const saved = snap.data();
          if (saved.flights && Array.isArray(saved.flights) && saved.flights.length > 0) {
            setSchedule(saved.flights);
            setScheduleAccepted(true);
            if (saved.scheduleType) setScheduleType(saved.scheduleType as any);
            console.log('[ARIA Schedule] Schedule caricata da Cloud:', saved.flights.length, 'legs');
          }
        }
      } catch (err) {
        console.warn('[ARIA Schedule] Caricamento schedule fallito:', err);
      }
    };
    loadSavedSchedule();
  }, [userId]);
  const generateSchedule = useCallback(async () => {
    if (!profile) return;
    setScheduleLoading(true);
    setSchedule([]);
    setScheduleAccepted(false);
    setExpandedScheduleId(null);

    const pilotBase = profile.latestFlight?.arrival?.toUpperCase() || 'LIRF';
    const pilotBaseHub = opsPlan?.hubs.find(h => h.icao === pilotBase);
    const isLongHaulQualified = ['Captain', 'Senior Captain', 'Chief Captain'].includes(profile.currentRank.name);

    const scheduleConstraints = {
      short: {
        label: 'Short Haul',
        instruction: 'MODALITÀ SHORT HAUL (≤ 1.500 nm): usa SOLO A319/A320. '
          + 'Genera 2-4 legs al giorno con turnaround realistico: un pilota di linea short-haul '
          + 'fa andata+ritorno o più rotazioni nella stessa giornata. '
          + 'Esempio giorno: LIRF→LIML (mattina) + LIML→LIRF (tarda mattina) + LIRF→EGLL (pomeriggio). '
          + 'Usa gli orari reali del piano operativo. Totale legs settimana: 10-18. '
          + 'NO intercontinentali, NO transatlantiche.',
      },
      medium: {
        label: 'Medium Haul',
        instruction: 'MODALITÀ MEDIUM HAUL (1.000–4.000 nm): usa A321LR o A330neo. '
          + 'Genera 1-2 legs al giorno. Su rotte ≤2.500nm puoi fare andata+ritorno nello stesso giorno. '
          + 'Su rotte più lunghe (es. LIRF→OMDB) il ritorno è il giorno dopo. '
          + 'Totale legs settimana: 7-12. NO ultra-long (>10h block).',
      },
      long: {
        label: 'Long Haul',
        instruction: 'MODALITÀ LONG HAUL (≥ 3.000 nm): usa SOLO A330neo o A350-900. '
          + "1 leg al giorno. Il giorno successivo al lungo raggio parte dall'aeroporto di arrivo (layover realistico). "
          + 'Totale legs settimana: 5-7. NO rotte domestiche.',
      },
    };

    const constraint = scheduleConstraints[scheduleType];

    const shortHaulExample = `[
  {"day":"Lunedì","flightNumber":"VLR311","departure":"LIRF","arrival":"LIML","departureCity":"Roma","arrivalCity":"Milano Linate","aircraft":"Airbus A320","estimatedDuration":"1h 15m","distance":"298 nm","departureTime":"07:00","arrivalTime":"08:15","reason":"Apertura settimana, rotazione domestica mattutina."},
  {"day":"Lunedì","flightNumber":"VLR312","departure":"LIML","arrival":"LIRF","departureCity":"Milano Linate","arrivalCity":"Roma","aircraft":"Airbus A320","estimatedDuration":"1h 15m","distance":"298 nm","departureTime":"09:30","arrivalTime":"10:45","reason":"Ritorno hub LIRF dopo turnaround 75 min."},
  {"day":"Lunedì","flightNumber":"VLR411","departure":"LIRF","arrival":"EGLL","departureCity":"Roma","arrivalCity":"Londra Heathrow","aircraft":"Airbus A320","estimatedDuration":"2h 45m","distance":"895 nm","departureTime":"12:00","arrivalTime":"14:45","reason":"Secondo blocco giornaliero, rotta premium pomeridiana."},
  {"day":"Martedì","flightNumber":"VLR412","departure":"EGLL","arrival":"LIRF","departureCity":"Londra Heathrow","arrivalCity":"Roma","aircraft":"Airbus A320","estimatedDuration":"2h 45m","distance":"895 nm","departureTime":"08:00","arrivalTime":"11:45","reason":"Ritorno da Londra dopo layover. Rientro hub principale."}
]`;

    const mediumHaulExample = `[
  {"day":"Lunedì","flightNumber":"VLR211","departure":"LIRF","arrival":"OMDB","departureCity":"Roma","arrivalCity":"Dubai","aircraft":"Airbus A321LR","estimatedDuration":"5h 30m","distance":"2847 nm","departureTime":"10:00","arrivalTime":"20:30","reason":"Apertura settimana verso Middle East hub. Rotta premium."},
  {"day":"Martedì","flightNumber":"VLR212","departure":"OMDB","arrival":"LIRF","departureCity":"Dubai","arrivalCity":"Roma","aircraft":"Airbus A321LR","estimatedDuration":"6h 30m","distance":"2847 nm","departureTime":"08:00","arrivalTime":"12:30","reason":"Ritorno da Dubai dopo layover overnight. Rientro LIRF."}
]`;

    const longHaulExample = `[
  {"day":"Lunedì","flightNumber":"VLR101","departure":"LIRF","arrival":"KBOS","departureCity":"Roma","arrivalCity":"Boston","aircraft":"Airbus A350-900","estimatedDuration":"9h 30m","distance":"4232 nm","departureTime":"10:30","arrivalTime":"14:00","reason":"Apertura settimana transatlantica. The First Port."},
  {"day":"Martedì","flightNumber":"VLR102","departure":"KBOS","arrival":"LIRF","departureCity":"Boston","arrivalCity":"Roma","aircraft":"Airbus A350-900","estimatedDuration":"8h 15m","distance":"4232 nm","departureTime":"18:00","arrivalTime":"08:15","reason":"Ritorno da Boston dopo layover. Rientro LIRF."}
]`;

    const exampleForType = scheduleType === 'short' ? shortHaulExample : scheduleType === 'medium' ? mediumHaulExample : longHaulExample;

    const prompt = `
Sei ARIA, il sistema di pianificazione voli di Velar Virtual Airline.
Devi generare una schedule settimanale REALISTICA con turnaround, non un solo volo al giorno.

PIANO OPERATIVO v${opsPlan?._meta?.version || '5.2'} — rotte disponibili:
${opsPlan ? opsPlan.hubs.map((h: VelarHub) =>
  h.icao + ' ' + h.city + ':\n' +
  h.routes.map((r: VelarRoute) => '  ' + r.flight + ' ' + h.icao + '→' + r.dest + ' (' + r.aircraft + ') ' + r.freq).join('\n')
).join('\n') : 'Piano non disponibile'}

PILOTA: ${pilotName || 'Comandante'} | Rank: ${profile.currentRank.name} | Ore: ${profile.totalHours.toFixed(0)}h
BASE PARTENZA LUNEDÌ: ${pilotBase} — il primo leg DEVE decollare da qui

MODALITÀ: ${constraint.label.toUpperCase()}
${constraint.instruction}

═══ REGOLE FONDAMENTALI (NON NEGOZIABILI) ═══
R1. TURNAROUND OBBLIGATORIO: dopo ogni leg verso una destinazione, DEVI inserire il volo di ritorno
    (o un leg verso un altro hub raggiungibile) nello stesso giorno o il giorno successivo.
    NON puoi avere giorni con un solo volo in partenza senza ritorno, salvo layover esplicito.
R2. CATENA GEOGRAFICA: ogni leg parte dall'arrivo del leg precedente.
    Se lunedì arrivi a LIML, martedì o lo stesso giorno devi ripartire da LIML.
R3. TEMPI TURNAROUND MINIMI: 60 min narrowbody (A319/A320/A321LR), 90 min widebody (A330neo/A350).
R4. USA SOLO rotte presenti nel piano operativo sopra.
R5. Usa SOLO aeromobili compatibili con il rank: ${opsPlan?.aria_ops?.rank_progression?.find((r: RankDef) => r.name === profile.currentRank.name)?.aircraft?.join(', ') || 'A320'}

═══ FORMATO OUTPUT ═══
Rispondi ESCLUSIVAMENTE con un array JSON valido (nessun testo, nessun markdown).
Ogni elemento rappresenta UN singolo leg con questi campi:
"day" (giorno della settimana in italiano), "flightNumber", "departure", "arrival",
"departureCity", "arrivalCity", "aircraft", "estimatedDuration", "distance",
"departureTime" (HH:MM UTC), "arrivalTime" (HH:MM UTC), "reason"

═══ ESEMPIO OUTPUT CORRETTO per ${constraint.label} ═══
${exampleForType}

Genera ora la schedule COMPLETA da Lunedì a Domenica rispettando tutte le regole.
`.trim();


    try {
      const res = await fetch('/api/aria-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || '[]';
      const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const clean = jsonMatch ? jsonMatch[0] : raw.replace(/```json|```/g, '').trim();
      const parsed: ScheduledFlight[] = JSON.parse(clean);
      // Aggiungi legIndex per ogni giorno (0-based)
      const dayCounts: Record<string, number> = {};
      const withIndex = parsed.map((f: ScheduledFlight) => {
        dayCounts[f.day] = (dayCounts[f.day] ?? -1) + 1;
        return { ...f, legIndex: dayCounts[f.day] };
      });
      setSchedule(withIndex);
    } catch (e) {
      console.error('Schedule generation error:', e);
      toast.error('Errore nella generazione schedule. Riprova.');
    } finally {
      setScheduleLoading(false);
    }
  }, [profile, pilotName, opsPlan, scheduleType]);

  // ── Accetta e salva schedule su Firestore ────────────────────────────────
  const acceptSchedule = useCallback(async () => {
    if (!schedule.length || !userId) return;
    setScheduleSaving(true);
    try {
      await setDoc(doc(db, 'users', userId, 'schedule', 'active'), {
        flights: schedule,
        scheduleType,
        savedAt: Date.now(),
        pilotBase: profile?.latestFlight?.arrival?.toUpperCase() || 'LIRF',
        totalLegs: schedule.length,
      });
      setScheduleAccepted(true);
      toast.success(`Schedule accettata — ${schedule.length} legs salvati`);
    } catch (err) {
      console.error('[ARIA Schedule] Salvataggio fallito:', err);
      toast.error('Errore nel salvataggio. Riprova.');
    } finally {
      setScheduleSaving(false);
    }
  }, [schedule, userId, scheduleType, profile]);

  // ── Test Discord ────────────────────────────────────────────────────────
  const testDiscord = async () => {
    if (discordTesting) return;
    setDiscordTesting(true);
    const id = toast.loading('Invio test a Discord...');
    
    try {
      const res = await sendOperationalAlert(
        "Connessione Stabilita",
        `Sistemi Operativi Velar Airlines: Collegamento Discord stabilito per il Comandante **${pilotName || 'Pilota'}**. Pronto a monitorare la flotta.`,
        [{ name: "Stato", value: "🟢 Operativo", inline: true }, { name: "Hub", value: currentBase, inline: true }]
      );
      
      if (res.error) throw new Error(res.error);
      
      toast.success('Test inviato a Discord! ✅', { id });
    } catch (err: any) {
      console.error('[ARIA Discord] Test Error:', err);
      // Mostriamo l'errore completo per il debug
      const msg = err.error || err.message || 'Unknown Discord Error';
      const details = err.details ? ` (${err.details})` : '';
      toast.error(`Errore: ${msg}${details}`, { id });
    } finally {
      setDiscordTesting(false);
    }
  };



  // ── Genera Overview con dati reali (no AI hallucination) ───────────────────
  const generateOverview = useCallback(() => {
    if (!profile || !opsPlan) return;

    const aogCount = fleetState.filter(ac => ac.status === 'AOG' || ac.isAOG).length;
    const operationalCount = fleetState.length - aogCount;
    const activeVols = allNetworkFlights.filter(f =>
      !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)
    ).length;
    const totalFlights = allNetworkFlights.length;
    // FIX 11: on-time calcolato solo su voli con status operativo (non Scheduled/AOG)
    const operatedFlights = allNetworkFlights.filter(f =>
      !['Scheduled', 'AOG/Cancel'].includes(f.status)
    );
    const onTimeFlights = operatedFlights.filter(f => f.status !== 'AOG/Cancel').length;
    const onTimePercentage = operatedFlights.length > 0
      ? Math.round((onTimeFlights / operatedFlights.length) * 100)
      : 100;
    const totalFH = fleetState.reduce((acc: number, ac: any) => acc + (ac.totalFlightHours || 0), 0);

    const avgCapacity = opsPlan.fleet.length > 0
      ? opsPlan.fleet.reduce((acc: number, f: VelarFleetItem) => acc + f.capacity * f.count, 0) /
        opsPlan.fleet.reduce((acc: number, f: VelarFleetItem) => acc + f.count, 0)
      : 180;

    const hubs = opsPlan.hubs.map((hub: VelarHub) => {
      const activeAtHub = allNetworkFlights.filter(
        f => (f.departure === hub.icao || f.arrival === hub.icao) && 
             !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)
      ).length;
      
      // Calcoliamo i passeggeri solo sui voli in PARTENZA per il totale finanziario del singolo hub,
      // ma usiamo il totale globale per la dashboard.
      const paxAtHub = allNetworkFlights.filter(
        f => (f.departure === hub.icao || f.arrival === hub.icao) && 
             !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)
      ).length * avgCapacity * 0.82;

      return {
        icao: hub.icao,
        role: hub.role,
        city: hub.city,
        status: aogCount > 2 ? 'Reduced' : 'Operational',
        activeFlights: activeAtHub,
        routeCount: hub.routes.length,
        paxToday: Math.round(paxAtHub),
        alertMessage: aogCount > 2 ? `${aogCount} AOG — rotazioni ridotte` : null,
      };
    });

    const totalPaxToday = Math.round(activeVols * avgCapacity * 0.82);
    const briefingStatus = aogCount === 0
      ? 'Tutti i sistemi operativi. Flotta al 100%.'
      : `${aogCount} aeromobile${aogCount > 1 ? 'i' : ''} in manutenzione AOG. Rotazioni sostitutive attive.`;

    setOverviewData({
      briefing: `Comandante ${pilotName || ''}, situazione operativa aggiornata. ${briefingStatus}`,
      operationalStatus: {
        fleetOperational: operationalCount,
        fleetTotal: fleetState.length,
        flightsToday: totalFlights,
        activeNow: activeVols,
        onTimePercentage,
        totalFlightHours: Math.floor(totalFH),
      },
      hubs,
      passengerSummary: { totalPaxToday, avgLoadFactor: 82 },
    });
  }, [profile, pilotName, opsPlan, fleetState, allNetworkFlights]);


  useEffect(() => {
    if (view === 'overview' && profile && opsPlan) {
      generateOverview();
    }
  }, [view, profile, opsPlan, allNetworkFlights, fleetState, generateOverview]);

  // ── Genera briefing flotta ────────────────────────────────────────────────
  const generateFleetBriefing = useCallback(async () => {
    if (!profile || fleetBriefingLoading || fleetBriefing) return;
    setFleetBriefingLoading(true);

    const systemPrompt = buildSystemPrompt(profile);
    // FIX 6: descrizione flotta costruita dinamicamente dal piano operativo
    const fleetTotal = opsPlan?.fleet.reduce((s: number, f: VelarFleetItem) => s + f.count, 0) || 25;
    const fleetDesc = opsPlan?.fleet.map((f: VelarFleetItem) =>
      `${f.count}x${f.type.replace('Airbus ', '')}`
    ).join(', ') || '5xA319, 10xA320, 5xA321LR, 3xA330neo, 4xA350-900';

    const prompt = `Genera un messaggio di stato operativo della flotta Velar per il Comandante ${pilotName || 'Comandante'}.
Flotta: ${fleetTotal} aeromobili (${fleetDesc}).
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
  // FIX 7: il briefing viene invalidato se il numero di AOG cambia durante la sessione
  const aogCountForBriefing = fleetState.filter(ac => ac.status === 'AOG' || ac.isAOG).length;
  const prevAogCountRef = useRef<number>(aogCountForBriefing);
  useEffect(() => {
    if (prevAogCountRef.current !== aogCountForBriefing) {
      setFleetBriefing(''); // invalida briefing — si rigenererà al prossimo render del tab fleet
      prevAogCountRef.current = aogCountForBriefing;
    }
  }, [aogCountForBriefing]);

  useEffect(() => {
    if (view === 'fleet' && profile && !fleetBriefing && !fleetBriefingLoading) {
      generateFleetBriefing();
    }
  }, [view, profile, fleetBriefing, fleetBriefingLoading, generateFleetBriefing]);

  // ── EFB: carica dati SimBrief ─────────────────────────────────────────────
  // Parsing speculare a simbriefService.js per garantire compatibilità con l'API
  const loadEfbData = useCallback(async () => {
    setEfbLoading(true);
    setEfbError(null);
    try {
      const res = await fetch(`/api/simbrief?username=${SIMBRIEF_USERNAME}`);
      if (!res.ok) throw new Error('SimBrief non raggiungibile');
      const raw = await res.json();
      if (raw.fetch?.status === 'error') throw new Error(raw.fetch.message || 'Piano non trovato');

      // ── Helpers (speculari a simbriefService.js) ──────────────────────────
      const safeFloat = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

      // IMPORTANT: SimBrief usa pos_long (con la g) come campo primario per longitudine
      const getLat = (o: any) => safeFloat(o?.pos_lat ?? o?.latitude ?? o?.lat_deg ?? o?.lat ?? 0);
      const getLon = (o: any) => safeFloat(o?.pos_long ?? o?.pos_lon ?? o?.longitude ?? o?.lon_deg ?? o?.lon ?? o?.lng ?? o?.long ?? 0);

      // Duration: supporta HH:MM:SS, HH:MM, secondi, ore decimali
      const fmtDur = (v: any) => {
        if (!v) return 'N/D';
        const s = String(v).trim();
        const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
        if (hms) return `${parseInt(hms[1])}h ${parseInt(hms[2])}m`;
        const hm = s.match(/^(\d+):(\d{2})$/);
        if (hm) return `${parseInt(hm[1])}h ${parseInt(hm[2])}m`;
        const sec = parseInt(v);
        if (!isNaN(sec) && sec > 60) return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;
        return 'N/D';
      };

      const fmtZulu = (v: any) => {
        if (!v) return '--:--z';
        if (!isNaN(Number(v)) && String(v).length >= 10) {
          const d = new Date(Number(v) * 1000);
          return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}z`;
        }
        const d = new Date(v);
        if (!isNaN(d.getTime())) return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}z`;
        const str = String(v).replace(':','');
        if (str.length === 4 && !isNaN(Number(str))) return `${str.slice(0,2)}:${str.slice(2,4)}z`;
        return '--:--z';
      };

      // ── Airline name (stesso dizionario di simbriefService.js) ────────────
      const AIRLINE_NAMES: Record<string, string> = {
        'VLR': 'Velar Airlines', 'DLH': 'Lufthansa', 'KLM': 'KLM',
        'AZA': 'ITA Airways', 'BAW': 'British Airways', 'AFR': 'Air France',
        'UAL': 'United Airlines', 'AAL': 'American Airlines', 'DAL': 'Delta Air Lines',
        'RYR': 'Ryanair', 'EZY': 'EasyJet', 'UAE': 'Emirates', 'QTR': 'Qatar Airways',
        'SWR': 'Swiss International Air Lines', 'THY': 'Turkish Airlines',
        'IBE': 'Iberia', 'TAP': 'TAP Air Portugal', 'FIN': 'Finnair',
        'ACA': 'Air Canada', 'ANA': 'All Nippon Airways', 'JAL': 'Japan Airlines',
        'QFA': 'Qantas', 'WZZ': 'Wizz Air', 'EIN': 'Aer Lingus',
      };
      const callsign = raw.atc?.callsign || 'N/A';
      const callsignPrefix = callsign !== 'N/A' ? callsign.replace(/\d.*$/, '').toUpperCase() : '';
      const airlineIcaoFromGeneral = (raw.general?.icao_airline || '').toUpperCase();
      // Il prefisso callsign è più affidabile di icao_airline (vedi simbriefService.js)
      const airlineIcao = (callsignPrefix && callsignPrefix !== airlineIcaoFromGeneral)
        ? callsignPrefix : airlineIcaoFromGeneral;
      const airline = AIRLINE_NAMES[airlineIcao] || airlineIcao || 'Velar Airlines';

      // ── Durata ────────────────────────────────────────────────────────────
      const rawDur = raw.times?.est_time_enroute || raw.times?.enroute_time
        || raw.times?.ete || raw.params?.time_enroute
        || raw.general?.est_time_enroute || null;

      // ── Waypoints (tutti e tre i fallback di simbriefService.js) ─────────
      let waypointsRaw: any[] = [];
      if (Array.isArray(raw.navlog)) waypointsRaw = raw.navlog;
      else if (raw.navlog?.fix) waypointsRaw = Array.isArray(raw.navlog.fix) ? raw.navlog.fix : [raw.navlog.fix];
      else if (raw.navlog?.waypoint) waypointsRaw = Array.isArray(raw.navlog.waypoint) ? raw.navlog.waypoint : [raw.navlog.waypoint];

      const waypoints = waypointsRaw
        .map((f: any) => ({
          id:   f.ident || f.name || '?',
          lat:  getLat(f),
          lon:  getLon(f),
          alt:  f.altitude_feet || f.altitude || '',
          wind: (f.wind_dir && f.wind_spd) ? `${f.wind_dir}°/${f.wind_spd}kt` : '',
        }))
        .filter((w: any) => w.lat !== 0 || w.lon !== 0);

      // ── OFP URL ──────────────────────────────────────────────────────────
      const ofpUrl = (() => {
        const dir = raw.files?.directory || 'https://www.simbrief.com/ofp/flightplans/';
        const base = dir.endsWith('/') ? dir : dir + '/';
        const pdf  = raw.files?.pdf?.link || raw.files?.html?.link || null;
        return pdf ? (pdf.startsWith('http') ? pdf : base + pdf) : null;
      })();

      setEfbData({
        origin:      { icao: raw.origin?.icao_code || '---', name: raw.origin?.name || '', lat: getLat(raw.origin), lon: getLon(raw.origin) },
        destination: { icao: raw.destination?.icao_code || '---', name: raw.destination?.name || '', lat: getLat(raw.destination), lon: getLon(raw.destination) },
        callsign,
        airline,
        aircraft:  raw.aircraft?.icaocode || 'N/A',
        route:     raw.general?.route || 'N/A',
        cruiseFl:  Math.round(safeFloat(raw.general?.initial_altitude) / 100),
        distance:  safeFloat(raw.general?.air_distance),
        duration:  fmtDur(rawDur),
        passengers: raw.general?.passengers || '0',
        costIndex:  raw.general?.costindex || '0',
        sid:    raw.general?.sid || '--',
        star:   raw.general?.star || '--',
        depRwy: raw.origin?.plan_rwy || '--',
        arrRwy: raw.destination?.plan_rwy || '--',
        depTime: fmtZulu(raw.times?.est_off || raw.times?.sched_off || raw.params?.time_off),
        arrTime: fmtZulu(raw.times?.est_on  || raw.times?.sched_on  || raw.params?.time_on),
        // Fuel breakdown (speculare a simbriefService.js)
        fuelBlock:       safeFloat(raw.fuel?.plan_ramp),
        fuelTrip:        safeFloat(raw.fuel?.plan_trip),
        fuelAlternate:   safeFloat(raw.fuel?.alternate),
        fuelReserve:     safeFloat(raw.fuel?.reserve),
        fuelContingency: safeFloat(raw.fuel?.contingency),
        fuelExtra:       safeFloat(raw.fuel?.extra),
        // Weights
        zfw: safeFloat(raw.weights?.est_zfw), maxZfw: safeFloat(raw.weights?.max_zfw),
        tow: safeFloat(raw.weights?.est_tow), maxTow: safeFloat(raw.weights?.max_tow),
        ldw: safeFloat(raw.weights?.est_ldw), maxLdw: safeFloat(raw.weights?.max_ldw),
        // Wind & step climbs
        avgWindDir:  raw.general?.avg_wind_dir  || null,
        avgWindSpd:  raw.general?.avg_wind_spd  || null,
        avgWindComp: raw.general?.avg_wind_comp || null,
        stepclimb:   raw.general?.stepclimb_string || null,
        waypoints,
        ofpUrl,
      });
    } catch (err: any) {
      setEfbError(err.message || 'Errore connessione SimBrief');
    } finally {
      setEfbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'efb' && !efbData && !efbLoading) loadEfbData();
  }, [view, efbData, efbLoading, loadEfbData]);

  // EFB Mappa — inizializza/aggiorna quando si entra nella sezione map
  useEffect(() => {
    if (efbSection !== 'map' || !efbData || !efbMapRef.current) return;

    // Cleanup precedente
    if (efbMapInstance.current) {
      efbMapInstance.current.remove();
      efbMapInstance.current = null;
    }

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const map = L.map(efbMapRef.current, { attributionControl: false, zoomControl: false })
      .setView([30, 10], 2);
    efbMapInstance.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(tileUrl).addTo(map);

    const bounds = L.latLngBounds([]);
    const d = efbData;

    // Waypoint dots
    const wps = d.waypoints.filter((w: any) => w.lat !== 0 || w.lon !== 0);
    if (wps.length >= 2) {
      const latLons: [number, number][] = wps.map((w: any) => [w.lat, w.lon]);
      L.polyline(latLons, { color: 'var(--color-primary)', weight: 2.5, opacity: 0.8, dashArray: '6 8' }).addTo(map);
      wps.forEach((w: any, i: number) => {
        if (i === 0 || i === wps.length - 1) return; // skip origin/dest, drawn separately
        L.circleMarker([w.lat, w.lon], { radius: 3, color: 'var(--color-primary)', fillOpacity: 0.6, weight: 1 })
          .bindTooltip(w.id, { permanent: false, direction: 'top', className: 'aria-map-tooltip' })
          .addTo(map);
        bounds.extend([w.lat, w.lon]);
      });
    }

    // Origin marker
    if (d.origin.lat !== 0 || d.origin.lon !== 0) {
      L.circleMarker([d.origin.lat, d.origin.lon], { radius: 7, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 })
        .bindTooltip(`${d.origin.icao} (DEP)`, { permanent: true, direction: 'top', className: 'aria-map-tooltip' })
        .addTo(map);
      bounds.extend([d.origin.lat, d.origin.lon]);
    }

    // Destination marker
    if (d.destination.lat !== 0 || d.destination.lon !== 0) {
      L.circleMarker([d.destination.lat, d.destination.lon], { radius: 7, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 })
        .bindTooltip(`${d.destination.icao} (ARR)`, { permanent: true, direction: 'top', className: 'aria-map-tooltip' })
        .addTo(map);
      bounds.extend([d.destination.lat, d.destination.lon]);
    }

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });

    return () => {
      if (efbMapInstance.current) { efbMapInstance.current.remove(); efbMapInstance.current = null; }
    };
  }, [efbSection, efbData, isDarkMode]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p className={styles.loadingText}>ARIA sta analizzando il logbook...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'var(--font-family-sans)', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}} />

      {/* ── SIDEBAR INTERNA (FISSA) ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoContainer}>
            <div className={styles.ariaIcon}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h2 className={styles.sidebarTitle}>ARIA</h2>
          </div>
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 600, letterSpacing: '0.05em' }}>
            OPERATIONAL DASHBOARD
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {(['chat', 'overview', 'schedule', 'fleet', 'network', 'roster', 'financials', 'efb'] as ViewState[]).map(v => (
            <button 
              key={v} 
              onClick={() => setView(v)}
              className={`${styles.sidebarBtn} ${view === v ? styles.sidebarBtnActive : ''}`}
            >
              {v === 'chat' && <MessageSquare className={styles.sidebarBtnIcon} />}
              {v === 'overview' && <LayoutDashboard className={styles.sidebarBtnIcon} />}
              {v === 'schedule' && <Calendar className={styles.sidebarBtnIcon} />}
              {v === 'fleet' && <Plane className={styles.sidebarBtnIcon} />}
              {v === 'network' && <Activity className={styles.sidebarBtnIcon} />}
              {v === 'roster' && <Users className={styles.sidebarBtnIcon} />}
              {v === 'financials' && <DollarSign className={styles.sidebarBtnIcon} />}
              {v === 'efb' && <Tablet className={styles.sidebarBtnIcon} />}
              <span style={{ textTransform: 'capitalize' }}>{v === 'efb' ? 'EFB' : v}</span>
              {view === v && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </button>
          ))}
        </nav>

        {profile && (
          <div className={styles.pilotInfo}>
            <div className={styles.pilotAvatar}>
              {pilotName ? pilotName.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className={styles.pilotText}>
              <span className={styles.pilotName}>
                {(() => {
                  if (!pilotName || !pilotName.trim()) return 'Andrea Lana';
                  const t = pilotName.trim();
                  return t.includes(' ') ? t : `${t} Lana`;
                })()}
              </span>
              <span className={styles.pilotRank}>{profile.currentRank.name}</span>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
               <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>{profile.totalXp.toLocaleString()}</span>
               <div style={{ fontSize: '9px', color: 'var(--color-text-hint)', fontWeight: 600 }}>XP</div>
            </div>
          </div>
        )}
        
        <div style={{ padding: '0 16px 16px' }}>
             <button 
                onClick={testDiscord} 
                className={styles.sidebarBtn} 
                disabled={discordTesting}
                style={{ 
                  border: '1px solid var(--color-border)', 
                  fontSize: '11px', 
                  padding: '8px 12px', 
                  marginTop: '12px',
                  opacity: discordTesting ? 0.6 : 1,
                  cursor: discordTesting ? 'not-allowed' : 'pointer'
                }}
             >
                {discordTesting ? <RefreshCw size={14} className={styles.spin} /> : <Activity size={14} />}
                {discordTesting ? 'Invio in corso...' : 'Discord Test'}
             </button>
        </div>
      </aside>

      {/* ── AREA PRINCIPALE ── */}
      <main className={styles.mainArea}>
        
        {/* MAPPA IN ALTO */}
        <div className={styles.mapWrapper}>
          <ARIAMap 
            flights={allNetworkFlights} 
            selectedFlight={selectedFlightForMap} 
            isDarkMode={isDarkMode} 
            onCloseFlight={() => { setSelectedFlightForMap(null); setMapMode('network'); }}
            hubIcaos={opsPlan?.hubs.map((h: VelarHub) => h.icao) ?? ['LIRF', 'KBOS', 'WIII']}
          />
          <div className={styles.mapOverlay}>
            <div className={styles.mapBadge}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', animation: 'pulse 2s infinite' }} />
                LIVE NETWORK: {allNetworkFlights.length} VOLI
            </div>
            <div className={styles.mapBadge}>
                <Clock size={12} />
                {new Date().getUTCHours().toString().padStart(2, '0')}:{new Date().getUTCMinutes().toString().padStart(2, '0')} ZULU
            </div>
          </div>
        </div>

        {/* CONTENUTO SCROLLABILE */}
        <div className={styles.contentScroller}>

          {/* 💬 CHAT VIEW */}
          {view === 'chat' && (
            <div className={styles.chatContent}>
               <div className={styles.messageList}>
                {messages.map((msg, i) => (
                  <div key={i} className={`${styles.msgRow} ${msg.role === 'pilot' ? styles.msgRowPilot : ''}`}>
                    {msg.role === 'aria' && <div className={styles.ariaAvatar}>A</div>}
                    <div className={`${styles.bubble} ${msg.role === 'pilot' ? styles.bubblePilot : styles.bubbleAria}`}>
                      {msg.content.split('\n').map((line, j) => {
                        const parts = line.split(/\*\*(.*?)\*\*/g);
                        return (
                          <p key={j} className={styles.msgLine}>
                            {parts.map((p, k) => k % 2 === 1 ? <strong key={k}>{p}</strong> : p)}
                          </p>
                        );
                      })}
                      <span className={styles.msgTime}>
                        {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className={styles.msgRow}>
                    <div className={styles.ariaAvatar}>A</div>
                    <div className={`${styles.bubble} ${styles.bubbleAria}`}>
                       <RefreshCw size={16} className={styles.spin} style={{ color: 'var(--color-text-hint)' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className={styles.chatFooter}>
                <div className={styles.quickActions}>
                  {[
                    'Analisi rotte XP',
                    'Stato flotta attiva',
                    'Prossimo rank',
                  ].map(q => (
                    <button key={q} className={styles.quickBtn} onClick={() => setInput(q)}>{q}</button>
                  ))}
                </div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Invia un comando tattico ad ARIA..."
                  />
                  <button className={styles.sendBtn} onClick={sendMessage} disabled={isTyping || !input.trim()}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* 📊 OVERVIEW VIEW */}
          {view === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className={styles.kpiGrid}>
                 <div className={styles.kpiCard}>
                    <span className={styles.sectionTitle}>Total XP</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>{profile?.totalXp.toLocaleString()}</span>
                 </div>
                 <div className={styles.kpiCard}>
                    <span className={styles.sectionTitle}>Block Hours</span>
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{profile?.totalHours.toFixed(1)}h</span>
                 </div>
                 <div className={styles.kpiCard}>
                    <span className={styles.sectionTitle}>Total Flights</span>
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{profile?.totalFlights}</span>
                 </div>
                 <div className={styles.kpiCard}>
                    <span className={styles.sectionTitle}>Network Traffic</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{allNetworkFlights.length}</span>
                 </div>
              </div>

              <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Hub Performance</h3>
                  <button onClick={generateOverview} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px' }}>
                    <RefreshCw size={14} style={{ marginRight: '6px' }} /> Update AI analysis
                  </button>
                </div>
                
                {overviewData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                      {overviewData.briefing}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                      {overviewData.hubs?.map((hub: any) => (
                        <div key={hub.icao} style={{ padding: '12px 16px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, fontSize: '14px' }}>{hub.icao}</span>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: hub.status === 'Operational' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: hub.status === 'Operational' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                              {hub.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginBottom: '4px' }}>{hub.role}</div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{hub.activeFlights} voli attivi</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-hint)' }}>{hub.paxToday?.toLocaleString()} pax stimati</div>
                          {hub.alertMessage && <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600 }}>⚠ {hub.alertMessage}</div>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                      {[
                        { label: 'Flotta', value: `${overviewData.operationalStatus?.fleetOperational}/${overviewData.operationalStatus?.fleetTotal} operativi` },
                        { label: 'On-time', value: `${overviewData.operationalStatus?.onTimePercentage}%`, color: 'var(--color-success)' },
                        { label: 'Attivi ora', value: `${overviewData.operationalStatus?.activeNow} voli` },
                        { label: 'Pax oggi', value: overviewData.passengerSummary?.totalPaxToday?.toLocaleString() },
                        { label: 'FH Flotta', value: `${overviewData.operationalStatus?.totalFlightHours?.toLocaleString()}h` },
                      ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</span>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: stat.color ?? 'var(--color-text-primary)' }}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-hint)' }}>
                    Nessun dato disponibile. Assicurati che il piano operativo sia caricato.
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
                  className={`${styles.sidebarBtn} ${scheduleTab === 'mine' ? styles.sidebarBtnActive : ''}`}
                  style={{ width: 'auto' }}
                  onClick={() => setScheduleTab('mine')}
                >
                  <Calendar size={16} /> I miei voli
                </button>
                <button
                  className={`${styles.sidebarBtn} ${scheduleTab === 'crew' ? styles.sidebarBtnActive : ''}`}
                  style={{ width: 'auto' }}
                  onClick={() => setScheduleTab('crew')}
                >
                  <Users size={16} /> Crew Board
                </button>
              </div>

              {scheduleTab === 'mine' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

                  {/* Selettore tipo schedule + controlli */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-hint)' }}>
                        Tipologia schedule
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {([
                          { key: 'short',  label: 'Short Haul',  sub: '≤ 1.500 nm',  icon: '✦' },
                          { key: 'medium', label: 'Medium Haul', sub: '1.000–4.000 nm', icon: '✦✦' },
                          { key: 'long',   label: 'Long Haul',   sub: '≥ 3.000 nm',  icon: '✦✦✦' },
                        ] as const).map(({ key, label, sub, icon }) => {
                          const active = scheduleType === key;
                          return (
                            <button
                              key={key}
                              onClick={() => {
                                setScheduleType(key);
                                // Svuota la schedule solo se non è ancora stata accettata/salvata.
                                // Se è salvata, cambiare tipo serve solo a indicare la modalità
                                // per la prossima rigenerazione — non cancella quella attiva.
                                if (!scheduleAccepted) {
                                  setSchedule([]);
                                  setExpandedScheduleId(null);
                                }
                              }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '2px',
                                padding: '8px 14px',
                                border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                borderRadius: '8px',
                                background: active ? 'rgba(var(--color-primary-rgb), 0.07)' : 'var(--color-surface)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              <span style={{ fontSize: '11px', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                                {label}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-hint)' }}>{sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      {/* Accetta Schedule */}
                      {schedule.length > 0 && !scheduleAccepted && (
                        <button
                          onClick={acceptSchedule}
                          disabled={scheduleSaving}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            whiteSpace: 'nowrap', height: '38px', padding: '0 18px',
                            fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px',
                            background: 'var(--color-success)', color: 'white',
                            cursor: scheduleSaving ? 'not-allowed' : 'pointer',
                            opacity: scheduleSaving ? 0.7 : 1,
                          }}
                        >
                          {scheduleSaving
                            ? <><RefreshCw size={13} className={styles.spin} /> Salvataggio...</>
                            : <><Check size={13} /> Accetta Schedule</>}
                        </button>
                      )}
                      {scheduleAccepted && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 12px', height: '38px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.3)' }}>
                          <Check size={13} /> Salvata
                        </div>
                      )}
                      {/* Genera / Rigenera */}
                      <button
                        onClick={generateSchedule}
                        disabled={scheduleLoading}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '7px',
                          whiteSpace: 'nowrap', height: '38px', padding: '0 18px',
                          fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px',
                          background: scheduleLoading ? 'var(--color-border)' : 'var(--color-primary)',
                          color: 'white',
                          cursor: scheduleLoading ? 'not-allowed' : 'pointer',
                          opacity: scheduleLoading ? 0.7 : 1,
                          transition: 'opacity 0.15s, background 0.15s',
                        }}
                      >
                        <RefreshCw size={13} className={scheduleLoading ? styles.spin : undefined} />
                        {scheduleLoading ? 'Generazione...' : schedule.length > 0 ? 'Rigenera' : 'Genera schedule'}
                      </button>
                    </div>
                  </div>

                  {/* Header colonne */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 1fr 180px 90px 100px 28px',
                    gap: '0 12px',
                    padding: '6px 16px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-hint)',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <span>#</span>
                    <span>Rotta</span>
                    <span>Aeromobile</span>
                    <span>Distanza</span>
                    <span>Durata</span>
                    <span />
                  </div>

                  {schedule.length > 0 ? (() => {
                    // Raggruppa legs per giorno mantenendo l'ordine
                    const orderedDays = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
                    const byDay: Record<string, ScheduledFlight[]> = {};
                    schedule.forEach(f => {
                      if (!byDay[f.day]) byDay[f.day] = [];
                      byDay[f.day].push(f);
                    });
                    const days = orderedDays.filter(d => byDay[d]);

                    return days.map(day => {
                      const legs = byDay[day];
                      const dayTotalMins = legs.reduce((acc, f) => {
                        const match = f.estimatedDuration.match(/(\d+)h\s*(\d+)m/);
                        return acc + (match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0);
                      }, 0);
                      const dayTotalStr = dayTotalMins > 0
                        ? `${Math.floor(dayTotalMins/60)}h ${dayTotalMins%60}m`
                        : '';

                      return (
                        <div key={day}>
                          {/* Day header */}
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 16px',
                            background: 'var(--color-background)',
                            borderBottom: '1px solid var(--color-border)',
                            borderTop: '1px solid var(--color-border)',
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {day}
                            </span>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-hint)' }}>
                                {legs.length} {legs.length === 1 ? 'leg' : 'legs'}
                              </span>
                              {dayTotalStr && (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)' }}>
                                  {dayTotalStr} totali
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Legs for this day */}
                          {legs.map((f, legIdx) => {
                            const globalIdx = schedule.indexOf(f);
                            const isOpen = expandedScheduleId === globalIdx;
                            return (
                              <div key={`${day}-${legIdx}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <div
                                  onClick={() => {
                                    const next = isOpen ? null : globalIdx;
                                    setExpandedScheduleId(next);
                                    if (next !== null) { setSelectedFlight(f); setSelectedFlightForMap(f); setIsMapZoomed(true); }
                                  }}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '20px 1fr 180px 90px 100px 28px',
                                    gap: '0 12px',
                                    padding: '10px 16px',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: isOpen ? 'rgba(var(--color-primary-rgb), 0.04)' : legs.length > 1 ? 'rgba(0,0,0,0.01)' : 'transparent',
                                    transition: 'background 0.15s',
                                  }}
                                >
                                  {/* Leg number indicator (solo se più di 1 leg nel giorno) */}
                                  {legs.length > 1
                                    ? <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-hint)', textAlign: 'center' }}>L{legIdx+1}</span>
                                    : <span />
                                  }
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{f.flightNumber}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      {f.departure}
                                      <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}> {f.departureTime || '--:--'}</span>
                                      {' → '}
                                      {f.arrival}
                                      <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}> {f.arrivalTime || '--:--'}</span>
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.aircraft}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{f.distance}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{f.estimatedDuration}</span>
                                  <ChevronRight size={14} style={{ color: 'var(--color-text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                                </div>

                                {isOpen && (
                                  <div style={{ padding: '12px 16px 16px', background: 'rgba(var(--color-primary-rgb), 0.04)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.5', fontStyle: 'italic' }}>{f.reason}</p>
                                    <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                                      <span>Partenza: <strong style={{ color: 'var(--color-text-primary)' }}>{f.departureCity}</strong></span>
                                      <span>Arrivo: <strong style={{ color: 'var(--color-text-primary)' }}>{f.arrivalCity}</strong></span>
                                    </div>
                                    <a
                                      href={buildSimbriefUrl(f)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '0 16px', height: '32px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', border: 'none' }}
                                    >
                                      <ExternalLink size={13} /> Briefing SimBrief
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })() : (
                    <div style={{ textAlign: 'center', padding: '48px 60px', color: 'var(--color-text-hint)' }}>
                      <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.2 }} />
                      <p style={{ margin: 0, fontSize: '14px' }}>
                        Seleziona una tipologia e premi <strong>Genera schedule</strong> per pianificare la settimana.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {scheduleTab === 'crew' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {/* Header colonne */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 160px 120px 28px',
                    gap: '0 12px',
                    padding: '6px 16px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-hint)',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <span />
                    <span>Pilota</span>
                    <span>Volo / Rotta</span>
                    <span>Stato</span>
                    <span />
                  </div>
                  {Array.from(new Map(allNetworkFlights.filter(f => !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)).map(f => [f.pilot.id, f])).values()).map((nf: any) => {
                    const isOpen = expandedNetworkId === nf.id + '-crew';
                    return (
                      <div key={nf.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <div
                          onClick={() => setExpandedNetworkId(isOpen ? null : nf.id + '-crew')}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '44px 1fr 160px 120px 28px',
                            gap: '0 12px',
                            padding: '9px 16px',
                            alignItems: 'center',
                            cursor: 'pointer',
                            background: isOpen ? 'rgba(var(--color-primary-rgb), 0.04)' : 'transparent',
                          }}
                        >
                          <div className={styles.ariaAvatar} style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                            {(nf.pilot.name || 'CM').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nf.pilot.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)' }}>{nf.pilot.rank} · {nf.pilot.base}</div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)' }}>{nf.flightNumber}</span>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>{nf.departure}→{nf.arrival}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>{nf.status.toUpperCase()}</span>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>
                        {isOpen && (
                          <div style={{ padding: '10px 16px 14px 72px', background: 'rgba(var(--color-primary-rgb), 0.04)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '24px', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                            <span>Aeromobile: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.aircraft}</strong></span>
                            <span>Partenza: <strong style={{ color: 'var(--color-text-primary)' }}>{formatMinutesToTime(nf.departureTime)}</strong></span>
                            <span>Arrivo: <strong style={{ color: 'var(--color-text-primary)' }}>{formatMinutesToTime(nf.arrivalTime)}</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ✈️ FLEET VIEW */}
          {view === 'fleet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className={styles.card}>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <div className={styles.ariaAvatar}>A</div>
                   <div>
                      <span className={styles.sectionTitle}>ARIA Fleet Intelligence</span>
                      <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                        {fleetBriefingLoading ? 'Analisi stato flotta in corso...' : fleetBriefing}
                      </p>
                   </div>
                </div>
              </div>

              {/* Lista flotta espandibile */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Header colonne */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 160px 1fr 120px 130px 28px',
                  gap: '0 12px',
                  padding: '6px 16px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-hint)',
                  background: 'var(--color-background)',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <span>Targa</span>
                  <span>Tipo</span>
                  <span>Manutenzione</span>
                  <span>Ore Totali</span>
                  <span>Stato</span>
                  <span />
                </div>

                {fleetState.map((ac) => {
                  const activeFlight = allNetworkFlights.find(nf => nf.tailNumber === ac.id);
                  const isFlying = activeFlight && !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(activeFlight.status);

                  // GUARD: ricalcola AOG dalla soglia reale, non dal campo status Firestore
                  // che potrebbe essere stantio dalla vecchia soglia 500h
                  const cycleHoursLive = (ac.totalFlightHours || 0) - (ac.lastMaintenanceHour || 0);
                  const isReallyAog = (ac.status === 'AOG' || ac.isAOG) && cycleHoursLive >= MAINTENANCE_CYCLE_HOURS;

                  const liveStatus = isFlying ? activeFlight.status.toUpperCase() : (isReallyAog ? 'AOG' : (ac.status === 'AOG' ? 'Idle' : ac.status));
                  const maintProgress = (ac.totalFlightHours % MAINTENANCE_CYCLE_HOURS) / MAINTENANCE_CYCLE_HOURS;
                  const hoursUntilCheck = MAINTENANCE_CYCLE_HOURS - (ac.totalFlightHours % MAINTENANCE_CYCLE_HOURS);
                  const liveStatusLower = liveStatus?.toString().toLowerCase() || '';
                  const statusColor = liveStatusLower === 'aog' ? 'var(--color-danger)' :
                                     (isFlying || ['en route','approach','taxi out','pushback','boarding'].includes(liveStatusLower)) ? 'var(--color-primary)' : 'var(--color-success)';
                  const progressColor = isReallyAog ? 'var(--color-danger)' :
                                       (hoursUntilCheck < 50) ? 'var(--color-danger)' :
                                       (hoursUntilCheck < 150) ? 'var(--color-warning)' : 'var(--color-primary)';
                  const isOpen = expandedFleetId === ac.id;
                  const isAog = isReallyAog && ac.aogUntilTimeMs > Date.now();

                  return (
                    <div key={ac.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* Riga compatta */}
                      <div
                        onClick={() => setExpandedFleetId(isOpen ? null : ac.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '110px 160px 1fr 120px 130px 28px',
                          gap: '0 12px',
                          padding: '10px 16px',
                          alignItems: 'center',
                          cursor: 'pointer',
                          background: isOpen ? 'rgba(var(--color-primary-rgb), 0.04)' : isAog ? 'rgba(239,68,68,0.03)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* Targa */}
                        <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: isAog ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>{ac.id}</span>
                        {/* Tipo */}
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ac.type}</span>
                        {/* Barra manutenzione inline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ flex: 1, height: '5px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${maintProgress * 100}%`, background: progressColor, transition: 'width 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: hoursUntilCheck < 50 ? 'var(--color-danger)' : 'var(--color-text-hint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {hoursUntilCheck.toFixed(0)}h al check
                          </span>
                        </div>
                        {/* Ore totali */}
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{ac.totalFlightHours.toFixed(1)}h</span>
                        {/* Status badge */}
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, fontWeight: 700, border: `1px solid ${statusColor}44`, whiteSpace: 'nowrap' }}>
                          {liveStatus}
                        </span>
                        <ChevronRight size={14} style={{ color: 'var(--color-text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      </div>

                      {/* Pannello espanso */}
                      {isOpen && (
                        <div style={{ padding: '12px 16px 14px', background: 'rgba(var(--color-primary-rgb), 0.04)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: 'var(--color-text-hint)', flexWrap: 'wrap' }}>
                            <span>Ore totali: <strong style={{ color: 'var(--color-text-primary)' }}>{ac.totalFlightHours.toFixed(1)}h</strong></span>
                            <span>Ultimo check a: <strong style={{ color: 'var(--color-text-primary)' }}>{ac.lastMaintenanceHour?.toFixed(0) || '0'}h</strong></span>
                            <span>Prossimo check tra: <strong style={{ color: progressColor }}>{hoursUntilCheck.toFixed(1)}h</strong></span>
                            {ac.base && <span>Base: <strong style={{ color: 'var(--color-text-primary)' }}>{ac.base}</strong></span>}
                          </div>
                          {isFlying && activeFlight && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(var(--color-primary-rgb), 0.08)' }}>
                              <Plane size={12} style={{ color: 'var(--color-primary)' }} />
                              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{activeFlight.flightNumber}</span>
                              <span style={{ color: 'var(--color-text-secondary)' }}>{activeFlight.departure} → {activeFlight.arrival}</span>
                              {activeFlight.progressPercent > 0 && activeFlight.progressPercent < 100 && (
                                <div style={{ flex: 1, height: '3px', background: 'var(--color-background)', borderRadius: '2px', overflow: 'hidden', minWidth: '60px' }}>
                                  <div style={{ height: '100%', width: `${activeFlight.progressPercent}%`, background: 'var(--color-primary)' }} />
                                </div>
                              )}
                              <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', whiteSpace: 'nowrap' }}>{activeFlight.progressPercent.toFixed(0)}%</span>
                            </div>
                          )}
                          {isAog && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-danger)', fontWeight: 600, padding: '6px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <Clock size={11} />
                              AOG fino a {new Date(ac.aogUntilTimeMs).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
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
                     <button 
                        onClick={() => setIsStandbyActive(!isStandbyActive)} 
                        className={styles.sidebarBtn}
                        style={{ 
                          background: isStandbyActive ? 'rgba(255, 107, 129, 0.1)' : 'transparent', 
                          color: isStandbyActive ? '#ff6b81' : 'var(--color-text-hint)', 
                          border: '1px solid currentColor', 
                          padding: '6px 12px', 
                          height: 'auto', 
                          width: 'auto' 
                        }}
                     >
                        {isStandbyActive ? 'DISATTIVA STANDBY' : 'ATTIVA STANDBY'}
                     </button>
                  </div>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                 {/* Header colonne */}
                 <div style={{
                   display: 'grid',
                   gridTemplateColumns: '90px 200px 1fr 130px 60px 28px',
                   gap: '0 12px',
                   padding: '6px 16px',
                   fontSize: '10px',
                   fontWeight: 700,
                   textTransform: 'uppercase',
                   letterSpacing: '0.06em',
                   color: 'var(--color-text-hint)',
                   background: 'var(--color-background)',
                   borderBottom: '1px solid var(--color-border)',
                 }}>
                   <span>Volo</span>
                   <span>Rotta</span>
                   <span>Pilota / Aereo</span>
                   <span>Stato</span>
                   <span>Prog.</span>
                   <span />
                 </div>

                 {[...allNetworkFlights].sort((a, b) => {
                   const statusPrio: Record<string, number> = {
                     'En Route': 100, 'Approach': 90, 'Taxi Out': 80,
                     'Pushback': 70, 'Boarding': 60, 'Taxi In': 50,
                     'Arrived': 40, 'Turnaround': 30, 'Scheduled': 20, 'AOG/Cancel': 10
                   };
                   const pa = statusPrio[a.status] || 0;
                   const pb = statusPrio[b.status] || 0;
                   if (pa !== pb) return pb - pa;
                   return a.departureTime - b.departureTime;
                 }).map((nf) => {
                   const isOpen = expandedNetworkId === nf.id;
                   const statusActive = nf.status === 'En Route' || nf.status === 'Approach';
                   const isUser = (nf as any).isUserFlight === true;
                   const telemetry = (nf as any).telemetry;
                   return (
                     <div key={nf.id} style={{ borderBottom: '1px solid var(--color-border)', background: isUser ? 'rgba(var(--color-primary-rgb), 0.03)' : 'transparent' }}>
                       {/* Riga compatta */}
                       <div
                         onClick={() => {
                           const next = isOpen ? null : nf.id;
                           setExpandedNetworkId(next);
                           if (next !== null) { setSelectedFlightForMap(nf); setIsMapZoomed(true); }
                         }}
                         style={{
                           display: 'grid',
                           gridTemplateColumns: '90px 200px 1fr 130px 60px 28px',
                           gap: '0 12px',
                           padding: '10px 16px',
                           alignItems: 'center',
                           cursor: 'pointer',
                           transition: 'background 0.15s',
                           background: isOpen ? 'rgba(var(--color-primary-rgb), 0.06)' : 'transparent',
                         }}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                           <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)' }}>{nf.flightNumber}</span>
                           {isUser && <span style={{ fontSize: '9px', padding: '1px 5px', background: 'var(--color-primary)', color: 'white', borderRadius: '3px', fontWeight: 800, flexShrink: 0 }}>YOU</span>}
                         </div>
                         <span style={{ fontSize: '13px', fontWeight: 600 }}>
                           {nf.departure}
                           <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}> {formatMinutesToTime(nf.departureTime)}</span>
                           {' → '}
                           {nf.arrival}
                           <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}> {formatMinutesToTime(nf.arrivalTime)}</span>
                         </span>
                         <div style={{ minWidth: 0 }}>
                           <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                             {isUser ? 'Cmdt. Andrea Lana (Volanta)' : `${nf.pilot.name} · ${nf.aircraft}`}
                             {!isUser && nf.tailNumber && nf.tailNumber !== 'Generic' && <span style={{ color: 'var(--color-text-hint)' }}> ({nf.tailNumber})</span>}
                           </span>
                         </div>
                         <span style={{ fontSize: '11px', fontWeight: 700, color: statusActive || isUser ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{nf.status.toUpperCase()}</span>
                         {nf.progressPercent > 0 && nf.progressPercent < 100 ? (
                           <div style={{ height: '3px', background: 'var(--color-background)', borderRadius: '2px', overflow: 'hidden' }}>
                             <div style={{ height: '100%', width: `${nf.progressPercent}%`, background: isUser ? 'var(--color-success)' : 'var(--color-primary)' }} />
                           </div>
                         ) : (
                           <span style={{ fontSize: '11px', color: 'var(--color-text-hint)' }}>—</span>
                         )}
                         <ChevronRight size={14} style={{ color: 'var(--color-text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                       </div>

                       {/* Pannello espanso */}
                       {isOpen && (
                         <div style={{ padding: '10px 16px 14px', background: 'rgba(var(--color-primary-rgb), 0.04)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                           {isUser && telemetry ? (
                             <>
                               <span>Altitudine: <strong style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>FL{Math.round((telemetry.altitude || 0) / 100)}</strong></span>
                               <span>GS: <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{Math.round(telemetry.groundSpeed || 0)} kt</strong></span>
                               <span>HDG: <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{Math.round(telemetry.heading || 0)}°</strong></span>
                               <span>VS: <strong style={{ color: (telemetry.verticalSpeed || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-family-mono)' }}>{(telemetry.verticalSpeed || 0) >= 0 ? '+' : ''}{Math.round(telemetry.verticalSpeed || 0)} fpm</strong></span>
                               <span>Aeromobile: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.aircraft}</strong></span>
                               <span>Progresso: <strong style={{ color: 'var(--color-primary)' }}>{nf.progressPercent.toFixed(1)}%</strong></span>
                             </>
                           ) : (
                             <>
                               <span>Comandante: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.pilot.name}</strong></span>
                               <span>Rank: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.pilot.rank}</strong></span>
                               <span>Base: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.pilot.base}</strong></span>
                               <span>Aeromobile: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.aircraft}</strong></span>
                               {nf.tailNumber && nf.tailNumber !== 'Generic' && (
                                 <span>Targa: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.tailNumber}</strong></span>
                               )}
                               {nf.progressPercent > 0 && nf.progressPercent < 100 && (
                                 <span>Progresso: <strong style={{ color: 'var(--color-primary)' }}>{nf.progressPercent.toFixed(1)}%</strong></span>
                               )}
                             </>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
                   return (
                     <div key={nf.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                       {/* Riga compatta */}
                       <div
                         onClick={() => {
                           const next = isOpen ? null : nf.id;
                           setExpandedNetworkId(next);
                           if (next !== null) { setSelectedFlightForMap(nf); setIsMapZoomed(true); }
                         }}
                         style={{
                           display: 'grid',
                           gridTemplateColumns: '90px 200px 1fr 130px 60px 28px',
                           gap: '0 12px',
                           padding: '10px 16px',
                           alignItems: 'center',
                           cursor: 'pointer',
                           background: isOpen ? 'rgba(var(--color-primary-rgb), 0.04)' : 'transparent',
                           transition: 'background 0.15s',
                         }}
                       >
                         <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)' }}>{nf.flightNumber}</span>
                         <span style={{ fontSize: '13px', fontWeight: 600 }}>
                           {nf.departure}
                           <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}> {formatMinutesToTime(nf.departureTime)}</span>
                           {' → '}
                           {nf.arrival}
                           <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}> {formatMinutesToTime(nf.arrivalTime)}</span>
                         </span>
                         <div style={{ minWidth: 0 }}>
                           <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                             {nf.pilot.name} · {nf.aircraft}
                             {nf.tailNumber && nf.tailNumber !== 'Generic' && <span style={{ color: 'var(--color-text-hint)' }}> ({nf.tailNumber})</span>}
                           </span>
                         </div>
                         <span style={{ fontSize: '11px', fontWeight: 700, color: statusActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{nf.status.toUpperCase()}</span>
                         {/* Progress inline */}
                         {nf.progressPercent > 0 && nf.progressPercent < 100 ? (
                           <div style={{ height: '3px', background: 'var(--color-background)', borderRadius: '2px', overflow: 'hidden' }}>
                             <div style={{ height: '100%', width: `${nf.progressPercent}%`, background: 'var(--color-primary)' }} />
                           </div>
                         ) : (
                           <span style={{ fontSize: '11px', color: 'var(--color-text-hint)' }}>—</span>
                         )}
                         <ChevronRight size={14} style={{ color: 'var(--color-text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                       </div>

                       {/* Pannello espanso */}
                       {isOpen && (
                         <div style={{ padding: '10px 16px 14px', background: 'rgba(var(--color-primary-rgb), 0.04)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                           <span>Comandante: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.pilot.name}</strong></span>
                           <span>Rank: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.pilot.rank}</strong></span>
                           <span>Base: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.pilot.base}</strong></span>
                           <span>Aeromobile: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.aircraft}</strong></span>
                           {nf.tailNumber && nf.tailNumber !== 'Generic' && (
                             <span>Targa: <strong style={{ color: 'var(--color-text-primary)' }}>{nf.tailNumber}</strong></span>
                           )}
                           {nf.progressPercent > 0 && nf.progressPercent < 100 && (
                             <span>Progresso: <strong style={{ color: 'var(--color-primary)' }}>{nf.progressPercent.toFixed(1)}%</strong></span>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>
          )}

          {/* 👥 ROSTER VIEW */}
          {view === 'roster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Pilot Roster</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                      Classifica piloti Velar per ore di volo effettive.
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Filtra Hub</span>
                      <select 
                        value={rosterHubFilter} 
                        onChange={(e) => setRosterHubFilter(e.target.value)}
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', color: 'var(--color-text-primary)' }}
                      >
                        <option value="ALL">TUTTI GLI HUB</option>
                        {opsPlan?.hubs.map(h => <option key={h.icao} value={h.icao}>{h.icao} - {h.city}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Filtra Rating</span>
                      <select 
                        value={rosterRankFilter} 
                        onChange={(e) => setRosterRankFilter(e.target.value)}
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', color: 'var(--color-text-primary)' }}
                      >
                        <option value="ALL">TUTTI I RATING</option>
                        <option value="Chief Captain">Chief Captain</option>
                        <option value="Senior Captain">Senior Captain</option>
                        <option value="Captain">Captain</option>
                        <option value="First Officer">First Officer</option>
                        <option value="Junior First Officer">Junior First Officer</option>
                      </select>
                    </div>
                  </div>
               </div>

               {/* Lista espandibile */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                 {/* Header colonne */}
                 <div style={{
                   display: 'grid',
                   gridTemplateColumns: '40px 44px 1fr 80px 100px 80px 80px 28px',
                   gap: '0 12px',
                   padding: '6px 16px',
                   fontSize: '10px',
                   fontWeight: 700,
                   textTransform: 'uppercase',
                   letterSpacing: '0.06em',
                   color: 'var(--color-text-hint)',
                   background: 'var(--color-background)',
                   borderBottom: '1px solid var(--color-border)',
                 }}>
                   <span>#</span>
                   <span />
                   <span>Pilota</span>
                   <span>Hub</span>
                   <span>Rating</span>
                   <span style={{ textAlign: 'right' }}>Voli</span>
                   <span style={{ textAlign: 'right' }}>Ore</span>
                   <span />
                 </div>

                 {fullRoster.map((pilot, index) => {
                   const isOpen = expandedRosterId === pilot.id;
                   const initials = pilot.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                   return (
                     <div
                       key={pilot.id}
                       style={{
                         borderBottom: '1px solid var(--color-border)',
                         background: pilot.isUser
                           ? isOpen ? 'rgba(var(--color-primary-rgb), 0.08)' : 'rgba(var(--color-primary-rgb), 0.04)'
                           : isOpen ? 'rgba(var(--color-primary-rgb), 0.02)' : 'transparent',
                       }}
                     >
                       {/* Riga compatta */}
                       <div
                         onClick={() => setExpandedRosterId(isOpen ? null : pilot.id)}
                         style={{
                           display: 'grid',
                           gridTemplateColumns: '40px 44px 1fr 80px 100px 80px 80px 28px',
                           gap: '0 12px',
                           padding: '9px 16px',
                           alignItems: 'center',
                           cursor: 'pointer',
                           transition: 'background 0.15s',
                         }}
                       >
                         {/* Posizione */}
                         <span style={{
                           fontSize: '12px',
                           fontWeight: pilot.isUser ? 800 : 500,
                           color: pilot.isUser ? 'var(--color-primary)' : 'var(--color-text-hint)',
                           fontStyle: pilot.isUser ? 'normal' : 'italic',
                         }}>
                           #{index + 1}
                         </span>

                         {/* Avatar */}
                         <div className={styles.ariaAvatar} style={{
                           width: '28px',
                           height: '28px',
                           fontSize: '11px',
                           background: pilot.isUser ? 'var(--color-primary)' : 'var(--color-background)',
                           color: pilot.isUser ? 'white' : 'var(--color-text-primary)',
                           border: pilot.isUser ? 'none' : '1px solid var(--color-border)',
                           flexShrink: 0,
                         }}>
                           {initials}
                         </div>

                         {/* Nome + badge YOU */}
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                           <span style={{
                             fontSize: '13px',
                             fontWeight: pilot.isUser ? 700 : 500,
                             color: pilot.isUser ? 'var(--color-primary)' : 'var(--color-text-primary)',
                             overflow: 'hidden',
                             textOverflow: 'ellipsis',
                             whiteSpace: 'nowrap',
                           }}>
                             {pilot.name}
                           </span>
                           {pilot.isUser && (
                             <span style={{ fontSize: '9px', padding: '1px 5px', background: 'var(--color-primary)', color: 'white', borderRadius: '3px', fontWeight: 800, flexShrink: 0 }}>YOU</span>
                           )}
                         </div>

                         {/* Hub */}
                         <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)' }}>{pilot.base}</span>

                         {/* Rating */}
                         <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pilot.rank}</span>

                         {/* Voli */}
                         <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'right' }}>{pilot.totalFlights}</span>

                         {/* Ore */}
                         <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', textAlign: 'right' }}>{Math.floor(pilot.totalHours)}h</span>

                         <ChevronRight size={14} style={{ color: 'var(--color-text-hint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                       </div>

                       {/* Pannello espanso */}
                       {isOpen && (
                         <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-text-hint)', alignItems: 'center' }}>
                           <span>ID: <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{pilot.id}</strong></span>
                           <span>Ore totali: <strong style={{ color: 'var(--color-primary)' }}>{pilot.totalHours.toFixed(1)}h</strong></span>
                           <span>Voli completati: <strong style={{ color: 'var(--color-text-primary)' }}>{pilot.totalFlights}</strong></span>
                           <span>Hub: <strong style={{ color: 'var(--color-text-primary)' }}>{pilot.base}</strong></span>
                           {pilot.isUser && (
                             <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>
                               {rosterHubFilter !== 'ALL' || rosterRankFilter !== 'ALL'
                                 ? `Posizione nella selezione: #${index + 1}`
                                 : `Posizione globale: #${index + 1}`}
                             </span>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
           {/* 💰 FINANCIALS VIEW */}
           {view === 'financials' && financialStatements && (
                    <FinancialsView 
                      data={financialStatements} 
                      selectedHub={selectedHub} 
                      onHubSelect={setSelectedHub} 
                      period={period}
                      setPeriod={setPeriod}
                    />
                )}

          {/* 🖥️ EFB VIEW */}
          {view === 'efb' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tablet size={18} style={{ color: 'var(--color-primary)' }} /> Electronic Flight Bag
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                    Ultimo piano SimBrief · {SIMBRIEF_USERNAME}
                  </p>
                </div>
                <button
                  onClick={loadEfbData}
                  disabled={efbLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '34px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', cursor: efbLoading ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)' }}
                >
                  <RefreshCw size={13} className={efbLoading ? styles.spin : undefined} />
                  {efbLoading ? 'Caricamento...' : 'Aggiorna OFP'}
                </button>
              </div>

              {/* Error state */}
              {efbError && !efbData && (
                <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-hint)' }}>
                  <AlertCircle size={32} style={{ marginBottom: '12px', opacity: 0.4, color: 'var(--color-danger)' }} />
                  <p style={{ margin: '0 0 12px', fontSize: '13px' }}>{efbError}</p>
                  <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--color-text-hint)' }}>
                    Assicurati di aver pianificato un volo su SimBrief con l'account <strong>{SIMBRIEF_USERNAME}</strong>
                  </p>
                  <button onClick={loadEfbData} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 20px', height: '36px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                    <RefreshCw size={13} /> Riprova
                  </button>
                </div>
              )}

              {/* Loading skeleton */}
              {efbLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[80, 100, 60, 120].map((w, i) => (
                    <div key={i} style={{ height: '16px', borderRadius: '6px', background: 'var(--color-border)', opacity: 0.4, width: `${w}%` }} />
                  ))}
                </div>
              )}

              {/* Main EFB content */}
              {efbData && !efbLoading && (() => {
                const d = efbData;

                // Section tabs
                const sections = [
                  { key: 'dispatch',  label: 'Dispatch',     icon: FileText },
                  { key: 'weights',   label: 'Pesi & Fuel',  icon: Fuel },
                  { key: 'wind',      label: 'Vento',        icon: Wind },
                  { key: 'map',       label: 'Mappa',        icon: MapIcon },
                  { key: 'vspeeds',   label: 'V-Speeds',     icon: Gauge },
                  { key: 'checklist', label: 'Checklist',    icon: CheckSquare },
                  { key: 'route',     label: 'Rotta ATC',    icon: Route },
                ] as const;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Hero card */}
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
                      {/* Route header */}
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Origine</div>
                            <div style={{ fontSize: '32px', fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>{d.origin.icao}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '2px' }}>{d.origin.name}</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '6px', fontFamily: 'var(--font-family-mono)' }}>{d.depTime}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '2px' }}>RWY {d.depRwy} · {d.sid}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-text-hint)', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500 }}>{d.duration}</span>
                            <div style={{ width: '80px', height: '1px', background: 'var(--color-border)', position: 'relative' }}>
                              <Plane size={12} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--color-surface)', padding: '0 3px', color: 'var(--color-primary)' }} />
                            </div>
                            <span style={{ fontSize: '11px' }}>{d.distance} nm</span>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Destinazione</div>
                            <div style={{ fontSize: '32px', fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>{d.destination.icao}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '2px' }}>{d.destination.name}</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '6px', fontFamily: 'var(--font-family-mono)' }}>{d.arrTime}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '2px' }}>RWY {d.arrRwy} · {d.star}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>{d.callsign}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{d.aircraft} · {d.airline}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '4px' }}>FL{d.cruiseFl} · CI {d.costIndex} · {d.passengers} pax</div>
                        </div>
                      </div>
                    </div>

                    {/* Section tabs */}
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px' }}>
                      {sections.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setEfbSection(key as any)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '7px 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px',
                            background: efbSection === key ? 'var(--color-primary)' : 'transparent',
                            color: efbSection === key ? 'white' : 'var(--color-text-secondary)',
                            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                          }}
                        >
                          <Icon size={13} /> {label}
                        </button>
                      ))}
                    </div>

                    {/* DISPATCH section */}
                    {efbSection === 'dispatch' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                        {[
                          { label: 'Block Fuel', value: `${d.fuelBlock.toLocaleString()} kg`, icon: Fuel, color: 'var(--color-primary)' },
                          { label: 'Trip Fuel', value: `${d.fuelTrip.toLocaleString()} kg`, icon: Fuel, color: 'var(--color-text-secondary)' },
                          { label: 'Alternate', value: `${d.fuelAlternate.toLocaleString()} kg`, icon: Fuel, color: 'var(--color-text-secondary)' },
                          { label: 'Reserve', value: `${d.fuelReserve.toLocaleString()} kg`, icon: Fuel, color: 'var(--color-text-secondary)' },
                          { label: 'Contingency', value: `${d.fuelContingency.toLocaleString()} kg`, icon: Fuel, color: 'var(--color-warning)' },
                          { label: 'Cruise FL', value: `FL${d.cruiseFl}`, icon: ArrowUp, color: 'var(--color-primary)' },
                          { label: 'SID', value: d.sid, icon: Navigation, color: 'var(--color-text-secondary)' },
                          { label: 'STAR', value: d.star, icon: Navigation, color: 'var(--color-text-secondary)' },
                        ].map(({ label, value, icon: Icon, color }) => (
                          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon size={15} style={{ color }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* WEIGHTS section */}
                    {efbSection === 'weights' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                          { label: 'Zero Fuel Weight (ZFW)', est: d.zfw, max: d.maxZfw },
                          { label: 'Takeoff Weight (TOW)',   est: d.tow, max: d.maxTow },
                          { label: 'Landing Weight (LDW)',   est: d.ldw, max: d.maxLdw },
                        ].map(({ label, est, max }) => {
                          const pct = max > 0 ? Math.round((est / max) * 100) : 0;
                          const barColor = pct > 95 ? 'var(--color-danger)' : pct > 85 ? 'var(--color-warning)' : 'var(--color-success)';
                          return (
                            <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: barColor }}>{pct}% max</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)' }}>{est.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-hint)' }}>kg</span></span>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>max {Number(max).toLocaleString()} kg</span>
                              </div>
                              <div style={{ height: '6px', background: 'var(--color-background)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, transition: 'width 0.5s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* WIND section */}
                    {efbSection === 'wind' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {d.avgWindDir && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            {[
                              { label: 'Dir. Media', value: `${d.avgWindDir}°` },
                              { label: 'Velocità Media', value: `${d.avgWindSpd} kt` },
                              { label: 'Componente', value: (() => {
                                const c = Number(d.avgWindComp);
                                if (isNaN(c)) return '—';
                                return c >= 0
                                  ? <span style={{ color: 'var(--color-success)' }}>+{c} kt ↑ Coda</span>
                                  : <span style={{ color: 'var(--color-danger)' }}>{c} kt ↓ Frontale</span>;
                              })() },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Wind size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</div>
                                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {d.stepclimb && (
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Step Climbs</div>
                            <div style={{ fontSize: '13px', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)', background: 'var(--color-background)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--color-border)', lineHeight: 1.5 }}>
                              {d.stepclimb}
                            </div>
                          </div>
                        )}
                        {d.waypoints.length > 0 && (
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Waypoints ({d.waypoints.length})
                            </div>
                            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                              {d.waypoints.map((w: any, i: number) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '8px', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '12px', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                  <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>{w.id}</span>
                                  <span style={{ color: 'var(--color-text-secondary)' }}>{w.alt ? `FL${Math.round(Number(w.alt)/100)}` : '--'}</span>
                                  <span style={{ color: 'var(--color-text-hint)' }}>{w.wind || ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {!d.avgWindDir && !d.stepclimb && d.waypoints.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-hint)', fontSize: '13px' }}>Dati vento non disponibili per questo piano.</div>
                        )}
                      </div>
                    )}

                    {/* MAP section */}
                    {efbSection === 'map' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ height: '420px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--color-border)', position: 'relative' }}>
                          <div ref={efbMapRef} style={{ height: '100%', width: '100%' }} />
                          {/* Map legend */}
                          <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 800, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> {d.origin.icao}
                            </div>
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> {d.destination.icao}
                            </div>
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--color-text-hint)', fontFamily: 'var(--font-family-mono)' }}>
                              {d.distance} nm · {d.waypoints.length} waypoints
                            </div>
                          </div>
                        </div>
                        {d.waypoints.length === 0 && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-hint)', textAlign: 'center' }}>
                            I waypoints non sono disponibili per questo piano — la rotta è mostrata come linea diretta.
                          </p>
                        )}
                      </div>
                    )}

                    {/* V-SPEEDS section */}
                    {efbSection === 'vspeeds' && (() => {
                      const tow = d.tow || 70000;
                      const handleCalc = () => {
                        setVspeedsLoading(true);
                        setTimeout(() => {
                          const result = computeVSpeeds(
                            tow,
                            parseFloat(vspeedsInput.oat) || 15,
                            parseFloat(vspeedsInput.elevation) || 0,
                            parseFloat(vspeedsInput.wind) || 0,
                            vspeedsInput.flaps
                          );
                          setVspeedsResult(result);
                          setVspeedsLoading(false);
                        }, 400);
                      };

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Input panel */}
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-hint)', marginBottom: '16px' }}>
                              Parametri di decollo
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                              {/* TOW — pre-filled from SimBrief */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>TOW (kg)</label>
                                <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-background)', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: 'var(--color-primary)' }}>
                                  {tow.toLocaleString()}
                                  <span style={{ fontSize: '10px', color: 'var(--color-text-hint)', fontWeight: 400, marginLeft: '6px' }}>da SimBrief</span>
                                </div>
                              </div>
                              {[
                                { key: 'oat', label: 'OAT (°C)', placeholder: '15', type: 'number' },
                                { key: 'elevation', label: 'Elevazione pista (ft)', placeholder: '0', type: 'number' },
                                { key: 'wind', label: 'Vento frontale (kt)', placeholder: '0', type: 'number' },
                              ].map(({ key, label, placeholder, type }) => (
                                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>{label}</label>
                                  <input
                                    type={type}
                                    value={(vspeedsInput as any)[key]}
                                    onChange={e => setVspeedsInput(prev => ({ ...prev, [key]: e.target.value }))}
                                    placeholder={placeholder}
                                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '14px', color: 'var(--color-text-primary)', outline: 'none', fontFamily: 'var(--font-family-mono)' }}
                                  />
                                </div>
                              ))}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Config Flap</label>
                                <select
                                  value={vspeedsInput.flaps}
                                  onChange={e => setVspeedsInput(prev => ({ ...prev, flaps: e.target.value }))}
                                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '14px', color: 'var(--color-text-primary)', outline: 'none' }}
                                >
                                  <option value="1+F">FLAP 1+F</option>
                                  <option value="2">FLAP 2</option>
                                  <option value="3">FLAP 3</option>
                                </select>
                              </div>
                            </div>
                            <button
                              onClick={handleCalc}
                              disabled={vspeedsLoading}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 24px', height: '40px', fontSize: '13px', fontWeight: 700, border: 'none', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: vspeedsLoading ? 0.7 : 1, letterSpacing: '0.02em' }}
                            >
                              {vspeedsLoading
                                ? <><RefreshCw size={14} className={styles.spin} /> Calcolo...</>
                                : <><Gauge size={14} /> ARIA, calcola performance</>}
                            </button>
                          </div>

                          {/* Results */}
                          {vspeedsResult && (
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
                              <div style={{ padding: '12px 20px', background: 'rgba(var(--color-primary-rgb),0.06)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary)' }}>
                                Takeoff Performance — {d.aircraft} · TOW {tow.toLocaleString()} kg
                              </div>
                              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                                {[
                                  { label: 'V1',  value: `${vspeedsResult.v1} kt`,  sub: 'Decision Speed',     color: 'var(--color-danger)' },
                                  { label: 'VR',  value: `${vspeedsResult.vr} kt`,  sub: 'Rotation Speed',     color: 'var(--color-warning)' },
                                  { label: 'V2',  value: `${vspeedsResult.v2} kt`,  sub: 'Safety Speed',       color: 'var(--color-success)' },
                                  { label: 'FLEX',
                                    value: vspeedsResult.flexAvailable ? `${vspeedsResult.flexTemp}°C` : 'N/A',
                                    sub: vspeedsResult.flexAvailable ? 'Flex Temp' : 'TOGA Reqrd',
                                    color: vspeedsResult.flexAvailable ? 'var(--color-primary)' : 'var(--color-text-hint)' },
                                ].map(({ label, value, sub, color }) => (
                                  <div key={label} style={{ textAlign: 'center', padding: '16px', borderRadius: '8px', background: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
                                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color, lineHeight: 1 }}>{value}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: '6px' }}>{sub}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-hint)' }}>
                                ⚠ Valori calcolati per A320 family — uso esclusivo simulatore. Non certificati per volo reale.
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* CHECKLIST section */}
                    {efbSection === 'checklist' && (() => {
                      const phases = [
                        { key: 'preflight',      label: 'Pre-Flight' },
                        { key: 'before_takeoff', label: 'Before T/O' },
                        { key: 'approach',       label: 'Approach' },
                        { key: 'landing',        label: 'After Landing' },
                      ] as const;

                      const currentList = CHECKLIST_DATA[checklistPhase];
                      const completedCount = currentList.items.filter(item => checklistItems[item.id]).length;
                      const totalCount = currentList.items.length;
                      const allDone = completedCount === totalCount;

                      const toggleItem = (id: string) =>
                        setChecklistItems(prev => ({ ...prev, [id]: !prev[id] }));

                      const resetPhase = () =>
                        setChecklistItems(prev => {
                          const next = { ...prev };
                          currentList.items.forEach(item => { delete next[item.id]; });
                          return next;
                        });

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Phase selector */}
                          <div style={{ display: 'flex', gap: '6px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px' }}>
                            {phases.map(({ key, label }) => {
                              const phaseList = CHECKLIST_DATA[key];
                              const phaseDone = phaseList.items.filter(i => checklistItems[i.id]).length;
                              const phaseTotal = phaseList.items.length;
                              const isActive = checklistPhase === key;
                              const isDone = phaseDone === phaseTotal;
                              return (
                                <button
                                  key={key}
                                  onClick={() => setChecklistPhase(key)}
                                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px 4px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '6px', background: isActive ? 'var(--color-primary)' : 'transparent', color: isActive ? 'white' : isDone ? 'var(--color-success)' : 'var(--color-text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                                >
                                  <span>{label}</span>
                                  <span style={{ fontSize: '9px', opacity: 0.8 }}>{phaseDone}/{phaseTotal}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Progress bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(completedCount / totalCount) * 100}%`, background: allDone ? 'var(--color-success)' : 'var(--color-primary)', transition: 'width 0.3s ease' }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: allDone ? 'var(--color-success)' : 'var(--color-text-hint)', whiteSpace: 'nowrap' }}>
                              {completedCount}/{totalCount}
                              {allDone && ' ✓'}
                            </span>
                            <button
                              onClick={resetPhase}
                              style={{ fontSize: '11px', color: 'var(--color-text-hint)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                            >
                              Reset
                            </button>
                          </div>

                          {/* Checklist items */}
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', background: allDone ? 'rgba(34,197,94,0.08)' : 'var(--color-background)', borderBottom: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 700, color: allDone ? 'var(--color-success)' : 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {currentList.label} — {allDone ? 'COMPLETED ✓' : `${totalCount - completedCount} items remaining`}
                            </div>
                            {currentList.items.map((item, i) => {
                              const done = !!checklistItems[item.id];
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleItem(item.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 16px', cursor: 'pointer',
                                    background: done ? 'rgba(34,197,94,0.05)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                                    borderBottom: i < currentList.items.length - 1 ? '1px solid var(--color-border)' : 'none',
                                    transition: 'background 0.15s',
                                    gap: '16px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${done ? 'var(--color-success)' : 'var(--color-border)'}`, background: done ? 'var(--color-success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                                      {done && <Check size={12} color="white" strokeWidth={3} />}
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: done ? 400 : 500, color: done ? 'var(--color-text-hint)' : 'var(--color-text-primary)', textDecoration: done ? 'line-through' : 'none', transition: 'all 0.15s' }}>
                                      {item.text}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: done ? 'var(--color-success)' : 'var(--color-primary)', fontFamily: 'var(--font-family-mono)', flexShrink: 0, textTransform: 'uppercase' }}>
                                    {item.response}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ROUTE section */}
                    {efbSection === 'route' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rotta ATC</span>
                            <button
                              onClick={() => {
                                if (d.route) navigator.clipboard.writeText(d.route).then(() => { setEfbRouteCopied(true); setTimeout(() => setEfbRouteCopied(false), 2000); });
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '6px', background: efbRouteCopied ? 'var(--color-success)' : 'var(--color-surface)', color: efbRouteCopied ? 'white' : 'var(--color-text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                            >
                              {efbRouteCopied ? <><Check size={11} /> Copiato</> : <><Copy size={11} /> Copia</>}
                            </button>
                          </div>
                          <div style={{ padding: '16px', fontFamily: 'var(--font-family-mono)', fontSize: '13px', lineHeight: 1.7, wordBreak: 'break-all', color: 'var(--color-text-primary)', background: 'var(--color-background)' }}>
                            {d.route}
                          </div>
                        </div>
                        {d.ofpUrl && (
                          <a
                            href={d.ofpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 18px', height: '38px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', textDecoration: 'none', alignSelf: 'flex-start' }}
                          >
                            <FileText size={14} /> Visualizza OFP completo
                          </a>
                        )}
                        <a
                          href="https://dispatch.simbrief.com/briefing/latest"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 18px', height: '38px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', alignSelf: 'flex-start' }}
                        >
                          <ExternalLink size={14} /> Apri SimBrief
                        </a>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>
          )}
 
         </div>
       </main>
    </div>
  );
}

// ─── Stili — usa variabili CSS Skydeck, funziona in light e dark mode ────────

