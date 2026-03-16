import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { Plane, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';

export default function LoginScreen() {
    const { loginWithEmail, registerWithEmail } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        displayName: ''
    });

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
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = 'Invalid email or password.';
            } else if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password should be at least 6 characters.';
            }
            showToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">
                        <Plane size={32} />
                    </div>
                    <h1 className="login-title">SimFlight Logger</h1>
                    <p className="login-subtitle">
                        {isRegistering ? 'Create your pilot account' : 'Your professional sim flight logbook'}
                    </p>
                </div>

                <div className="auth-tabs">
                    <button 
                        className={`auth-tab ${!isRegistering ? 'active' : ''}`}
                        onClick={() => setIsRegistering(false)}
                    >
                        Login
                    </button>
                    <button 
                        className={`auth-tab ${isRegistering ? 'active' : ''}`}
                        onClick={() => setIsRegistering(true)}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {isRegistering && (
                        <div className="form-group">
                            <label className="form-label"><User size={16} /> Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Your Name"
                                value={formData.displayName}
                                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                                required={isRegistering}
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label"><Mail size={16} /> Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="pilot@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><Lock size={16} /> Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            required
                        />
                    </div>

                    <button type="submit" className="login-submit-btn" disabled={loading}>
                        {loading ? 'Processing...' : (isRegistering ? 'Register Account' : 'Login to Dashboard')}
                        <ArrowRight size={18} />
                    </button>
                </form>

                <p className="login-note">
                    {isRegistering 
                        ? 'Your account will need to be approved by an administrator.' 
                        : 'Sign in to access your flight logbook'}
                </p>
            </div>
        </div>
    );
}
