// app.js - 香港巴士實時地圖 (整合KMB實時ETA API版本)
// ==============================================

// !!! 【必須修改】你的 Mapbox 訪問令牌 !!!
// 請替換成你自己的 Token (從 Mapbox 網站獲取)
mapboxgl.accessToken = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ'; 

// ==============================================
// 1. 導入模塊
// ==============================================
// 注意：請確保你的項目根目錄有 'kmbFetcher.js' 文件
import { getKmbBusesOnRoute } from './kmbFetcher.js';

// ==============================================
// 2. 地圖初始化
// ==============================================
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [114.1694, 22.3193], // 香港中心
    zoom: 11,
    pitch: 45, // 3D傾斜效果
    bearing: 0
});

// 巴士公司顏色
const OPERATOR_COLORS = {
    'KMB': '#E2231A',
    'CTB': '#FFD100',
    'NWFB': '#FFD100',
    'NLB': '#6DCFF6'
};

// ==============================================
// 3. 核心數據與狀態
// ==============================================
let allBuses = {}; // 改用空對象，等待真實數據填充
let busMarkers = {};
let isUpdating = false; // 防止數據更新重疊

// ==============================================
// 4. 核心函數
// ==============================================

// 4.1 添加巴士到地圖
function addBusToMap(busId) {
    const bus = allBuses[busId];
    if (!bus) return;

    const el = document.createElement('div');
    el.className = 'bus-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundColor = OPERATOR_COLORS[bus.operator] || '#888';
    el.style.borderRadius = '50%';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
    el.style.cursor = 'pointer';
    el.title = `${bus.operator} ${bus.route} | ${bus.direction}`;

    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.currentPosition.lng, bus.currentPosition.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <div class="bus-popup">
                    <h3>${bus.operator} ${bus.route} 路線</h3>
                    <p><strong>方向:</strong> ${bus.direction || 'N/A'}</p>
                    <p><strong>狀態:</strong> 行駛中</p>
                    <p><small>車輛 ID: ${busId}</small></p>
                </div>
            `))
        .addTo(map);
    
    busMarkers[busId] = marker;
}

// 4.2 平滑動畫引擎 (與之前相同，但改為讀取 allBuses 對象)
function animateBuses() {
    Object.keys(allBuses).forEach(busId => {
        const bus = allBuses[busId];
        const marker = busMarkers[busId];

        if (!marker || !bus.currentPosition || !bus.targetPosition) return;

        const dlng = bus.targetPosition.lng - bus.currentPosition.lng;
        const dlat = bus.targetPosition.lat - bus.currentPosition.lat;
        const distance = Math.sqrt(dlng * dlng + dlat * dlat);

        if (distance < 0.00001) {
            bus.currentPosition.lng = bus.targetPosition.lng;
            bus.currentPosition.lat = bus.targetPosition.lat;
        } else {
            const moveStep = bus.speed * Math.min(distance, 1);
            bus.currentPosition.lng += (dlng / distance) * moveStep;
            bus.currentPosition.lat += (dlat / distance) * moveStep;
        }
        marker.setLngLat([bus.currentPosition.lng, bus.currentPosition.lat]);
    });
    requestAnimationFrame(animateBuses);
}

// 4.3 更新資訊面板
function updateInfoPanel(count) {
    const countElement = document.getElementById('bus-count');
    const timeElement = document.getElementById('update-time');
    if (countElement) countElement.textContent = count;
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = 
            `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }
}

// 4.4 【核心新功能】從真實API更新巴士數據
async function updateBusesFromRealAPI() {
    if (isUpdating) {
        console.log('正在更新中，跳過此次請求');
        return;
    }
    isUpdating = true;
    
    try {
        console.log('開始從 KMB API 獲取實時數據...');
        
        // !!! 【可選修改】你可以更改這裡的路線號，例如 '101', '1A' 等
        const realBuses = await getKmbBusesOnRoute('101');
        console.log(`API 返回 ${realBuses.length} 輛巴士數據`);
        
        // 處理每輛從API返回的巴士
        realBuses.forEach(realBus => {
            if (allBuses[realBus.id]) {
                // 巴士已存在：更新目標位置
                allBuses[realBus.id].targetPosition = { 
                    lng: realBus.lng, 
                    lat: realBus.lat 
                };
            } else {
                // 新巴士：創建並添加到系統
                allBuses[realBus.id] = {
                    id: realBus.id,
                    route: realBus.route,
                    operator: realBus.operator,
                    direction: realBus.direction,
                    currentPosition: { lng: realBus.lng, lat: realBus.lat },
                    targetPosition: { lng: realBus.lng, lat: realBus.lat },
                    speed: 0.00015
                };
                // 將新巴士添加到地圖上
                addBusToMap(realBus.id);
            }
        });
        
        // 更新資訊面板
        updateInfoPanel(Object.keys(allBuses).length);
        
    } catch (error) {
        console.error('更新真實數據時出錯:', error);
        // 可選：在此處添加錯誤提示到網頁界面
    } finally {
        isUpdating = false;
    }
}

// ==============================================
// 5. 地圖加載與主程序
// ==============================================
map.on('load', () => {
    console.log('地圖載入完成！');
    
    // 5.1 添加3D建築層 (可選)
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

    // 5.2 啟動平滑動畫引擎
    animateBuses();
    console.log('平滑動畫引擎已啟動！');
    
    // 5.3 立即執行一次數據更新，然後每30秒更新一次
    updateBusesFromRealAPI();
    setInterval(updateBusesFromRealAPI, 30000); // 30秒更新一次
    
    // 5.4 (可選) 添加一個手動更新按鈕到資訊面板，方便測試
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) {
        const button = document.createElement('button');
        button.textContent = '手動更新數據';
        button.style.marginTop = '10px';
        button.onclick = updateBusesFromRealAPI;
        infoPanel.appendChild(button);
    }
});

// ==============================================
// 6. 啟動日誌
// ==============================================
console.log('香港巴士實時地圖應用程式 (KMB API 版本) 已初始化。');
