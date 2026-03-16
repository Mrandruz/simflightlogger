import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserCheck, UserX, Clock, Mail, Shield, Trash2, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const usersData = [];
            querySnapshot.forEach((doc) => {
                usersData.push({ id: doc.id, ...doc.data() });
            });
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error('Admin Panel users listener error:', error);
            setLoading(false);
            showToast('Permission denied or error loading users list.', 'error');
        });

        return () => unsubscribe();
    }, []);

    const handleStatusUpdate = async (userId, newStatus) => {
        try {
            await updateDoc(doc(db, 'users', userId), {
                status: newStatus
            });
            showToast(`User status updated to ${newStatus}`, 'success');
        } catch (error) {
            console.error('Detailed Update Error:', error);
            if (error.code === 'permission-denied') {
                showToast('Permission denied. You might not be authorized as Admin in Firestore.', 'error');
            } else {
                showToast(`Failed to update user status: ${error.message}`, 'error');
            }
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user trace? (Auth account must be deleted manually in Firebase Console)')) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            showToast('User trace deleted', 'success');
        } catch (error) {
            showToast('Failed to delete user trace', 'error');
        }
    };

    if (loading) return <div className="admin-loading">Loading users...</div>;

    const pendingUsers = users.filter(u => u.status === 'pending');
    const approvedUsers = users.filter(u => u.status === 'approved');

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1><Shield size={24} /> Admin User Management</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <p>Manage access requests and authorized pilots.</p>
                    <Link to="/admin/recovery" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', textDecoration: 'none' }}>
                        <Database size={16} /> Data Recovery
                    </Link>
                </div>
            </header>

            <section className="admin-section">
                <h2><Clock size={20} /> Pending Requests ({pendingUsers.length})</h2>
                <div className="admin-list">
                    {pendingUsers.length === 0 ? (
                        <p className="no-data">No pending requests.</p>
                    ) : (
                        pendingUsers.map(user => (
                            <div key={user.id} className="admin-card pending">
                                <div className="user-info">
                                    <span className="user-name">{user.displayName || 'Unnamed Pilot'}</span>
                                    <span className="user-email"><Mail size={14} /> {user.email || 'No Email'}</span>
                                </div>
                                <div className="user-actions">
                                    <button 
                                        onClick={() => handleStatusUpdate(user.id, 'approved')}
                                        className="btn-approve"
                                        title="Approve"
                                    >
                                        <UserCheck size={18} /> Approve
                                    </button>
                                    <button 
                                        onClick={() => handleStatusUpdate(user.id, 'rejected')}
                                        className="btn-reject"
                                        title="Reject"
                                    >
                                        <UserX size={18} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="admin-section">
                <h2><UserCheck size={20} /> Authorized Pilots ({approvedUsers.length})</h2>
                <div className="admin-list">
                    {approvedUsers.map(user => (
                        <div key={user.id} className="admin-card approved">
                            <div className="user-info">
                                <span className="user-name">{user.displayName || 'Unnamed Pilot'}</span>
                                <span className="user-email"><Mail size={14} /> {user.email || 'No Email'}</span>
                            </div>
                            <div className="user-actions">
                                <button 
                                    onClick={() => handleStatusUpdate(user.id, 'pending')}
                                    className="btn-revoke"
                                    title="Revoke Access"
                                >
                                    Revoke
                                </button>
                                <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="btn-delete"
                                    title="Delete trace"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
