import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import FlightForm from './FlightForm';

export default function NewFlight({ onAddFlight }) {
    const [showToast, setShowToast] = useState(false);
    const location = useLocation();
    const prefillData = location.state?.prefillData;

    const handleFlightAdded = async (flightData) => {
        // We call the original App.jsx handler
        await onAddFlight(flightData);
        // Show success toast
        setShowToast(true);
    };

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
            <FlightForm onAddFlight={handleFlightAdded} initialData={prefillData} />

            {/* Success Toast */}
            {showToast && (
                <div style={{
                    position: 'absolute',
                    top: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(30, 215, 96, 0.95)',
                    backdropFilter: 'blur(8px)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 8px 24px rgba(30, 215, 96, 0.25)',
                    animation: 'fadeSlideDown 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
                    zIndex: 1000,
                    fontWeight: 600,
                    fontSize: '0.95rem'
                }}>
                    <CheckCircle size={20} color="white" />
                    Flight successfully added!
                </div>
            )}

            <style>{`
                @keyframes fadeSlideDown {
                    from { opacity: 0; transform: translate(-50%, -20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
        </div>
    );
}
