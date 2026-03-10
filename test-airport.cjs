const airports = require('airport-data');

const eddf = airports.find(a => a.icao === 'EDDF');
console.log('EDDF:', eddf);

const kjfk = airports.find(a => a.icao === 'KJFK');
console.log('KJFK:', kjfk);

const lirf = airports.find(a => a.icao === 'LIRF');
console.log('LIRF:', lirf);
