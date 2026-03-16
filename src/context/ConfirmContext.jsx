import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, Trash2, Database, AlertTriangle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};

export const ConfirmProvider = ({ children }) => {
    const [config, setConfig] = useState(null);
    const [passwordInput, setPasswordInput] = useState('');

    const askConfirm = useCallback((options) => {
        setPasswordInput('');
        return new Promise((resolve) => {
            setConfig({
                ...options,
                resolve
            });
        });
    }, []);

    const handleClose = () => {
        if (config) config.resolve(false);
        setConfig(null);
        setPasswordInput('');
    };

    const handleConfirm = () => {
        if (config.requirePassword && passwordInput !== config.requirePassword) {
            return;
        }
        if (config) config.resolve(true);
        setConfig(null);
        setPasswordInput('');
    };

    const isConfirmDisabled = config?.requirePassword && passwordInput !== config.requirePassword;

    return (
        <ConfirmContext.Provider value={{ askConfirm }}>
            {children}
            {config && (
                <div className="modal-overlay" onClick={handleClose}>
                    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="confirm-header">
                            <div className={`confirm-icon-box ${config.confirmType || 'warning'}`}>
                                {config.icon === 'trash' && <Trash2 size={24} />}
                                {config.icon === 'database' && <Database size={24} />}
                                {config.icon === 'alert' && <AlertCircle size={24} />}
                                {!config.icon && <AlertTriangle size={24} />}
                            </div>
                            <h3>{config.title || 'Confirm Action'}</h3>
                        </div>
                        
                        <div className="confirm-body">
                            <p>{config.message || 'Are you sure you want to proceed?'}</p>
                            
                            {config.requirePassword && (
                                <div className="confirm-password-field" style={{ marginTop: 'var(--space-6)' }}>
                                    <p style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                        Type <strong>{config.requirePassword}</strong> to confirm:
                                    </p>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        placeholder="Type confirmation..."
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !isConfirmDisabled) handleConfirm();
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="confirm-footer">
                            <button className="btn btn-secondary" onClick={handleClose}>
                                {config.cancelText || 'Cancel'}
                            </button>
                            <button 
                                className={`btn btn-${config.confirmType || 'primary'}`} 
                                onClick={handleConfirm}
                                disabled={isConfirmDisabled}
                            >
                                {config.confirmText || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
