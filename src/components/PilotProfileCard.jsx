import React from 'react';
import { Award, Star, Shield, Medal, MapPin, Clock, Plane as PlaneIcon, Fuel, Globe, Trophy, Flame } from 'lucide-react';
import { usePilotData } from '../hooks/usePilotData';

const RankIcon = ({ rankName }) => {
    switch (rankName) {
        case 'Cadet': return <Star size={24} className="text-secondary" aria-hidden="true" />;
        case 'Junior F.O.': return <Medal size={24} className="text-primary" aria-hidden="true" />;
        case 'First Officer': return <Award size={24} className="text-primary" aria-hidden="true" />;
        case 'Captain': return <Shield size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} aria-hidden="true" />;
        case 'Senior Captain': return <Shield size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} aria-hidden="true" />;
        case 'Chief Captain': return <Award size={24} className="text-warning" style={{ fill: 'var(--color-warning)' }} aria-hidden="true" />;
        default: return <Star size={24} aria-hidden="true" />;
    }
};

const AchievementBadge = ({ title, description, icon: Icon, data }) => {
    const { current, goal, extraInfo } = data;
    let progress = data.progress;
    if (progress > 100) progress = 100;
    const isCompleted = progress >= 100;

    return (
        <div className={`achievement-card ${isCompleted ? 'completed' : ''}`}>
            <div className="achievement-tooltip">
                <div style={{ fontSize: '0.75rem', lineHeight: '1.3', fontFamily: 'var(--font-family-display)' }}>{description}</div>
                {extraInfo && !isCompleted && (
                    <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#60a5fa', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                        {extraInfo}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, textAlign: 'center' }}>
                <div className="achievement-icon-wrapper">
                    <Icon size={16} />
                </div>
                <div style={{ width: '100%', zIndex: 1 }}>
                    <div className="achievement-title" style={{ fontFamily: 'var(--font-family-display)', fontWeight: 500 }}>{title}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 500, fontFamily: 'var(--font-family-sans)' }}>
                        {isCompleted ? <span style={{ color: 'var(--color-success)', fontWeight: 500, fontFamily: 'var(--font-family-display)' }}>Unlocked!</span> : `${current} / ${goal}`}
                    </div>
                </div>
            </div>

            <div className="achievement-progress-bg" style={{ zIndex: 1 }}>
                <div className="achievement-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    );
};

export default function PilotProfileCard({ flights, user }) {
    const stats = usePilotData(flights);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Good morning';
        if (hour >= 12 && hour < 18) return 'Good afternoon';
        if (hour >= 18 || hour < 5) return 'Good evening';
        return 'Hello';
    };

    return (
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', backgroundImage: 'linear-gradient(to right, var(--color-surface), rgba(26, 115, 232, 0.05))', border: '1px solid var(--color-primary-light)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'stretch' }}>

                {/* Ranking Section */}
                <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <img
                            src={user?.photoURL || (user?.email?.toLowerCase() === 'and977@gmail.com' ? "/avatar.jpg" : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || "User")}&background=1a73e8&color=fff&size=80`)}
                            alt={user?.displayName || "Pilot"}
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary-light)', boxShadow: 'var(--shadow-sm)' }}
                            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || "User")}&background=1a73e8&color=fff&size=80` }}
                        />
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                                {getGreeting()} {user?.displayName?.split(' ')[0] || "Pilot"}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                                    <RankIcon rankName={stats.currentRank.name} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-family-display)', color: 'var(--color-primary)' }}>
                                    {stats.currentRank.name}
                                </h2>
                            </div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                                <span className="data-mono" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{stats.totalXp.toLocaleString()}</span> XP &bull; <span className="data-mono">{stats.totalHours.toFixed(1)}</span> h
                                {stats.activeBonuses?.map(b => (
                                    <span key={b.label} style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 500, color: b.color, backgroundColor: b.bg, padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: `1px solid ${b.color}30` }}>
                                        <Flame size={12} /> {b.label} Active
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>XP Progression</span>
                            <span style={{ fontWeight: 500 }} className="data-mono">{Math.round(stats.progress)}%</span>
                        </div>

                        {/* Progress Bar background */}
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-divider)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            {/* Progress Fill */}
                            <div style={{
                                height: '100%',
                                backgroundColor: 'var(--color-primary)',
                                width: `${stats.progress}%`,
                                transition: 'width 1s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                borderRadius: 'var(--radius-full)'
                            }}></div>
                        </div>

                        <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--color-text-hint)', textAlign: 'right' }}>
                            {stats.nextRank
                                ? `${stats.xpRemaining.toLocaleString()} XP remaining to ${stats.nextRank.name}`
                                : 'You have reached the maximum rank!'}
                        </div>

                        {/* Streak bonus expiration notice */}
                        {stats.activeBonuses?.filter(b => b.description.includes('expires')).map(b => (
                            <div key={b.label} style={{ marginTop: '6px', padding: '5px 10px', borderRadius: '8px', background: b.bg, border: `1px solid ${b.color}50`, fontSize: '0.7rem', color: b.color, display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
                                <Flame size={11} /> {b.label} bonus active — {b.description}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', backgroundColor: 'var(--color-divider)', margin: 'var(--space-2) 0' }} className="hide-on-mobile"></div>

                {/* Extra Stats Section - 2 columns */}
                <div style={{ flex: '1 1 400px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', alignContent: 'center' }}>

                    {/* Column 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {/* Hub Preferito */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: 'var(--color-success)', backgroundColor: 'var(--color-success-bg)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <MapPin size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Favorite Hub</div>
                                <div style={{ fontWeight: 500 }} className="data-mono">{stats.favoriteAirport}</div>
                            </div>
                        </div>

                        {/* Latest Flight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <PlaneIcon size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Latest Flight</div>
                                <div style={{ fontWeight: 500 }} className="data-mono">
                                    {stats.latestFlight
                                        ? <>{stats.latestFlight.departure}→{stats.latestFlight.arrival} <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400, fontFamily: 'var(--font-family-sans)' }}>({new Date(stats.latestFlight.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</span></>
                                        : 'None'
                                    }
                                </div>
                            </div>
                        </div>

                        {/* Longest Flight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <Trophy size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Longest Flight</div>
                                <div style={{ fontWeight: 500 }} className="data-mono">
                                    {stats.longestFlight.miles > 0
                                        ? <>{stats.longestFlight.miles.toLocaleString()} nm <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', fontWeight: 400, fontFamily: 'var(--font-family-sans)' }}>({stats.longestFlight.departure}→{stats.longestFlight.arrival})</span></>
                                        : 'N/A'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {/* Avg Hours / Flight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <Clock size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Hours / Flight</div>
                                <div style={{ fontWeight: 500 }} className="data-mono">{stats.avgTime} h</div>
                            </div>
                        </div>

                        {/* Avg Distance / Flight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <PlaneIcon size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Distance / Flight</div>
                                <div style={{ fontWeight: 500 }} className="data-mono">{stats.avgMiles} nm</div>
                            </div>
                        </div>

                        {/* Estimated Fuel */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: '#e8710a', backgroundColor: 'rgba(232, 113, 10, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <Fuel size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Estimated Fuel</div>
                                <div style={{ fontWeight: 500 }} className="data-mono">{stats.totalFuel.toLocaleString()} kg</div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
