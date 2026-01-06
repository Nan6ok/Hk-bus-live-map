// busFetcher.js - Real-time bus data fetcher for Hong Kong bus companies
console.log('[Data] Real-time bus data module loaded');

// API endpoints
const API_ENDPOINTS = {
    'KMB': 'https://data.etabus.gov.hk/v1/transport/kmb',
    'CTB': 'https://rt.data.gov.hk/v1/transport/citybus-nwfb',
    'NLB': 'https://rt.data.gov.hk/v1/transport/nlb'
};

/**
 * Fetch vehicle positions for a company
 * @param {string} company - 'KMB', 'CTB', or 'NLB'
 * @returns {Promise<Array>} Array of bus objects
 */
async function fetchVehiclePositions(company) {
    const url = `${API_ENDPOINTS[company]}/vehicle-position/`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`[Data] Failed to fetch ${company} vehicle positions:`, error);
        return [];
    }
}

/**
 * Fetch route information
 * @param {string} company - 'KMB', 'CTB', or 'NLB'
 * @param {string} route - Route number
 * @param {string} bound - 'O' or 'I'
 * @returns {Promise<Object>} Route data
 */
async function fetchRoute(company, route, bound) {
    const url = `${API_ENDPOINTS[company]}/route/${route}/${bound}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error(`[Data] Failed to fetch ${company} route ${route}/${bound}:`, error);
        return null;
    }
}

/**
 * Fetch ETA for a route at its first stop
 * @param {string} company - Company
 * @param {string} route - Route
 * @returns {Promise<string>} ETA string
 */
export async function fetchETAForRoute(company, route) {
    try {
        // Try both directions
        const routeO = await fetchRoute(company, route, 'O');
        const routeI = await fetchRoute(company, route, 'I');
        
        const routeData = routeO || routeI;
        if (!routeData || !routeData.stops || routeData.stops.length === 0) {
            return null;
        }

        // Get ETA for the first stop
        const firstStop = routeData.stops[0];
        const etaData = await fetchETA(company, firstStop);
        
        if (etaData && etaData.length > 0) {
            const nextETA = etaData[0];
            const etaTime = new Date(nextETA.eta);
            const now = new Date();
            const diffMinutes = Math.floor((etaTime - now) / 60000);
            return `${diffMinutes} 分鐘`;
        }
        return null;
    } catch (error) {
        console.error(`[Data] Failed to fetch ETA for ${company} ${route}:`, error);
        return null;
    }
}

/**
 * Normalize bus data from different APIs to a common format
 * @param {Array} vehicles - Raw vehicle data
 * @param {string} company - Company name
 * @returns {Array} Normalized bus objects
 */
function normalizeBusData(vehicles, company) {
    return vehicles.map(vehicle => ({
        id: `${company}_${vehicle.vehicle_id || vehicle.bus || vehicle.id}`,
        lng: parseFloat(vehicle.long || vehicle.longitude),
        lat: parseFloat(vehicle.lat || vehicle.latitude),
        route: vehicle.route,
        operator: company,
        direction: vehicle.bound === 'O' ? 'Outbound' : 'Inbound',
        direction_deg: vehicle.direction || 0,
        speed: vehicle.speed || 0,
        service_type: vehicle.service_type || '1'
    })).filter(bus => !isNaN(bus.lng) && !isNaN(bus.lat));
}

/**
 * Generate all real-time bus data from all companies
 * @returns {Promise<Array>} Array of bus objects
 */
export async function getAllSimulatedBuses() {
    const allBuses = [];
    const companies = ['KMB', 'CTB', 'NLB'];

    for (const company of companies) {
        console.log(`[Data] Fetching ${company} data...`);
        const vehicles = await fetchVehiclePositions(company);
        console.log(`[Data] ${company} raw vehicles:`, vehicles.length);
        const normalized = normalizeBusData(vehicles, company);
        console.log(`[Data] ${company} normalized buses:`, normalized.length);
        allBuses.push(...normalized);
    }

    console.log(`[Data] Total fetched ${allBuses.length} real-time buses`);
    console.log('[Data] Sample bus:', allBuses[0]);
    return allBuses;
}

// Keep compatibility
export async function getKmbBusesOnRoute(route) {
    const allBuses = await getAllSimulatedBuses();
    return allBuses.filter(bus => bus.operator === 'KMB' && (!route || bus.route === route));
}
