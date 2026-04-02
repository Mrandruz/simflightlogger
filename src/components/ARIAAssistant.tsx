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
  PieChart as PieChartIcon
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

type ViewState = 'chat' | 'overview' | 'schedule' | 'fleet' | 'network' | 'roster' | 'financials';

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
                <TrendingUp size={12} /> +12% vs last {period}
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
  const [selectedFlight, setSelectedFlight] = useState<ScheduledFlight | null>(null);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'total'>('month');
  const processedArrivedFlights = useRef<Set<string>>(new Set());
  const [scheduleTab, setScheduleTab] = useState<'mine' | 'crew'>('mine');

  const [fleetBriefing, setFleetBriefing] = useState('');
  const [fleetBriefingLoading, setFleetBriefingLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [opsPlan, setOpsPlan] = useState<VelarPlan | null>(null);
  const [npcRoster, setNpcRoster] = useState<NpcPilot[]>([]);
  const [fleetState, setFleetState] = useState<any[]>([]);
  const [networkFlights, setNetworkFlights] = useState<NetworkFlight[]>([]);
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

    // 1. Dati Utente (Andrea) - REALI da Firestore
    const userPilot = {
      id: "VLR-A01",
      name: pilotName || "Comandante Andrea",
      rank: profile.currentRank.name,
      base: currentBase,
      totalFlights: profile.totalFlights,
      totalHours: profile.totalHours,
      isUser: true
    };

    // 2. Dati NPCs (con simulazione FH dinamica e sincrona)
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

      // B. ORE ODIERNE (Sincronizzate con il network live oggi)
      let todayHours = 0;
      opsPlan.hubs.forEach((hub: any) => {
        hub.routes?.forEach((route: any) => {
          route.legs?.forEach((leg: any, idx: number) => {
            const depTime = parseTime(leg.dep_utc);
            const blockMins = parseBlock(leg.block);
            const arrTime = depTime + blockMins;
            const legId = `${leg.flight}-${idx}`;

            // Identifichiamo se questo volo è assegnato a questo NPC
            const pilotOnThisFlight = assignPilot(legId, route.aircraft, depTime, npcRoster, hub.icao);
            
            if (pilotOnThisFlight.id === npc.id) {
              if (currentMinsUtc >= arrTime) {
                // Volo già completato oggi
                todayHours += (blockMins / 60);
              } else if (currentMinsUtc >= depTime) {
                // Volo attualmente "In Corso" - aggiungiamo il progresso reale
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
                   
                   // Sync Firestore
                   setDoc(doc(db, 'users', userId, 'operations', 'processed_flights'), {
                      processed_ids: Array.from(processedArrivedFlights.current),
                      last_sync: Date.now()
                   }, { merge: true }).catch(e => console.error('[ARIA Sync] Failed:', e));

                   // Calcolo profitto per il report Discord (Format richiesto dal Comandante)
                   const specs = AIRCRAFT_FINANCIALS[flight.aircraft] || AIRCRAFT_FINANCIALS['Airbus A320'];
                   const pax = Math.round(specs.capacity * 0.82);
                   const blockHours = (flight.arrivalTime - flight.departureTime) / 60;
                   const miles = Math.round(blockHours * 450);
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
6. IMPORTANTE: Ogni volo DEVE includere i campi "departureTime" e "arrivalTime" nel formato "HH:MM" (UTC).

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
          model: 'claude-3-5-sonnet-20240620',
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
    const activeVols = networkFlights.filter(f =>
      !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)
    ).length;
    const totalFlights = networkFlights.length;
    const onTimeFlights = networkFlights.filter(f => f.status !== 'AOG/Cancel').length;
    const onTimePercentage = totalFlights > 0 ? Math.round((onTimeFlights / totalFlights) * 100) : 100;
    const totalFH = fleetState.reduce((acc: number, ac: any) => acc + (ac.totalFlightHours || 0), 0);

    const avgCapacity = opsPlan.fleet.length > 0
      ? opsPlan.fleet.reduce((acc: number, f: VelarFleetItem) => acc + f.capacity * f.count, 0) /
        opsPlan.fleet.reduce((acc: number, f: VelarFleetItem) => acc + f.count, 0)
      : 180;

    const hubs = opsPlan.hubs.map((hub: VelarHub) => {
      const activeAtHub = networkFlights.filter(
        f => (f.departure === hub.icao || f.arrival === hub.icao) && 
             !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)
      ).length;
      
      // Calcoliamo i passeggeri solo sui voli in PARTENZA per il totale finanziario del singolo hub,
      // ma usiamo il totale globale per la dashboard.
      const paxAtHub = networkFlights.filter(
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
  }, [profile, pilotName, opsPlan, fleetState, networkFlights]);


  useEffect(() => {
    if (view === 'overview' && profile && opsPlan) {
      generateOverview();
    }
  }, [view, profile, opsPlan, networkFlights, fleetState, generateOverview]);

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
          {(['chat', 'overview', 'schedule', 'fleet', 'network', 'roster', 'financials'] as ViewState[]).map(v => (
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
              <span style={{ textTransform: 'capitalize' }}>{v}</span>
              {view === v && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </button>
          ))}
        </nav>

        {profile && (
          <div className={styles.pilotInfo}>
            <div className={styles.pilotAvatar}>
              {pilotName ? pilotName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className={styles.pilotText}>
              <span className={styles.pilotName}>{pilotName || 'Comandante'}</span>
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
            flights={networkFlights} 
            selectedFlight={selectedFlightForMap} 
            isDarkMode={isDarkMode} 
            onCloseFlight={() => { setSelectedFlightForMap(null); setMapMode('network'); }}
            hubIcaos={opsPlan?.hubs.map((h: VelarHub) => h.icao) ?? ['LIRF', 'KBOS', 'WIII']}
          />
          <div className={styles.mapOverlay}>
            <div className={styles.mapBadge}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', animation: 'pulse 2s infinite' }} />
                LIVE NETWORK: {networkFlights.length} VOLI
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
                    <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{networkFlights.length}</span>
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
                <div className={styles.flightGrid}>
                  {schedule.length > 0 ? (
                    schedule.map((f, i) => (
                      <div 
                        key={i} 
                        className={`${styles.card} ${styles.flightCard} ${selectedFlight === f ? styles.flightCardSelected : ''}`} 
                        onClick={() => { setSelectedFlight(f); setSelectedFlightForMap(f); setIsMapZoomed(true); }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span className={styles.sectionTitle}>{f.day} • {f.flightNumber}</span>
                            <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0' }}>
                              {f.departure} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-hint)' }}>({f.departureTime || '--:--'})</span> 
                              {" → "}
                              {f.arrival} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-hint)' }}>({f.arrivalTime || '--:--'})</span>
                            </div>
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
                            <a href={buildSimbriefUrl(f)} target="_blank" rel="noopener noreferrer" className={styles.sendBtn} style={{ width: '100%', height: '36px', fontSize: '13px', textDecoration: 'none', gap: '8px' }}>
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
                       <button onClick={generateSchedule} className={styles.sendBtn} style={{ width: 'auto', padding: '0 24px', margin: '16px auto' }}>Genera Schedule</button>
                    </div>
                  )}
                </div>
              )}

              {scheduleTab === 'crew' && (
                <div className={styles.flightGrid}>
                  {Array.from(new Map(networkFlights.filter(f => !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(f.status)).map(f => [f.pilot.id, f])).values()).map((nf: any) => (
                    <div key={nf.id} className={styles.card}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className={styles.ariaAvatar}>{(nf.pilot.name || 'CM').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
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

              <div className={styles.flightGrid}>
                {fleetState.map((ac) => {
                  const activeFlight = networkFlights.find(nf => nf.tailNumber === ac.id);
                  const isFlying = activeFlight && !['Arrived', 'Turnaround', 'Scheduled', 'AOG/Cancel'].includes(activeFlight.status);
                  const liveStatus = isFlying ? activeFlight.status.toUpperCase() : ac.status;
                  
                  const maintProgress = (ac.totalFlightHours % MAINTENANCE_CYCLE_HOURS) / MAINTENANCE_CYCLE_HOURS;
                  const hoursUntilCheck = MAINTENANCE_CYCLE_HOURS - (ac.totalFlightHours % MAINTENANCE_CYCLE_HOURS);
                  
                  const statusColor = ac.status === 'AOG' ? 'var(--color-danger)' : 
                                     isFlying ? 'var(--color-primary)' : 'var(--color-success)';
                  
                  const progressColor = ac.status === 'AOG' ? 'var(--color-danger)' : 
                                       (hoursUntilCheck < 50) ? 'var(--color-danger)' :
                                       (hoursUntilCheck < 150) ? 'var(--color-warning)' : 'var(--color-primary)';

                   return (
                    <div key={ac.id} className={styles.card}>
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
                          <span style={{ fontWeight: 600, color: hoursUntilCheck < 50 ? 'var(--color-danger)' : 'inherit' }}>
                            Next Check: {hoursUntilCheck.toFixed(1)}h
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${maintProgress * 100}%`, 
                            background: progressColor,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                      
                      {isFlying && (
                        <div style={{ marginTop: '10px', padding: '6px', borderRadius: '6px', background: 'var(--color-primary-light)', fontSize: '10px' }}>
                          <span style={{ fontWeight: 600 }}>{activeFlight?.flightNumber}</span>: {activeFlight?.departure} → {activeFlight?.arrival}
                        </div>
                      )}
                      {(ac.status === 'AOG' || ac.isAOG) && ac.aogUntilTimeMs > Date.now() && (
                        <div style={{ marginTop: '10px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '10px', color: 'var(--color-danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={10} />
                          AOG fino a {new Date(ac.aogUntilTimeMs).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
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

               <div className={styles.flightGrid}>
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
                    <div 
                      key={nf.id} 
                      className={styles.card} 
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedFlightForMap(nf); setIsMapZoomed(true); }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-family-mono)' }}>{nf.flightNumber}</div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: nf.status === 'En Route' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{nf.status.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, margin: '4px 0' }}>
                        {nf.departure} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}>({(nf.departureTime !== undefined && nf.departureTime !== null) ? formatMinutesToTime(nf.departureTime) : '--:--'})</span>
                        {" → "}
                        {nf.arrival} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-hint)' }}>({(nf.arrivalTime !== undefined && nf.arrivalTime !== null) ? formatMinutesToTime(nf.arrivalTime) : '--:--'})</span>
                      </div>
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
                        <option value="Chief Pilot">Chief Pilot</option>
                        <option value="Senior Captain">Senior Captain</option>
                        <option value="Captain">Captain</option>
                        <option value="Senior First Officer">Senior First Officer</option>
                        <option value="First Officer">First Officer</option>
                        <option value="Second Officer">Second Officer</option>
                      </select>
                    </div>
                  </div>
               </div>

               <div className={styles.flightGrid}>
                  {fullRoster.map((pilot, index) => (
                    <div 
                      key={pilot.id} 
                      className={`${styles.card} ${pilot.isUser ? styles.userPilotCard : ''}`}
                      style={{ 
                        position: 'relative',
                        border: pilot.isUser ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: pilot.isUser ? 'rgba(var(--color-primary-rgb), 0.05)' : 'var(--color-surface)'
                      }}
                    >
                      <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '20px', fontWeight: 900, opacity: 0.1, fontStyle: 'italic' }}>
                        #{index + 1}
                      </div>

                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div className={styles.ariaAvatar} style={{ 
                          width: '48px', 
                          height: '48px', 
                          fontSize: '18px',
                          background: pilot.isUser ? 'var(--color-primary)' : 'var(--color-background)',
                          color: pilot.isUser ? 'white' : 'var(--color-text-primary)',
                          border: pilot.isUser ? 'none' : '1px solid var(--color-border)'
                        }}>
                          {pilot.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 700 }}>{pilot.name}</span>
                            {pilot.isUser && (
                              <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-primary)', color: 'white', borderRadius: '4px', fontWeight: 800 }}>YOU</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-hint)', fontWeight: 600 }}>{pilot.id} • {pilot.rank}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Hub</span>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{pilot.base}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Voli</span>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{pilot.totalFlights}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-hint)', textTransform: 'uppercase' }}>Ore</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>{Math.floor(pilot.totalHours)}h</span>
                        </div>
                      </div>

                      {pilot.isUser && (
                        <div style={{ marginTop: '12px', padding: '8px', borderRadius: '4px', background: 'rgba(var(--color-primary-rgb), 0.1)', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', textAlign: 'center' }}>
                          POSIZIONE ATTUALE NELLA TOP CREW: #{index + 1}
                        </div>
                      )}
                    </div>
                  ))}
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
 
         </div>
       </main>
    </div>
  );
}

// ─── Stili — usa variabili CSS Skydeck, funziona in light e dark mode ────────

