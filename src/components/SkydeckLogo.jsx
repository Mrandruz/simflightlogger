import './skydeck-logo.css';

export default function SkydeckLogo({ isDarkMode = false, height = 38 }) {
    const primary     = isDarkMode ? '#4d8eff' : '#146AFF';
    const stroke      = isDarkMode ? '#4d8eff' : '#146AFF';
    const horizonCol  = isDarkMode ? 'rgba(77,142,255,0.3)' : 'rgba(20,106,255,0.25)';

    const s = height / 48;

    const hex = [
        [24*s, 2*s],
        [42*s, 12*s],
        [42*s, 36*s],
        [24*s, 46*s],
        [6*s,  36*s],
        [6*s,  12*s],
    ].map(p => p.join(',')).join(' ');

    return (
        <div className="skydeck-logo">
            <svg
                width={height}
                height={height}
                viewBox={`0 0 ${height} ${height}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block', flexShrink: 0 }}
            >
                {/* Esagono outline */}
                <polygon
                    points={hex}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2 * s}
                />
                {/* Orizzonte */}
                <line
                    x1={10*s} y1={28*s}
                    x2={38*s} y2={28*s}
                    stroke={horizonCol}
                    strokeWidth={1.2*s}
                />
                {/* Punti rotta */}
                <circle cx={14*s} cy={21*s} r={3*s} fill={primary} />
                <circle cx={33*s} cy={16*s} r={3*s} fill={primary} />
                {/* Linea rotta */}
                <line
                    x1={17*s} y1={20.2*s}
                    x2={30*s} y2={16.8*s}
                    stroke={primary}
                    strokeWidth={2*s}
                    strokeLinecap="round"
                />
                {/* Anelli bianchi sui punti */}
                <circle cx={14*s} cy={21*s} r={1.3*s} fill="white" fillOpacity={isDarkMode ? 0.15 : 0.8} />
                <circle cx={33*s} cy={16*s} r={1.3*s} fill="white" fillOpacity={isDarkMode ? 0.15 : 0.8} />
            </svg>

            <div className="skydeck-logo__text">
                <span className="skydeck-logo__name">Skydeck</span>
                <span className="skydeck-logo__tagline">FLIGHT LOGGER</span>
            </div>
        </div>
    );
}
