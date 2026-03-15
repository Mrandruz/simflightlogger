import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import FlightForm from './FlightForm';
import { useToast } from '../context/ToastContext';

export default function NewFlight({ onAddFlight, flights }) {
    const location = useLocation();
    const prefillData = location.state?.prefillData;
    const { showToast } = useToast();

    const handleFlightAdded = async (flightData) => {
        try {
            await onAddFlight(flightData);
            showToast("Flight successfully added!", "success");
        } catch (error) {
            // Error is handled by App.jsx, but we could add more specific feedback here if needed
        }
    };

    return (
        <div style={{ 
            maxWidth: '700px', 
            width: '100%',
            margin: '0 auto', 
            position: 'relative',
            padding: 'var(--space-6) 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)'
        }}>
            <FlightForm 
                onAddFlight={handleFlightAdded} 
                initialData={prefillData} 
                flights={flights} 
            />
        </div>
    );
}
