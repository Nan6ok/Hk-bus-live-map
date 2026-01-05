// app.js - 香港巴士實時地圖 (第一階段：平滑動畫引擎)
// ==============================================
// 你的 Mapbox 訪問令牌 (Access Token)
// !!! 重要：請務必替換成你自己的 Token !!!
mapboxgl.accessToken = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ'; // ← 替換這裡

// 地圖初始化
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [114.1694, 22.3193], // 香港中心
    zoom: 11,
    pitch: 45, // 地圖傾斜角度，產生 3D 效果
    bearing: 0
});

// 巴士營運商顏色配置
const OPERATOR_COLORS = {
    'KMB': '#E2231A', // 九巴紅
    'CTB': '#FFD100', // 城巴/新巴黃
    'NWFB': '#FFD100',
    'NLB': '#6DCFF6'  // 新大嶼山藍
};

// ==============================================
// 核心數據結構：儲存所有巴士的完整信息
// ==============================================
let allBuses = {
    // 示例巴士 1
    'KMB_101_001': {
        id: 'KMB_101_001',
        route: '101',
        operator: 'KMB',
        direction: '往觀塘',
        // 核心：兩個位置
        currentPosition: { lng: 114.165, lat: 22.332 }, // 地圖上實際顯示的位置
        targetPosition: { lng: 114.165, lat: 22.332 },  // 平滑移動的目標位置 (初始相同)
        speed: 0.00015 // 移動速度（經緯度/每次動畫幀），調整此值可控制快慢
    },
    // 示例巴士 2
    'CTB_962_001': {
        id: 'CTB_962_001',
        route: '962',
        operator: 'CTB',
        direction: '往銅鑼灣',
        currentPosition: { lng: 114.158, lat: 22.321 },
        targetPosition: { lng: 114.158, lat: 22.321 },
        speed: 0.00015
    },
    // 示例巴士 3
    'NLB_1_001': {
        id: 'NLB_1_001',
        route: '1',
        operator: 'NLB',
        direction: '往梅窩',
        currentPosition: { lng: 114.172, lat: 22.311 },
        targetPosition: { lng: 114.172, lat: 22.311 },
        speed: 0.00015
    }
};

// 儲存地圖標記物件的字典
let busMarkers = {};

// ==============================================
// 函式：將一輛巴士添加到地圖上
// ==============================================
function addBusToMap(busId) {
    const bus = allBuses[busId];
    if (!bus) return;

    // 1. 建立自訂標記圖標 (彩色圓點)
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

    // 2. 建立 Mapbox 標記，位置取自巴士的 currentPosition
    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.currentPosition.lng, bus.currentPosition.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <div class="bus-popup">
                    <h3>${bus.operator} ${bus.route} 路線</h3>
                    <p><strong>方向:</strong> ${bus.direction}</p>
                    <p><strong>狀態:</strong> <span class="bus-status-${busId}">行駛中</span></p>
                    <p><small>車輛 ID: ${busId}</small></p>
                </div>
            `))
        .addTo(map);
    
    // 3. 儲存標記物件，以便後續更新位置
    busMarkers[busId] = marker;
}

// ==============================================
// 函式：核心平滑動畫引擎 (最重要！)
// ==============================================
function animateBuses() {
    // 遍歷所有巴士，更新它們的當前位置
    Object.keys(allBuses).forEach(busId => {
        const bus = allBuses[busId];
        const marker = busMarkers[busId];

        // 如果標記或位置數據不存在，跳過
        if (!marker || !bus.currentPosition || !bus.targetPosition) return;

        // 計算當前位置與目標位置的差值
        const dlng = bus.targetPosition.lng - bus.currentPosition.lng;
        const dlat = bus.targetPosition.lat - bus.currentPosition.lat;

        // 計算兩點之間的距離（簡化計算）
        const distance = Math.sqrt(dlng * dlng + dlat * dlat);

        // 如果距離非常小（幾乎到達），則直接設置為目標位置
        if (distance < 0.00001) {
            bus.currentPosition.lng = bus.targetPosition.lng;
            bus.currentPosition.lat = bus.targetPosition.lat;
        } else {
            // 否則，計算移動步長（速度 * 距離，這樣移動會先快後慢）
            const moveStep = bus.speed * Math.min(distance, 1);
            
            // 沿著方向向量移動一步
            bus.currentPosition.lng += (dlng / distance) * moveStep;
            bus.currentPosition.lat += (dlat / distance) * moveStep;
        }

        // 更新地圖上標記的實際位置
        marker.setLngLat([bus.currentPosition.lng, bus.currentPosition.lat]);
    });

    // 請求下一幀動畫，形成連續不斷的動畫循環
    requestAnimationFrame(animateBuses);
}

// ==============================================
// 函式：更新資訊面板
// ==============================================
function updateInfoPanel(count) {
    document.getElementById('bus-count').textContent = count;
    const now = new Date();
    document.getElementById('update-time').textContent = 
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// ==============================================
// 地圖加載完成後的主初始化邏輯
// ==============================================
map.on('load', () => {
    console.log('地圖載入完成！');
    
    // 1. 加入 3D 建築圖層 (可選)
    if (map.getLayer('3d-buildings')) {
        map.removeLayer('3d-buildings');
        map.removeSource('composite');
    }
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

    // 2. 將所有巴士添加到地圖上
    Object.keys(allBuses).forEach(busId => {
        addBusToMap(busId);
    });
    
    // 3. 更新資訊面板
    updateInfoPanel(Object.keys(allBuses).length);
    console.log(`已在地圖上顯示 ${Object.keys(allBuses).length} 輛巴士`);
    
    // 4. 啟動平滑動畫引擎 (核心)
    animateBuses();
    console.log('平滑動畫引擎已啟動！');
    
    // 5. 測試：3秒後，讓九巴移動到一個新位置
    setTimeout(() => {
        if (allBuses['KMB_101_001']) {
            allBuses['KMB_101_001'].targetPosition = { lng: 114.170, lat: 22.340 };
            console.log('測試：已為 KMB_101_001 設定新目標位置，它應開始向東北方緩慢移動。');
        }
    }, 3000);
    
    // 6. 測試：8秒後，讓城巴也移動
    setTimeout(() => {
        if (allBuses['CTB_962_001']) {
            allBuses['CTB_962_001'].targetPosition = { lng: 114.148, lat: 22.315 };
            console.log('測試：已為 CTB_962_001 設定新目標位置，它應開始向西南方緩慢移動。');
        }
    }, 8000);
});

// ==============================================
// 初始化完成日誌
// ==============================================
console.log('香港巴士實時地圖應用程式 (第一階段) 已初始化。');
