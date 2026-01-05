// app.js - 香港巴士實時地圖主程序 (安全、完整版)

// ==================== 【必須修改】 ====================
// 請將下面的 Token 替換成你自己的 Mapbox 公開令牌 (Public Token)
// 獲取地址：https://account.mapbox.com/access-tokens/
mapboxgl.accessToken = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ';
// =====================================================

// 1. 導入模塊
import { getKmbBusesOnRoute } from './kmbFetcher.js';

// 2. 地圖初始化
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [114.1694, 22.3193], // 香港中心
    zoom: 11,
    pitch: 45, // 3D傾斜
    bearing: 0
});

// 3. 巴士顏色定義
const OPERATOR_COLORS = {
    'KMB': '#E2231A', // 九巴紅
    'CTB': '#FFD100', // 城巴黃
    'NLB': '#6DCFF6'  // 新大嶼山藍
};

// 4. 全局變量
let allBuses = {};     // 儲存所有巴士數據
let busMarkers = {};   // 儲存地圖標記
let isUpdating = false; // 防止重複更新

// 5. 函數：添加巴士到地圖
function addBusToMap(busId) {
    const bus = allBuses[busId];
    if (!bus) return;

    const el = document.createElement('div');
    el.className = 'bus-marker';
    el.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background-color: ${OPERATOR_COLORS[bus.operator] || '#888'};
        border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);
        cursor: pointer;
    `;
    el.title = `${bus.operator} ${bus.route} | ${bus.direction}`;

    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.currentPosition.lng, bus.currentPosition.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <div class="bus-popup">
                    <h3>${bus.operator} ${bus.route} 路線</h3>
                    <p><strong>方向:</strong> ${bus.direction}</p>
                    <p><strong>狀態:</strong> 行駛中</p>
                    <p><small>車輛 ID: ${busId}</small></p>
                </div>
            `))
        .addTo(map);
    
    busMarkers[busId] = marker;
}

// 6. 函數：平滑動畫引擎 (核心)
function animateBuses() {
    Object.keys(allBuses).forEach(busId => {
        const bus = allBuses[busId];
        const marker = busMarkers[busId];
        if (!marker || !bus.currentPosition || !bus.targetPosition) return;

        const dlng = bus.targetPosition.lng - bus.currentPosition.lng;
        const dlat = bus.targetPosition.lat - bus.currentPosition.lat;
        const distance = Math.sqrt(dlng * dlng + dlat * dlat);

        if (distance < 0.00001) {
            // 到達目標
            bus.currentPosition.lng = bus.targetPosition.lng;
            bus.currentPosition.lat = bus.targetPosition.lat;
        } else {
            // 平滑移動
            const moveStep = bus.speed * Math.min(distance, 1);
            bus.currentPosition.lng += (dlng / distance) * moveStep;
            bus.currentPosition.lat += (dlat / distance) * moveStep;
        }
        marker.setLngLat([bus.currentPosition.lng, bus.currentPosition.lat]);
    });
    requestAnimationFrame(animateBuses);
}

// 7. 函數：更新信息面板
function updateInfoPanel(count) {
    const countEl = document.getElementById('bus-count');
    const timeEl = document.getElementById('update-time');
    if (countEl) countEl.textContent = count;
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = 
            `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }
}

// 8. 函數：從數據源獲取並更新巴士 (核心)
async function updateBusesFromAPI() {
    if (isUpdating) return;
    isUpdating = true;

    try {
        console.log('[系統] 正在更新巴士數據...');
        // 調用 kmbFetcher.js 中的函數獲取數據
        const realBuses = await getKmbBusesOnRoute('101'); // 固定獲取101路線
        
        realBuses.forEach(realBus => {
            if (allBuses[realBus.id]) {
                // 更新已有巴士的目標位置
                allBuses[realBus.id].targetPosition = { 
                    lng: realBus.lng, 
                    lat: realBus.lat 
                };
            } else {
                // 添加新巴士
                allBuses[realBus.id] = {
                    id: realBus.id,
                    route: realBus.route,
                    operator: realBus.operator,
                    direction: realBus.direction,
                    currentPosition: { lng: realBus.lng, lat: realBus.lat },
                    targetPosition: { lng: realBus.lng, lat: realBus.lat },
                    speed: 0.0001 // 移動速度
                };
                addBusToMap(realBus.id);
            }
        });
        
        updateInfoPanel(Object.keys(allBuses).length);
        console.log(`[系統] 更新完成，共管理 ${Object.keys(allBuses).length} 輛巴士`);
        
    } catch (error) {
        console.error('[系統] 更新數據時出錯:', error);
    } finally {
        isUpdating = false;
    }
}

// 9. 地圖加載完成後的主程序
map.on('load', () => {
    console.log('[系統] 地圖加載完成！');
    
    // 添加3D建築層 (可選)
    map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 12,
        'paint': {
            'fill-extrusion-color': '#ddd',
            'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                12, 0, 15, ['get', 'height']
            ],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6
        }
    }, 'road-label');
    
    // 啟動平滑動畫引擎
    animateBuses();
    console.log('[系統] 平滑動畫引擎已啟動');
    
    // 立即獲取一次數據，然後每20秒更新一次
    updateBusesFromAPI();
    const updateInterval = setInterval(updateBusesFromAPI, 20000);
    
    // 綁定手動刷新按鈕
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.onclick = updateBusesFromAPI;
    }
});

// 10. 初始日誌
console.log('[系統] 香港巴士實時地圖已初始化。');
