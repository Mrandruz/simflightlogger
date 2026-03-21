import React, { useState } from 'react';
import { Trophy, Globe, Plane, Users, Zap, Award, CalendarDays, MapPin, Lock, CheckCircle, Flame, ChevronRight } from 'lucide-react';
import { usePilotData } from '../hooks/usePilotData';

/* ── Achievement definitions ── */
const ACHIEVEMENT_DEFS = [
    {
        key: 'worldTraveler',
        title: 'World Traveler',
        description: 'Visit 100 different countries across your logbook.',
        flavor: 'The world is your runway. Every country is a new chapter.',
        icon: Globe,
        color: '#10b981',
        rgb: '16,185,129',
        category: 'Exploration',
    },
    {
        key: 'longHaulAce',
        title: 'Long Haul Ace',
        description: 'Complete 120 flights over 5,000 nm.',
        flavor: 'Mastery of the long sectors — where true endurance is proven.',
        icon: Plane,
        color: '#3b82f6',
        rgb: '59,130,246',
        category: 'Endurance',
    },
    {
        key: 'airlineLoyal',
        title: 'Airline Loyal',
        description: 'Fly 70 times with the same airline.',
        flavor: 'Loyalty is earned flight by flight, route by route.',
        icon: Users,
        color: '#8b5cf6',
        rgb: '139,92,246',
        category: 'Dedication',
    },
    {
        key: 'tireless',
        title: 'Tireless',
        description: 'Log 3 flights in a single day.',
        flavor: 'Some pilots never stop. You are one of them.',
        icon: Zap,
        color: '#f59e0b',
        rgb: '245,158,11',
        category: 'Intensity',
    },
    {
        key: 'typeRatingMaster',
        title: 'Type Rating Master',
        description: 'Fly 120 times with the same aircraft type.',
        flavor: 'One aircraft, thousands of hours. You know it by heart.',
        icon: Award,
        color: '#ef4444',
        rgb: '239,68,68',
        category: 'Mastery',
    },
    {
        key: 'dailyStreak',
        title: '7-Day Streak',
        description: 'Log at least one flight per day for 7 consecutive days.',
        flavor: 'Consistency builds legends. Seven days in a row.',
        icon: CalendarDays,
        color: '#06b6d4',
        rgb: '6,182,212',
        category: 'Consistency',
    },
    {
        key: 'newDiscovery',
        title: 'New Discovery',
        description: 'Discover 50 new destinations never visited before.',
        flavor: 'Every unfamiliar runway is an adventure waiting to happen.',
        icon: MapPin,
        color: '#f97316',
        rgb: '249,115,22',
        category: 'Discovery',
    },
];

function AchievementCard({ def, data, isSelected, onClick }) {
    const { icon: Icon, color, rgb, title, description, flavor, category } = def;
    const { unlocked, progress, current, goal, extraInfo } = data;
    const pct = Math.min(100, Math.round(progress));

    return (
        <div
            onClick={onClick}
            style={{
                position: 'relative',
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-lg)',
                border: isSelected
                    ? `1.5px solid ${color}`
                    : unlocked
                        ? `1.5px solid rgba(${rgb}, 0.35)`
                        : '1.5px solid var(--color-border)',
                background: unlocked
                    ? `linear-gradient(135deg, rgba(${rgb}, 0.07) 0%, var(--color-surface) 100%)`
                    : 'var(--color-surface)',
                cursor: 'pointer',
                transition: 'all .2s',
                boxShadow: isSelected ? `0 0 0 1px ${color}, 0 4px 20px rgba(${rgb},.15)` : 'none',
                animation: 'cardFadeIn .35s ease-out both',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = color; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = unlocked ? `rgba(${rgb}, 0.35)` : 'var(--color-border)'; }}
        >
            {/* Category pill */}
            <div style={{ position: 'absolute', top: 14, right: 14, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: `rgba(${rgb},.1)`, color }}>
                {category}
            </div>

            {/* Icon */}
            <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: unlocked ? `linear-gradient(135deg, ${color}, rgba(${rgb},.6))` : 'var(--color-surface-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--space-3)',
                boxShadow: unlocked ? `0 4px 14px rgba(${rgb},.35)` : 'none',
                transition: 'all .2s',
            }}>
                {unlocked
                    ? <Icon size={22} color="#fff" />
                    : <Lock size={18} color="var(--color-text-hint)" />
                }
            </div>

            {/* Title */}
            <div style={{ fontWeight: 700, fontSize: '0.92rem', fontFamily: 'var(--font-family-display)', color: unlocked ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', marginBottom: 4 }}>
                {title}
            </div>

            {/* Status */}
            {unlocked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 700, color, marginBottom: 'var(--space-3)' }}>
                    <CheckCircle size={12} /> Unlocked
                </div>
            ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-hint)', marginBottom: 'var(--space-3)' }}>
                    {current} / {goal}
                </div>
            )}

            {/* Progress bar */}
            <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${pct}%`,
                    background: unlocked ? `linear-gradient(90deg, ${color}, rgba(${rgb},.7))` : `rgba(${rgb},.5)`,
                    transition: 'width .8s cubic-bezier(.25,.8,.25,1)',
                }} />
            </div>

            {/* Chevron */}
            <ChevronRight size={14} style={{ position: 'absolute', bottom: 14, right: 14, color: 'var(--color-text-hint)', opacity: isSelected ? 0 : 1, transition: 'opacity .15s' }} />
        </div>
    );
}

function AchievementDetail({ def, data }) {
    const { icon: Icon, color, rgb, title, description, flavor, category } = def;
    const { unlocked, progress, current, goal, extraInfo } = data;
    const pct = Math.min(100, Math.round(progress));

    return (
        <div style={{
            position: 'sticky', top: 'var(--space-4)',
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            border: `1.5px solid ${unlocked ? color : 'var(--color-border)'}`,
            background: unlocked
                ? `linear-gradient(145deg, rgba(${rgb},.09) 0%, var(--color-surface) 60%)`
                : 'var(--color-surface)',
            boxShadow: unlocked ? `0 8px 32px rgba(${rgb},.12)` : 'none',
            animation: 'fadeSlideUp .25s ease-out',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                    background: unlocked ? `linear-gradient(135deg, ${color}, rgba(${rgb},.5))` : 'var(--color-surface-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: unlocked ? `0 6px 20px rgba(${rgb},.3)` : 'none',
                }}>
                    {unlocked ? <Icon size={30} color="#fff" /> : <Lock size={26} color="var(--color-text-hint)" />}
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color, marginBottom: 4 }}>{category}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', fontFamily: 'var(--font-family-display)', color: 'var(--color-text-primary)', lineHeight: 1.1 }}>{title}</div>
                    {unlocked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: '0.75rem', fontWeight: 700, color }}>
                            <CheckCircle size={13} /> Achievement Unlocked
                        </div>
                    )}
                </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: `linear-gradient(90deg, rgba(${rgb},.3), transparent)`, marginBottom: 'var(--space-5)' }} />

            {/* Description */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)', marginBottom: 8 }}>Objective</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{description}</div>
            </div>

            {/* Flavor */}
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: `rgba(${rgb},.06)`, borderLeft: `3px solid ${color}`, marginBottom: 'var(--space-5)' }}>
                <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>"{flavor}"</div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)' }}>Progress</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color }}>{pct}%</div>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}, rgba(${rgb},.6))`,
                        transition: 'width 1s cubic-bezier(.25,.8,.25,1)',
                        boxShadow: unlocked ? `0 0 8px rgba(${rgb},.5)` : 'none',
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', color: 'var(--color-text-hint)' }}>
                    <span>{current.toLocaleString()} achieved</span>
                    <span>Goal: {goal.toLocaleString()}</span>
                </div>
            </div>

            {/* Extra info */}
            {extraInfo && (
                <div style={{ marginTop: 'var(--space-3)', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-background)', border: '1px solid var(--color-border)', fontSize: '0.75rem', color, fontWeight: 600 }}>
                    {extraInfo}
                </div>
            )}
        </div>
    );
}

export default function Achievements({ flights }) {
    const stats = usePilotData(flights);
    const [selected, setSelected] = useState('worldTraveler');

    const selectedDef  = ACHIEVEMENT_DEFS.find(d => d.key === selected);
    const selectedData = stats.achievements[selected];

    const unlocked = ACHIEVEMENT_DEFS.filter(d => stats.achievements[d.key]?.unlocked);
    const locked   = ACHIEVEMENT_DEFS.filter(d => !stats.achievements[d.key]?.unlocked);

    return (
        <div style={{ animation: 'fadeIn .4s ease-out' }}>
            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Trophy className="title-icon" /> Achievements
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {unlocked.length} of {ACHIEVEMENT_DEFS.length} unlocked
                        {stats.activeBonuses?.map(b => (
                            <span key={b.label} style={{ fontSize: '0.75rem', fontWeight: 600, color: b.color, backgroundColor: b.bg, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${b.color}30` }}>
                                <Flame size={11} /> {b.label} — {b.description}
                            </span>
                        ))}
                    </p>
                </div>

                {/* Summary pills */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Unlocked', value: unlocked.length, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                        { label: 'In Progress', value: locked.length, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                        { label: 'Total XP', value: stats.totalXp.toLocaleString(), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
                    ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: bg, border: `1px solid ${color}20` }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--color-text-hint)' }}>{label}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color, fontFamily: 'var(--font-family-display)' }}>{value}</div>
                        </div>
                    ))}
                </div>
            </header>

            {/* Body — 2 col */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,0.6fr)', gap: 'var(--space-6)', alignItems: 'start' }}>

                {/* Left: grid of cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

                    {/* Unlocked */}
                    {unlocked.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                                <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)' }}>Unlocked ({unlocked.length})</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                                {unlocked.map((def, i) => (
                                    <div key={def.key} style={{ animationDelay: `${i * 60}ms` }}>
                                        <AchievementCard
                                            def={def}
                                            data={stats.achievements[def.key]}
                                            isSelected={selected === def.key}
                                            onClick={() => setSelected(def.key)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Locked */}
                    {locked.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                                <Lock size={14} style={{ color: 'var(--color-text-hint)' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-hint)' }}>In Progress ({locked.length})</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                                {locked.map((def, i) => (
                                    <div key={def.key} style={{ animationDelay: `${(unlocked.length + i) * 60}ms` }}>
                                        <AchievementCard
                                            def={def}
                                            data={stats.achievements[def.key]}
                                            isSelected={selected === def.key}
                                            onClick={() => setSelected(def.key)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: detail panel */}
                {selectedDef && selectedData && (
                    <AchievementDetail def={selectedDef} data={selectedData} />
                )}
            </div>

            <style>{`
                @keyframes cardFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
                @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                @media (max-width: 900px) {
                    .achievements-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}
