import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';

const SkydeckMark = ({ size = 32 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <polygon points="16,3 27,8.5 27,21.5 16,27 5,21.5 5,8.5"
            fill="none" stroke="#146AFF" strokeWidth="1.5"/>
        <polygon points="16,3 27,8.5 27,16 5,16 5,8.5"
            fill="#146AFF" fillOpacity=".08"/>
        <line x1="8" y1="16" x2="24" y2="16" stroke="#E6E8EB" strokeWidth="1"/>
        <circle cx="11" cy="12" r="2.5" fill="#146AFF"/>
        <circle cx="22" cy="10" r="2.5" fill="#146AFF"/>
        <line x1="13.5" y1="11.4" x2="19.5" y2="10.4"
            stroke="#146AFF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

export default function LoginScreen() {
    const { loginWithEmail, registerWithEmail } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '', displayName: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegistering) {
                await registerWithEmail(formData.email, formData.password, formData.displayName);
                showToast('Registration successful! Your account is pending approval.', 'success');
            } else {
                await loginWithEmail(formData.email, formData.password);
                showToast('Welcome back!', 'success');
            }
        } catch (error) {
            let message = 'An error occurred. Please try again.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')
                message = 'Invalid email or password.';
            else if (error.code === 'auth/email-already-in-use')
                message = 'This email is already registered.';
            else if (error.code === 'auth/weak-password')
                message = 'Password should be at least 6 characters.';
            showToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#F7F7F9', padding: '24px',
        }}>
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 400px',
                width: '100%', maxWidth: '960px',
                borderRadius: '20px', overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.14)',
                border: '1px solid rgba(255,255,255,.1)',
            }}>

                {/* ── LEFT PANEL — dark animated ── */}
                <div style={{
                    background: '#0d1f35', display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between', padding: '44px', position: 'relative', overflow: 'hidden',
                }}>
                    {/* Animated SVG background */}
                    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}
                        viewBox="0 0 440 600" preserveAspectRatio="xMidYMid slice">
                        <rect width="440" height="600" fill="#0d1f35"/>
                        <radialGradient id="lglow" cx="35%" cy="45%" r="55%">
                            <stop offset="0%" stopColor="#146AFF" stopOpacity=".13"/>
                            <stop offset="100%" stopColor="#0d1f35" stopOpacity="0"/>
                        </radialGradient>
                        <rect width="440" height="600" fill="url(#lglow)"/>

                        {/* Stars */}
                        {[[60,40,1,.5],[180,25,1.2,.4],[300,55,1,.6],[390,30,.8,.4],[130,80,1,.3],[350,100,1.2,.5],[240,60,.8,.4],[420,80,1,.3]].map(([x,y,r,o],i)=>(
                            <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={o}/>
                        ))}

                        {/* Grid cross */}
                        <line x1="0" y1="310" x2="440" y2="310" stroke="#146AFF" strokeOpacity=".06" strokeWidth="1"/>
                        <line x1="220" y1="0" x2="220" y2="600" stroke="#146AFF" strokeOpacity=".04" strokeWidth="1"/>

                        {/* Origin — Bergen */}
                        <circle cx="100" cy="210" r="4" fill="#10b981"/>
                        <circle cx="100" cy="210" r="6" fill="none" stroke="#10b981" strokeWidth=".8">
                            <animate attributeName="r" values="6;14;6" dur="2.2s" repeatCount="indefinite"/>
                            <animate attributeName="strokeOpacity" values=".5;0;.5" dur="2.2s" repeatCount="indefinite"/>
                        </circle>

                        {/* Dest 1 — Frankfurt */}
                        <circle cx="310" cy="265" r="4" fill="#ef4444"/>
                        <circle cx="310" cy="265" r="6" fill="none" stroke="#ef4444" strokeWidth=".8">
                            <animate attributeName="r" values="6;14;6" dur="2.5s" begin=".4s" repeatCount="indefinite"/>
                            <animate attributeName="strokeOpacity" values=".5;0;.5" dur="2.5s" begin=".4s" repeatCount="indefinite"/>
                        </circle>

                        {/* Dest 2 — Doha */}
                        <circle cx="375" cy="365" r="3.5" fill="#146AFF"/>
                        <circle cx="375" cy="365" r="5" fill="none" stroke="#146AFF" strokeWidth=".8">
                            <animate attributeName="r" values="5;12;5" dur="3s" begin=".8s" repeatCount="indefinite"/>
                            <animate attributeName="strokeOpacity" values=".4;0;.4" dur="3s" begin=".8s" repeatCount="indefinite"/>
                        </circle>

                        {/* Dest 3 — New York */}
                        <circle cx="60" cy="315" r="3" fill="#146AFF" opacity=".6"/>

                        {/* Route 1: ENBR → EDDF */}
                        <path d="M104 206 Q200 162 306 263" stroke="#146AFF" strokeWidth="1.5"
                            fill="none" strokeOpacity=".55" strokeDasharray="6 5">
                            <animate attributeName="strokeDashoffset" from="0" to="-22" dur="1.8s" repeatCount="indefinite"/>
                        </path>

                        {/* Plane on route 1 */}
                        <g>
                            <animateTransform attributeName="transform" type="translate"
                                values="104,206; 205,162; 306,263"
                                keyTimes="0;0.5;1" dur="4s" repeatCount="indefinite"/>
                            <circle r="5" fill="#146AFF" fillOpacity=".2" stroke="#146AFF" strokeWidth=".5"/>
                            <path d="M0 -3 L1.5 1 L0 0 L-1.5 1 Z" fill="white" transform="rotate(-35)"/>
                        </g>

                        {/* Route 2: ENBR → OTHH */}
                        <path d="M104 214 Q235 295 371 363" stroke="#146AFF" strokeWidth="1"
                            fill="none" strokeOpacity=".28" strokeDasharray="5 7">
                            <animate attributeName="strokeDashoffset" from="0" to="-24" dur="2.5s" repeatCount="indefinite"/>
                        </path>

                        {/* Route 3: ENBR → KJFK westward */}
                        <path d="M96 208 Q78 250 62 313" stroke="#10b981" strokeWidth="1"
                            fill="none" strokeOpacity=".3" strokeDasharray="4 6">
                            <animate attributeName="strokeDashoffset" from="0" to="-20" dur="3s" repeatCount="indefinite"/>
                        </path>

                        {/* Scattered secondary dots */}
                        {[[155,285],[250,325],[200,405],[320,435]].map(([x,y],i)=>(
                            <circle key={i} cx={x} cy={y} r="1.8" fill="#146AFF" opacity=".22"/>
                        ))}
                    </svg>

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px', fontWeight: 500, color: '#fff',
                                lineHeight: 1.25, letterSpacing: '-.02em',
                                fontFamily: 'var(--font-family-display)',
                            }}>
                                Your professional<br/>sim flight logbook
                            </h1>
                            <p style={{
                                fontSize: '13px', color: 'rgba(255,255,255,.5)',
                                marginTop: '10px', lineHeight: 1.65, maxWidth: '300px',
                                fontFamily: 'var(--font-family-sans)',
                            }}>
                                Track every flight, analyse your performance and plan your next departure. Built for serious sim pilots.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                            {[
                                'Full logbook with XP system & achievements',
                                'SimBrief & Navigraph integration',
                                'AI-powered flight analysis (Claude)',
                                'Personalised route scheduling',
                                'Live METAR weather at every airport',
                                'Alliance tracking across all 3 alliances',
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: 'rgba(255,255,255,.6)', fontFamily: 'var(--font-family-sans)' }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#146AFF', flexShrink: 0 }}/>
                                    {f}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom tiles — neutral platform stats */}
                    <div style={{ position: 'relative', zIndex: 2 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                                { v: '3',     l: 'Airline alliances' },
                                { v: '130+',  l: 'Countries covered' },
                                { v: '4 000+',l: 'Airports in database' },
                                { v: '24 / 7',l: 'Live weather data' },
                            ].map(({ v, l }) => (
                                <div key={l} style={{
                                    background: 'rgba(255,255,255,.04)',
                                    border: '0.5px solid rgba(255,255,255,.07)',
                                    borderRadius: '10px', padding: '12px 14px',
                                }}>
                                    <div style={{ fontSize: '17px', fontWeight: 500, color: '#fff', fontFamily: 'var(--font-family-display)', letterSpacing: '.02em' }}>{v}</div>
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: '3px', fontFamily: 'var(--font-family-sans)' }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT PANEL — form ── */}
                <div style={{
                    background: 'var(--color-surface)', padding: '48px 40px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px',
                    borderLeft: '0.5px solid var(--color-border)',
                }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <SkydeckMark size={32}/>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)' }}>Skydeck</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-hint)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'var(--font-family-sans)' }}>Flight Logger</div>
                        </div>
                    </div>

                    {/* Heading */}
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-display)', margin: 0 }}>
                            {isRegistering ? 'Create account' : 'Welcome back'}
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', fontFamily: 'var(--font-family-sans)' }}>
                            {isRegistering ? 'Create your pilot account' : 'Sign in to access your logbook'}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        background: 'var(--color-background)', borderRadius: '8px', padding: '3px',
                    }}>
                        {['Login', 'Register'].map((tab, i) => {
                            const active = isRegistering ? i === 1 : i === 0;
                            return (
                                <button key={tab} onClick={() => setIsRegistering(i === 1)} style={{
                                    padding: '7px', textAlign: 'center', fontSize: '13px', border: 'none', cursor: 'pointer',
                                    borderRadius: '6px', fontFamily: 'var(--font-family-sans)',
                                    background: active ? 'var(--color-surface)' : 'transparent',
                                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                    fontWeight: active ? 500 : 400,
                                    boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                                    transition: 'all .15s',
                                }}>{tab}</button>
                            );
                        })}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {isRegistering && (
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', fontFamily: 'var(--font-family-sans)' }}>
                                    <User size={12}/> Name
                                </label>
                                <input type="text" className="form-input" placeholder="Your name"
                                    value={formData.displayName}
                                    onChange={e => setFormData({...formData, displayName: e.target.value})}
                                    required={isRegistering}
                                    style={{ width: '100%', fontFamily: 'var(--font-family-sans)' }}
                                />
                            </div>
                        )}
                        <div>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', fontFamily: 'var(--font-family-sans)' }}>
                                <Mail size={12}/> Email
                            </label>
                            <input type="email" className="form-input" placeholder="pilot@example.com"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                required style={{ width: '100%', fontFamily: 'var(--font-family-sans)' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', fontFamily: 'var(--font-family-sans)' }}>
                                <Lock size={12}/> Password
                            </label>
                            <input type="password" className="form-input" placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                                required style={{ width: '100%', fontFamily: 'var(--font-family-sans)' }}
                            />
                        </div>

                        <button type="submit" disabled={loading} style={{
                            height: '42px', background: loading ? 'var(--color-text-hint)' : '#146AFF',
                            border: 'none', borderRadius: '8px', color: 'white',
                            fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'background .15s', fontFamily: 'var(--font-family-sans)',
                            marginTop: '4px',
                        }}>
                            {loading ? 'Processing…' : (isRegistering ? 'Create Account' : 'Login to Dashboard')}
                            {!loading && <ArrowRight size={16}/>}
                        </button>
                    </form>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-hint)', fontSize: '11px', fontFamily: 'var(--font-family-sans)' }}>
                        <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border)' }}/>
                        <span>note</span>
                        <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border)' }}/>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', textAlign: 'center', lineHeight: 1.6, fontFamily: 'var(--font-family-sans)', margin: 0 }}>
                        {isRegistering
                            ? 'New accounts require admin approval before access is granted.'
                            : 'Access is restricted to approved pilots only.'}
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes lglow-pulse {
                    0%,100%{opacity:.5} 50%{opacity:1}
                }
                .login-submit-btn:hover:not(:disabled) {
                    background: #0040B1 !important;
                }
            `}</style>
        </div>
    );
}
