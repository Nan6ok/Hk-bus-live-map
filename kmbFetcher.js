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
 * Fetch route path
 * @param {string} company - 'KMB', 'CTB', or 'NLB'
 * @param {string} route - Route number
 * @param {string} bound - 'O' or 'I'
 * @returns {Promise<Array>} Array of coordinates
 */
async function fetchRoutePath(company, route, bound) {
    const url = `${API_ENDPOINTS[company]}/route-path/${route}/${bound}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`[Data] Failed to fetch ${company} route path ${route}/${bound}:`, error);
        return [];
    }
}

/**
 * Fetch route stops
 * @param {string} company - 'KMB', 'CTB', or 'NLB'
 * @param {string} route - Route number
 * @param {string} bound - 'O' or 'I'
 * @returns {Promise<Array>} Array of stop IDs
 */
async function fetchRouteStops(company, route, bound) {
    const routeData = await fetchRoute(company, route, bound);
    return routeData ? routeData.stops || [] : [];
}

/**
 * Fetch stop details
 * @param {string} company - 'KMB', 'CTB', or 'NLB'
 * @param {string} stopId - Stop ID
 * @returns {Promise<Object>} Stop data
 */
export async function fetchStop(company, stopId) {
    const url = `${API_ENDPOINTS[company]}/stop/${stopId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error(`[Data] Failed to fetch ${company} stop ${stopId}:`, error);
        return null;
    }
}

/**
 * Get complete route data including path and stops
 * @param {string} company - Company
 * @param {string} route - Route
 * @returns {Promise<Object>} Route data with path and stops
 */
export async function getRouteData(company, route) {
    try {
        const [routeO, routeI] = await Promise.all([
            fetchRoute(company, route, 'O'),
            fetchRoute(company, route, 'I')
        ]);

        const routeData = routeO || routeI;
        if (!routeData) return null;

        const [pathO, pathI, stopsO, stopsI] = await Promise.all([
            fetchRoutePath(company, route, 'O'),
            fetchRoutePath(company, route, 'I'),
            fetchRouteStops(company, route, 'O'),
            fetchRouteStops(company, route, 'I')
        ]);

        return {
            route: routeData.route,
            company,
            orig_en: routeData.orig_en,
            dest_en: routeData.dest_en,
            orig_tc: routeData.orig_tc,
            dest_tc: routeData.dest_tc,
            pathO: pathO.map(p => [p.long, p.lat]),
            pathI: pathI.map(p => [p.long, p.lat]),
            stopsO,
            stopsI
        };
    } catch (error) {
        console.error(`[Data] Failed to get route data for ${company} ${route}:`, error);
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
