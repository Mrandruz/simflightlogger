
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Search, Database, ArrowRight, AlertTriangle, FileUp, ShieldAlert, History } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function DataRecovery() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const { showToast } = useToast();

    // Helper for safe date exhibition
    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        try {
            // Check if it's a Firestore Timestamp
            if (dateValue.toDate) return dateValue.toDate().toLocaleDateString();
            // Check if it's an ISO string or Date object
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
        } catch (e) {
            return 'Date Error';
        }
    };

    const fetchUsersWithData = async () => {
        setLoading(true);
        setUsers([]);
        try {
            const usersCol = collection(db, 'users');
            const userSnapshot = await getDocs(usersCol);
            const foundUsers = [];

            for (const userDoc of userSnapshot.docs) {
                try {
                    const userData = userDoc.data();
                    const flightsCol = collection(db, 'users', userDoc.id, 'flights');
                    const flightSnapshot = await getDocs(flightsCol);
                    
                    if (flightSnapshot.docs.length > 0) {
                        foundUsers.push({
                            id: userDoc.id,
                            email: userData.email || 'N/A',
                            displayName: userData.displayName || 'N/A',
                            flightCount: flightSnapshot.docs.length,
                            createdAt: userData.createdAt || null
                        });
                    }
                } catch (userErr) {
                    console.warn(`Could not read data for user ${userDoc.id}:`, userErr);
                    // Skip users with permission errors or data issues instead of crashing
                }
            }
            setUsers(foundUsers);
            if (foundUsers.length === 0) {
                showToast('Scan complete. No data found in other accounts.', 'info');
            } else {
                showToast(`Scan complete! Found ${foundUsers.length} data sources.`);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Error accessing Firestore user list. Check security rules.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const migrateData = async (sourceUid, targetUid, dataToMigrate = null) => {
        const count = dataToMigrate ? dataToMigrate.length : users.find(u => u.id === sourceUid)?.flightCount;
        
        if (!window.confirm(`Are you sure you want to migrate ${count} flights to your current account? This will MERGE the data.`)) return;
        
        setMigrating(true);
        try {
            const batch = writeBatch(db);
            let flights = [];

            if (dataToMigrate) {
                flights = dataToMigrate;
            } else {
                const sourceFlightsCol = collection(db, 'users', sourceUid, 'flights');
                const sourceSnapshot = await getDocs(sourceFlightsCol);
                flights = sourceSnapshot.docs.map(d => ({ id: d.id, data: d.data() }));
            }

            flights.forEach((f) => {
                // Use the original ID or a new one if it's from local import
                const targetRef = doc(db, 'users', targetUid, 'flights', f.id || doc(collection(db, 'temp')).id);
                batch.set(targetRef, f.data || f);
            });

            await batch.commit();
            showToast('Migration successful! Your data has been restored.', 'success');
            if (!dataToMigrate) fetchUsersWithData();
        } catch (error) {
            console.error('Migration error:', error);
            showToast('Failed to migrate data.', 'error');
        } finally {
            setMigrating(false);
        }
    };

    const handleLocalImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    await migrateData(null, auth.currentUser.uid, importedData);
                } else {
                    showToast('Invalid JSON format. Expected an array of flights.', 'error');
                }
            } catch (err) {
                console.error('Local import error:', err);
                showToast('Failed to read the local backup file.', 'error');
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    return (
        <div className="admin-container">
            <div className="admin-header">
                <div>
                    <h1><History size={24} style={{ marginRight: '8px', verticalAlign: 'bottom' }} /> Data Recovery Tool</h1>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Scan Firestore or upload a local backup to restore your flight logs.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <FileUp size={18} /> Import Local Backup
                        <input type="file" accept=".json" onChange={handleLocalImport} style={{ display: 'none' }} />
                    </label>
                    <button 
                        onClick={fetchUsersWithData} 
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Search size={18} /> {loading ? 'Scanning...' : 'Scan Firestore'}
                    </button>
                </div>
            </div>

            <div className="card mt-6" style={{ background: 'rgba(255, 183, 0, 0.05)', border: '1px solid rgba(255, 183, 0, 0.2)' }}>
                <div style={{ display: 'flex', gap: '12px', padding: '16px' }}>
                    <ShieldAlert className="text-warning" size={24} />
                    <div style={{ fontSize: '0.9rem' }}>
                        <p style={{ fontWeight: 600, color: 'var(--color-warning)' }}>Developer Warning</p>
                        <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            You can migrate flights from another UID OR import directly from your local JSON backup. 
                            The data will be appended to your current account.
                        </p>
                    </div>
                </div>
            </div>

            <div className="users-list mt-8">
                {users.length === 0 && !loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-hint)' }}>
                        <Database size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p>Use the buttons above to find or import your data.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>UID / Source</th>
                                    <th>Email</th>
                                    <th>Flights Found</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{u.id}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)' }}>Created: {formatDate(u.createdAt)}</div>
                                        </td>
                                        <td style={{ fontSize: '0.9rem' }}>{u.email}</td>
                                        <td>
                                            <span style={{ 
                                                padding: '2px 8px', 
                                                background: u.flightCount > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 100, 100, 0.1)',
                                                color: u.flightCount > 0 ? '#22c55e' : 'var(--color-text-secondary)',
                                                borderRadius: '4px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600
                                            }}>
                                                {u.flightCount} Flights
                                            </span>
                                        </td>
                                        <td>
                                            <button 
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => migrateData(u.id, auth.currentUser?.uid)}
                                                disabled={migrating || !auth.currentUser || u.id === auth.currentUser.uid}
                                                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                {u.id === auth.currentUser?.uid ? 'Current User' : <><ArrowRight size={14} /> Restore to Me</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {migrating && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Restoring data, please wait...</p>
                </div>
            )}
        </div>
    );
}
