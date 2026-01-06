// kmbFetcher.js - 三公司模拟数据生成器 (稳定版)
console.log('[Data] 模拟数据模块已加载');

const SIMULATION_ROUTES = {
    'KMB': {
        color: '#E2231A',
        routes: {
            '101': {
                path: [
                    [114.225, 22.312], // 观塘
                    [114.214, 22.320],
                    [114.200, 22.333],
                    [114.183, 22.312],
                    [114.165, 22.332], // 旺角
                    [114.155, 22.320],
                    [114.135, 22.286]  // 坚尼地城
                ]
            },
            '1A': {
                path: [
                    [114.180, 22.320],
                    [114.185, 22.315],
                    [114.190, 22.310]
                ]
            }
        }
    },
    'CTB': {
        color: '#FFD100',
        routes: {
            '962': {
                path: [
                    [114.165, 22.332], // 起点
                    [114.175, 22.325],
                    [114.183, 22.312],
                    [114.190, 22.303],
                    [114.195, 22.295]  // 终点
                ]
            }
        }
    },
    'NLB': {
        color: '#6DCFF6',
        routes: {
            '1': {
                path: [
                    [113.945, 22.267], // 东涌附近
                    [113.935, 22.275],
                    [113.925, 22.280]
                ]
            }
        }
    }
};

/**
 * 生成所有模拟巴士数据 (主函数)
 * @returns {Promise<Array>} 巴士对象数组
 */
export async function getAllSimulatedBuses() {
    const allBuses = [];
    const now = Date.now();

    for (const [company, companyInfo] of Object.entries(SIMULATION_ROUTES)) {
        for (const [routeNum, routeInfo] of Object.entries(companyInfo.routes)) {
            const path = routeInfo.path;
            // 每条路线生成2辆巴士
            for (let i = 1; i <= 2; i++) {
                // 每辆车有独立、稳定的进度
                const busSeed = (i * 100) + routeNum.charCodeAt(0);
                const totalDuration = 400000; // 每辆车完整跑一圈的时间 (毫秒)
                const baseProgress = ((now % totalDuration) + busSeed) / totalDuration;
                
                const pointIndex = Math.floor(baseProgress * (path.length - 1));
                const nextIndex = Math.min(pointIndex + 1, path.length - 1);
                const segmentProgress = (baseProgress * (path.length - 1)) % 1;

                const [lng1, lat1] = path[pointIndex];
                const [lng2, lat2] = path[nextIndex];

                // 使用固定ID，避免车辆无故消失
                const busId = `${company}_${routeNum}_V${i}`;

                allBuses.push({
                    id: busId, // 固定ID是关键
                    lng: lng1 + (lng2 - lng1) * segmentProgress,
                    lat: lat1 + (lat2 - lat1) * segmentProgress,
                    route: routeNum,
                    operator: company,
                    direction: pointIndex % 2 === 0 ? '往终点' : '往起点',
                    color: companyInfo.color
                });
            }
        }
    }
    console.log(`[Data] 生成 ${allBuses.length} 辆模拟巴士`);
    return allBuses;
}

// 兼容旧版调用 (如果app.js还在用)
export async function getKmbBusesOnRoute(route) {
    const allBuses = await getAllSimulatedBuses();
    return allBuses.filter(bus => bus.operator === 'KMB' && (!route || bus.route === route));
}
