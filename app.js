// app.js - 第一階段：顯示香港地圖與模擬巴士
// 你的 Mapbox 訪問令牌 (access token)
mapboxgl.accessToken = 'pk.eyJ1IjoibmFuNmtvayIsImEiOiJjbTZ0aGExcGYwM2RiMmpwYzF6cWtyM3N6In0.-HQMtE4dC0qVyaPs0pP-7g'; // ！！！請務必替換成你自己的 Token ！！！

// 地圖初始化
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [114.1694, 22.3193], // 香港中心
    zoom: 11,
    pitch: 45, // 地圖傾斜角度，產生 3D 效果
    bearing: 0
});

// 等待地圖載入完成後加入3D建築
map.on('load', () => {
    console.log('地圖載入完成！');
    // 加入 3D 建築圖層 (Mapbox 標準樣式)
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
    }, 'road-label'); // 確保建築在道路標籤之下

    // 初始載入一些模擬巴士
    loadInitialBuses();
});

// 巴士營運商顏色配置
const OPERATOR_COLORS = {
    'KMB': '#E2231A',
    'CTB': '#FFD100',
    'NWFB': '#FFD100',
    'NLB': '#6DCFF6'
};

// 儲存當前地圖上的巴士標記 (Marker)
let busMarkers = {};

// 函式：載入初始模擬巴士 (第二階段會替換為真實API)
function loadInitialBuses() {
    console.log('載入模擬巴士資料...');
    
    // 模擬資料 - 幾輛靜態巴士
    const simulatedBuses = [
        { id: 'KMB_101_001', lng: 114.165, lat: 22.332, route: '101', operator: 'KMB', direction: '往觀塘' },
        { id: 'CTB_962_001', lng: 114.158, lat: 22.321, route: '962', operator: 'CTB', direction: '往銅鑼灣' },
        { id: 'NLB_1_001', lng: 114.172, lat: 22.311, route: '1', operator: 'NLB', direction: '往梅窩' },
        { id: 'KMB_970X_001', lng: 114.152, lat: 22.328, route: '970X', operator: 'KMB', direction: '往香港仔' },
        { id: 'CTB_788_001', lng: 114.175, lat: 22.282, route: '788', operator: 'CTB', direction: '往小西灣' }
    ];
    
    // 清除舊標記 (如果有的話)
    clearAllBusMarkers();
    
    // 為每輛巴士建立地圖標記
    simulatedBuses.forEach(bus => {
        addBusToMap(bus);
    });
    
    // 更新資訊面板
    updateInfoPanel(simulatedBuses.length);
    console.log(`已在地圖上顯示 ${simulatedBuses.length} 輛巴士`);
}

// 函式：將一輛巴士新增到地圖上
function addBusToMap(bus) {
    // 建立一個 div 元素作為自訂標記
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
    
    // 建立 Mapbox 標記
    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.lng, bus.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <div class="bus-popup">
                    <h3>${bus.operator} ${bus.route} 路線</h3>
                    <p><strong>方向:</strong> ${bus.direction}</p>
                    <p><strong>狀態:</strong> 行駛中</p>
                    <p><small>車輛 ID: ${bus.id}</small></p>
                </div>
            `))
        .addTo(map);
    
    // 儲存標記以便後續管理
    busMarkers[bus.id] = marker;
}

// 函式：清除所有巴士標記
function clearAllBusMarkers() {
    Object.values(busMarkers).forEach(marker => marker.remove());
    busMarkers = {};
}

// 函式：更新資訊面板
function updateInfoPanel(count) {
    document.getElementById('bus-count').textContent = count;
    const now = new Date();
    document.getElementById('update-time').textContent = 
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// 初始化完成
console.log('香港巴士地圖應用已初始化');
