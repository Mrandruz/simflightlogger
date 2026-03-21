import React from 'react';
import SimBriefBriefing from './SimBriefBriefing';

export default function Briefing({ onAddFlight, flights }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <SimBriefBriefing onAddFlight={onAddFlight} flights={flights} />
        </div>
    );
}