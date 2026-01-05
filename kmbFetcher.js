// kmbFetcher.js - 九巴 (KMB) 实时ETA数据获取与位置估算模块

// ============================================================================
// 配置区：这里是你最可能需要修改的地方
// ============================================================================

// 1. KMB API 基础URL（这是公开API示例，可能需要根据实际情况调整）
const KMB_API_BASE = 'https://data.etagmb.gov.hk/eta';
// 注意：某些API可能需要API Key，如果需要，请在此处添加，并在fetch请求的headers中传入。

// 2. 线路与站点模拟数据（因为真实API返回的是站点的ETA，我们需要知道站点位置）
//    这里以KMB 101路线（观塘裕民坊 <-> 堅尼地城）的部分站点为例。
//    你需要为你想显示的每条线路准备这样的数据。
const ROUTE_DATA = {
    '101': {
        stops: {
            // 站牌ID: [经度, 纬度]
            // 这些坐标需要你从地图上或公开数据中手动获取，这里仅为示例
            'A001': [114.183, 22.312], // 假设为观塘市中心附近
            'A002': [114.176, 22.309],
            'A003': [114.170, 22.315],
            'B001': [114.165, 22.332], // 假设为旺角附近
            'B002': [114.159, 22.321],
            // ... 更多站点
        },
        // 简易路径形状 (用于在没有精确路径时进行线性插值)
        // 这是一个从起点到终点的简化直线，实际效果会比较生硬。
        // 最佳实践是获取该线路的完整GPS轨迹点数组。
        path: [
            [114.183, 22.312], // 起点坐标 (A001)
            [114.165, 22.332], // 中间点坐标 (B001)
            [114.159, 22.321]  // 终点附近坐标 (B002)
        ]
    }
    // 可以继续添加 '102', '1A' 等其他路线
};

// ============================================================================
// 核心函数：获取并处理KMB数据
// ============================================================================

/**
 * 获取指定线路和站点的ETA数据
 * @param {string} route - 路线编号，如 '101'
 * @param {string} stopId - 站牌ID，如 'A001'
 * @returns {Promise<Array>} - 返回一个包含ETA对象的数组
 */
export async function fetchKmbEta(route, stopId) {
    // 构建API请求URL (此URL格式为示例，请根据官方文档调整)
    const apiUrl = `${KMB_API_BASE}/route-stop/${route}/${stopId}`;

    try {
        console.log(`正在请求KMB数据: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`网络响应不正常: ${response.status}`);
        }
        const data = await response.json();
        // 假设返回的数据结构是 { data: [ {eta: '2023-...', ...} ] }
        return data.data || [];
    } catch (error) {
        console.error(`获取KMB ${route} 线 ${stopId} 站数据失败:`, error);
        return []; // 发生错误时返回空数组，避免程序崩溃
    }
}

/**
 * 根据ETA数据，估算巴士的实时地图位置（核心算法）
 * @param {Object} etaRecord - 一条ETA记录，包含预计到站时间等
 * @param {string} route - 路线编号
 * @param {string} currentStopId - 当前查询的站牌ID
 * @returns {Object | null} - 返回 { id, lng, lat, route, operator, direction } 或 null（如果无法估算）
 */
function estimateBusPosition(etaRecord, route, currentStopId) {
    const routeInfo = ROUTE_DATA[route];
    if (!routeInfo) {
        console.warn(`未找到路线 ${route} 的配置数据`);
        return null;
    }

    // 1. 解析ETA时间
    // 假设etaRecord.eta是ISO格式字符串，如 "2023-10-27T14:30:00+08:00"
    const etaTimestamp = new Date(etaRecord.eta).getTime();
    const nowTimestamp = Date.now();

    // 2. 如果巴士已经过站（ETA时间已过去超过2分钟），则忽略这条数据
    if (nowTimestamp > etaTimestamp + 120000) {
        return null;
    }

    // 3. 获取当前站点和下一个站点的坐标（简化模型：假设巴士在当前站和下一站之间）
    const stopIds = Object.keys(routeInfo.stops);
    const currentIndex = stopIds.indexOf(currentStopId);
    if (currentIndex === -1 || currentIndex === stopIds.length - 1) {
        return null; // 当前站点未配置或是终点站
    }

    const currentStopCoord = routeInfo.stops[stopIds[currentIndex]];
    const nextStopCoord = routeInfo.stops[stopIds[currentIndex + 1]];

    // 4. 计算巴士在两点间的“进度”（一个0到1之间的数）
    //    这是一个简化计算：假设巴士匀速行驶，根据当前时间与ETA的比例估算位置。
    const timeToArrival = etaTimestamp - nowTimestamp; // 毫秒
    const totalTripTime = 5 * 60 * 1000; // 假设两站间行驶总时间为5分钟（这是一个示例，需要根据实际调整！）
    let progress = 1 - (timeToArrival / totalTripTime); // 越接近到站，progress越接近1

    // 将进度限制在0到1之间
    progress = Math.max(0, Math.min(1, progress));

    // 5. 线性插值计算经纬度
    const [lng1, lat1] = currentStopCoord;
    const [lng2, lat2] = nextStopCoord;
    const estimatedLng = lng1 + (lng2 - lng1) * progress;
    const estimatedLat = lat1 + (lat2 - lat1) * progress;

    // 6. 生成一个稳定的巴士ID（假设ETA记录里有车辆编号，若没有则用其他信息组合）
    const busId = `KMB_${route}_${etaRecord.vehicle || currentStopId}_${etaRecord.eta_seq || '0'}`;

    return {
        id: busId,
        lng: estimatedLng,
        lat: estimatedLat,
        route: route,
        operator: 'KMB',
        direction: etaRecord.dir || 'O', // 'O' 代表去程, 'I' 代表回程
        etaTimestamp: etaTimestamp,
        progress: progress
    };
}

/**
 * 主函数：获取并处理一条线路多个站点的数据，返回所有估算的巴士位置
 * @param {string} route - 路线编号
 * @returns {Promise<Array>} - 返回巴士对象数组
 */
export async function getKmbBusesOnRoute(route) {
    const allEstimatedBuses = [];
    const routeInfo = ROUTE_DATA[route];

    if (!routeInfo) {
        console.error(`路线 ${route} 未配置`);
        return [];
    }

    // 获取这条线路前3个站点的数据（为避免请求过多，先做演示）
    const stopIdsToQuery = Object.keys(routeInfo.stops).slice(0, 3);

    for (const stopId of stopIdsToQuery) {
        const etaList = await fetchKmbEta(route, stopId);
        for (const eta of etaList) {
            const bus = estimateBusPosition(eta, route, stopId);
            if (bus) {
                allEstimatedBuses.push(bus);
            }
        }
        // 在请求间添加短暂延迟，避免对服务器造成压力
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`路线 ${route} 共估算出 ${allEstimatedBuses.length} 辆巴士位置`);
    return allEstimatedBuses;
}
