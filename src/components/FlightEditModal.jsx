import React from 'react';
import FlightForm from './FlightForm';

export default function FlightEditModal({ flight, onUpdateFlight, onCancel, flights }) {
    if (!flight) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)'
        }}>
            <div style={{
                maxWidth: '600px',
                width: '100%',
                animation: 'modalSlideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}>
                {/* 
                 * Pass the selected flight as initialData.
                 * The form will update the existing flight ID instead of creating a new one.
                 */}
                <FlightForm
                    initialData={flight}
                    onAddFlight={onUpdateFlight}
                    onCancel={onCancel}
                    flights={flights}
                />
            </div>

            <style>{`
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
