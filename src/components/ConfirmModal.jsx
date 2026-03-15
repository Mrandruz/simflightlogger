import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmStyle = 'danger' }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
                    <div style={{ backgroundColor: confirmStyle === 'danger' ? 'rgba(255, 69, 58, 0.15)' : 'rgba(232, 113, 10, 0.15)', padding: '16px', borderRadius: '50%' }}>
                        {confirmStyle === 'danger' ? <Trash2 size={32} color="var(--color-danger)" /> : <AlertTriangle size={32} color="#e8710a" />}
                    </div>
                </div>

                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>{title}</h3>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <button
                        className="btn"
                        onClick={onClose}
                        style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn"
                        onClick={() => {
                            try {
                                onConfirm();
                            } finally {
                                onClose();
                            }
                        }}
                        style={{ flex: 1, backgroundColor: confirmStyle === 'danger' ? 'var(--color-danger)' : '#e8710a', color: 'white' }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
