import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, RefreshCw, ExternalLink, Zap, MapPin, Wind, Gauge, Thermometer, Droplets } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { findAirport } from '../utils/airportUtils';

const ALLIANCE_MAP = {
    'United Airlines':'Star Alliance','Lufthansa':'Star Alliance','Air Canada':'Star Alliance',
    'Singapore Airlines':'Star Alliance','ANA':'Star Alliance','Thai Airways':'Star Alliance',
    'Turkish Airlines':'Star Alliance','Swiss':'Star Alliance','Austrian Airlines':'Star Alliance',
    'Brussels Airlines':'Star Alliance','TAP Air Portugal':'Star Alliance','LOT Polish Airlines':'Star Alliance',
    'Scandinavian Airlines':'Star Alliance','Air China':'Star Alliance','Shenzhen Airlines':'Star Alliance',
    'Air India':'Star Alliance','Copa Airlines':'Star Alliance','Avianca':'Star Alliance',
    'South African Airways':'Star Alliance','Ethiopian Airlines':'Star Alliance','Egyptair':'Star Alliance',
    'Croatia Airlines':'Star Alliance','Adria Airways':'Star Alliance',
    'Air France':'SkyTeam','KLM':'SkyTeam','Delta Air Lines':'SkyTeam','Alitalia':'SkyTeam',
    'Korean Air':'SkyTeam','China Southern':'SkyTeam','China Eastern':'SkyTeam',
    'Aeromexico':'SkyTeam','Czech Airlines':'SkyTeam','Air Europa':'SkyTeam','TAROM':'SkyTeam',
    'Vietnam Airlines':'SkyTeam','Garuda Indonesia':'SkyTeam','Middle East Airlines':'SkyTeam',
    'Kenya Airways':'SkyTeam','Saudia':'SkyTeam','Etihad':'SkyTeam',
    'American Airlines':'Oneworld','British Airways':'Oneworld','Iberia':'Oneworld',
    'Cathay Pacific':'Oneworld','Qatar Airways':'Oneworld','Japan Airlines':'Oneworld',
    'Finnair':'Oneworld','Malaysia Airlines':'Oneworld','Royal Jordanian':'Oneworld',
    'Royal Air Maroc':'Oneworld','Alaska Airlines':'Oneworld','SriLankan Airlines':'Oneworld',
};

const haversineNm = (lat1, lon1, lat2, lon2) => {
    if (lat1==null||lon1==null||lat2==null||lon2==null) return 0;
    const R=3440.065, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
};

const MAJOR_DESTINATIONS = [
    'KATL','KLAX','KORD','KDFW','KDEN','KJFK','KSFO','KLAS','KMIA','KIAH',
    'KEWR','KSEA','KBOS','KPHX','KMCO','KFLL','KIAD','CYYZ','CYVR','CYUL',
    'MMMX','MMUN','EGLL','LFPG','EHAM','EDDF','LEMD','LEBL','LIRF','LSZH',
    'EDDM','LOWW','EKCH','ESSA','ENGM','EFHK','LPPT','LGAV','LTFM','LIMC',
    'EIDW','EGKK','EGCC','EDDL','EDDB','EBBR','EPWA','LKPR','LHBP','UUEE',
    'OMDB','OERK','OTHH','OMAA','LLBG','ZBAA','ZSPD','ZGGG','VHHH','RCTP',
    'RJTT','RJAA','RKSI','WSSS','VTBS','RPLL','WIII','WMKK','VIDP','VABB',
    'YSSY','YMML','NZAA','FAOR','HECA','GMMN','HKJK',
    'SBGR','SCEL','SAEZ','SKBO','SEQM','SPJC',
    'KMSP','KDTW','KPHL','KBWI','KSLC','KPDX','KMDW','KCLT','KCLE',
    'CYC','CYYC','CYEG','LFMN','LFSB','LSGG','EDDS','EDDH','EDDV',
    'LIPE','LICC','LEPA','LEMG','LPPR','LIME','LIRQ','LEZL','LIML',
    'OEJN','OKBK','OBBI','ZGSZ','ZUCK','VMMC','VVTS','VTCC',
    'RPVM','WABD','WAAA','WSAP','YBBN','YPPH','NZCH','NZQN',
    'KATK','PHNL','PANC','PAFA','SBGL','SBRJ','SUMU','SPQU',
];

const HAUL_TYPES = [
    { key:'SHORT',  label:'Short haul',  color:'#10b981', rgb:'16,185,129',  min:300,  max:1500, xpMult:1.5  },
    { key:'MEDIUM', label:'Medium haul', color:'#3b82f6', rgb:'59,130,246',  min:1500, max:3000, xpMult:1.25 },
    { key:'LONG',   label:'Long haul',   color:'#f59e0b', rgb:'245,158,11',  min:3000, max:9000, xpMult:1.0  },
];

const ALLIANCES = [
    { name:'Star Alliance', color:'var(--color-alliance-star)' },
    { name:'SkyTeam',       color:'var(--color-alliance-skyteam)' },
    { name:'Oneworld',      color:'var(--color-alliance-oneworld)' },
];



/* ── SimBrief + Airline suggestion ── */

// Maps ICAO prefix → continent code used for routing logic
function icaoToContinent(icao) {
    if (!icao) return 'WORLD';
    const p = icao.toUpperCase();
    if (p.startsWith('K') || p.startsWith('PH') || p.startsWith('PA')) return 'US';
    if (p.startsWith('CY')) return 'CA';
    if (p.startsWith('MM') || p.startsWith('MN') || p.startsWith('MR') || p.startsWith('MT') || p.startsWith('MU') || p.startsWith('MY') || p.startsWith('MZ') || p.startsWith('TI') || p.startsWith('MK')) return 'LA';
    if (p.startsWith('SB') || p.startsWith('SC') || p.startsWith('SD') || p.startsWith('SJ') || p.startsWith('SK') || p.startsWith('SL') || p.startsWith('SM') || p.startsWith('SO') || p.startsWith('SP') || p.startsWith('SS') || p.startsWith('SU') || p.startsWith('SW') || p.startsWith('SA') || p.startsWith('SE') || p.startsWith('SY') || p.startsWith('SZ')) return 'SA';
    if (p.startsWith('EG') || p.startsWith('EI') || p.startsWith('LF') || p.startsWith('ED') || p.startsWith('LI') || p.startsWith('LE') || p.startsWith('GC') || p.startsWith('LP') || p.startsWith('EB') || p.startsWith('EH') || p.startsWith('EN') || p.startsWith('EK') || p.startsWith('ES') || p.startsWith('EF') || p.startsWith('LO') || p.startsWith('LZ') || p.startsWith('LK') || p.startsWith('LH') || p.startsWith('EP') || p.startsWith('LR') || p.startsWith('UU') || p.startsWith('UL') || p.startsWith('UM') || p.startsWith('LT') || p.startsWith('LC') || p.startsWith('BK') || p.startsWith('LW') || p.startsWith('LY') || p.startsWith('LJ') || p.startsWith('LQ') || p.startsWith('LB') || p.startsWith('LD')) return 'EU';
    if (p.startsWith('OJ') || p.startsWith('OI') || p.startsWith('OB') || p.startsWith('OR') || p.startsWith('OE') || p.startsWith('OA') || p.startsWith('OM') || p.startsWith('OT') || p.startsWith('OK') || p.startsWith('LL') || p.startsWith('OS') || p.startsWith('OL')) return 'ME';
    if (p.startsWith('Z') || p.startsWith('RJ') || p.startsWith('RK') || p.startsWith('VH') || p.startsWith('WS') || p.startsWith('RC') || p.startsWith('VT') || p.startsWith('VA') || p.startsWith('VI') || p.startsWith('VV') || p.startsWith('WI') || p.startsWith('WA') || p.startsWith('WM') || p.startsWith('RP') || p.startsWith('VB') || p.startsWith('VN') || p.startsWith('VM') || p.startsWith('VG') || p.startsWith('VD') || p.startsWith('VC')) return 'AS';
    if (p.startsWith('YS') || p.startsWith('YM') || p.startsWith('NZ') || p.startsWith('AG') || p.startsWith('AY') || p.startsWith('NF')) return 'OC';
    return 'AF'; // H*, D*, F*, G* etc.
}

// More granular sub-region for intra-EU precision
function icaoToSubRegion(icao) {
    if (!icao) return null;
    const p = icao.toUpperCase();
    if (p.startsWith('EG') || p.startsWith('EI')) return 'EU-UK';
    if (p.startsWith('LF')) return 'EU-FR';
    if (p.startsWith('ED')) return 'EU-DE';
    if (p.startsWith('LI')) return 'EU-IT';
    if (p.startsWith('LE') || p.startsWith('GC')) return 'EU-ES';
    if (p.startsWith('LP')) return 'EU-PT';
    if (p.startsWith('EB') || p.startsWith('EH')) return 'EU-BNL';
    if (p.startsWith('EN') || p.startsWith('EK') || p.startsWith('ES') || p.startsWith('EF')) return 'EU-N';
    if (p.startsWith('LO') || p.startsWith('LZ') || p.startsWith('LK') || p.startsWith('LH') || p.startsWith('EP') || p.startsWith('LR')) return 'EU-C';
    if (p.startsWith('UU') || p.startsWith('UL') || p.startsWith('UM')) return 'EU-E';
    if (p.startsWith('LT')) return 'ME-TR';
    if (p.startsWith('K') || p.startsWith('PH') || p.startsWith('PA')) return 'US';
    if (p.startsWith('CY')) return 'CA';
    if (p.startsWith('OM') || p.startsWith('OT') || p.startsWith('OK')) return 'ME-GULF';
    if (p.startsWith('RJ')) return 'AS-JP';
    if (p.startsWith('RK')) return 'AS-KR';
    if (p.startsWith('ZB') || p.startsWith('ZS') || p.startsWith('ZG') || p.startsWith('ZU') || p.startsWith('ZH') || p.startsWith('ZW') || p.startsWith('ZY') || p.startsWith('ZL') || p.startsWith('ZP')) return 'AS-CN';
    if (p.startsWith('VT') || p.startsWith('VA') || p.startsWith('VI')) return 'AS-IN';
    if (p.startsWith('WI') || p.startsWith('WA') || p.startsWith('WM') || p.startsWith('RP') || p.startsWith('VV') || p.startsWith('VH') || p.startsWith('WS') || p.startsWith('RC')) return 'AS-SEA';
    return null;
}

/*
 * Airline definitions.
 *
 * domestic: continents/sub-regions where the airline runs real domestic/regional routes.
 *   → For an intra-continental route, ONLY airlines with a matching domestic tag are considered.
 * international: continents the airline serves on intercontinental routes.
 *   → Used when origin and dest are on different continents.
 */
const ALLIANCE_AIRLINES = {
    'Star Alliance': [
        { iata:'LH', icao:'DLH', name:'Lufthansa',          domestic:['EU','EU-DE'],          international:['US','AS','AF','ME','SA']       },
        { iata:'UA', icao:'UAL', name:'United Airlines',     domestic:['US','CA'],              international:['EU','AS','SA','OC','ME']       },
        { iata:'AC', icao:'ACA', name:'Air Canada',          domestic:['CA','US'],              international:['EU','AS','ME']                 },
        { iata:'SQ', icao:'SIA', name:'Singapore Airlines',  domestic:['AS-SEA'],               international:['EU','OC','US','AS','ME']       },
        { iata:'NH', icao:'ANA', name:'ANA',                 domestic:['AS-JP'],                international:['US','EU','AS','OC']            },
        { iata:'TG', icao:'THA', name:'Thai Airways',        domestic:['AS-SEA'],               international:['EU','AS','OC']                 },
        { iata:'TK', icao:'THY', name:'Turkish Airlines',    domestic:['EU','ME-TR'],           international:['US','AF','AS','ME','SA','OC']  },
        { iata:'OS', icao:'AUA', name:'Austrian Airlines',   domestic:['EU','EU-C'],            international:['US','ME','AS']                 },
        { iata:'SK', icao:'SAS', name:'SAS',                 domestic:['EU','EU-N'],            international:['US','AS']                      },
        { iata:'TP', icao:'TAP', name:'TAP Air Portugal',    domestic:['EU','EU-PT'],           international:['SA','AF','US']                 },
        { iata:'LO', icao:'LOT', name:'LOT Polish Airlines', domestic:['EU','EU-C'],            international:['US','AS']                      },
        { iata:'CA', icao:'CCA', name:'Air China',           domestic:['AS','AS-CN'],           international:['EU','US','OC','ME']            },
        { iata:'ET', icao:'ETH', name:'Ethiopian Airlines',  domestic:['AF'],                   international:['EU','ME','AS','US']            },
        { iata:'MS', icao:'MSR', name:'EgyptAir',            domestic:['AF','ME'],              international:['EU','AS']                      },
        { iata:'AI', icao:'AIC', name:'Air India',           domestic:['AS','AS-IN'],           international:['EU','US','ME']                 },
        { iata:'AV', icao:'AVA', name:'Avianca',             domestic:['SA','LA'],              international:['US','EU']                      },
    ],
    'SkyTeam': [
        { iata:'AF', icao:'AFR', name:'Air France',          domestic:['EU','EU-FR'],           international:['US','AF','AS','ME','SA','OC']  },
        { iata:'KL', icao:'KLM', name:'KLM',                 domestic:['EU','EU-BNL'],          international:['US','AS','AF','ME','OC','SA']  },
        { iata:'DL', icao:'DAL', name:'Delta Air Lines',     domestic:['US','CA'],              international:['EU','AS','SA','OC','ME']       },
        { iata:'AM', icao:'AMX', name:'Aeromexico',          domestic:['LA','US'],              international:['EU','AS']                      },
        { iata:'MU', icao:'CES', name:'China Eastern',       domestic:['AS','AS-CN'],           international:['EU','US','OC','AS-SEA']        },
        { iata:'CZ', icao:'CSN', name:'China Southern',      domestic:['AS','AS-CN','AS-SEA'],  international:['EU','US','OC','ME']            },
        { iata:'KE', icao:'KAL', name:'Korean Air',          domestic:['AS-KR','AS'],           international:['US','EU','OC']                 },
        { iata:'VN', icao:'HVN', name:'Vietnam Airlines',    domestic:['AS-SEA'],               international:['EU','AS','OC']                 },
        { iata:'GA', icao:'GIA', name:'Garuda Indonesia',    domestic:['AS-SEA'],               international:['OC','EU','AS']                 },
        { iata:'ME', icao:'MEA', name:'Middle East Airlines',domestic:['ME'],                   international:['EU','AF','AS']                 },
        { iata:'KQ', icao:'KQA', name:'Kenya Airways',       domestic:['AF'],                   international:['EU','ME','AS']                 },
        { iata:'SV', icao:'SVA', name:'Saudia',              domestic:['ME','ME-GULF'],         international:['AS','EU','AF','US']            },
        { iata:'EY', icao:'ETD', name:'Etihad',              domestic:['ME','ME-GULF'],         international:['EU','AS','OC','US','AF']       },
        { iata:'RO', icao:'ROT', name:'TAROM',               domestic:['EU','EU-C'],            international:['ME']                           },
    ],
    'Oneworld': [
        { iata:'AA', icao:'AAL', name:'American Airlines',   domestic:['US','CA'],              international:['EU','AS','SA','OC','ME']       },
        { iata:'BA', icao:'BAW', name:'British Airways',     domestic:['EU','EU-UK'],           international:['US','AS','AF','ME','SA','OC']  },
        { iata:'IB', icao:'IBE', name:'Iberia',              domestic:['EU','EU-ES'],           international:['SA','US','AF']                 },
        { iata:'QR', icao:'QTR', name:'Qatar Airways',       domestic:['ME','ME-GULF'],         international:['EU','US','AS','AF','OC','SA']  },
        { iata:'CX', icao:'CPA', name:'Cathay Pacific',      domestic:['AS-SEA','AS-CN'],       international:['EU','US','OC','AS']            },
        { iata:'JL', icao:'JAL', name:'Japan Airlines',      domestic:['AS-JP'],                international:['US','EU','AS','OC']            },
        { iata:'AY', icao:'FIN', name:'Finnair',             domestic:['EU','EU-N'],            international:['AS','US']                      },
        { iata:'MH', icao:'MAS', name:'Malaysia Airlines',   domestic:['AS-SEA'],               international:['EU','OC','AS']                 },
        { iata:'RJ', icao:'RJA', name:'Royal Jordanian',     domestic:['ME'],                   international:['EU','AF','AS']                 },
        { iata:'AS', icao:'ASA', name:'Alaska Airlines',     domestic:['US','CA'],              international:[]                               },
        { iata:'QF', icao:'QFA', name:'Qantas',              domestic:['OC'],                   international:['AS','EU','US']                 },
        { iata:'SN', icao:'BEL', name:'Brussels Airlines',   domestic:['EU','EU-BNL'],          international:['AF']                           },
    ],
};

function pickAirlineForRoute(allianceName, originIcao, destIcao) {
    const options = ALLIANCE_AIRLINES[allianceName] || [];
    if (!options.length) return null;

    const originCont = icaoToContinent(originIcao);
    const destCont   = icaoToContinent(destIcao);
    const originSub  = icaoToSubRegion(originIcao);
    const destSub    = icaoToSubRegion(destIcao);
    const seed       = routeSeed(originIcao, destIcao);
    const isIntra    = originCont === destCont;

    const scored = options.map((a, i) => {
        let score = 0;

        if (isIntra) {
            // Intra-continental: domestic field must cover the continent
            const domCoverage = a.domestic.some(d => d === originCont || d === originSub || (originSub && originSub.startsWith(d)));
            if (!domCoverage) return { a, score: 0, tiebreak: 0 };
            score += 10; // base for domestic coverage

            // Bonus for sub-region precision (e.g. EU-N airline on EU-N→EU-UK)
            if (originSub && a.domestic.includes(originSub)) score += 4;
            if (destSub   && a.domestic.includes(destSub))   score += 4;

        } else {
            // Intercontinental: airline must cover BOTH sides
            const coversOrigin = a.domestic.some(d => d === originCont || d === originSub || originCont.startsWith(d))
                              || a.international.some(d => d === originCont || (originSub && originSub.startsWith(d)));
            const coversDest   = a.domestic.some(d => d === destCont   || d === destSub   || destCont.startsWith(d))
                              || a.international.some(d => d === destCont   || (destSub   && destSub.startsWith(d)));

            if (!coversOrigin || !coversDest) return { a, score: 0, tiebreak: 0 };
            score += 10;

            // Bonus for home-side match (airline from origin continent)
            if (a.domestic.some(d => d === originCont || (originSub && originSub.startsWith(d)))) score += 5;
            if (a.domestic.some(d => d === destCont   || (destSub   && destSub.startsWith(d))))   score += 3;
        }

        return { a, score, tiebreak: (seed + i * 37) % 1000 };
    });

    const maxScore = Math.max(...scored.map(s => s.score));
    if (maxScore === 0) {
        // Last resort: pick by seed among all
        return options[seed % options.length];
    }

    // Top tier: within 4 points of best (allows some variety)
    const topTier = scored.filter(s => s.score >= maxScore - 4);
    topTier.sort((a, b) => (b.score * 1000 + b.tiebreak) - (a.score * 1000 + a.tiebreak));
    return topTier[seed % topTier.length].a;
}

// Aircraft per haul
const HAUL_AIRCRAFT = {
    SHORT:  [
        { simbrief:'A319', label:'Airbus A319' },
        { simbrief:'A320', label:'Airbus A320' },
    ],
    MEDIUM: [
        { simbrief:'A320', label:'Airbus A320' },
        { simbrief:'A321', label:'Airbus A321' },
        { simbrief:'A332', label:'Airbus A330' },
        { simbrief:'A359', label:'Airbus A350' },
    ],
    LONG: [
        { simbrief:'A332', label:'Airbus A330' },
        { simbrief:'A359', label:'Airbus A350' },
        { simbrief:'A388', label:'Airbus A380' },
        { simbrief:'B77W', label:'Boeing 777'  },
        { simbrief:'B789', label:'Boeing 787'  },
    ],
};

// Stable seed from two strings
function routeSeed(a, b) {
    const s = (a + b).split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
    return s;
}



function pickAircraftForHaul(haulKey, originIcao, destIcao) {
    const options = HAUL_AIRCRAFT[haulKey] || HAUL_AIRCRAFT.SHORT;
    const seed = routeSeed(originIcao, destIcao);
    return options[seed % options.length];
}

// Generate realistic flight number: ICAO(3) + number, range varies by haul
function buildFlightNumber(airline, haulKey, originIcao, destIcao) {
    const icaoCode = airline?.icao || 'SKY';
    const seed = routeSeed(originIcao, destIcao);
    let num;
    if (haulKey === 'SHORT')       num = (seed % 400) + 100;   // 100–499
    else if (haulKey === 'MEDIUM') num = (seed % 500) + 500;   // 500–999
    else                           num = (seed % 900) + 1;     // 1–899 (long haul often low numbers)
    return `${icaoCode}${num}`;
}

function buildSimbriefUrl(suggestion, airline, aircraft) {
    if (!suggestion?.origin?.icao || !suggestion?.dest?.icao) return null;
    const baseUrl = 'https://dispatch.simbrief.com/options/custom';
    const seed = routeSeed(suggestion.origin.icao, suggestion.dest.icao);
    let fltnumOnly;
    if (suggestion.key === 'SHORT')       fltnumOnly = (seed % 400) + 100;   // 100–499
    else if (suggestion.key === 'MEDIUM') fltnumOnly = (seed % 500) + 500;   // 500–999
    else                                  fltnumOnly = (seed % 900) + 1;     // 1–899
    const cruise = suggestion.key === 'LONG' ? '350' : suggestion.key === 'MEDIUM' ? '360' : '370';
    const params = new URLSearchParams({
        airline: airline?.icao || 'SKY',
        fltnum:  String(fltnumOnly),
        orig:    suggestion.origin.icao,
        dest:    suggestion.dest.icao,
        type:    aircraft?.simbrief || 'A320',
        cruise:  cruise,
    });
    return `${baseUrl}?${params.toString()}`;
}

/* ── Leaflet map — identical to SimBriefBriefing ── */
function RouteMap({ origin, dest, isDarkMode }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {
        if (!origin?.latitude||!dest?.latitude||!mapRef.current) return;
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current=null; }

        const tileUrl = isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

        const map = L.map(mapRef.current).setView([0,0],2);
        mapInstanceRef.current = map;
        L.tileLayer(tileUrl,{attribution}).addTo(map);

        const greenIcon = new L.Icon({
            iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41],
        });
        const redIcon = new L.Icon({
            iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41],
        });

        const oLat=origin.latitude, oLon=origin.longitude;
        const dLat=dest.latitude,   dLon=dest.longitude;

        L.marker([oLat,oLon],{icon:greenIcon}).addTo(map)
            .bindPopup(`<strong>${origin.icao}</strong><br/>${origin.name}<br/><span style="color:#6b7280;font-size:11px">${origin.country||''}</span>`,{maxWidth:200});
        L.marker([dLat,dLon],{icon:redIcon}).addTo(map)
            .bindPopup(`<strong>${dest.icao}</strong><br/>${dest.name}<br/><span style="color:#6b7280;font-size:11px">${dest.country||''}</span>`,{maxWidth:200});

        // Great circle
        const gcPoints=[], steps=60;
        for (let i=0;i<=steps;i++) {
            const t=i/steps;
            const lat1r=oLat*Math.PI/180, lon1r=oLon*Math.PI/180;
            const lat2r=dLat*Math.PI/180, lon2r=dLon*Math.PI/180;
            const d=2*Math.asin(Math.sqrt(Math.sin((lat2r-lat1r)/2)**2+Math.cos(lat1r)*Math.cos(lat2r)*Math.sin((lon2r-lon1r)/2)**2));
            if (d===0){gcPoints.push([oLat,oLon]);continue;}
            const A=Math.sin((1-t)*d)/Math.sin(d), B=Math.sin(t*d)/Math.sin(d);
            const x=A*Math.cos(lat1r)*Math.cos(lon1r)+B*Math.cos(lat2r)*Math.cos(lon2r);
            const y=A*Math.cos(lat1r)*Math.sin(lon1r)+B*Math.cos(lat2r)*Math.sin(lon2r);
            const z=A*Math.sin(lat1r)+B*Math.sin(lat2r);
            gcPoints.push([Math.atan2(z,Math.sqrt(x*x+y*y))*180/Math.PI, Math.atan2(y,x)*180/Math.PI]);
        }
        const routeColor = isDarkMode ? '#94a3b8' : '#64748b';
        L.polyline(gcPoints,{color:routeColor,weight:2.5,opacity:0.85,dashArray:'6,8'}).addTo(map);
        map.fitBounds(L.latLngBounds([[oLat,oLon],[dLat,dLon]]),{padding:[50,50]});

        return () => { if (mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null;} };
    },[origin?.icao,dest?.icao,isDarkMode]);

    return <div ref={mapRef} style={{width:'100%',height:'100%'}} />;
}

/* ── Weather strip — mirrors MiniMetar from SimBriefBriefing exactly ── */
function WxStrip({ icao, wx }) {
    if (wx === 'loading' || wx === undefined) {
        return (
            <div className="wx-strip">
                <div className="wx-strip-lbl">{icao}</div>
                <div className="wx-grid-wrap">
                    {[0,1,2,3].map(i => (
                        <div key={i} className="wx-chip-col">
                            <div className="skeleton" style={{width:16,height:16,borderRadius:4,marginBottom:2}}/>
                            <div className="skeleton skeleton-text" style={{width:28,height:8,marginBottom:4}}/>
                            <div className="skeleton skeleton-text" style={{width:36,height:12}}/>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (wx === 'unavailable' || !wx) {
        return (
            <div className="wx-strip">
                <div className="wx-strip-lbl">{icao}</div>
                <div className="wx-unavailable">Weather data not available</div>
            </div>
        );
    }
    return (
        <div className="wx-strip">
            <div className="wx-strip-lbl">{icao}</div>
            <div className="wx-grid-wrap">
                <div className="wx-chip-col">
                    <Gauge size={14} style={{color:'var(--color-text-hint)',marginBottom:2}} aria-hidden="true"/>
                    <span className="wx-cl">Pres</span>
                    <span className="wx-cv">{wx.pres ?? '--'}</span>
                </div>
                <div className="wx-chip-col">
                    <Wind size={14} style={{color:'var(--color-text-hint)',marginBottom:2}} aria-hidden="true"/>
                    <span className="wx-cl">Wind</span>
                    <span className="wx-cv">{wx.wind ?? '--'}</span>
                </div>
                <div className="wx-chip-col">
                    <Thermometer size={14} style={{color:'var(--color-text-hint)',marginBottom:2}} aria-hidden="true"/>
                    <span className="wx-cl">Temp</span>
                    <span className="wx-cv">{wx.temp != null ? `${wx.temp}°` : '--'}</span>
                </div>
                <div className="wx-chip-col">
                    <Droplets size={14} style={{color:'var(--color-text-hint)',marginBottom:2}} aria-hidden="true"/>
                    <span className="wx-cl">Dew</span>
                    <span className="wx-cv">{wx.dew != null ? `${wx.dew}°` : '--'}</span>
                </div>
            </div>
        </div>
    );
}

export default function Schedule({ flights=[], user }) {
    const context = useOutletContext();
    const isDarkMode = context?.isDarkMode ?? false;

    const [suggestions, setSuggestions]   = useState({});
    const [loading, setLoading]           = useState(true);
    const [selectedAlliance, setSelectedAlliance] = useState('Star Alliance');
    const [selectedHaul, setSelectedHaul] = useState('SHORT');
    const [weatherCache, setWeatherCache] = useState({});

    /* ── Analysis ── */
    const analysis = useMemo(() => {
        const res = {
            visitedAirports:new Set(), visitedCountries:new Set(), longHaulCount:0,
            allianceLastFlights:{'Star Alliance':null,'SkyTeam':null,'Oneworld':null},
            allianceFlightCounts:{'Star Alliance':0,'SkyTeam':0,'Oneworld':0},
        };
        if (!Array.isArray(flights)) return res;
        if (process.env.NODE_ENV==='development'&&flights.length>0)
            console.log('[Schedule] flight keys:',Object.keys(flights[0]),'sample:',flights[0]);
        flights.forEach(f=>{
            if (!f) return;
            const dep=String(f.departure||'').toUpperCase();
            const arr=String(f.arrival||'').toUpperCase();
            if (dep) res.visitedAirports.add(dep);
            if (arr) res.visitedAirports.add(arr);
            const dAp=findAirport(dep), aAp=findAirport(arr);
            if (dAp?.country) res.visitedCountries.add(dAp.country);
            if (aAp?.country) res.visitedCountries.add(aAp.country);
            const dist=Number(f.miles||f.distance||f.nm||0);
            if (dist>3000) res.longHaulCount++;
            let al=f.alliance;
            if (!al) al = f.airline==='ITA Airways'
                ? (new Date(f.date)>=new Date('2024-11-01')?'Star Alliance':'SkyTeam')
                : ALLIANCE_MAP[f.airline];
            if (al&&res.allianceLastFlights.hasOwnProperty(al)) {
                res.allianceFlightCounts[al]++;
                if (!res.allianceLastFlights[al]||new Date(f.date)>new Date(res.allianceLastFlights[al].date))
                    res.allianceLastFlights[al]=f;
            }
        });
        return res;
    },[flights]);

    /* ── Generate suggestions ── */
    const generateSuggestions = (allianceName, forceRandom=false) => {
        try {
            const lf=analysis.allianceLastFlights[allianceName];
            if (!lf?.arrival) return [];
            const originCode=String(lf.arrival).toUpperCase();
            const originAp=findAirport(originCode);
            if (!originAp?.latitude) return [];
            const allDests=MAJOR_DESTINATIONS.map(i=>findAirport(i)).filter(a=>a&&a.icao&&a.latitude!=null);

            return HAUL_TYPES.map(range=>{
                try {
                    let cands=allDests.filter(ap=>{
                        if (ap.icao===originCode) return false;
                        const d=haversineNm(originAp.latitude,originAp.longitude,ap.latitude,ap.longitude);
                        return d>=range.min&&d<=range.max;
                    }).map(ap=>({
                        icao:ap.icao, name:ap.name, city:ap.city, country:ap.country,
                        latitude:ap.latitude, longitude:ap.longitude,
                        elevation:ap.elevation??ap.alt??null,
                        distance:haversineNm(originAp.latitude,originAp.longitude,ap.latitude,ap.longitude),
                    }));
                    if (!cands.length) return null;
                    cands.sort((a,b)=>{
                        if (forceRandom) return Math.random()-.5;
                        const aV=analysis.visitedAirports.has(a.icao), bV=analysis.visitedAirports.has(b.icao);
                        if (aV!==bV) return aV?1:-1;
                        if (range.key==='LONG'&&analysis.longHaulCount<120) return b.distance-a.distance;
                        return a.distance-b.distance||a.icao.localeCompare(b.icao);
                    });
                    const best=cands[0]; if (!best) return null;
                    const hrs=best.distance/450, h=Math.floor(hrs), m=Math.round((hrs-h)*60);
                    const baseXP=Math.floor((best.distance/10)+(hrs*50)+250);
                    const totalXP=Math.round(baseXP*range.xpMult);
                    let achievement=null;
                    if (range.key==='LONG') achievement={label:'Long Haul Ace',icon:'✈️'};
                    else if (!analysis.visitedCountries.has(best.country)) achievement={label:'World Traveler',icon:'🌍'};
                    else if (!analysis.visitedAirports.has(best.icao)) achievement={label:'New Discovery',icon:'📍'};
                    const visitCount=flights.filter(f=>f&&(
                        String(f.arrival||'').toUpperCase()===best.icao||
                        String(f.departure||'').toUpperCase()===best.icao
                    )).length;
                    return {...range,dest:best,origin:originAp,duration:`${h}h ${m}m`,baseXP,xp:totalXP,achievement,visitCount};
                } catch {return null;}
            }).filter(Boolean);
        } catch {return [];}
    };

    /* ── Firestore sync ── */
    useEffect(()=>{
        const sync=async()=>{
            if (!user) return;
            setLoading(true);
            try {
                const local={};
                ALLIANCES.forEach(al=>{local[al.name]=generateSuggestions(al.name);});
                setSuggestions(local);
                const ref=doc(db,'users',user.uid,'settings','schedule');
                const snap=await getDoc(ref);
                if (snap.exists()) {
                    const pd=snap.data(), synced={...local}; let needsUpdate=false;
                    ALLIANCES.forEach(al=>{
                        const lf=analysis.allianceLastFlights[al.name];
                        const cur=lf?.arrival?.toUpperCase()||null;
                        if (pd[al.name]?.baseAirport&&cur===pd[al.name].baseAirport) synced[al.name]=pd[al.name].suggestions;
                        else if (cur){needsUpdate=true;pd[al.name]={baseAirport:cur,suggestions:local[al.name]};}
                    });
                    if (needsUpdate) await setDoc(ref,pd,{merge:true});
                    setSuggestions(synced);
                } else {
                    const init={};
                    ALLIANCES.forEach(al=>{
                        const lf=analysis.allianceLastFlights[al.name];
                        init[al.name]={baseAirport:lf?.arrival?.toUpperCase()||null,suggestions:local[al.name]};
                    });
                    await setDoc(ref,init);
                }
            } catch(e){console.error('Schedule sync',e);}
            finally{setLoading(false);}
        };
        if (flights?.length>0) sync(); else setLoading(false);
    },[flights,analysis,user]);

    /* ── METAR fetch ── */
    const activeSuggestions = suggestions[selectedAlliance]||[];
    const activeHaul = activeSuggestions.find(s=>s.key===selectedHaul);

    // Fetch METAR for all icaos in active suggestions — one effect, no race conditions
    useEffect(() => {
        if (!activeSuggestions.length) return;

        const icaos = [...new Set(
            activeSuggestions.flatMap(s => [s.origin.icao, s.dest.icao])
        )];

        icaos.forEach(icao => {
            // Only skip if we already have real data
            const cached = weatherCache[icao];
            if (cached && typeof cached === 'object') return;
            if (cached === 'loading') return;

            setWeatherCache(p => ({ ...p, [icao]: 'loading' }));

            fetch(`/api/metar?ids=${icao}&format=json`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
                    const m = data[0];
                    setWeatherCache(p => ({ ...p, [icao]: {
                        pres: m.altim  != null ? Math.round(m.altim) : null,
                        wind: m.wdir   != null && m.wspd != null ? `${m.wdir}°/${m.wspd}kt` : null,
                        temp: m.temp   != null ? Math.round(m.temp)  : null,
                        dew:  m.dewp   != null ? Math.round(m.dewp)  : null,
                    }}));
                })
                .catch(e => {
                    console.warn(`[Schedule] METAR failed ${icao}:`, e.message);
                    setWeatherCache(p => ({ ...p, [icao]: 'unavailable' }));
                });
        });
    }, [selectedAlliance, activeSuggestions.map(s => s.dest.icao).join(',')]);

    const handleRegenerate = async()=>{
        const newS=generateSuggestions(selectedAlliance,true);
        setSuggestions(p=>({...p,[selectedAlliance]:newS}));
        if (user) {
            try {
                const ref=doc(db,'users',user.uid,'settings','schedule');
                const lf=analysis.allianceLastFlights[selectedAlliance];
                await setDoc(ref,{[selectedAlliance]:{baseAirport:lf?.arrival?.toUpperCase()||null,suggestions:newS}},{merge:true});
            } catch(e){console.error('Regen save',e);}
        }
    };

    const totalFlights=Object.values(analysis.allianceFlightCounts).reduce((a,b)=>a+b,0);
    const activeAl=ALLIANCES.find(a=>a.name===selectedAlliance);
    const activeLastFlight=analysis.allianceLastFlights[selectedAlliance];

    if (!flights||flights.length===0) return (
        <div className="schedule-page">
            <header className="page-header">
                <h1 className="page-title"><Calendar className="title-icon"/> Flight Schedule</h1>
            </header>
            <div className="card" style={{padding:'2rem',textAlign:'center'}}>
                <p>No flights logged yet. Add your first flight to get started.</p>
            </div>
        </div>
    );

    return (
        <div className="schedule-page">

            {/* ── Page header ── */}
            <header className="sched-header">
                <div className="sched-header-left">
                    <h1 className="page-title"><Calendar className="title-icon"/> Flight Schedule</h1>
                    {activeLastFlight && (
                        <p className="sched-header-sub">
                            From <strong>{String(activeLastFlight.arrival).toUpperCase()}</strong>
                            {' — '}{findAirport(activeLastFlight.arrival)?.name||activeLastFlight.arrival}
                        </p>
                    )}
                </div>
                <div className="sched-header-actions">
                    {ALLIANCES.map(al=>{
                        const count=analysis.allianceFlightCounts[al.name];
                        const isActive=selectedAlliance===al.name;
                        if (!analysis.allianceLastFlights[al.name]) return null;
                        return (
                            <button
                                key={al.name}
                                className={`al-tab-btn ${isActive?'active':''}`}
                                style={{'--al-color':al.color}}
                                onClick={()=>{setSelectedAlliance(al.name);setSelectedHaul('SHORT');setWeatherCache({});}}
                            >
                                <span className="al-tab-dot" style={{background:al.color}}/>
                                {al.name}
                                <span className="al-tab-count">{count}</span>
                            </button>
                        );
                    })}
                    <button className="btn regen-btn" onClick={handleRegenerate}>
                        <RefreshCw size={13}/> Regenerate
                    </button>
                </div>
            </header>

            {/* ── Stats bar ── */}
            <div className="sched-stats-bar">
                <div className="stat-chip"><span className="stat-v">{analysis.visitedAirports.size}</span><span className="stat-l">Airports</span></div>
                <div className="stat-chip"><span className="stat-v">{analysis.visitedCountries.size}</span><span className="stat-l">Countries</span></div>
                <div className="stat-chip"><span className="stat-v">{analysis.longHaulCount}</span><span className="stat-l">Long haul</span></div>
                <div className="stat-chip"><span className="stat-v">{totalFlights}</span><span className="stat-l">Total flights</span></div>
            </div>

            {/* ── 2-column body ── */}
            <div className="sched-body">

                {/* Left: flight cards */}
                <div className="sched-left" key={selectedAlliance}>
                    {HAUL_TYPES.map((haul,idx)=>{
                        const s=activeSuggestions.find(x=>x.key===haul.key);
                        const isActive=selectedHaul===haul.key;
                        const wx_dep=s?(weatherCache[s.origin.icao]??null):null;
                        const wx_arr=s?(weatherCache[s.dest.icao]??null):null;
                        const suggestedAirline = s ? pickAirlineForRoute(selectedAlliance, s.origin.icao, s.dest.icao) : null;
                        const suggestedAircraft = s ? pickAircraftForHaul(haul.key, s.origin.icao, s.dest.icao) : null;
                        const sbUrl = s ? buildSimbriefUrl(s, suggestedAirline, suggestedAircraft) : null;
                        return (
                            <div
                                key={haul.key}
                                className={`fcard card ${isActive?'fcard-active':''}`}
                                style={{'--haul-c':haul.color,'--haul-rgb':haul.rgb,'--anim-delay':`${idx*70}ms`}}
                                onClick={()=>s&&setSelectedHaul(haul.key)}
                            >
                                {/* Top bar */}
                                <div className="fcard-topbar">
                                    <span className="fcard-type">{haul.label}</span>
                                    {s && suggestedAirline && (
                                        <span className="fcard-suggestion-pill">
                                            <span className="fcard-suggestion-iata">{suggestedAirline.iata}</span>
                                            {suggestedAirline.name}
                                            {suggestedAircraft && <span className="fcard-suggestion-sep">·</span>}
                                            {suggestedAircraft && <span className="fcard-suggestion-ac">{suggestedAircraft.label}</span>}
                                        </span>
                                    )}
                                    {s&&<span className="fcard-xp"><Zap size={11}/> +{s.xp} XP</span>}
                                </div>

                                {s ? (
                                    <div className="fcard-body">
                                        {/* Route — Briefing layout: airports left, info right */}
                                        <div className="fcard-route">
                                            <div className="fcard-route-airports">
                                                <div className="fcard-ap">
                                                    <div className="fcard-ap-label fcard-ap-label-origin">Origin</div>
                                                    <div className="fcard-icao">{s.origin.icao}</div>
                                                    <div className="fcard-apname">{s.origin.name}</div>
                                                    {s.origin.country&&<div className="fcard-country"><MapPin size={10}/>{s.origin.country}</div>}
                                                </div>
                                                <div className="fcard-route-mid">
                                                    <span className="fcard-dur">{s.duration}</span>
                                                    <div className="fcard-route-line">
                                                        <div className="fcard-route-line-bar"/>
                                                        <MapPin size={12} className="fcard-route-plane"/>
                                                        <div className="fcard-route-line-bar"/>
                                                    </div>
                                                </div>
                                                <div className="fcard-ap">
                                                    <div className="fcard-ap-label fcard-ap-label-dest">Destination</div>
                                                    <div className="fcard-icao">{s.dest.icao}</div>
                                                    <div className="fcard-apname">{s.dest.name}</div>
                                                    {s.dest.country&&<div className="fcard-country"><MapPin size={10}/>{s.dest.country}</div>}
                                                </div>
                                            </div>
                                            <div className="fcard-route-info">
                                                <div className="fcard-info-item">
                                                    <span className="fcard-info-l">Distance</span>
                                                    <span className="fcard-info-v">{s.dest.distance.toLocaleString()} nm</span>
                                                </div>
                                                <div className="fcard-info-item">
                                                    <span className="fcard-info-l">XP earned</span>
                                                    <span className="fcard-info-v xp-green">+{s.xp} XP</span>
                                                </div>
                                                <div className="fcard-info-item">
                                                    <span className="fcard-info-l">Multiplier</span>
                                                    <span className="fcard-info-v">{haul.xpMult}×</span>
                                                </div>
                                                <div className="fcard-info-item">
                                                    <span className="fcard-info-l">Route type</span>
                                                    <span className="fcard-info-v">{s.origin.country===s.dest.country?'Domestic':'International'}</span>
                                                </div>
                                                {s.visitCount>0 ? (
                                                    <div className="fcard-info-item">
                                                        <span className="fcard-info-l">Status</span>
                                                        <span className="fcard-badge fcard-badge-visited">
                                                            <span className="fcard-badge-dot" style={{background:'var(--color-success)'}}/> Flown {s.visitCount}×
                                                        </span>
                                                    </div>
                                                ) : s.achievement ? (
                                                    <div className="fcard-info-item">
                                                        <span className="fcard-info-l">Achievement</span>
                                                        <span className="fcard-badge fcard-badge-new">
                                                            <span className="fcard-badge-dot" style={{background:'var(--color-primary)'}}/> {s.achievement.label}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>



                                        {/* Weather — Briefing style 2 columns */}
                                        <div className="fcard-wx">
                                            <div className="fcard-wx-section">
                                                <span className="fcard-wx-label">Origin Weather</span>
                                                <WxStrip icao={s.origin.icao} wx={wx_dep}/>
                                            </div>
                                            <div className="fcard-wx-section">
                                                <span className="fcard-wx-label">Dest Weather</span>
                                                <WxStrip icao={s.dest.icao} wx={wx_arr}/>
                                            </div>
                                        </div>

                                        {/* SimBrief CTA */}
                                        {sbUrl && (
                                            <div className="fcard-simbrief">
                                                <a
                                                    href={sbUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="simbrief-btn"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        try { localStorage.setItem('lastPlannedFlight', JSON.stringify({ origin: s.origin.icao, dest: s.dest.icao, haulType: haul.key, airline: suggestedAirline?.name, aircraft: suggestedAircraft?.label })); } catch {}
                                                    }}
                                                >
                                                    <ExternalLink size={13}/>
                                                    Plan on SimBrief
                                                    <span className="simbrief-route">{s.origin.icao} → {s.dest.icao}</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="fcard-empty">No routes available</div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right: map */}
                <div className="sched-map-col">
                    <div className="sched-map-box card">
                        {activeHaul ? (
                            <RouteMap origin={activeHaul.origin} dest={activeHaul.dest} isDarkMode={isDarkMode}/>
                        ) : (
                            <div className="map-placeholder">
                                <Calendar size={24}/>
                                <span>Select a flight</span>
                            </div>
                        )}
                    </div>
                    {activeHaul&&(
                        <div className="map-dist-badge">
                            {activeHaul.dest.distance.toLocaleString()} NM
                        </div>
                    )}
                </div>
            </div>

            {loading&&(
                <div className="persistence-loader">
                    <RefreshCw size={14} className="spin"/>
                    <span>Syncing schedule...</span>
                </div>
            )}

            <style>{`
                .schedule-page { animation: fadeIn .4s ease-out; max-width: 1600px; margin: 0 auto; }

                /* ── Header ── */
                .sched-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-4); }
                .sched-header-left { display: flex; flex-direction: column; gap: 4px; }
                .sched-header-sub { font-size: .8rem; color: var(--color-text-secondary); }
                .sched-header-sub strong { color: var(--color-text-primary); font-weight: 700; }
                .sched-header-actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; justify-content: flex-end; }

                /* Alliance tab buttons */
                .al-tab-btn { display: flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); font-size: .78rem; font-family: var(--font-family-display); font-weight: 600; cursor: pointer; transition: all .15s; }
                .al-tab-btn:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
                .al-tab-btn.active { background: var(--color-surface-hover); border-color: var(--al-color); color: var(--color-text-primary); box-shadow: 0 0 0 1px var(--al-color); }
                .al-tab-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
                .al-tab-count { font-size: .65rem; color: var(--color-text-hint); background: var(--color-surface-hover); border-radius: var(--radius-full); padding: 1px 6px; }
                .al-tab-btn.active .al-tab-count { background: rgba(var(--color-primary-rgb), .08); color: var(--color-primary); }
                .regen-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; font-size: .75rem; font-weight: 600; font-family: var(--font-family-display); background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-secondary); border-radius: var(--radius-md); cursor: pointer; text-decoration: none; transition: all .15s; }
                .regen-btn:hover { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-primary-light); }

                /* ── Stats bar ── */
                .sched-stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin-bottom: var(--space-5); }
                .stat-chip { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); }
                .stat-v { display: block; font-family: var(--font-family-display); font-size: 1.4rem; font-weight: 800; color: var(--color-text-primary); }
                .stat-l { display: block; font-size: .62rem; color: var(--color-text-hint); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }

                /* ── 2-col body ── */
                .sched-body { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,0.8fr); gap: var(--space-6); align-items: start; }

                /* ── Flight cards ── */
                .sched-left { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
                .fcard { padding: 0; overflow: hidden; cursor: pointer; transition: border-color .2s, box-shadow .2s, transform .2s; animation: cardFadeIn .3s ease-out both; animation-delay: var(--anim-delay, 0ms); }
                .fcard:hover { transform: translateY(-1px); border-color: var(--haul-c); }
                .fcard-active { border-color: var(--haul-c) !important; box-shadow: 0 0 0 1px var(--haul-c) !important; }
                @keyframes cardFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .fcard-topbar { display: flex; align-items: center; justify-content: space-between; padding: 9px 18px; background: rgba(var(--haul-rgb), .07); border-bottom: 1px solid rgba(var(--haul-rgb), .15); }
                .fcard-type { font-family: var(--font-family-display); font-size: .65rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--haul-c); }
                .fcard-xp { font-family: var(--font-family-display); font-size: .68rem; font-weight: 800; color: var(--haul-c); display: flex; align-items: center; gap: 4px; opacity: .9; }

                .fcard-body { padding: 0; display: flex; flex-direction: column; gap: 0; }

                /* Route — large Briefing-style ICAOs */
                .fcard-route { display: flex; align-items: stretch; justify-content: space-between; gap: var(--space-6); padding: var(--space-6) var(--space-6); border-bottom: 1px solid var(--color-border); }
                .fcard-route-airports { display: flex; align-items: center; gap: var(--space-4); flex: 1; }
                .fcard-route-mid { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0 var(--space-2); color: var(--color-text-hint); }
                .fcard-route-line { display: flex; align-items: center; gap: 4px; width: 80px; }
                .fcard-route-line-bar { flex: 1; height: 1px; background: var(--color-text-hint); opacity: .4; }
                .fcard-route-plane { color: var(--color-text-hint); transform: rotate(90deg); }
                .fcard-route-info { display: flex; flex-direction: column; gap: var(--space-2); justify-content: center; border-left: 1px solid var(--color-border); padding-left: var(--space-6); min-width: 160px; }
                .fcard-info-item { display: flex; flex-direction: column; gap: 1px; }
                .fcard-info-l { font-size: .6rem; text-transform: uppercase; letter-spacing: .06em; color: var(--color-text-hint); font-weight: 500; }
                .fcard-info-v { font-size: .88rem; font-weight: 500; color: var(--color-text-primary); font-family: var(--font-family-display); }
                .xp-green { color: var(--color-success); }
                .fcard-ap { display: flex; flex-direction: column; gap: 2px; }
                .fcard-ap-r { text-align: right; align-items: flex-end; }
                .fcard-icao { font-family: var(--font-family-display); font-size: 2.5rem; font-weight: 300; color: var(--color-text-primary); line-height: 1; letter-spacing: -.03em; }
                .fcard-apname { font-size: .7rem; color: var(--color-text-secondary); margin-top: 2px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
                .fcard-ap-label { font-size: .65rem; font-weight: 500; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 4px; }
                .fcard-ap-label-origin { color: var(--color-success); }
                .fcard-ap-label-dest { color: var(--color-danger, #ef4444); }
                .fcard-country { display: flex; align-items: center; gap: 3px; font-size: .62rem; color: var(--color-text-hint); margin-top: 2px; }
                .fcard-ap-r .fcard-country { justify-content: flex-end; }
                .fcard-route-mid { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 var(--space-2); }
                .fcard-dist { font-family: var(--font-family-display); font-size: .9rem; font-weight: 800; color: var(--color-text-primary); }
                .fcard-arrow { font-size: 1.2rem; color: var(--color-text-hint); }
                .fcard-dur { font-size: .68rem; color: var(--color-text-secondary); }

                /* Meta */

                .fcard-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: var(--radius-full); font-family: var(--font-family-display); font-size: .65rem; font-weight: 800; }
                .fcard-badge-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
                .fcard-badge-visited { background: rgba(var(--color-success-rgb), .1); color: var(--color-success); border: 1px solid rgba(var(--color-success-rgb), .2); }
                .fcard-badge-new { background: rgba(var(--color-primary-rgb), .07); color: var(--color-primary); border: 1px dashed rgba(var(--color-primary-rgb), .25); }

                /* Weather — Briefing style */
                .fcard-wx { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--color-border); }
                .fcard-wx-section { padding: var(--space-4) var(--space-6); }
                .fcard-wx-section:first-child { border-right: 1px solid var(--color-border); }
                .fcard-wx-label { font-size: .65rem; font-weight: 500; color: var(--color-text-hint); text-transform: uppercase; letter-spacing: .07em; display: block; margin-bottom: var(--space-2); }
                .wx-strip { display: flex; flex-direction: column; gap: 0; }
                .wx-strip-lbl { font-size: .65rem; font-weight: 500; color: var(--color-text-hint); text-transform: uppercase; letter-spacing: .07em; margin-bottom: var(--space-2); }
                .wx-grid-wrap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; background: rgba(0,0,0,0.02); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
                .wx-chip-col { display: flex; flex-direction: column; align-items: center; text-align: center; }
                .wx-cl { font-size: .6rem; color: var(--color-text-hint); text-transform: uppercase; letter-spacing: .06em; }
                .wx-cv { font-size: .75rem; font-weight: 500; font-family: var(--font-family-mono, 'Courier New', monospace); color: var(--color-text-primary); }
                .wx-unavailable { margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.02); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: .7rem; color: var(--color-text-hint); text-align: center; font-style: italic; }
                .fcard-empty { padding: var(--space-6); text-align: center; font-size: .8rem; color: var(--color-text-hint); }

                /* ── Airline / aircraft suggestion pill ── */
                .fcard-suggestion-pill { display: flex; align-items: center; gap: 5px; font-size: .68rem; font-weight: 600; color: var(--color-text-secondary); font-family: var(--font-family-display); background: rgba(var(--haul-rgb),.06); border: 1px solid rgba(var(--haul-rgb),.18); border-radius: var(--radius-full); padding: 3px 10px; }
                .fcard-suggestion-iata { font-size: .62rem; font-weight: 800; font-family: var(--font-family-mono, monospace); background: rgba(var(--haul-rgb),.15); color: var(--haul-c); border-radius: 3px; padding: 1px 5px; letter-spacing: .04em; }
                .fcard-suggestion-sep { opacity: .4; font-size: .7rem; }
                .fcard-suggestion-ac { color: var(--color-text-hint); font-size: .65rem; font-weight: 500; }

                /* ── SimBrief CTA ── */
                .fcard-simbrief { padding: var(--space-3) var(--space-6); border-top: 1px solid var(--color-border); background: rgba(var(--haul-rgb), .03); }
                .simbrief-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: var(--radius-md); font-size: .76rem; font-weight: 700; font-family: var(--font-family-display); letter-spacing: .02em; text-decoration: none; background: rgba(var(--haul-rgb), .08); color: var(--haul-c); border: 1px solid rgba(var(--haul-rgb), .25); transition: all .15s; cursor: pointer; }
                .simbrief-btn:hover { background: rgba(var(--haul-rgb), .16); border-color: rgba(var(--haul-rgb), .5); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(var(--haul-rgb), .2); }
                .simbrief-route { font-size: .68rem; font-weight: 500; opacity: .7; font-family: var(--font-family-mono, monospace); margin-left: 4px; }

                /* ── Map ── */
                .sched-map-col { position: sticky; top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); height: calc(100vh - 160px); }
                .sched-map-box { padding: 0; overflow: hidden; flex: 1; min-height: 500px; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }
                .map-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); color: var(--color-text-hint); font-size: .8rem; }
                .map-dist-badge { align-self: flex-start; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 5px 14px; font-family: var(--font-family-display); font-size: .78rem; font-weight: 800; color: var(--color-text-primary); }

                /* ── Loader ── */
                .persistence-loader { position: fixed; bottom: var(--space-12); right: var(--space-6); background: var(--color-surface); border: 1px solid var(--color-border); padding: var(--space-2) var(--space-4); border-radius: var(--radius-full); display: flex; align-items: center; gap: var(--space-2); font-size: .72rem; font-weight: 600; color: var(--color-text-secondary); box-shadow: var(--shadow-lg); z-index: 100; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

                /* ── Responsive ── */
                @media (max-width: 1100px) {
                    .sched-body { grid-template-columns: 1fr; }
                    .sched-map-col { position: static; height: 400px; }
                    .sched-stats-bar { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 700px) {
                    .sched-header { flex-direction: column; align-items: flex-start; }
                    .sched-header-actions { justify-content: flex-start; }
                    .fcard-route { grid-template-columns: 1fr; gap: var(--space-2); }
                    .fcard-icao { font-size: 1.5rem; }
                }
            `}</style>
        </div>
    );
}
