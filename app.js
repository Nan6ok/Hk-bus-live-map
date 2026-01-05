// app.js - 香港巴士实时地图 (为 iPad 优化，完整版)
// ==============================================
// 【！必填！】你的 Mapbox 令牌 (从 mapbox.com 获取)
mapboxgl.accessToken = 'pk.eyJ1IjoibmFuNm9rIiwiYSI6ImNtazB2bTYxMTdhNnkzZHB1cXN4bTRmb3UifQ.c6BNgPAE-3qtewe22CGvyQ'; // ← 替换这里！

// ==============================================
// 1. 导入模块 (确保有 kmbFetcher.js 文件)
// ==============================================
import { getKmbBusesOnRoute } from './kmbFetcher.js';

// ==============================================
// 2. 地图初始化
// ==============================================
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [114.1694, 22.3193],
    zoom: 11,
    pitch: 45
});

// 公司颜色
const OPERATOR_COLORS = { 'KMB': '#E2231A', 'CTB': '#FFD100', 'NLB': '#6DCFF6' };

// ==============================================
// 3. 核心数据
// ==============================================
let allBuses = {};
let busMarkers = {};
let isUpdating = false;

// ==============================================
// 4. 核心函数定义
// ==============================================

// 4.1 添加巴士标记
function addBusToMap(busId) {
    const bus = allBuses[busId];
    if (!bus) return;

    const el = document.createElement('div');
    el.className = 'bus-marker';
    Object.assign(el.style, {
        width: '20px', height: '20px', borderRadius: '50%',
        backgroundColor: OPERATOR_COLORS[bus.operator] || '#888',
        border: '3px solid white', boxShadow: '0 0 5px rgba(0,0,0,0.5)',
        cursor: 'pointer'
    });
    el.title = `${bus.operator} ${bus.route}`;

    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.currentPosition.lng, bus.currentPosition.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="bus-popup">
                <h3>${bus.operator} ${bus.route}</h3>
                <p><strong>方向:</strong> ${bus.direction || 'N/A'}</p>
                <p><small>ID: ${busId}</small></p>
            </div>
        `))
        .addTo(map);
    
    busMarkers[busId] = marker;
}

// 4.2 平滑动画引擎
function animateBuses() {
    Object.keys(allBuses).forEach(busId => {
        const bus = allBuses[busId];
        const marker = busMarkers[busId];
        if (!marker || !bus.currentPosition || !bus.targetPosition) return;

        const dlng = bus.targetPosition.lng - bus.currentPosition.lng;
        const dlat = bus.targetPosition.lat - bus.currentPosition.lat;
        const distance = Math.sqrt(dlng * dlng + dlat * dlat);

        if (distance < 0.00001) {
            bus.currentPosition = { ...bus.targetPosition };
        } else {
            const moveStep = 0.00015 * Math.min(distance, 1);
            bus.currentPosition.lng += (dlng / distance) * moveStep;
            bus.currentPosition.lat += (dlat / distance) * moveStep;
        }
        marker.setLngLat([bus.currentPosition.lng, bus.currentPosition.lat]);
    });
    requestAnimationFrame(animateBuses);
}

// 4.3 更新信息面板
function updateInfoPanel(count) {
    const countEl = document.getElementById('bus-count');
    const timeEl = document.getElementById('update-time');
    if (countEl) countEl.textContent = count;
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toTimeString().slice(0, 8);
    }
}

// 4.4 从API获取数据 (核心)
async function updateBusesFromRealAPI() {
    if (isUpdating) return;
    isUpdating = true;
    console.log('[步骤] 开始获取KMB实时数据...');

    try {
        const realBuses = await getKmbBusesOnRoute('101'); // 获取101路线数据
        console.log(`[成功] 获取到 ${realBuses.length} 辆巴士`);

        realBuses.forEach(realBus => {
            if (!allBuses[realBus.id]) {
                // 新增巴士
                allBuses[realBus.id] = {
                    ...realBus,
                    currentPosition: { lng: realBus.lng, lat: realBus.lat },
                    targetPosition: { lng: realBus.lng, lat: realBus.lat },
                    speed: 0.00015
                };
                addBusToMap(realBus.id);
            } else {
                // 更新已有巴士的目标位置
                allBuses[realBus.id].targetPosition = { lng: realBus.lng, lat: realBus.lat };
            }
        });
        updateInfoPanel(Object.keys(allBuses).length);
    } catch (error) {
        console.error('[错误] 获取数据失败:', error);
        // 友好提示：在信息面板显示错误
        const panel = document.getElementById('info-panel');
        if (panel && !document.getElementById('error-msg')) {
            const msg = document.createElement('p');
            msg.id = 'error-msg';
            msg.style.color = 'red';
            msg.textContent = '数据获取失败，请检查控制台。';
            panel.appendChild(msg);
        }
    } finally {
        isUpdating = false;
    }
}

// ==============================================
// 5. 地图加载完成后执行
// ==============================================
map.on('load', () => {
    console.log('[步骤] 地图加载完成，启动应用...');
    
    // 添加3D建筑
    if (map.getSource('composite')) {
        map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 12,
            'paint': {
                'fill-extrusion-color': '#ddd',
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 15, ['get', 'height']],
                'fill-extrusion-opacity': 0.6
            }
        }, 'road-label');
    }

    // 启动动画
    animateBuses();
    console.log('[成功] 动画引擎启动');
    
    // 立即并每隔30秒获取数据
    updateBusesFromRealAPI();
    setInterval(updateBusesFromRealAPI, 30000);
    
    // 添加手动刷新按钮（方便测试）
    const panel = document.getElementById('info-panel');
    if (panel) {
        const btn = document.createElement('button');
        btn.textContent = '手动刷新数据';
        btn.style.cssText = 'margin-top:10px; padding:5px; background:#007cba; color:white; border:none; border-radius:3px;';
        btn.onclick = updateBusesFromRealAPI;
        panel.appendChild(btn);
    }
});

console.log('✅ 香港巴士地图应用初始化完毕。');
