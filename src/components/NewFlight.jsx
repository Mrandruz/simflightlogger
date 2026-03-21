import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FlightForm from './FlightForm';
import { useToast } from '../context/ToastContext';

export default function NewFlight({ onAddFlight, flights }) {
    const location = useLocation();
    const navigate = useNavigate();
    const prefillData = location.state?.prefillData;
    const { showToast } = useToast();

    const handleFlightAdded = async (flightData) => {
        try {
            await onAddFlight(flightData);
            showToast("Flight successfully added!", "success");
            // If opened from Briefing (prefillData present), redirect to logbook after save
            if (prefillData) navigate('/logbook');
        } catch (error) {
            // Error is handled by App.jsx
        }
    };

    // If opened from Briefing (prefillData present), Cancel goes back to Briefing
    const handleCancel = prefillData ? () => navigate('/briefing') : undefined;

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
                onCancel={handleCancel}
                flights={flights} 
            />
        </div>
    );
}
