import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Star, Shield, Zap, Target, Clock, TrendingUp,
    CheckCircle, Lock, AlertTriangle, ChevronRight, Award,
    Plane, Globe, RefreshCw, Calendar, Fuel, MapPin, X,
    Trophy, Flame, BarChart2
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// HANGAR AIRCRAFT — exact keys from Hangar.jsx AIRCRAFT_CHECKLISTS
// Only these aircraft types are valid for mission requirements
// ─────────────────────────────────────────────────────────────────────────────
const HANGAR_AIRCRAFT = [
    'Airbus A319',
    'Airbus A320',
    'Airbus A321',
    'Airbus A330',
    'Airbus A350',
    'Airbus A380',
    'Boeing 777',
    'Boeing 787',
];

// Aircraft groups for convenience in mission requirements
const NARROWBODY = ['Airbus A319', 'Airbus A320', 'Airbus A321'];
const WIDEBODY   = ['Airbus A330', 'Airbus A350', 'Airbus A380', 'Boeing 777', 'Boeing 787'];

// ─────────────────────────────────────────────────────────────────────────────
// MISSION DEFINITIONS — dispatcher-assigned flights. The company decides the
// route, aircraft and airline. The pilot executes. Add new objects to extend.
// ─────────────────────────────────────────────────────────────────────────────
const MISSION_DEFS = [
    // ── LEVEL 1 — EASY ────────────────────────────────────────────────────────
    {
        id: 'cargo_001',
        type: 'CARGO',
        title: 'Air France Cargo: CDG → FCO',
        description: 'Dispatch: Air France Cargo requires an A320 family positioning flight carrying medical supplies from Paris CDG to Rome FCO. Slot assigned, no delays tolerated. Max block time: 2h 30m.',
        dispatchNote: 'Airline: Air France · Flight AF7721',
        requirements: {
            departure: 'LFPG', arrival: 'LIRF',
            aircraft: ['Airbus A320', 'Airbus A321', 'Airbus A319'],
            airline: 'Air France',
            maxFlightTime: 2.5,
            minLevel: 1,
        },
        rewards: { xp: 320, credits: 4200, repDelta: 8 },
        penalty: { xp: -100, credits: -1500, repDelta: -12 },
        expiresInHours: 48,
        difficulty: 'EASY',
        category: 'CARGO',
    },
    {
        id: 'passenger_001',
        type: 'PASSENGER',
        title: 'Lufthansa: FRA → LHR (Rotation)',
        description: 'Dispatch: Lufthansa schedules a standard A320 rotation between Frankfurt and London Heathrow. Two sectors must be completed within the duty window. Airline: Lufthansa, aircraft A320 family.',
        dispatchNote: 'Airline: Lufthansa · Flights LH900 / LH901',
        requirements: {
            departure: 'EDDF', arrival: 'EGLL',
            aircraft: ['Airbus A320', 'Airbus A319', 'Airbus A321'],
            airline: 'Lufthansa',
            flightCount: 2,
            minLevel: 1,
        },
        rewards: { xp: 280, credits: 3500, repDelta: 6 },
        penalty: { xp: -80, credits: -1000, repDelta: -8 },
        expiresInHours: 96,
        difficulty: 'EASY',
        category: 'PASSENGER',
    },
    {
        id: 'training_001',
        type: 'TRAINING',
        title: 'A320 Family Type Rating — Line Training',
        description: 'Company requirement: before operating narrowbody routes independently, complete 5 line training sectors on any A320 family aircraft under supervision. Route and airline at discretion of training captain.',
        dispatchNote: 'Training Authority: Fleet Standards · Any A320 family · Any route',
        requirements: {
            aircraft: ['Airbus A320', 'Airbus A321', 'Airbus A319'],
            flightCount: 5,
            minLevel: 1,
        },
        rewards: { xp: 500, credits: 6000, repDelta: 10, unlocksId: 'rating_a320' },
        penalty: null,
        expiresInHours: null,
        difficulty: 'MEDIUM',
        category: 'TRAINING',
    },

    // ── LEVEL 2 — MEDIUM ──────────────────────────────────────────────────────
    {
        id: 'passenger_002',
        type: 'PASSENGER',
        title: 'ITA Airways: FCO → AMS → FCO',
        description: 'Dispatch: ITA Airways assigns a round-trip rotation Rome FCO to Amsterdam AMS and back. Both sectors must be completed within 5 days. Aircraft: A320 family. Punctuality is monitored — slot compliance required.',
        dispatchNote: 'Airline: ITA Airways · Flights AZ102 / AZ103',
        requirements: {
            departure: 'LIRF', arrival: 'EHAM',
            aircraft: ['Airbus A320', 'Airbus A321', 'Airbus A319'],
            airline: 'ITA Airways',
            flightCount: 2,
            minLevel: 2,
        },
        rewards: { xp: 380, credits: 4800, repDelta: 9 },
        penalty: { xp: -100, credits: -1500, repDelta: -10 },
        expiresInHours: 120,
        difficulty: 'MEDIUM',
        category: 'PASSENGER',
    },
    {
        id: 'event_001',
        type: 'EVENT',
        title: 'Emirates: DXB → NRT — Network Expansion',
        description: 'SPECIAL DISPATCH: Emirates activates a new long-haul slot on the Dubai–Tokyo Narita sector for network expansion. Boeing 787 assigned. Departure window: 24 hours. This is a one-time activation — do not miss it.',
        dispatchNote: 'Airline: Emirates · Flight EK318 · Boeing 787 · OMDB → RJTT',
        requirements: {
            departure: 'OMDB', arrival: 'RJTT',
            aircraft: ['Boeing 787'],
            airline: 'Emirates',
            minLevel: 2,
        },
        rewards: { xp: 800, credits: 12000, repDelta: 20 },
        penalty: { xp: -50, credits: 0, repDelta: -5 },
        expiresInHours: 24,
        difficulty: 'HARD',
        category: 'EVENT',
    },

    // ── LEVEL 3 — HARD ────────────────────────────────────────────────────────
    {
        id: 'charter_001',
        type: 'CHARTER',
        title: 'British Airways Charter: LHR → AUH',
        description: 'Dispatch: British Airways Executive Charter division assigns a VIP flight from London Heathrow to Abu Dhabi. Passenger manifest: government delegation. Aircraft: Boeing 787 or Airbus A350. Crew rest requirements apply — max flight time 8h.',
        dispatchNote: 'Airline: British Airways · Charter BA9901 · A350 / B787',
        requirements: {
            departure: 'EGLL', arrival: 'OMAA',
            aircraft: ['Airbus A350', 'Boeing 787'],
            airline: 'British Airways',
            maxFlightTime: 8,
            minLevel: 3,
        },
        rewards: { xp: 650, credits: 9500, repDelta: 15 },
        penalty: { xp: -200, credits: -3000, repDelta: -18 },
        expiresInHours: 72,
        difficulty: 'HARD',
        category: 'CHARTER',
    },
    {
        id: 'training_002',
        type: 'TRAINING',
        title: 'B777 Widebody Type Rating — Line Training',
        description: 'Company requirement: widebody endorsement on Boeing 777. Complete 8 supervised line sectors on B777 to qualify for long-haul independent command. Any route, any airline operating B777. No expiry — complete at your own pace.',
        dispatchNote: 'Training Authority: Fleet Standards · Boeing 777 · Any route',
        requirements: {
            aircraft: ['Boeing 777'],
            flightCount: 8,
            minLevel: 3,
        },
        rewards: { xp: 750, credits: 9000, repDelta: 12, unlocksId: 'rating_b777' },
        penalty: null,
        expiresInHours: null,
        difficulty: 'HARD',
        category: 'TRAINING',
    },

    // ── LEVEL 4 — ELITE ───────────────────────────────────────────────────────
    {
        id: 'cargo_002',
        type: 'CARGO',
        title: 'Lufthansa Cargo: LAX → FRA — Transatlantic Freighter',
        description: 'Dispatch: Lufthansa Cargo activates the LAX–FRA freighter sector. Aircraft: Boeing 777 or Airbus A350 with cargo configuration. Minimum flight time 10h due to oceanic routing. This is an ELITE-class operation — full rest compliance, no shortcuts.',
        dispatchNote: 'Airline: Lufthansa · Cargo LH8469 · B777 / A350 · KLAX → EDDF',
        requirements: {
            departure: 'KLAX', arrival: 'EDDF',
            aircraft: ['Boeing 777', 'Airbus A350'],
            airline: 'Lufthansa',
            minFlightTime: 10,
            minLevel: 4,
        },
        rewards: { xp: 900, credits: 14000, repDelta: 18 },
        penalty: { xp: -250, credits: -4000, repDelta: -20 },
        expiresInHours: 96,
        difficulty: 'ELITE',
        category: 'CARGO',
    },
    {
        id: 'charter_002',
        type: 'CHARTER',
        title: 'Singapore Airlines Charter: SIN → CDG — Ultra Long Haul',
        description: 'Dispatch: Singapore Airlines assigns an ultra long-haul charter from Singapore Changi to Paris CDG. Aircraft: Airbus A350 only. This is one of the longest commercial sectors in the network — minimum flight time 13h. Senior Captain clearance required.',
        dispatchNote: 'Airline: Singapore Airlines · Charter SQ9901 · A350 · WSSS → LFPG',
        requirements: {
            departure: 'WSSS', arrival: 'LFPG',
            aircraft: ['Airbus A350'],
            airline: 'Singapore Airlines',
            minFlightTime: 13,
            minLevel: 4,
        },
        rewards: { xp: 1100, credits: 18000, repDelta: 22 },
        penalty: { xp: -300, credits: -5000, repDelta: -25 },
        expiresInHours: 120,
        difficulty: 'ELITE',
        category: 'CHARTER',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// XP TABLE — livelli carriera
// ─────────────────────────────────────────────────────────────────────────────
const CAREER_LEVELS = [
    { level: 1, title: 'Junior First Officer', xpRequired: 0,     color: '#6b7280', rgb: '107,114,128' },
    { level: 2, title: 'First Officer',        xpRequired: 500,   color: '#3b82f6', rgb: '59,130,246'  },
    { level: 3, title: 'Senior First Officer', xpRequired: 1400,  color: '#10b981', rgb: '16,185,129'  },
    { level: 4, title: 'Captain',              xpRequired: 3000,  color: '#f59e0b', rgb: '245,158,11'  },
    { level: 5, title: 'Senior Captain',       xpRequired: 5500,  color: '#f97316', rgb: '249,115,22'  },
    { level: 6, title: 'Chief Pilot',          xpRequired: 9500,  color: '#ef4444', rgb: '239,68,68'   },
    { level: 7, title: 'Fleet Director',       xpRequired: 15000, color: '#8b5cf6', rgb: '139,92,246'  },
];

const CATEGORY_COLORS = {
    CARGO:     { bg: '#fef3c7', color: '#d97706', border: '#fbbf24' },
    PASSENGER: { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
    CHARTER:   { bg: '#fdf4ff', color: '#9333ea', border: '#d8b4fe' },
    TRAINING:  { bg: '#ecfdf5', color: '#059669', border: '#6ee7b7' },
    EVENT:     { bg: '#fff1f2', color: '#e11d48', border: '#fda4af' },
};

const DIFFICULTY_META = {
    EASY:   { label: 'Easy',  color: '#10b981' },
    MEDIUM: { label: 'Medium',   color: '#f59e0b' },
    HARD:   { label: 'Hard', color: '#ef4444' },
    ELITE:  { label: 'Elite',   color: '#8b5cf6' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function getCurrentLevel(xp) {
    let current = CAREER_LEVELS[0];
    for (const lvl of CAREER_LEVELS) {
        if (xp >= lvl.xpRequired) current = lvl;
        else break;
    }
    return current;
}

function getNextLevel(xp) {
    for (const lvl of CAREER_LEVELS) {
        if (xp < lvl.xpRequired) return lvl;
    }
    return null;
}

function getLevelProgress(xp) {
    const current = getCurrentLevel(xp);
    const next = getNextLevel(xp);
    if (!next) return 100;
    const range = next.xpRequired - current.xpRequired;
    const earned = xp - current.xpRequired;
    return Math.min(100, Math.round((earned / range) * 100));
}

function getFatigueColor(fatigue) {
    if (fatigue <= 40) return '#10b981';
    if (fatigue <= 70) return '#f59e0b';
    return '#ef4444';
}

function getRepColor(rep) {
    if (rep >= 70) return '#10b981';
    if (rep >= 40) return '#f59e0b';
    return '#ef4444';
}

// Verifica se un volo soddisfa i requisiti di una missione
function validateMission(mission, flight) {
    const req = mission.requirements;
    if (!flight) return false;

    // Route checks
    if (req.departure && flight.departure?.toUpperCase() !== req.departure.toUpperCase()) return false;
    if (req.arrival   && flight.arrival?.toUpperCase()   !== req.arrival.toUpperCase())   return false;

    // Airline — the company assigns the carrier, pilot must comply
    if (req.airline) {
        const flightAirline = (flight.airline || '').toLowerCase().trim();
        const reqAirline    = req.airline.toLowerCase().trim();
        if (!flightAirline.includes(reqAirline) && !reqAirline.includes(flightAirline)) return false;
    }

    // Alliance
    if (req.alliance && flight.alliance !== req.alliance) return false;

    // Flight time constraints (in decimal hours)
    if (req.maxFlightTime && Number(flight.flightTime) > req.maxFlightTime) return false;
    if (req.minFlightTime && Number(flight.flightTime) < req.minFlightTime) return false;

    // Aircraft type — exact match against Hangar aircraft names
    if (req.aircraft?.length) {
        const flightAc = (flight.aircraft || '').toLowerCase();
        const matches  = req.aircraft.some(a => flightAc.includes(a.toLowerCase()));
        if (!matches) return false;
    }

    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAREER HEADER
// ─────────────────────────────────────────────────────────────────────────────
function CareerHeader({ profile }) {
    const level = getCurrentLevel(profile.xp);
    const nextLevel = getNextLevel(profile.xp);
    const progress = getLevelProgress(profile.xp);
    const fatigueColor = getFatigueColor(profile.fatigue);
    const repColor = getRepColor(profile.reputation);

    return (
        <div style={{
            background: 'var(--career-header-bg)',
            border: '1px solid var(--career-header-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px 28px',
            marginBottom: 'var(--space-5)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow decorativo */}
            <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, background: `radial-gradient(circle, rgba(${level.rgb},0.12) 0%, transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -20, width: 150, height: 150, background: 'radial-gradient(circle, rgba(20,106,255,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            {/* Subtle top stripe accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${level.color}, transparent)`, borderRadius: '12px 12px 0 0', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>

                {/* Rank icon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${level.color}, rgba(${level.rgb},0.5))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 20px rgba(${level.rgb},0.4)`,
                    }}>
                        <Shield size={26} color="#fff" />
                    </div>
                    <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid rgba(${level.rgb},0.35)`, animation: 'ping 3s cubic-bezier(0,0,0.2,1) infinite' }} />
                </div>

                {/* Callsign + rank */}
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--career-text-primary)', letterSpacing: '0.05em' }}>
                            CAPT. ANDREA
                        </span>
                        <div style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', background: `rgba(${level.rgb},0.15)`, border: `1px solid rgba(${level.rgb},0.4)` }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: level.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {level.title}
                            </span>
                        </div>
                    </div>

                    {/* XP progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${level.color}, rgba(${level.rgb},0.7))`, borderRadius: 3, transition: 'width 1s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-family-mono)', color: 'var(--career-text-hint)', flexShrink: 0 }}>
                            {profile.xp.toLocaleString()} XP
                            {nextLevel && <span style={{ opacity: 0.5 }}> / {nextLevel.xpRequired.toLocaleString()}</span>}
                        </span>
                    </div>
                    {nextLevel && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--career-text-muted)', marginTop: 3 }}>
                            {(nextLevel.xpRequired - profile.xp).toLocaleString()} XP to next rank: <span style={{ color: nextLevel.color }}>{nextLevel.title}</span>
                        </div>
                    )}
                </div>

                {/* Stats pill row */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* Credits */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', background: 'var(--career-pill-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--career-pill-border)' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--career-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Credits</span>
                        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }}>
                            ✦ {profile.credits.toLocaleString()}
                        </span>
                    </div>

                    {/* Reputation */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', background: 'var(--career-pill-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--career-pill-border)' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--career-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Reputation</span>
                        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.95rem', fontWeight: 700, color: repColor }}>
                            {profile.reputation}/100
                        </span>
                    </div>

                    {/* Fatigue */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', border: `1px solid ${profile.fatigue > 70 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--career-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Fatigue</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {profile.fatigue > 70 && <AlertTriangle size={11} color={fatigueColor} />}
                            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.95rem', fontWeight: 700, color: fatigueColor }}>
                                {profile.fatigue}%
                            </span>
                        </div>
                    </div>

                    {/* Completed missions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', background: 'var(--career-pill-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--career-pill-border)' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--career-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Missions</span>
                        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                            {profile.completedMissions}✓
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MISSION CARD
// ─────────────────────────────────────────────────────────────────────────────
function MissionCard({ mission, missionState, onAccept, onComplete, onAbandon, flights, profile }) {
    const cat = CATEGORY_COLORS[mission.category] || CATEGORY_COLORS.CARGO;
    const diff = DIFFICULTY_META[mission.difficulty];
    const isActive = missionState?.status === 'active';
    const isCompleted = missionState?.status === 'completed';
    const isFailed = missionState?.status === 'failed';
    const isLocked = mission.requirements.minLevel > profile.level;

    // Count valid flights for multi-flight missions
    const validFlightCount = useMemo(() => {
        if (!isActive || !mission.requirements.flightCount) return 0;
        const acceptedAt = missionState?.acceptedAt ? new Date(missionState.acceptedAt) : new Date(0);
        return flights.filter(f => {
            if (new Date(f.date) < acceptedAt) return false;
            return validateMission(mission, f);
        }).length;
    }, [flights, isActive, mission, missionState]);

    const progress = mission.requirements.flightCount
        ? Math.min(100, Math.round((validFlightCount / mission.requirements.flightCount) * 100))
        : isActive ? 50 : 0;

    // For single-flight missions: check logbook for at least one valid flight
    // logged after the mission was accepted
    const validSingleFlight = useMemo(() => {
        if (!isActive || mission.requirements.flightCount) return null;
        const acceptedAt = missionState?.acceptedAt ? new Date(missionState.acceptedAt) : new Date(0);
        return flights.find(f => {
            if (new Date(f.date) < acceptedAt) return false;
            return validateMission(mission, f);
        }) || null;
    }, [flights, isActive, mission, missionState]);

    const canComplete = isActive && (
        mission.requirements.flightCount
            ? validFlightCount >= mission.requirements.flightCount
            : validSingleFlight !== null
    );

    const cardBg = isCompleted
        ? 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, var(--color-surface) 100%)'
        : isFailed
        ? 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, var(--color-surface) 100%)'
        : isActive
        ? 'linear-gradient(135deg, rgba(20,106,255,0.06) 0%, var(--color-surface) 100%)'
        : 'var(--color-surface)';

    const cardBorder = isCompleted ? 'var(--color-success)'
        : isFailed ? 'var(--color-danger)'
        : isActive ? '#146AFF'
        : 'var(--color-border)';

    // Locked missions render as compact stubs — no spoilers, just title + level req
    if (isLocked) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border)',
                background: 'var(--color-background)',
                opacity: 0.65,
            }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lock size={13} color="var(--color-text-hint)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mission.title}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ padding: '1px 6px', borderRadius: 3, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.62rem', fontFamily: 'var(--font-family-mono)', color: CATEGORY_COLORS[mission.category]?.color || 'var(--color-text-hint)' }}>
                            {mission.category}
                        </span>
                        <span>Unlocks at Level {mission.requirements.minLevel} — {CAREER_LEVELS.find(l => l.level === mission.requirements.minLevel)?.title || ''}</span>
                    </div>
                </div>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-hint)', flexShrink: 0 }}>
                    +{mission.rewards.xp} XP
                </div>
            </div>
        );
    }

    return (
        <div style={{
            borderRadius: 'var(--radius-lg)',
            border: `1.5px solid ${cardBorder}`,
            background: cardBg,
            padding: '18px 20px',
            opacity: 1,
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Active glow */}
            {isActive && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #146AFF, transparent)', borderRadius: '4px 4px 0 0' }} />
            )}

            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Category badge */}
                    <div style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: cat.bg, border: `1px solid ${cat.border}` }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {mission.category}
                        </span>
                    </div>
                    {/* Difficulty */}
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: diff.color }}>
                        ● {diff.label}
                    </span>
                </div>

                {/* Status badge */}
                {isCompleted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}>
                        <CheckCircle size={11} color="var(--color-success)" />
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-success)' }}>Completed</span>
                    </div>
                )}
                {isFailed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)' }}>
                        <X size={11} color="var(--color-danger)" />
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-danger)' }}>Failed</span>
                    </div>
                )}
                {isActive && (() => {
                    // Compute time remaining for display
                    const acceptedAt = missionState?.acceptedAt ? new Date(missionState.acceptedAt).getTime() : null;
                    const expiresAt  = acceptedAt && mission.expiresInHours ? acceptedAt + mission.expiresInHours * 3600000 : null;
                    const remainingMs = expiresAt ? expiresAt - Date.now() : null;
                    const remainingH  = remainingMs ? Math.max(0, Math.floor(remainingMs / 3600000)) : null;
                    const remainingM  = remainingMs ? Math.max(0, Math.floor((remainingMs % 3600000) / 60000)) : null;
                    const isUrgent    = remainingH !== null && remainingH < 2;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(20,106,255,0.08)', border: '1px solid rgba(20,106,255,0.4)' }}>
                                <Zap size={11} color="#146AFF" />
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#146AFF' }}>Active</span>
                            </div>
                            {remainingH !== null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: isUrgent ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}` }}>
                                    <Clock size={9} color={isUrgent ? '#ef4444' : '#f59e0b'} />
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: isUrgent ? '#ef4444' : '#f59e0b' }}>
                                        {remainingH}h {remainingM}m
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {isLocked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={13} color="var(--color-text-hint)" />
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-hint)' }}>Lv. {mission.requirements.minLevel}</span>
                    </div>
                )}
            </div>

            {/* Title + description */}
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)', marginBottom: 4 }}>
                {mission.title}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: mission.dispatchNote ? 8 : 12 }}>
                {mission.description}
            </div>
            {/* Dispatcher note — flight number, airline, aircraft assigned by company */}
            {mission.dispatchNote && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', marginBottom: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    borderLeft: '3px solid #146AFF',
                }}>
                    <Plane size={10} style={{ color: '#146AFF', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}>
                        {mission.dispatchNote}
                    </span>
                </div>
            )}

            {/* Requirements chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {mission.requirements.departure && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)' }}>
                        <Plane size={10} style={{ transform: 'rotate(45deg)' }} /> {mission.requirements.departure}
                    </div>
                )}
                {mission.requirements.arrival && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)' }}>
                        <MapPin size={10} /> {mission.requirements.arrival}
                    </div>
                )}
                {mission.requirements.alliance && (
                    <div style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        {mission.requirements.alliance}
                    </div>
                )}
                {mission.requirements.flightCount && (
                    <div style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        {mission.requirements.flightCount} flights required
                    </div>
                )}
                {mission.requirements.maxFlightTime && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        <Clock size={10} /> max {mission.requirements.maxFlightTime}h
                    </div>
                )}
                {mission.requirements.aircraft?.length && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', fontSize: '0.68rem', color: '#8b5cf6', fontFamily: 'var(--font-family-mono)' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>
                        {mission.requirements.aircraft.length === 1
                            ? mission.requirements.aircraft[0]
                            : `${mission.requirements.aircraft[0]} +${mission.requirements.aircraft.length - 1}`
                        }
                    </div>
                )}
                {mission.requirements.minFlightTime && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        <Clock size={10} /> min {mission.requirements.minFlightTime}h
                    </div>
                )}
                {mission.expiresInHours && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.7rem', color: 'var(--color-text-hint)' }}>
                        <Calendar size={10} /> {mission.expiresInHours}h window
                    </div>
                )}
            </div>

            {/* Progress bar (solo se multi-flight e attiva) */}
            {isActive && mission.requirements.flightCount && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)' }}>Flight Progress</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: validFlightCount >= mission.requirements.flightCount ? 'var(--color-success)' : '#146AFF' }}>
                            {validFlightCount} / {mission.requirements.flightCount}
                        </span>
                    </div>
                    <div style={{ height: 5, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? 'var(--color-success)' : '#146AFF', borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                </div>
            )}

            {/* Qualifying flight found — shown for single-flight missions ── */}
            {isActive && !mission.requirements.flightCount && validSingleFlight && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '7px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-success-bg)',
                    border: '1px solid var(--color-success)',
                }}>
                    <CheckCircle size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-success)' }}>
                        Qualifying flight found:
                    </span>
                    <span style={{ fontSize: '0.73rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-secondary)' }}>
                        {validSingleFlight.departure} → {validSingleFlight.arrival}
                        {validSingleFlight.airline ? ` · ${validSingleFlight.airline}` : ''}
                        {validSingleFlight.aircraft ? ` · ${validSingleFlight.aircraft}` : ''}
                        {' · '}{validSingleFlight.date}
                    </span>
                </div>
            )}
            {/* Active mission with no qualifying flight yet — hint to pilot ── */}
            {isActive && !mission.requirements.flightCount && !validSingleFlight && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '7px 12px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.3)',
                }}>
                    <Clock size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.76rem', color: '#f59e0b' }}>
                        Awaiting qualifying flight — log the assigned flight to complete this mission.
                    </span>
                </div>
            )}

            {/* Rewards row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 700, color: '#146AFF' }}>
                        <Zap size={12} /> +{mission.rewards.xp} XP
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b' }}>
                        ✦ {mission.rewards.credits.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--color-success)' }}>
                        <TrendingUp size={12} /> +{mission.rewards.repDelta} rep
                    </div>
                </div>

                {/* CTA button */}
                {!isCompleted && !isFailed && !isLocked && (
                    <div style={{ display: 'flex', gap: 6 }}>
                        {isActive ? (
                            <>
                                <button
                                    onClick={() => onAbandon(mission.id)}
                                    style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--color-text-hint)', transition: 'all 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-danger)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                >
                                    Abandon
                                </button>
                                {canComplete && (
                                    <button
                                        onClick={() => onComplete(mission.id)}
                                        style={{ padding: '5px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-success)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}
                                    >
                                        <CheckCircle size={13} /> Complete
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={() => onAccept(mission.id)}
                                style={{ padding: '5px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                                <ChevronRight size={13} /> Accept
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────
function AuditLog({ entries }) {
    if (!entries.length) return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-hint)', fontSize: '0.8rem' }}>
            No career events recorded yet.
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {entries.slice(-20).reverse().map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.color || 'var(--color-text-hint)', marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>{e.text}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-hint)', marginTop: 1 }}>{e.timestamp}</div>
                    </div>
                    {e.xp && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#146AFF', flexShrink: 0 }}>+{e.xp} XP</span>}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TheCrew({ flights = [], user }) {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [notification, setNotification] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null); // { title, body, onConfirm }
    // Track which mission IDs were just unlocked (for pop animation)
    const [newlyUnlockedIds, setNewlyUnlockedIds] = useState(new Set());

    // ── Career profile state (localStorage per ora, Firestore-ready) ──────────
    const [profile, setProfile] = useState(() => {
        try {
            const saved = localStorage.getItem('skydeck_career_profile');
            if (saved) return JSON.parse(saved);
        } catch {}
        return { xp: 0, credits: 1000, reputation: 50, fatigue: 0, completedMissions: 0, level: 1 };
    });

    // ── Mission states ────────────────────────────────────────────────────────
    const [missionStates, setMissionStates] = useState(() => {
        try {
            const saved = localStorage.getItem('skydeck_career_missions');
            if (saved) return JSON.parse(saved);
        } catch {}
        return {};
    });

    // ── Audit log ─────────────────────────────────────────────────────────────
    const [auditLog, setAuditLog] = useState(() => {
        try {
            const saved = localStorage.getItem('skydeck_career_audit');
            if (saved) return JSON.parse(saved);
        } catch {}
        return [];
    });

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('skydeck_career_profile', JSON.stringify(profile));
    }, [profile]);

    useEffect(() => {
        localStorage.setItem('skydeck_career_missions', JSON.stringify(missionStates));
    }, [missionStates]);

    useEffect(() => {
        localStorage.setItem('skydeck_career_audit', JSON.stringify(auditLog));
    }, [auditLog]);

    // Sync level with XP
    useEffect(() => {
        const lvl = getCurrentLevel(profile.xp);
        if (lvl.level !== profile.level) {
            setProfile(p => ({ ...p, level: lvl.level }));
        }
    }, [profile.xp, profile.level]);

    // Fatigue recovery — 1 point per 12 real minutes (= 5/hr while tab is open)
    useEffect(() => {
        const interval = setInterval(() => {
            setProfile(p => {
                if (p.fatigue <= 0) return p;
                return { ...p, fatigue: Math.max(0, p.fatigue - 1) };
            });
        }, 720000);
        return () => clearInterval(interval);
    }, []);

    // Real expiry check — runs every 60 seconds.
    // If an accepted mission has exceeded its expiresInHours window since
    // acceptedAt, it is automatically failed and the penalty is applied.
    useEffect(() => {
        const checkExpiry = () => {
            const now = Date.now();
            let penaltyXp = 0;
            let penaltyCredits = 0;
            let penaltyRep = 0;
            const newStates = { ...missionStates };
            let anyExpired = false;

            MISSION_DEFS.forEach(mission => {
                const state = newStates[mission.id];
                if (!state || state.status !== 'active') return;
                if (!mission.expiresInHours) return; // TRAINING missions never expire
                const acceptedAt = new Date(state.acceptedAt).getTime();
                const expiresAt = acceptedAt + mission.expiresInHours * 3600000;
                if (now >= expiresAt) {
                    newStates[mission.id] = { ...state, status: 'failed', failedAt: new Date().toISOString(), reason: 'expired' };
                    if (mission.penalty) {
                        penaltyXp      += mission.penalty.xp;
                        penaltyCredits += mission.penalty.credits;
                        penaltyRep     += mission.penalty.repDelta;
                    }
                    addAuditEntry(`⏰ Mission expired: ${mission.title} · Penalty applied`, '#ef4444');
                    anyExpired = true;
                }
            });

            if (anyExpired) {
                setMissionStates(newStates);
                if (penaltyXp || penaltyCredits || penaltyRep) {
                    setProfile(p => ({
                        ...p,
                        xp:         Math.max(0, p.xp + penaltyXp),
                        credits:    Math.max(0, p.credits + penaltyCredits),
                        reputation: Math.max(0, p.reputation + penaltyRep),
                    }));
                }
                showNotification('A mission has expired. Penalty applied.', 'error');
            }
        };

        // Run immediately on mount, then every 60 seconds
        checkExpiry();
        const interval = setInterval(checkExpiry, 60000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [missionStates]);

    // Unlock notification — when profile.level changes, notify the pilot
    // which new missions became available (those whose minLevel === new level)
    const prevLevelRef = React.useRef(profile.level);
    useEffect(() => {
        if (profile.level <= prevLevelRef.current) return;
        prevLevelRef.current = profile.level;
        const newlyUnlocked = MISSION_DEFS.filter(m => m.requirements.minLevel === profile.level);
        if (newlyUnlocked.length > 0) {
            const titles = newlyUnlocked.map(m => m.title).join(', ');
            addAuditEntry(`🔓 New missions unlocked at Level ${profile.level}: ${titles}`, '#10b981');
            showNotification(`New missions unlocked! Check the board.`, 'levelup');
            // Trigger pop animation on newly available cards
            const ids = new Set(newlyUnlocked.map(m => m.id));
            setNewlyUnlockedIds(ids);
            setTimeout(() => setNewlyUnlockedIds(new Set()), 1200);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.level]);

    const addAuditEntry = (text, color, xp = null) => {
        const entry = {
            text,
            color,
            xp,
            timestamp: new Date().toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        };
        setAuditLog(prev => [...prev, entry]);
    };

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3500);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleAccept = (missionId) => {
        // Controlla se c'è già una missione attiva dello stesso tipo
        const mission = MISSION_DEFS.find(m => m.id === missionId);
        if (!mission) return;
        if (profile.fatigue >= 95) {
            showNotification('Fatigue troppo alta. Riposati prima di accettare nuove missioni.', 'error');
            return;
        }
        setMissionStates(prev => ({
            ...prev,
            [missionId]: { status: 'active', acceptedAt: new Date().toISOString() },
        }));
        addAuditEntry(`Mission accepted: ${mission.title}`, '#146AFF');
        showNotification(`Mission "${mission.title}" accepted!`);
    };

    const handleComplete = (missionId) => {
        const mission = MISSION_DEFS.find(m => m.id === missionId);
        if (!mission) return;

        const xpGained = mission.rewards.xp;
        const newXp = profile.xp + xpGained;
        const oldLevel = getCurrentLevel(profile.xp);
        const newLevel = getCurrentLevel(newXp);
        const levelUp = newLevel.level > oldLevel.level;

        setProfile(p => ({
            ...p,
            xp: newXp,
            credits: p.credits + mission.rewards.credits,
            reputation: Math.min(100, p.reputation + mission.rewards.repDelta),
            fatigue: Math.min(100, p.fatigue + 15),
            completedMissions: p.completedMissions + 1,
            level: newLevel.level,
        }));

        setMissionStates(prev => ({
            ...prev,
            [missionId]: { ...prev[missionId], status: 'completed', completedAt: new Date().toISOString() },
        }));

        addAuditEntry(`Mission completed: ${mission.title} · +${xpGained} XP · ✦ +${mission.rewards.credits.toLocaleString()}`, '#10b981', xpGained);

        if (levelUp) {
            addAuditEntry(`🎖️ Promotion! New rank: ${newLevel.title}`, newLevel.color);
            showNotification(`Promotion! You are now ${newLevel.title} 🎖️`, 'levelup');
        } else {
            showNotification(`Mission complete! +${xpGained} XP · ✦ +${mission.rewards.credits.toLocaleString()}`);
        }
    };

    const handleAbandon = (missionId) => {
        const mission = MISSION_DEFS.find(m => m.id === missionId);
        if (!mission) return;
        setMissionStates(prev => ({
            ...prev,
            [missionId]: { ...prev[missionId], status: 'failed' },
        }));
        if (mission.penalty) {
            setProfile(p => ({
                ...p,
                xp: Math.max(0, p.xp + mission.penalty.xp),
                credits: Math.max(0, p.credits + mission.penalty.credits),
                reputation: Math.max(0, p.reputation + mission.penalty.repDelta),
            }));
            addAuditEntry(`Mission abandoned: ${mission.title} · ${mission.penalty.xp} XP`, '#ef4444');
        }
        showNotification(`Mission abandoned. Penalty applied.`, 'error');
    };

    const handleReset = () => {
        setConfirmModal({
            title: 'Reset Career',
            body: 'This will permanently erase all career progress, missions, XP and credits. This action cannot be undone.',
            confirmLabel: 'Reset Forever',
            danger: true,
            onConfirm: () => {
                setProfile({ xp: 0, credits: 1000, reputation: 50, fatigue: 0, completedMissions: 0, level: 1 });
                setMissionStates({});
                setAuditLog([]);
                showNotification('Career reset successfully.');
                setConfirmModal(null);
            },
        });
    };

    // ── Filtered missions ──────────────────────────────────────────────────────
    const filteredMissions = useMemo(() => {
        if (activeFilter === 'ALL') return MISSION_DEFS;
        if (activeFilter === 'ACTIVE') return MISSION_DEFS.filter(m => missionStates[m.id]?.status === 'active');
        return MISSION_DEFS.filter(m => m.category === activeFilter);
    }, [activeFilter, missionStates]);

    const FILTERS = ['ALL', 'ACTIVE', 'CARGO', 'PASSENGER', 'CHARTER', 'TRAINING', 'EVENT'];

    const levelData = getCurrentLevel(profile.xp);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{ animation: 'fadeIn .4s ease-out' }}>

            {/* Toast notification */}
            {notification && (
                <div style={{
                    position: 'fixed', top: 80, right: 24, zIndex: 9999,
                    padding: '12px 20px',
                    background: notification.type === 'error' ? 'var(--color-danger)'
                        : notification.type === 'levelup' ? levelData.color
                        : 'var(--color-success)',
                    color: '#fff',
                    borderRadius: 'var(--radius-lg)',
                    fontWeight: 600, fontSize: '0.85rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    animation: 'fadeIn 0.3s ease',
                    maxWidth: 340,
                }}>
                    {notification.msg}
                </div>
            )}

            {/* Page header */}
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4 }}>
                        <Users className="title-icon" /> The Crew
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Career Mode · RPG Progression · Exclusive Access
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => navigate('/logbook')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                        <BarChart2 size={13} /> Go to Logbook
                    </button>
                    <button
                        onClick={handleReset}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-hint)', fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                        <RefreshCw size={12} /> Reset Career
                    </button>
                </div>
            </header>

            {/* Career Header */}
            <CareerHeader profile={profile} />

            {/* Body — 2 colonne */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 'var(--space-5)', alignItems: 'start' }}>

                {/* LEFT — Mission Feed */}
                <div>
                    {/* Filter bar */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 'var(--radius-full)',
                                    border: `1px solid ${activeFilter === f ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    background: activeFilter === f ? 'var(--color-primary)' : 'var(--color-surface)',
                                    color: activeFilter === f ? '#fff' : 'var(--color-text-secondary)',
                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : f}
                            </button>
                        ))}
                    </div>

                    {/* Mission cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {filteredMissions.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-hint)', fontSize: '0.85rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                                No missions available in this category.
                            </div>
                        ) : (
                            filteredMissions.map(mission => (
                                <div
                                    key={mission.id}
                                    className={newlyUnlockedIds.has(mission.id) ? 'mission-unlock-anim' : ''}
                                >
                                    <MissionCard
                                        mission={mission}
                                        missionState={missionStates[mission.id]}
                                        onAccept={handleAccept}
                                        onComplete={handleComplete}
                                        onAbandon={handleAbandon}
                                        flights={flights}
                                        profile={{ ...profile, level: getCurrentLevel(profile.xp).level }}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT — Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

                    {/* Career stats */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>
                            Career Statistics
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Total XP', value: profile.xp.toLocaleString(), icon: Zap, color: '#146AFF' },
                                { label: 'Credits', value: `✦ ${profile.credits.toLocaleString()}`, icon: Star, color: '#f59e0b' },
                                { label: 'Reputation', value: `${profile.reputation}/100`, icon: TrendingUp, color: getRepColor(profile.reputation) },
                                { label: 'Rank', value: getCurrentLevel(profile.xp).title, icon: Shield, color: levelData.color },
                                { label: 'Completed missions', value: profile.completedMissions, icon: CheckCircle, color: '#10b981' },
                                { label: 'Active missions', value: Object.values(missionStates).filter(s => s.status === 'active').length, icon: Target, color: '#8b5cf6' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={13} style={{ color }} />
                                    </div>
                                    <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{label}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-mono)' }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fatigue indicator */}
                    {profile.fatigue > 40 && (
                        <div className="card" style={{ padding: '16px 20px', border: `1px solid ${getFatigueColor(profile.fatigue)}40`, background: `${getFatigueColor(profile.fatigue)}08` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <AlertTriangle size={14} style={{ color: getFatigueColor(profile.fatigue) }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: getFatigueColor(profile.fatigue) }}>
                                    {profile.fatigue >= 80 ? 'Fatigue Critica' : 'Fatigue Elevata'}
                                </span>
                            </div>
                            <div style={{ height: 5, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                                <div style={{ height: '100%', width: `${profile.fatigue}%`, background: getFatigueColor(profile.fatigue), borderRadius: 3 }} />
                            </div>
                            <p style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                {profile.fatigue >= 95
                                    ? 'Cannot accept new missions. Wait for recovery.'
                                    : 'La fatica riduce l\'XP guadagnato. Si recupera automaticamente nel tempo.'}
                            </p>
                        </div>
                    )}

                    {/* Levels overview */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-4)' }}>
                            Rank Table
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {CAREER_LEVELS.map(lvl => {
                                const isCurrentLevel = getCurrentLevel(profile.xp).level === lvl.level;
                                const isUnlocked = profile.xp >= lvl.xpRequired;
                                return (
                                    <div key={lvl.level} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '7px 10px',
                                        borderRadius: 'var(--radius-md)',
                                        background: isCurrentLevel ? `rgba(${lvl.rgb},0.08)` : 'transparent',
                                        border: isCurrentLevel ? `1px solid rgba(${lvl.rgb},0.3)` : '1px solid transparent',
                                    }}>
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: isUnlocked ? lvl.color : 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {isUnlocked
                                                ? <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fff' }}>{lvl.level}</span>
                                                : <Lock size={9} color="var(--color-text-hint)" />
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: isCurrentLevel ? 700 : 500, color: isCurrentLevel ? lvl.color : isUnlocked ? 'var(--color-text-primary)' : 'var(--color-text-hint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {lvl.title}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-hint)', flexShrink: 0 }}>
                                            {lvl.xpRequired.toLocaleString()} XP
                                        </div>
                                        {isCurrentLevel && (
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: lvl.color, flexShrink: 0 }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Audit log */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>
                            Career Log
                        </div>
                        <AuditLog entries={auditLog} />
                    </div>
                </div>
            </div>

            {/* ── Custom Confirm Modal ── */}
            {confirmModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.15s ease',
                }}>
                    <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '28px 32px',
                        maxWidth: 420,
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                        animation: 'slideUp 0.2s ease',
                    }}>
                        {/* Icon */}
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: confirmModal.danger ? 'rgba(239,68,68,0.1)' : 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <AlertTriangle size={20} style={{ color: confirmModal.danger ? 'var(--color-danger)' : 'var(--color-primary)' }} />
                        </div>
                        {/* Title */}
                        <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-primary)', marginBottom: 8 }}>
                            {confirmModal.title}
                        </div>
                        {/* Body */}
                        <p style={{ fontSize: '0.87rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                            {confirmModal.body}
                        </p>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmModal(null)}
                                style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: confirmModal.danger ? 'var(--color-danger)' : 'var(--color-primary)', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                {confirmModal.confirmLabel || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
                @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
                @keyframes ping { 75%,100% { transform:scale(1.4); opacity:0; } }
                @keyframes unlockPop {
                    0%   { opacity:0; transform: scale(0.92) translateY(6px); box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                    60%  { opacity:1; transform: scale(1.02) translateY(-2px); box-shadow: 0 0 0 6px rgba(16,185,129,0.15); }
                    100% { transform: scale(1) translateY(0); box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                }
                .mission-unlock-anim { animation: unlockPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

                /* ── Career Header CSS Variables ── */
                /* Light mode: a distinctive but non-dark surface — subtle blue-tinted off-white */
                :root {
                    --career-header-bg: linear-gradient(135deg, #eef4ff 0%, #f0f5ff 60%, #e8f0fe 100%);
                    --career-header-border: rgba(20,106,255,0.2);
                    --career-text-primary: #111827;
                    --career-text-hint: rgba(17,24,39,0.45);
                    --career-text-muted: rgba(17,24,39,0.3);
                    --career-pill-bg: rgba(20,106,255,0.06);
                    --career-pill-border: rgba(20,106,255,0.12);
                }
                /* Dark mode: the original deep navy */
                [data-theme="dark"] {
                    --career-header-bg: linear-gradient(135deg, #0d151e 0%, #111e2e 60%, #0a1628 100%);
                    --career-header-border: rgba(20,106,255,0.25);
                    --career-text-primary: #f7f7f9;
                    --career-text-hint: rgba(255,255,255,0.5);
                    --career-text-muted: rgba(255,255,255,0.35);
                    --career-pill-bg: rgba(255,255,255,0.04);
                    --career-pill-border: rgba(255,255,255,0.07);
                }
            `}</style>
        </div>
    );
}
