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
 * Fetch ETA for a specific stop
 * @param {string} company - 'KMB', 'CTB', or 'NLB'
 * @param {string} stopId - Stop ID
 * @returns {Promise<Array>} Array of ETA objects
 */
async function fetchETA(company, stopId) {
    const url = `${API_ENDPOINTS[company]}/eta/${stopId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`[Data] Failed to fetch ${company} ETA for ${stopId}:`, error);
        return [];
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
        const vehicles = await fetchVehiclePositions(company);
        const normalized = normalizeBusData(vehicles, company);
        allBuses.push(...normalized);
    }

    console.log(`[Data] Fetched ${allBuses.length} real-time buses`);
    return allBuses;
}

// Keep compatibility
export async function getKmbBusesOnRoute(route) {
    const allBuses = await getAllSimulatedBuses();
    return allBuses.filter(bus => bus.operator === 'KMB' && (!route || bus.route === route));
}
