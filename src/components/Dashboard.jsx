import React, { useMemo } from 'react';
import { Plane, MapPin, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area } from 'recharts';

export default function Dashboard({ flights }) {

    const kpis = useMemo(() => {
        return {
            totalFlights: flights.length,
            totalMiles: flights.reduce((sum, f) => sum + (f.miles || 0), 0),
            totalHours: flights.reduce((sum, f) => sum + (f.flightTime || 0), 0).toFixed(1)
        };
    }, [flights]);

    const aircraftStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.aircraft) counts[f.aircraft] = (counts[f.aircraft] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [flights]);

    const airportStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.departure) counts[f.departure] = (counts[f.departure] || 0) + 1;
            if (f.arrival) counts[f.arrival] = (counts[f.arrival] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    }, [flights]);

    const airlineStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.airline) counts[f.airline] = (counts[f.airline] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [flights]);

    const allianceStats = useMemo(() => {
        const counts = {};
        flights.forEach(f => {
            if (f.alliance) counts[f.alliance] = (counts[f.alliance] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [flights]);

    const timelineStats = useMemo(() => {
        const grouped = {};
        flights.forEach(f => {
            if (f.date) {
                const dateKey = f.date.substring(0, 7);
                if (!grouped[dateKey]) {
                    grouped[dateKey] = { dateStr: dateKey, flights: 0 };
                }
                grouped[dateKey].flights += 1;
            }
        });
        const sortedArray = Object.values(grouped).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        return sortedArray.map(item => {
            const [year, month] = item.dateStr.split('-');
            const dateObj = new Date(year, parseInt(month) - 1, 1);
            return {
                ...item,
                displayDate: dateObj.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
            };
        });
    }, [flights]);

    const colors = ['#1ed760', '#00ab6c', '#24CC9A', '#7bdcb5', '#C1DBBD', '#00d084'];
    const pieColors = ['#1ed760', '#7bdcb5', '#00ab6c', '#C1DBBD', '#24CC9A'];

    if (flights.length === 0) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--color-text-secondary)' }}>
                <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-4)' }} />
                <h3 style={{ margin: 0 }}>No flights recorded</h3>
                <p>Add your first flight in the "New Flight" section.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* KPIs */}
            <div className="kpi-grid">
                <div className="card kpi-card">
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(20,106,255,0.08) 0%, transparent 70%)', borderRadius: '50%', transform: 'translate(30%, -30%)', zIndex: 0 }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1, position: 'relative' }}>
                        <span className="kpi-label">Total Flights</span>
                        <div style={{ padding: '10px', backgroundColor: 'var(--color-primary-light)', borderRadius: '50%', color: 'var(--color-primary)', display: 'flex' }}><Plane size={24} /></div>
                    </div>
                    <span className="kpi-value" style={{ zIndex: 1, position: 'relative' }}>{kpis.totalFlights}</span>
                </div>

                <div className="card kpi-card">
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(60,196,125,0.08) 0%, transparent 70%)', borderRadius: '50%', transform: 'translate(30%, -30%)', zIndex: 0 }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1, position: 'relative' }}>
                        <span className="kpi-label">Total Miles</span>
                        <div style={{ padding: '10px', backgroundColor: 'var(--color-success-bg)', borderRadius: '50%', color: 'var(--color-success)', display: 'flex' }}><MapPin size={24} /></div>
                    </div>
                    <span className="kpi-value text-success" style={{ zIndex: 1, position: 'relative' }}>{kpis.totalMiles.toLocaleString()}</span>
                </div>

                <div className="card kpi-card">
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(234,135,93,0.08) 0%, transparent 70%)', borderRadius: '50%', transform: 'translate(30%, -30%)', zIndex: 0 }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1, position: 'relative' }}>
                        <span className="kpi-label">Flight Hours</span>
                        <div style={{ padding: '10px', backgroundColor: 'var(--color-warning-bg)', borderRadius: '50%', color: 'var(--color-warning)', display: 'flex' }}><Clock size={24} /></div>
                    </div>
                    <span className="kpi-value text-warning" style={{ zIndex: 1, position: 'relative', color: 'var(--color-warning)' }}>{kpis.totalHours}</span>
                </div>
            </div>

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
                <div className="card">
                    <h3 className="card-title">Top Airlines</h3>
                    <div style={{ height: 250 }}>
                        {airlineStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={airlineStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} width={100} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Bar dataKey="count" name="Flights" radius={[0, 4, 4, 0]} barSize={24}>
                                        {airlineStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">Top Alliances</h3>
                    <div style={{ height: 250 }}>
                        {allianceStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                                    <Pie data={allianceStats} nameKey="name" dataKey="value" name="Flights" cx="50%" cy="45%" innerRadius={50} outerRadius={70} paddingAngle={2}>
                                        {allianceStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">Top Aircraft</h3>
                    <div style={{ height: 250 }}>
                        {aircraftStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={aircraftStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} width={80} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Bar dataKey="count" name="Flights" radius={[0, 4, 4, 0]} barSize={24}>
                                        {aircraftStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">Top Airports</h3>
                    <div style={{ height: 250 }}>
                        {airportStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={airportStats.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} width={60} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                    <Bar dataKey="count" name="Flights" radius={[0, 4, 4, 0]} barSize={20}>
                                        {airportStats.slice(0, 5).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[(index + 2) % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p>Insufficient data</p>}
                    </div>
                </div>
            </div>

            {/* Timeline AreaChart */}
            <div className="card">
                <h3 className="card-title">Monthly Flight History</h3>
                <div style={{ height: 200 }}>
                    {timelineStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineStats} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorFlights" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-primary)', fontSize: 13 }} allowDecimals={false} />
                                <RechartsTooltip cursor={{ stroke: 'var(--color-divider)', strokeWidth: 2 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }} itemStyle={{ color: 'var(--color-text-primary)' }} />
                                <Area type="monotone" dataKey="flights" name="Flights" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorFlights)" activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-primary)' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-hint)' }}>
                            Add flights to see your progress over time
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
