const SIMBRIEF_API_BASE = 'https://api.simbrief.com/api/v1/flights';

export const simbreefService = {
    // Genera un piano di volo simulato (poiché l'API di SimBrief non permette generazione diretta)
    async generateFlightPlan(departure, arrival, aircraft) {
        try {
            // Simuliamo la generazione di un piano di volo
            // In un'implementazione reale, useremmo un'altra API o servizio

            // Dati di esempio basati sui parametri inseriti
            const mockData = {
                flight: {
                    origin: {
                        icao: departure,
                        name: `${departure} Airport`
                    },
                    destination: {
                        icao: arrival,
                        name: `${arrival} Airport`
                    },
                    aircraft: {
                        name: aircraft
                    },
                    route: this.generateMockRoute(departure, arrival),
                    cruise_altitude: this.generateMockAltitude(aircraft),
                    distance: this.generateMockDistance(departure, arrival),
                    flight_time: this.generateMockFlightTime(departure, arrival, aircraft),
                    fuel: {
                        total: this.generateMockFuel(aircraft)
                    }
                },
                briefing_url: '#',
                charts_url: '#'
            };

            // Simuliamo un delay per rendere realistico
            await new Promise(resolve => setTimeout(resolve, 1500));

            return mockData;
        } catch (error) {
            console.error('Errore nella generazione del piano di volo:', error);
            throw error;
        }
    },

    // Genera una rotta mock
    generateMockRoute(departure, arrival) {
        const routes = [
            'DCT LIRF UM728 KORUL/N0448F360 UM728 MOLUS DCT',
            'DCT LFPG UT183 KORUL UM728 MOLUS DCT',
            'N0448F360 DCT KORUL UM728 MOLUS DCT LFPG',
            'UM728 MOLUS DCT KORUL UT183 LIRF DCT'
        ];
        return routes[Math.floor(Math.random() * routes.length)];
    },

    // Genera altitudine mock basata sull'aeromobile
    generateMockAltitude(aircraft) {
        const altitudes = {
            'A320': 'FL360',
            'B737': 'FL350',
            'A330': 'FL380',
            'B777': 'FL380',
            'default': 'FL340'
        };
        return altitudes[aircraft] || altitudes.default;
    },

    // Genera distanza mock
    generateMockDistance(departure, arrival) {
        // Distanza approssimativa LIRF-LFPG
        return Math.floor(Math.random() * 200) + 600; // 600-800 nm
    },

    // Genera tempo di volo mock
    generateMockFlightTime(departure, arrival, aircraft) {
        const baseTime = Math.floor(Math.random() * 30) + 120; // 2-2.5 ore in minuti
        const hours = Math.floor(baseTime / 60);
        const minutes = baseTime % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    },

    // Genera carburante mock
    generateMockFuel(aircraft) {
        const fuelAmounts = {
            'A320': '18000 lbs',
            'B737': '22000 lbs',
            'A330': '45000 lbs',
            'B777': '65000 lbs',
            'default': '25000 lbs'
        };
        return fuelAmounts[aircraft] || fuelAmounts.default;
    },

    // Estrarre i dati del piano di volo dalla risposta di SimBrief
    parseFlightData(simbreefData) {
        const flight = simbreefData.flight || {};
        const origin = flight.origin || {};
        const destination = flight.destination || {};
        
        return {
            departure: origin.icao || origin.name || 'N/A',
            arrival: destination.icao || destination.name || 'N/A',
            aircraft: flight.aircraft?.name || 'N/A',
            route: flight.route || 'N/A',
            altitude: flight.cruise_altitude || 'N/A',
            distance: flight.distance || 'N/A',
            duration: flight.flight_time || 'N/A',
            fuel: flight.fuel?.total || 'N/A',
            notes: flight.notes || '',
            source: 'simbrief',
            simbreefId: flight.id,
            briefingUrl: simbreefData.briefing_url || '',
            chartUrl: simbreefData.charts_url || ''
        };
    }
};
