// app.js - 香港巴士實時地圖主程式
// ==================== !!! 必須修改 !!! ====================
// 將下面的示例Token替換成你自己的Mapbox Public Token
// 獲取地址：https://account.mapbox.com/access-tokens/
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
                    <h3>${opInfo.name} ${bus.route} 線</h3>
                    <p><strong>方向:</strong> ${bus.direction}</p>
                    <p><strong>公司:</strong> ${bus.operator}</p>
                    <p><strong>狀態:</strong> 行駛中</p>
                    <p class="bus-id">ID: ${bus.id}</p>
                </div>
            `));
    return marker;
}

// 6. 数据更新函数 (防止车辆消失的关键逻辑)
async function updateBusesFromAPI() {
    if (isUpdating) {
        console.log('[App] 跳過，更新中');
        return;
    }
    isUpdating = true;
    updateStatus('正在更新數據...');

    try {
        const freshBuses = await getAllSimulatedBuses();
        console.log(`[App] 收到 ${freshBuses.length} 輛新巴士數據`);
        console.log('[App] 樣本巴士:', freshBuses.slice(0, 3));

        // 記錄新數據中出現的ID
        const freshBusIds = new Set();

        freshBuses.forEach(newBus => {
            freshBusIds.add(newBus.id);

            if (allBuses[newBus.id]) {
                // 已有車輛：更新位置
                allBuses[newBus.id] = { ...allBuses[newBus.id], ...newBus };
                // 更新 marker 位置
                if (busMarkers[newBus.id]) {
                    busMarkers[newBus.id].setLngLat([newBus.lng, newBus.lat]);
                }
            } else {
                // 新車輛：添加到系統
                allBuses[newBus.id] = newBus;
                const marker = createBusMarker(allBuses[newBus.id]);
                marker.addTo(map);
                busMarkers[newBus.id] = marker;
                console.log(`[App] 新增車輛: ${newBus.id}`);
            }
        });

        // 移除消失的車輛
        Object.keys(allBuses).forEach(id => {
            if (!freshBusIds.has(id)) {
                delete allBuses[id];
                if (busMarkers[id]) {
                    busMarkers[id].remove();
                    delete busMarkers[id];
                }
                console.log(`[App] 移除車輛: ${id}`);
            }
        });

        updateInfoPanel(Object.keys(allBuses).length);
        updateStatus('數據更新完成');
        
    } catch (error) {
        console.error('[App] 更新數據失敗:', error);
        updateStatus('數據更新失敗');
    } finally {
        isUpdating = false;
    }
}

// 7. 地图与程序初始化
function initApp() {
    console.log('[App] 初始化開始');
    updateStatus('正在加載地圖...');

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [114.1694, 22.3193], // 香港中心
        zoom: 10.5,
        pitch: 40,
        bearing: 0
    });

    map.on('load', () => {
        console.log('[App] 地圖加載完成');
        updateStatus('地圖加載完成，啟動巴士更新...');

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

        console.log('[App] 3D建築加載完成');

        // 立即更新數據，然后每15秒更新一次
        updateBusesFromAPI();
        updateInterval = setInterval(updateBusesFromAPI, 15000);

        // 綁定手動刷新按鈕
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                updateBusesFromAPI();
                refreshBtn.textContent = '刷新中...';
                setTimeout(() => refreshBtn.textContent = '🔄 手動刷新數據', 1000);
            };
        }
        updateStatus('系統運行中');
    });

    map.on('error', (e) => {
        console.error('[App] 地圖錯誤:', e);
        updateStatus('地圖加載錯誤，請檢查Token');
    });
}

// 8. 啟動程式
document.addEventListener('DOMContentLoaded', initApp);
console.log('[App] 主腳本已加載');
