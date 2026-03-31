import fs from 'fs';
import path from 'path';

const opsPlanPath = path.resolve(process.cwd(), 'public/velar-ops-plan.json');
const dbPath = path.resolve(process.cwd(), 'data/fleet-state.json');

const opsPlan = JSON.parse(fs.readFileSync(opsPlanPath, 'utf8'));

// Prefix mappings
const prefixes = {
    'Airbus A319': 'I-V19',
    'Airbus A320': 'I-V20',
    'Airbus A321LR': 'I-V21',
    'Airbus A330neo': 'I-V33',
    'Airbus A350-900': 'I-V35'
};

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let fleetDb = [];

opsPlan.fleet.forEach(f => {
    const prefix = prefixes[f.type] || 'I-VXX';
    for (let i = 0; i < f.count; i++) {
        const id = `${prefix}${letters[i]}`;
        fleetDb.push({
            id: id,
            type: f.type,
            totalFlightHours: 0,
            lastMaintenanceHour: 0,
            status: 'Idle', // Idle, In Flight, AOG
            currentHub: 'LIRF', // Default origin
            isAOG: false,
            aogUntilTimeMs: 0
        });
    }
});

// Create data directory if not exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Write the database
fs.writeFileSync(dbPath, JSON.stringify(fleetDb, null, 2), 'utf8');
console.log(`✅ Fleet database initialized with ${fleetDb.length} aircraft in ${dbPath}`);
