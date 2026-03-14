import React from 'react';
import SimBriefBriefing from './SimBriefBriefing';

export default function Briefing() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* SimBrief Flight Plan */}
            <SimBriefBriefing />
        </div>
    );
}