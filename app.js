// app.js - 香港巴士实时地图主程序
// ==================== !!! 必须修改 !!! ====================
// 将下面的示例Token替换成你自己的Mapbox Public Token
// 获取地址：https://account.mapbox.com/access-tokens/
const MAPBOX_TOKEN = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ';
// =========================================================

// 1. 设置Token并导入模块
mapboxgl.accessToken = MAPBOX_TOKEN;
import { getAllSimulatedBuses } from './kmbFetcher.js';

// 2. 全局状态
let map = null;
let allBuses = {};      // 主车辆库: { 车辆ID: 车辆数据 }
let busMarkers = {};    // 地图标记: { 车辆ID: marker对象 }
let isUpdating = false;
let updateInterval = null;

// 3. 运营商信息
const OPERATOR_INFO = {
    'KMB': { name: '九巴', color: '#E2231A' },
    'CTB': { name: '城巴', color: '#FFD100' },
    'NLB': { name: '新大屿山巴士', color: '#6DCFF6' }
};

// 4. 核心函数
function updateStatus(text) {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = text;
}

function updateInfoPanel(count) {
    const countEl = document.getElementById('bus-count');
    const timeEl = document.getElementById('update-time');
    if (countEl) countEl.textContent = count;
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('zh-HK');
    }
}

function createBusMarker(bus) {
    const el = document.createElement('div');
    const opInfo = OPERATOR_INFO[bus.operator] || { color: '#888', name: bus.operator };
    
    el.className = 'bus-marker';
    el.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background-color: ${opInfo.color};
        border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer; transition: transform 0.2s;
    `;
    el.title = `${opInfo.name} ${bus.route} | ${bus.direction}`;

    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.lng, bus.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <div class="bus-popup">
                    <h3>${opInfo.name} ${bus.route} 线</h3>
                    <p><strong>方向:</strong> ${bus.direction}</p>
                    <p><strong>公司:</strong> ${bus.operator}</p>
                    <p><strong>状态:</strong> 行驶中</p>
                    <p class="bus-id">ID: ${bus.id}</p>
                </div>
            `));
    return marker;
}

// 5. 平滑动画引擎 (防止车辆消失的关键)
function animateBuses() {
    Object.values(allBuses).forEach(bus => {
        const marker = busMarkers[bus.id];
        if (!marker || !bus.targetPosition) return;

        const curr = bus.currentPosition;
        const target = bus.targetPosition;
        const dlng = target.lng - curr.lng;
        const dlat = target.lat - curr.lat;
        const distance = Math.sqrt(dlng * dlng + dlat * dlat);

        if (distance < 0.00001) {
            // 到达目标
            curr.lng = target.lng;
            curr.lat = target.lat;
        } else {
            // 平滑移动 (速度与距离相关)
            const speed = bus.speed || 0.0001;
            const moveStep = speed * Math.min(distance, 1);
            curr.lng += (dlng / distance) * moveStep;
            curr.lat += (dlat / distance) * moveStep;
        }
        marker.setLngLat([curr.lng, curr.lat]);
    });
    requestAnimationFrame(animateBuses);
}

// 6. 数据更新函数 (防止车辆消失的关键逻辑)
async function updateBusesFromAPI() {
    if (isUpdating) {
        console.log('[App] 跳过，更新中');
        return;
    }
    isUpdating = true;
    updateStatus('正在更新数据...');

    try {
        const freshBuses = await getAllSimulatedBuses();
        console.log(`[App] 获取到 ${freshBuses.length} 辆巴士数据`);

        // 记录新数据中出现的ID
        const freshBusIds = new Set();

        freshBuses.forEach(newBus => {
            freshBusIds.add(newBus.id);

            if (allBuses[newBus.id]) {
                // 已有车辆：更新目标位置
                allBuses[newBus.id].targetPosition = { lng: newBus.lng, lat: newBus.lat };
                allBuses[newBus.id].direction = newBus.direction;
            } else {
                // 新车辆：添加到系统
                allBuses[newBus.id] = {
                    ...newBus,
                    currentPosition: { lng: newBus.lng, lat: newBus.lat },
                    targetPosition: { lng: newBus.lng, lat: newBus.lat },
                    speed: 0.0001
                };
                const marker = createBusMarker(allBuses[newBus.id]);
                marker.addTo(map);
                busMarkers[newBus.id] = marker;
                console.log(`[App] 新增车辆: ${newBus.id}`);
            }
        });

        // 重要：不移除“消失”的车辆，除非明确需要清理
        // 这样可以防止车辆因API暂时未包含而消失

        updateInfoPanel(Object.keys(allBuses).length);
        updateStatus('数据更新完成');
        
    } catch (error) {
        console.error('[App] 更新数据失败:', error);
        updateStatus('数据更新失败');
    } finally {
        isUpdating = false;
    }
}

// 7. 地图与程序初始化
function initApp() {
    console.log('[App] 初始化开始');
    updateStatus('正在加载地图...');

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [114.1694, 22.3193], // 香港中心
        zoom: 10.5,
        pitch: 40,
        bearing: 0
    });

    map.on('load', () => {
        console.log('[App] 地图加载完成');
        updateStatus('地图加载完成，启动动画...');

        // 添加3D建筑
        map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 11,
            'paint': {
                'fill-extrusion-color': '#ddd',
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 11, 0, 16, ['get', 'height']],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.7
            }
        }, 'road-label');

        // 启动动画引擎
        animateBuses();
        console.log('[App] 动画引擎启动');

        // 立即更新数据，然后每15秒更新一次
        updateBusesFromAPI();
        updateInterval = setInterval(updateBusesFromAPI, 15000);

        // 绑定手动刷新按钮
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                updateBusesFromAPI();
                refreshBtn.textContent = '刷新中...';
                setTimeout(() => refreshBtn.textContent = '🔄 手动刷新数据', 1000);
            };
        }
        updateStatus('系统运行中');
    });

    map.on('error', (e) => {
        console.error('[App] 地图错误:', e);
        updateStatus('地图加载错误，请检查Token');
    });
}

// 8. 启动程序
document.addEventListener('DOMContentLoaded', initApp);
console.log('[App] 主脚本已加载');
