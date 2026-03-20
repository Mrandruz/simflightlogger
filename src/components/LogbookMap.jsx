import React, { useRef, useEffect, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RotateCcw, Map as MapIcon } from 'lucide-react';

export default function LogbookMap({ mapData, isDarkMode, filteredFlights }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersGroupRef = useRef(null);
    const routesGroupRef = useRef(null);
    const tileLayerRef = useRef(null);
    const isProgrammaticChange = useRef(false);
    const [isManualZoom, setIsManualZoom] = useState(false);

    const fitToData = useCallback((animate = true) => {
        if (!mapInstance.current || mapData.airports.length === 0) return;
        
        isProgrammaticChange.current = true;
        
        const bounds = L.latLngBounds();
        mapData.airports.forEach(ap => {
            bounds.extend([ap.coordinates[1], ap.coordinates[0]]);
        });

        if (bounds.isValid()) {
            mapInstance.current.invalidateSize();
            mapInstance.current.fitBounds(bounds, { 
                padding: [30, 30], 
                maxZoom: 10, 
                animate 
            });

            const timeout = animate ? 800 : 200;
            setTimeout(() => {
                if (mapInstance.current && mapInstance.current.getZoom() < 2) {
                    mapInstance.current.setZoom(2, { animate: false });
                }
                setTimeout(() => {
                    isProgrammaticChange.current = false;
                }, 200);
            }, timeout);

            setIsManualZoom(false);
        } else {
            isProgrammaticChange.current = false;
        }
    }, [mapData.airports]);

    const handleZoomReset = () => fitToData(true);

    // Map Initialization
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const map = L.map(mapRef.current, {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            zoomControl: false,
            attributionControl: false,
            renderer: L.canvas()
        });

        const initialTileUrl = isDarkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        
        tileLayerRef.current = L.tileLayer(initialTileUrl, {
            noWrap: true,
            bounds: [[-90, -180], [90, 180]]
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstance.current = map;
        markersGroupRef.current = L.layerGroup().addTo(map);
        routesGroupRef.current = L.layerGroup().addTo(map);

        map.on('zoomend moveend', () => {
            if (!isProgrammaticChange.current) {
                setIsManualZoom(true);
            }
        });

        const fitTimer = setTimeout(() => {
            if (mapInstance.current) fitToData(false);
        }, 800);

        return () => {
            clearTimeout(fitTimer);
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // Theme Update
    useEffect(() => {
        if (!mapInstance.current || !tileLayerRef.current) return;
        const newTileUrl = isDarkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        tileLayerRef.current.setUrl(newTileUrl);
    }, [isDarkMode]);

    // Markers & Routes
    useEffect(() => {
        if (!mapInstance.current || !markersGroupRef.current || !routesGroupRef.current) return;

        markersGroupRef.current.clearLayers();
        routesGroupRef.current.clearLayers();

        const pointIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div class="marker-dot"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        mapData.routes.forEach(route => {
            L.polyline([[route.from[1], route.from[0]], [route.to[1], route.to[0]]], {
                color: isDarkMode ? '#1ed760' : '#1db954',
                weight: 1.5,
                opacity: 0.4,
                dashArray: '5, 10'
            }).addTo(routesGroupRef.current);
        });

        mapData.airports.forEach(ap => {
            const latLng = [ap.coordinates[1], ap.coordinates[0]];
            L.marker(latLng, { icon: pointIcon })
                .addTo(markersGroupRef.current)
                .bindTooltip(`<b>${ap.name || ap.icao}</b><br/>${ap.icao}`, {
                    direction: 'top', offset: [0, -5], sticky: false
                });
        });

        if (mapData.airports.length > 0 && !isManualZoom) {
            fitToData(false);
        }
    }, [mapData, fitToData, isDarkMode, filteredFlights, isManualZoom]);

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '500px' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
            
            <div style={{
                position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
                backgroundColor: 'var(--color-surface)', padding: '6px 12px',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)', fontSize: '0.7rem', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.07em'
            }}>
                <MapIcon size={14} /> Global Network
            </div>

            {isManualZoom && (
                <button onClick={handleZoomReset} className="btn btn-secondary btn-sm" style={{
                    position: 'absolute', bottom: '12px', left: '12px', zIndex: 1000,
                    backgroundColor: 'var(--color-surface)',
                    boxShadow: 'var(--shadow-md)',
                    padding: '8px 12px',
                    fontSize: '0.75rem'
                }}>
                    <RotateCcw size={14} /> Reset View
                </button>
            )}

            <style>{`
                .marker-dot {
                    width: 10px;
                    height: 10px;
                    background-color: var(--color-primary);
                    border: 2px solid #fff;
                    border-radius: 50%;
                    box-shadow: 0 0 12px var(--color-primary);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .custom-map-marker:hover .marker-dot {
                    transform: scale(1.4);
                    box-shadow: 0 0 20px var(--color-primary);
                    z-index: 1000;
                }
                .leaflet-container {
                    background: var(--color-background) !important;
                }
            `}</style>
        </div>
    );
}
