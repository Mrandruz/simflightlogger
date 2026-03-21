import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlusCircle, Search, AlertCircle } from 'lucide-react';
import { findAirport } from '../utils/airportUtils';
import customAirports from '../customAirports';
import airports from 'airport-data';


// Component for mapping aircraft to realistic cruising speeds (in knots)
const AIRCRAFT_SPEED_KTS = {
    'Airbus A319': 450,
    'Airbus A320': 450,
    'Airbus A321': 450,
    'Airbus A330': 470,
    'Airbus A350': 490,
    'Airbus A380': 490,
    'Boeing 777': 490,
    'Boeing 787': 490,
    'Altro': 400
};

const AirportAutocomplete = ({ label, value, name, onChange, placeholder }) => {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const wrapperRef = useRef(null);
    const isValid = query.length === 0 || !!findAirport(query.toUpperCase());

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSearch = (e) => {
        const val = e.target.value.toUpperCase();
        setQuery(val);
        // We still bubble the raw value up so the form state holds it (even if invalid)
        onChange({ target: { name, value: val } });

        if (val.length >= 2) {
            const allAirports = [...customAirports, ...airports];
            const filtered = allAirports.filter(a =>
                a.icao.includes(val) ||
                (a.iata && a.iata.includes(val)) ||
                (a.city && a.city.toUpperCase().includes(val)) ||
                (a.name && a.name.toUpperCase().includes(val))
            ).slice(0, 10); // show top 10
            setResults(filtered);
            setShowDropdown(true);
        } else {
            setResults([]);
            setShowDropdown(false);
        }
    };

    const handleSelect = (airport) => {
        setQuery(airport.icao);
        onChange({ target: { name, value: airport.icao } });
        setShowDropdown(false);
    };

    return (
        <div className="form-group" style={{ flex: 1, minWidth: 0, position: 'relative' }} ref={wrapperRef}>
            <label className="form-label" style={{ 
                whiteSpace: 'nowrap', 
                display: 'flex', 
                justifyContent: 'space-between',
                color: name === 'departure' ? 'var(--color-success)' : 'var(--color-danger)',
                fontWeight: 500,
                letterSpacing: '0.05em',
                fontSize: '0.75rem',
                textTransform: 'uppercase'
            }}>
                {label}
                {query.length > 0 && !isValid && <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }} aria-live="polite"><AlertCircle size={10} aria-hidden="true" /> Invalid</span>}
            </label>
            <div style={{ position: 'relative' }}>
                <input
                    required
                    type="text"
                    name={name}
                    value={query}
                    onChange={handleSearch}
                    onFocus={() => {
                        if (results.length > 0) setShowDropdown(true);
                    }}
                    className="form-input"
                    placeholder={placeholder}
                    style={{
                        textTransform: 'uppercase',
                        borderColor: (query.length > 0 && !isValid) ? 'var(--color-danger)' : undefined,
                        fontSize: '1.25rem',
                        fontWeight: 500,
                        padding: '10px 12px',
                        height: 'auto',
                        letterSpacing: '0.02em',
                        fontFamily: 'var(--font-family-mono)',
                        textAlign: 'center',
                        backgroundColor: 'var(--color-surface-hover)'
                    }}
                />
            </div>

            {showDropdown && results.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxHeight: '200px', overflowY: 'auto'
                }}>
                    {results.map(ap => (
                        <div
                            key={ap.icao}
                            onClick={() => handleSelect(ap)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <div style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{ap.icao} {ap.iata ? `(${ap.iata})` : ''}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ap.name} {ap.city ? `- ${ap.city}` : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function FlightForm({ onAddFlight, initialData, onCancel, flights = [] }) {
    const defaultValues = {
        airline: '',
        alliance: '',
        aircraft: '',
        departure: '',
        arrival: '',
        miles: '',
        flightTime: '',
        date: new Date().toISOString().split('T')[0]
    };
    const [state, setState] = useState({ ...defaultValues, ...initialData });
    const isEditing = !!initialData;

    // Derived airlines from flights for datalist
    const historicalAirlines = useMemo(() => {
        if (!Array.isArray(flights)) return [];
        return [...new Set(flights.map(f => f.airline))].filter(Boolean).sort();
    }, [flights]);

    // Calculate distance and flight time automatically
    useEffect(() => {
        if (state.departure.length >= 3 && state.arrival.length >= 3) { // Autocomplete handles finding it
            const dep = findAirport(state.departure.toUpperCase());
            const arr = findAirport(state.arrival.toUpperCase());

            if (dep && arr) {
                // Haversine formula
                const R = 3440.065; // Radius of earth in nautical miles
                const dLat = (arr.latitude - dep.latitude) * Math.PI / 180;
                const dLon = (arr.longitude - dep.longitude) * Math.PI / 180;
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(dep.latitude * Math.PI / 180) * Math.cos(arr.latitude * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = Math.round(R * c);

                let updates = { miles: distance.toString() };

                // Estimate flight time only if:
                // 1. We have an aircraft selected
                // 2. We are NOT editing an existing flight (has id)
                // 3. initialData does NOT already provide a flightTime (e.g. from SimBrief)
                const hasPrefilledTime = initialData?.flightTime && Number(initialData.flightTime) > 0;
                if (state.aircraft && (!initialData || !initialData.id) && !hasPrefilledTime) {
                    const speed = AIRCRAFT_SPEED_KTS[state.aircraft] || AIRCRAFT_SPEED_KTS['Altro'];
                    // Add 0.5 hours (30 min) for climb/descent/taxi
                    const estimatedHours = (distance / speed) + 0.5;
                    updates.flightTime = (Math.round(estimatedHours * 10) / 10).toString(); // Round to 1 decimal place
                }

                setState(prev => ({ ...prev, ...updates }));
            }
        }
    }, [state.departure, state.arrival, state.aircraft, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setState(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onAddFlight({
            ...state,
            departure: state.departure.toUpperCase(),
            arrival: state.arrival.toUpperCase(),
            id: isEditing ? initialData.id : crypto.randomUUID(),
            date: state.date, // Use the user-selected date
            createdAt: isEditing ? (initialData.createdAt || Date.now()) : Date.now(),
            miles: Number(state.miles),
            flightTime: Number(state.flightTime)
        });

        if (!isEditing) {
            setState({
                airline: '',
                alliance: '',
                aircraft: '',
                departure: '',
                arrival: '',
                miles: '',
                flightTime: '',
                date: new Date().toISOString().split('T')[0] // Reset to today
            });
        }
    };

    return (
        <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <PlusCircle size={28} className="text-primary" aria-hidden="true" />
                <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 500 }}>
                    {isEditing ? 'Edit Flight' : 'New Flight'}
                </h1>
            </div>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label">Flight Date</label>
                        <input required type="date" name="date" value={state.date} onChange={handleChange} className="form-input" />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label">Airline</label>
                        <input required type="text" name="airline" list="airlinesConfig" value={state.airline} onChange={handleChange} className="form-input" placeholder="e.g. Alitalia, Ryanair" />
                        <datalist id="airlinesConfig">
                            {historicalAirlines.map(ap => <option key={ap} value={ap} />)}
                        </datalist>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Aircraft Type</label>
                    <select required name="aircraft" value={state.aircraft} onChange={handleChange} className="form-input">
                        <option value="">Select an aircraft...</option>
                        <option value="Airbus A319">Airbus A319 (Est. 450kts)</option>
                        <option value="Airbus A320">Airbus A320 (Est. 450kts)</option>
                        <option value="Airbus A321">Airbus A321 (Est. 450kts)</option>
                        <option value="Airbus A330">Airbus A330 (Est. 470kts)</option>
                        <option value="Airbus A350">Airbus A350 (Est. 490kts)</option>
                        <option value="Airbus A380">Airbus A380 (Est. 490kts)</option>
                        <option value="Boeing 777">Boeing 777 (Est. 490kts)</option>
                        <option value="Boeing 787">Boeing 787 (Est. 490kts)</option>
                        <option value="Altro">Other (Not listed)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Alliance</label>
                    <select required name="alliance" value={state.alliance} onChange={handleChange} className="form-input">
                        <option value="">Select...</option>
                        <option value="Star Alliance">Star Alliance</option>
                        <option value="SkyTeam">SkyTeam</option>
                        <option value="Oneworld">Oneworld</option>
                        <option value="Nessuna">None/Independent</option>
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                    <AirportAutocomplete
                        label="Departure (ICAO/City)"
                        name="departure"
                        value={state.departure}
                        onChange={handleChange}
                        placeholder="e.g. LIRF or Rome"
                    />
                    <AirportAutocomplete
                        label="Arrival (ICAO/City)"
                        name="arrival"
                        value={state.arrival}
                        onChange={handleChange}
                        placeholder="e.g. LIMC or Milan"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Distance (nm)</label>
                        <input 
                            required 
                            type="number" 
                            min="0" 
                            name="miles" 
                            value={state.miles} 
                            onChange={handleChange} 
                            className="form-input" 
                            placeholder="e.g. 350" 
                            style={{ fontSize: '1.25rem', fontWeight: 500 }}
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Flight Time (h)</label>
                        <input 
                            required 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            name="flightTime" 
                            value={state.flightTime} 
                            onChange={handleChange} 
                            className="form-input" 
                            placeholder="e.g. 1.5" 
                            style={{ fontSize: '1.25rem', fontWeight: 500 }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {isEditing && (
                        <button type="button" onClick={onCancel} className="btn" style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                            Cancel
                        </button>
                    )}
                    <button type="submit" className="btn btn-primary" style={{ flex: isEditing ? 1 : 'none', width: isEditing ? 'auto' : '100%' }}>
                        {isEditing ? 'Update Flight' : 'Log Flight'}
                    </button>
                </div>
            </form>
        </div>
    );
}
