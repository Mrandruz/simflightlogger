import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Book, MapPin, PlusCircle, Compass } from 'lucide-react';

export default function Sidebar() {
    return (
        <nav className="sidebar">
            <div className="sidebar-header">
                <Compass size={28} color="var(--color-primary)" />
            </div>

            <div className="sidebar-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    end
                >
                    <LayoutDashboard size={24} />
                    <span className="tooltip">Dashboard</span>
                </NavLink>

                <NavLink
                    to="/logbook"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <Book size={24} />
                    <span className="tooltip">Logbook</span>
                </NavLink>

                <NavLink
                    to="/briefing"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <MapPin size={24} />
                    <span className="tooltip">Briefing</span>
                </NavLink>

                <div className="sidebar-divider"></div>

                <NavLink
                    to="/new-flight"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <PlusCircle size={24} />
                    <span className="tooltip">New Flight</span>
                </NavLink>
            </div>
        </nav>
    );
}
