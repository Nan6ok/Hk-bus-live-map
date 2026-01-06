// kmbFetcher.js - 獲取九巴(KMB)實時數據 (安全版本)

// 配置：KMB 101路線的模擬站點坐標 (香港島至九龍)
const ROUTE_DATA = {
    '101': {
        stops: {
            'KT1': [114.183, 22.312], // 觀塘市中心模擬坐標
            'KT2': [114.176, 22.309],
            'MK1': [114.170, 22.315], // 旺角模擬坐標
            'MK2': [114.165, 22.332],
            'YD1': [114.159, 22.321]  // 油麻地模擬坐標
        }
    }
};

/**
 * 模擬獲取KMB ETA數據，避免真實API的複雜性。
 * 返回模擬的、會移動的巴士數據。
 * @param {string} route - 路線號碼，如 '101'
 * @returns {Promise<Array>} - 返回巴士對象數組
 */
export async function getKmbBusesOnRoute(route = '101') {
    console.log(`[KMB] 模擬獲取路線 ${route} 的數據`);
    
    // 如果配置中沒有該路線，返回空數組
    const routeInfo = ROUTE_DATA[route];
    if (!routeInfo) {
        console.warn(`[KMB] 未配置路線 ${route} 的數據`);
        return [];
    }
    
    // 模擬3輛巴士
    const stopIds = Object.keys(routeInfo.stops);
    const now = Date.now();
    const simulatedBuses = [];
    
    for (let i = 1; i <= 3; i++) {
        // 讓每輛巴士在不同的站點間“移動”
        const baseProgress = (now / 60000 + i * 5) % 100 / 100; // 基於時間的進度
        const stopIndex = Math.floor(baseProgress * (stopIds.length - 1));
        
        const currentStopId = stopIds[stopIndex];
        const nextStopId = stopIds[stopIndex + 1] || stopIds[stopIndex];
        
        const currentStopCoord = routeInfo.stops[currentStopId];
        const nextStopCoord = routeInfo.stops[nextStopId];
        
        // 計算當前站點內的進度 (0 到 1)
        const segmentProgress = (baseProgress * (stopIds.length - 1)) % 1;
        
        // 線性插值計算經緯度
        const lng = currentStopCoord[0] + (nextStopCoord[0] - currentStopCoord[0]) * segmentProgress;
        const lat = currentStopCoord[1] + (nextStopCoord[1] - currentStopCoord[1]) * segmentProgress;
        
        const busId = `KMB_${route}_SIM${i}`;
        
        simulatedBuses.push({
            id: busId,
            lng: lng,
            lat: lat,
            route: route,
            operator: 'KMB',
            direction: i % 2 === 0 ? '往觀塘' : '往堅尼地城'
        });
    }
    
    console.log(`[KMB] 返回 ${simulatedBuses.length} 輛模擬巴士`);
    return simulatedBuses;
}

// 備用：如果未來想連接真實API，可在此添加函數
// export async function fetchRealKmbEta(route, stopId) { ... }
/**
 * 模拟获取城巴 (CTB) 路線數據（測試用）
 * 以城巴 962 路線（屯門 <-> 銅鑼灣）為例，使用模擬坐標
 */
export async function getCtbBusesOnRoute(route = '962') {
    console.log(`[CTB] 模擬獲取城巴路線 ${route} 的數據`);
    // 定義 962 路線的模擬關鍵坐標點（屯門 -> 港島）
    const ctbRoutePath = [
        [113.97, 22.39],  // 屯門市中心附近
        [114.00, 22.37],
        [114.04, 22.33],  // 荃灣附近
        [114.07, 22.32],
        [114.12, 22.29],  // 青嶼幹線附近
        [114.16, 22.29],
        [114.17, 22.28],  // 西區海底隧道港島入口
        [114.18, 22.28],  // 西營盤附近
        [114.19, 22.28],  // 上環附近
        [114.20, 22.28]   // 銅鑼灣附近
    ];
    const now = Date.now();
    const simulatedBuses = [];
    // 模擬2輛城巴巴士
    for (let i = 1; i <= 2; i++) {
        const baseProgress = (now / 60000 + i * 300) % 50000 / 50000;
        const pointIndex = Math.floor(baseProgress * (ctbRoutePath.length - 1));
        const nextPointIndex = Math.min(pointIndex + 1, ctbRoutePath.length - 1);
        const currentPoint = ctbRoutePath[pointIndex];
        const nextPoint = ctbRoutePath[nextPointIndex];
        const segmentProgress = (baseProgress * (ctbRoutePath.length - 1)) % 1;
        const lng = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * segmentProgress;
        const lat = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * segmentProgress;
        const busId = `CTB_${route}_SIM${i}`;
        // 根據進度判斷方向
        const direction = baseProgress > 0.5 ? '往銅鑼灣' : '往屯門';
        simulatedBuses.push({
            id: busId,
            lng: lng,
            lat: lat,
            route: route,
            operator: 'CTB', // 營運商標記為 CTB
            direction: direction
        });
    }
    console.log(`[CTB] 返回 ${simulatedBuses.length} 輛模擬巴士`);
    return simulatedBuses;
}
