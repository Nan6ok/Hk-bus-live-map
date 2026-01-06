// app.js - 香港巴士實時地圖主程式
// ==================== !!! 必須修改 !!! ====================
// 將下面的示例Token替換成你自己的Mapbox Public Token
// 獲取地址：https://account.mapbox.com/access-tokens/
const MAPBOX_TOKEN = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ';
// =========================================================

// 1. 设置Token并导入模块
mapboxgl.accessToken = MAPBOX_TOKEN;
import { getAllSimulatedBuses, fetchETAForRoute, getRouteData, fetchStop } from './kmbFetcher.js';

// 2. 全局状态
let map = null;
let allBuses = {};      // 主车辆库: { 车辆ID: 车辆数据 }
let busMarkers = {};    // 地图标记: { 车辆ID: marker对象 }
let isUpdating = false;
let updateInterval = null;
let animationId = null;  // For animation

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

function updateBusSource() {
    const features = Object.values(allBuses).map(bus => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [bus.lng, bus.lat]
        },
        properties: {
            id: bus.id,
            route: bus.route,
            operator: bus.operator,
            direction: bus.direction,
            direction_deg: bus.direction_deg,
            speed: bus.speed
        }
    }));
    const geojson = {
        type: 'FeatureCollection',
        features: features
    };
    if (busSource) {
        busSource.setData(geojson);
    }
}

// Display route on map
async function displayRoute(routeData) {
    // Create route lines
    const routeFeatures = [];
    if (routeData.pathO && routeData.pathO.length > 0) {
        routeFeatures.push({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: routeData.pathO
            },
            properties: { direction: 'O' }
        });
    }
    if (routeData.pathI && routeData.pathI.length > 0) {
        routeFeatures.push({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: routeData.pathI
            },
            properties: { direction: 'I' }
        });
    }

    map.getSource('routes').setData({
        type: 'FeatureCollection',
        features: routeFeatures
    });

    // Create stop markers
    const stopFeatures = [];
    const allStops = [...(routeData.stopsO || []), ...(routeData.stopsI || [])];
    for (const stopId of allStops) {
        // Fetch stop details
        const stopData = await fetchStop(routeData.company, stopId);
        if (stopData) {
            stopFeatures.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [stopData.long, stopData.lat]
                },
                properties: {
                    id: stopId,
                    name_en: stopData.name_en,
                    name_tc: stopData.name_tc
                }
            });
        }
    }

    map.getSource('stops').setData({
        type: 'FeatureCollection',
        features: stopFeatures
    });

    // Update route info panel
    document.getElementById('route-info').innerHTML = `
        <p><strong>${routeData.orig_tc} → ${routeData.dest_tc}</strong></p>
        <p>${routeData.orig_en} → ${routeData.dest_en}</p>
        <p>公司: ${OPERATOR_INFO[routeData.company]?.name || routeData.company}</p>
    `;

    // Fit map to route
    if (routeFeatures.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        routeFeatures.forEach(feature => {
            feature.geometry.coordinates.forEach(coord => {
                bounds.extend(coord);
            });
        });
        map.fitBounds(bounds, { padding: 50 });
    }
}

// 平滑動畫引擎
function animateBuses() {
    let hasMovement = false;
    Object.values(allBuses).forEach(bus => {
        if (bus.targetLng !== undefined && bus.targetLat !== undefined) {
            const dlng = bus.targetLng - bus.lng;
            const dlat = bus.targetLat - bus.lat;
            const distance = Math.sqrt(dlng * dlng + dlat * dlat);

            if (distance > 0.00001) {
                hasMovement = true;
                const speed = 0.00005; // 調整速度
                const moveStep = speed * Math.min(distance, 1);
                bus.lng += (dlng / distance) * moveStep;
                bus.lat += (dlat / distance) * moveStep;
                // Update marker position
                if (busMarkers[bus.id]) {
                    busMarkers[bus.id].setLngLat([bus.lng, bus.lat]);
                }
            } else {
                bus.lng = bus.targetLng;
                bus.lat = bus.targetLat;
            }
        }
    });

    if (hasMovement) {
        animationId = requestAnimationFrame(animateBuses);
    } else {
        animationId = null;
    }
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
                // 已有車輛：更新目標位置
                allBuses[newBus.id].targetLng = newBus.lng;
                allBuses[newBus.id].targetLat = newBus.lat;
                allBuses[newBus.id].direction = newBus.direction;
                allBuses[newBus.id].direction_deg = newBus.direction_deg;
            } else {
                // 新車輛：添加到系統
                allBuses[newBus.id] = {
                    ...newBus,
                    lng: newBus.lng,
                    lat: newBus.lat,
                    targetLng: newBus.lng,
                    targetLat: newBus.lat
                };
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

        // 更新地圖源
        updateBusSource();

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

        // Load 3D bus model (using box for testing)
        map.loadModel('bus-model', 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF/Box.gltf');

        // Add GeoJSON source for buses
        busSource = new mapboxgl.GeoJSONSource({
            data: { type: 'FeatureCollection', features: [] }
        });
        map.addSource('buses', busSource);

        // Add source for routes
        map.addSource('routes', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Add source for stops
        map.addSource('stops', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Wait for model to load, then add layer
        setTimeout(() => {
            // Add 3D model layer
            map.addLayer({
                id: 'bus-models',
                type: 'model',
                source: 'buses',
                layout: {
                    'model-id': 'bus-model'
                },
                paint: {
                    'model-scale': [0.1, 0.1, 0.1],  // Larger scale for testing
                    'model-rotation': [0, 0, 0],  // No rotation for box
                    'model-opacity': 1.0
                }
            });

        // Add route lines
        map.addLayer({
            id: 'route-lines',
            type: 'line',
            source: 'routes',
            paint: {
                'line-color': '#007cbf',
                'line-width': 3,
                'line-opacity': 0.8
            }
        });

        // Add stop markers
        map.addLayer({
            id: 'stop-markers',
            type: 'circle',
            source: 'stops',
            paint: {
                'circle-radius': 6,
                'circle-color': '#ffffff',
                'circle-stroke-color': '#007cbf',
                'circle-stroke-width': 2
            }
        });
                    etaText = '無法獲取';
                }

                new mapboxgl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <div class="bus-popup">
                            <h3>${opInfo.name} ${properties.route} 線</h3>
                            <p><strong>方向:</strong> ${properties.direction}</p>
                            <p><strong>公司:</strong> ${properties.operator}</p>
                            <p><strong>狀態:</strong> 行駛中</p>
                            <p><strong>ETA:</strong> ${etaText}</p>
                            <p class="bus-id">ID: ${properties.id}</p>
                        </div>
                    `)
                    .addTo(map);
            });

            // Change cursor on hover
            map.on('mouseenter', 'bus-models', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'bus-models', () => {
                map.getCanvas().style.cursor = '';
            });

            console.log('[App] 3D巴士模型加載完成');
        }, 5000); // Wait 5 seconds for model to load

        // 啟動動畫
        animateBuses();

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

        // 綁定路線選擇
        const routeSelect = document.getElementById('route-select');
        if (routeSelect) {
            routeSelect.onchange = async () => {
                const value = routeSelect.value;
                if (!value) {
                    // Clear route
                    map.getSource('routes').setData({ type: 'FeatureCollection', features: [] });
                    map.getSource('stops').setData({ type: 'FeatureCollection', features: [] });
                    document.getElementById('route-info').innerHTML = '';
                    return;
                }

                const [company, route] = value.split('-');
                const routeData = await getRouteData(company, route);
                if (routeData) {
                    displayRoute(routeData);
                }
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
