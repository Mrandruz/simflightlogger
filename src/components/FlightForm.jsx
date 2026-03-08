import React, { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import airports from 'airport-data';
import customAirports from '../customAirports';

const findAirport = (icao) => {
    return airports.find(a => a.icao === icao) || customAirports.find(a => a.icao === icao);
};

export default function FlightForm({ onAddFlight, initialData, onCancel }) {
    const formData = initialData || {
        airline: '',
        alliance: '',
        aircraft: '',
        departure: '',
        arrival: '',
        miles: '',
        flightTime: '',
        date: new Date().toISOString().split('T')[0] // Default to today
    };
    const [state, setState] = useState(formData);
    const isEditing = !!initialData;

    // Calculate distance automatically
    useEffect(() => {
        if (state.departure.length === 4 && state.arrival.length === 4) {
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

                setState(prev => ({ ...prev, miles: distance.toString() }));
            }
        }
    }, [state.departure, state.arrival]);

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
            <h2 className="card-title">
                <PlusCircle size={20} className="text-primary" />
                {isEditing ? 'Edit Flight' : 'New Flight'}
            </h2>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label">Flight Date</label>
                        <input required type="date" name="date" value={state.date} onChange={handleChange} className="form-input" />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label">Airline</label>
                        <input required type="text" name="airline" value={state.airline} onChange={handleChange} className="form-input" placeholder="e.g. Alitalia, Ryanair" />
                    </div>
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

                <div className="form-group">
                    <label className="form-label">Aircraft Type</label>
                    <select required name="aircraft" value={state.aircraft} onChange={handleChange} className="form-input">
                        <option value="">Select an aircraft...</option>
                        <option value="Airbus A319">Airbus A319</option>
                        <option value="Airbus A320">Airbus A320</option>
                        <option value="Airbus A321">Airbus A321</option>
                        <option value="Airbus A330">Airbus A330</option>
                        <option value="Airbus A350">Airbus A350</option>
                        <option value="Airbus A380">Airbus A380</option>
                        <option value="Boeing 777">Boeing 777</option>
                        <option value="Boeing 787">Boeing 787</option>
                        <option value="Altro">Other (Not listed)</option>
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Departure (ICAO)</label>
                        <input required type="text" name="departure" value={state.departure} onChange={handleChange} className="form-input" placeholder="LIRF" maxLength={4} style={{ textTransform: 'uppercase' }} />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Arrival (ICAO)</label>
                        <input required type="text" name="arrival" value={state.arrival} onChange={handleChange} className="form-input" placeholder="LIMC" maxLength={4} style={{ textTransform: 'uppercase' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Distance (nm)</label>
                        <input required type="number" min="0" name="miles" value={state.miles} onChange={handleChange} className="form-input" placeholder="e.g. 350" />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                        <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Flight Time (hours)</label>
                        <input required type="number" min="0" step="0.01" name="flightTime" value={state.flightTime} onChange={handleChange} className="form-input" placeholder="e.g. 1.5" />
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
