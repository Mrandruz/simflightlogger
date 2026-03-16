import React from 'react';
import { Plane } from 'lucide-react';

const getStatFontSize = (value) => {
    const len = value.toString().replace(/[^0-9]/g, '').length;
    if (len <= 3) return 'clamp(2rem, 16cqw, 2.6rem)';
    if (len <= 5) return 'clamp(1.7rem, 14cqw, 2.3rem)';
    return 'clamp(1.4rem, 12cqw, 2rem)';
};

export default function LogbookStats({ stats, filterLabel, narrative }) {
    return (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--space-6)', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-primary)', marginBottom: '8px', fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-family-display)', flexWrap: 'wrap', lineHeight: 1.2 }}>
                <Plane size={24} style={{ color: 'var(--color-primary)' }} /> Operational Statistics
            </div>
            
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', fontWeight: 500, marginBottom: '2px' }}>
                    {filterLabel === 'Global' ? (
                        <>Showing&nbsp;&nbsp;<span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>all flights</span></>
                    ) : (
                        <>Filtered by&nbsp;&nbsp;<span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{filterLabel}</span></>
                    )}
                </div>
                {narrative && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, opacity: 0.9, fontFamily: 'var(--font-family-display)' }}>
                        {narrative}
                    </div>
                )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {[
                    { label: 'Total Flights', value: stats.total, color: 'var(--color-text-primary)' },
                    { label: 'Total Hours', value: stats.hours, color: 'var(--color-text-primary)' },
                    { label: 'Nautical Miles', value: stats.miles.toLocaleString(), color: 'var(--color-text-primary)' },
                    { label: 'Experience (XP)', value: stats.xp.toLocaleString(), color: 'var(--color-primary)' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'rgba(100,100,100,0.05)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        containerType: 'inline-size'
                    }}>
                        <div style={{
                            fontSize: '0.65rem',
                            color: 'var(--color-text-hint)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                        }}>
                            {label}
                        </div>
                        <div style={{
                            fontSize: getStatFontSize(value),
                            fontWeight: 800,
                            color: color,
                            lineHeight: 1.2
                        }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>
            
            <div style={{
                marginTop: 'var(--space-6)',
                padding: 'var(--space-4)',
                backgroundColor: 'rgba(20, 106, 255, 0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '10px',
                    opacity: 0.08,
                    color: 'var(--color-primary)',
                    pointerEvents: 'none'
                }}>
                    <Plane size={40} />
                </div>
                <div style={{
                    fontSize: '0.9rem',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    position: 'relative',
                    zIndex: 1,
                    textAlign: 'center'
                }}>
                    <div>"Your wings already exist.</div>
                    <div>All you have to do is fly."</div>
                </div>
            </div>
        </div>
    );
}
