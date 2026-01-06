// kmbFetcher.js - 三公司模拟数据生成器 (稳定测试版)
console.log('[模拟器] 三公司模拟数据模块已加载');

// 定义三家公司的固定模拟路径（坐标均集中在香港核心区域，避免跑出视野）
const SIMULATION_ROUTES = {
  'KMB': {
    color: '#E2231A',
    routes: {
      '101': { // 观塘 <-> 坚尼地城 路径关键点
        path: [
          [114.225, 22.312], // 观塘模拟起点
          [114.214, 22.320],
          [114.200, 22.333],
          [114.183, 22.312],
          [114.165, 22.332],
          [114.155, 22.320],
          [114.135, 22.286]  // 坚尼地城模拟终点
        ]
      },
      '1A': { // 另一条短线示例
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
      '962': { // 屯门 <-> 铜锣湾 路径关键点
        path: [
          [114.165, 22.332], // 旺角附近模拟起点
          [114.175, 22.325],
          [114.183, 22.312],
          [114.190, 22.303],
          [114.195, 22.295]  // 铜锣湾模拟终点
        ]
      }
    }
  },
  'NLB': {
    color: '#6DCFF6',
    routes: {
      '1': { // 梅窝 <-> 大澳 路径关键点 (简化到东涌附近演示)
        path: [
          [113.945, 22.267], // 东涌模拟起点
          [113.935, 22.275],
          [113.925, 22.280]  // 大澳模拟终点
        ]
      }
    }
  }
};

/**
 * 生成所有公司的模拟巴士数据 (主函数)
 * 此函数将被 app.js 调用
 */
export async function getAllSimulatedBuses() {
  const allBuses = [];
  const now = Date.now();

  // 遍历每家公司、每条路线
  for (const [company, companyInfo] of Object.entries(SIMULATION_ROUTES)) {
    for (const [routeNum, routeInfo] of Object.entries(companyInfo.routes)) {
      const path = routeInfo.path;
      // 每条路线生成2辆巴士
      for (let i = 1; i <= 2; i++) {
        // 每辆巴士有独立的进度，使其错开
        const baseProgress = (now / 60000 + (i * 200) + routeNum.charCodeAt(0)) % 40000 / 40000;
        const pointIndex = Math.floor(baseProgress * (path.length - 1));
        const nextIndex = Math.min(pointIndex + 1, path.length - 1);
        const segmentProgress = (baseProgress * (path.length - 1)) % 1;

        const [lng1, lat1] = path[pointIndex];
        const [lng2, lat2] = path[nextIndex];

        const busId = `${company}_${routeNum}_SIM${i}`; // 固定ID，避免车辆无故消失

        allBuses.push({
          id: busId,
          lng: lng1 + (lng2 - lng1) * segmentProgress,
          lat: lat1 + (lat2 - lat1) * segmentProgress,
          route: routeNum,
          operator: company,
          direction: pointIndex % 2 === 0 ? '往' + routeNum + '方向A' : '往' + routeNum + '方向B',
          // 可以将颜色也传给前端，方便未来扩展
          _color: companyInfo.color
        });
      }
    }
  }
  console.log(`[模拟器] 已生成 ${allBuses.length} 辆模拟巴士`);
  return allBuses;
}

// 兼容旧调用，确保 app.js 不报错 (保留此函数，但内部调用新的主函数)
export async function getKmbBusesOnRoute(route) {
  console.log('[模拟器] 兼容调用: getKmbBusesOnRoute');
  const allBuses = await getAllSimulatedBuses();
  // 过滤出KMB的指定路线巴士，若未指定路线则返回所有KMB巴士
  return allBuses.filter(bus => bus.operator === 'KMB' && (!route || bus.route === route));
}
