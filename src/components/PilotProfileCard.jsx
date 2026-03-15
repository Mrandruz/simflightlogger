import React from 'react';
import { Award, Star, Shield, Medal, MapPin, Clock, Plane as PlaneIcon, Fuel, Globe, Trophy, Users, Zap, CalendarDays, ChevronRight, Flame } from 'lucide-react';
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
                <div style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>{description}</div>
                {extraInfo && !isCompleted && (
                    <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {extraInfo}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, textAlign: 'center' }}>
                <div className="achievement-icon-wrapper">
                    <Icon size={16} />
                </div>
                <div style={{ width: '100%', zIndex: 1 }}>
                    <div className="achievement-title">{title}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                        {isCompleted ? <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>UNLOCKED!</span> : `${current} / ${goal}`}
                    </div>
                </div>
            </div>

            <div className="achievement-progress-bg" style={{ zIndex: 1 }}>
                <div className="achievement-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    );
};

export default function PilotProfileCard({ flights }) {
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
                            src="/avatar.jpg"
                            alt="Andrea"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary-light)', boxShadow: 'var(--shadow-sm)' }}
                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Andrea&background=1a73e8&color=fff&size=80' }}
                        />
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                                {getGreeting()} Andrea
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
                                <span className="data-mono" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{stats.totalXp.toLocaleString()}</span> XP &bull; <span className="data-mono">{stats.totalHours.toFixed(1)}</span> h
                                {stats.isMasterBonusActive ? (
                                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600, color: '#ff6b35', backgroundColor: 'rgba(255, 107, 53, 0.15)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(255, 107, 53, 0.3)' }}>
                                        <Flame size={12} />
                                        10x XP Active
                                    </span>
                                ) : stats.achievements.dailyStreak.unlocked && (
                                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                                        2x XP Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>XP Progression</span>
                            <span style={{ fontWeight: 600 }} className="data-mono">{Math.round(stats.progress)}%</span>
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
                        {stats.isMasterBonusActive ? (() => {
                            const expiryDate = new Date(stats.activeBonusExpiryMs);
                            const expiryStr = expiryDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                            return (
                                <div style={{
                                    marginTop: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,107,53,0.1)',
                                    border: '1px solid rgba(255,107,53,0.3)',
                                    fontSize: '0.7rem',
                                    color: '#ff6b35',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontWeight: 500
                                }}>
                                    <Flame size={11} />
                                    10x XP achievement bonus active — expires {expiryStr} (end of day)
                                </div>
                            );
                        })() : null}
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
                                <div style={{ fontWeight: 600 }} className="data-mono">{stats.favoriteAirport}</div>
                            </div>
                        </div>

                        {/* Latest Flight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <PlaneIcon size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Latest Flight</div>
                                <div style={{ fontWeight: 600 }} className="data-mono">
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
                                <div style={{ fontWeight: 600 }} className="data-mono">
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
                                <div style={{ fontWeight: 600 }} className="data-mono">{stats.avgTime} h</div>
                            </div>
                        </div>

                        {/* Avg Distance / Flight */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: 'var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <PlaneIcon size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Avg Distance / Flight</div>
                                <div style={{ fontWeight: 600 }} className="data-mono">{stats.avgMiles} nm</div>
                            </div>
                        </div>

                        {/* Estimated Fuel */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ color: '#e8710a', backgroundColor: 'rgba(232, 113, 10, 0.1)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                                <Fuel size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Estimated Fuel</div>
                                <div style={{ fontWeight: 600 }} className="data-mono">{stats.totalFuel.toLocaleString()} kg</div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Achievements Section */}
                <div style={{
                    flex: '1 1 100%',
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-4)',
                    borderRadius: '14px',
                    background: 'linear-gradient(145deg, rgba(20, 106, 255, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
                    position: 'relative'
                }}>
                    {/* Decorative background element */}
                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(20, 106, 255, 0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'stretch', position: 'relative', zIndex: 1 }}>
                        <div className="achievement-card" style={{
                            flex: '0 0 65px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            background: 'rgba(20, 106, 255, 0.08)',
                            border: '1px solid rgba(20, 106, 255, 0.2)',
                            padding: 'var(--space-3) 0',
                            borderRadius: '12px'
                        }}>
                            <div className="achievement-icon-wrapper" style={{
                                background: 'linear-gradient(135deg, var(--color-primary), #00d2ff)',
                                color: 'white',
                                boxShadow: '0 4px 10px rgba(20, 106, 255, 0.3)'
                            }}>
                                <Trophy size={18} />
                            </div>
                            <ChevronRight size={18} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
                        </div>

                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>

                            <AchievementBadge
                                title="World Traveler"
                                description="Visit 100 different countries"
                                icon={Globe}
                                data={stats.achievements.worldTraveler}
                            />
                            <AchievementBadge
                                title="Long Haul Ace"
                                description="Complete 120 flights over 5000nm"
                                icon={PlaneIcon}
                                data={stats.achievements.longHaulAce}
                            />
                            <AchievementBadge
                                title="Airline Loyal"
                                description="Fly 70 times total with the same airline"
                                icon={Users}
                                data={stats.achievements.airlineLoyal}
                            />
                            <AchievementBadge
                                title="Tireless"
                                description="Complete 3 flights in a single day"
                                icon={Zap}
                                data={stats.achievements.tireless}
                            />
                            <AchievementBadge
                                title="Type Rating Master"
                                description="Fly 120 times with the same aircraft type"
                                icon={Award}
                                data={stats.achievements.typeRatingMaster}
                            />
                            <AchievementBadge
                                title="7-Day Streak"
                                description="Log at least one flight per day for 7 consecutive days"
                                icon={CalendarDays}
                                data={stats.achievements.dailyStreak}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
