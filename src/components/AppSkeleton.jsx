import React from 'react';

export default function AppSkeleton({ isDarkMode }) {
    return (
        <div 
            className={`app-container ${isDarkMode ? 'dark' : ''}`} 
            style={{ backgroundColor: 'var(--color-background)' }}
            aria-busy="true"
            aria-live="polite"
            aria-label="Loading application content..."
        >
            {/* Sidebar Skeleton */}
            <aside className="sidebar" style={{ backgroundColor: 'var(--color-surface)' }}>
                <div style={{ padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)' }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: '100%', alignItems: 'center' }}>
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="skeleton" style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)' }}></div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Main Wrapper Skeleton */}
            <div className="main-wrapper">
                {/* Header Skeleton */}
                <header style={{ 
                    height: '64px', 
                    padding: '0 var(--space-6)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)' 
                }}>
                    <div className="skeleton" style={{ width: '150px', height: '24px' }}></div>
                </header>

                <main className="main-content">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                        {/* Pilot Profile Card Skeleton */}
                        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <div className="skeleton" style={{ width: '64px', height: '64px', borderRadius: '50%' }}></div>
                            <div style={{ flex: 1 }}>
                                <div className="skeleton" style={{ width: '40%', height: '20px', marginBottom: '8px' }}></div>
                                <div className="skeleton" style={{ width: '20%', height: '14px' }}></div>
                            </div>
                        </div>

                        {/* KPI Grid Skeleton */}
                        <div className="kpi-grid">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="card kpi-card">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div className="skeleton" style={{ width: '80px', height: '16px' }}></div>
                                        <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <div className="skeleton" style={{ width: '100px', height: '48px', margin: 'var(--space-2) 0' }}></div>
                                        <div className="skeleton" style={{ width: '60%', height: '14px' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Content Area Skeleton */}
                        <div className="card" style={{ height: '300px' }}>
                            <div className="skeleton" style={{ width: '30%', height: '24px', marginBottom: 'var(--space-6)' }}></div>
                            <div className="skeleton" style={{ width: '100%', height: '180px' }}></div>
                        </div>
                    </div>
                </main>

                {/* Status Bar Skeleton */}
                <div className="status-bar" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <div className="skeleton" style={{ width: '100px', height: '12px' }}></div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                        <div className="skeleton" style={{ width: '60px', height: '12px' }}></div>
                        <div className="skeleton" style={{ width: '60px', height: '12px' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
