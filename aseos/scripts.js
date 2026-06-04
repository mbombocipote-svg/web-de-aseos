// ==========================================================================
// CONFIGURACIÓN DE ESTADO Y VARIABLES GLOBALES
// ==========================================================================
let map;
let currentCenter;
let searchRadius = 1000; 
let isSelectCenterMode = false;
let isOfflineMode = false; // Detecta si la red del colegio bloquea los mapas

// Elementos de Capas de Leaflet
let userMarker = null;
let radiusCircle = null;
let markersGroup = null;

// Elementos del DOM
const rangeSlider = document.getElementById('range-slider');
const rangeValue = document.getElementById('range-value');
const btnSelectCenter = document.getElementById('btn-select-center');
const modeIndicator = document.getElementById('mode-indicator');
const resultsList = document.getElementById('results-list');
const resultsCount = document.getElementById('results-count');
const mapContainer = document.getElementById('map');

// ==========================================================================
// 1. COMPROBACIÓN DE RED E INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // COMPROBACIÓN ANTIBLOQUEO: ¿El colegio bloquea la librería de mapas?
    if (typeof L === 'undefined') {
        console.warn("Librería de mapas bloqueada por la red. Activando Modo Radar Local.");
        activateOfflineRadarMode();
    } else {
        try {
            initMap();
            requestUserLocation();
        } catch (e) {
            activateOfflineRadarMode();
        }
    }
});

function initMap() {
    // Intentar iniciar el mapa global
    map = L.map('map').setView([40.4167, -3.7037], 13);

    // Cambiamos a los servidores estándar de OpenStreetMap (suelen estar menos bloqueados que CartoDB)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersGroup = L.layerGroup().addTo(map);

    setTimeout(() => { map.invalidateSize(); }, 250);
}

function requestUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentCenter = L.latLng(position.coords.latitude, position.coords.longitude);
                updateSearchCenter(currentCenter);
            },
            () => { handleGeolocationFallback(); },
            { timeout: 3000 }
        );
    } else {
        handleGeolocationFallback();
    }
}

function handleGeolocationFallback() {
    // Si falla el GPS pero la librería funciona, centramos en unas coordenadas fijas por defecto
    currentCenter = L.latLng(40.4167, -3.7037); 
    updateSearchCenter(currentCenter);
    
    isSelectCenterMode = true;
    btnSelectCenter.classList.add('active');
    modeIndicator.textContent = "⚠️ GPS bloqueado. ¡Haz click en la rejilla para escanear esa zona!";
    modeIndicator.style.display = 'block';
    modeIndicator.style.color = 'var(--neon-pink)';
}

// ==========================================================================
// 2. MODO INTEGRADO: RADAR TÁCTICO LOCAL (100% OFFLINE)
// ==========================================================================
function activateOfflineRadarMode() {
    isOfflineMode = true;
    isSelectCenterMode = true;
    
    btnSelectCenter.classList.add('active');
    modeIndicator.innerHTML = "🔬 MODO RADAR LOCAL ACTIVO<br>Haz click en cualquier punto de la rejilla para buscar.";
    modeIndicator.style.display = 'block';
    modeIndicator.style.color = 'var(--neon-cyan)';
    mapContainer.style.cursor = 'crosshair';

    // Crear un centro de simulación inicial en medio de la pantalla
    simulateOfflineSearch(mapContainer.clientWidth / 2, mapContainer.clientHeight / 2);
}

function simulateOfflineSearch(clickX, clickY) {
    // Limpiar elementos previos en el contenedor
    const oldPines = mapContainer.querySelectorAll('.offline-pin, .offline-center');
    oldPines.forEach(p => p.remove());
    resultsList.innerHTML = '';

    // 1. Colocar indicador de centro
    const centerDiv = document.createElement('div');
    centerDiv.className = 'offline-center';
    centerDiv.style.left = `${clickX}px`;
    centerDiv.style.top = `${clickY}px`;
    mapContainer.appendChild(centerDiv);

    // 2. Generar elementos a su alrededor de forma matemática local
    const names = ["Aseo Público Smart", "Cyber Café Rest", "Búnker Sanitario Urbano", "Estación Central", "Mega-Mall Baños"];
    const types = ["baño", "establecimiento"];
    let detectados = 0;

    // El slider define cuántos elementos simula encontrar en el área visual
    const maxBaños = Math.floor(searchRadius / 200) + 2; 

    for (let i = 0; i < maxBaños; i++) {
        // Generar un ángulo y distancia aleatoria alrededor del click
        const angle = (i * 45) + (Math.sin(i) * 20);
        const distance = 40 + (i * 25); // píxeles de distancia en pantalla

        const pinX = clickX + Math.cos(angle * Math.PI / 180) * distance;
        const pinY = clickY + Math.sin(angle * Math.PI / 180) * distance;

        // Comprobar que no se salga de los bordes del recuadro negro
        if (pinX > 0 && pinX < mapContainer.clientWidth && pinY > 0 && pinY < mapContainer.clientHeight) {
            detectados++;
            const currentType = types[i % 2];
            const currentName = names[i % names.length] + ` Alpha-${i+1}`;
            const rating = (3.8 + (Math.sin(i) * 1.1)).toFixed(1);
            const mtDistancia = Math.round(distance * (searchRadius / 150));

            // Crear el pin físico en la pantalla
            const pin = document.createElement('div');
            pin.className = 'offline-pin';
            pin.style.left = `${pinX}px`;
            pin.style.top = `${pinY}px`;
            pin.title = currentName;
            
            // Simular el cuadro emergente (popup) mediante el click en el pin
            pin.addEventListener('click', () => {
                alert(`🛰️ [ESCANEO TERMINAL]\n\nLugar: ${currentName}\nCalificación: ${rating} Estrellas\nOrigen: Registro del ${currentType}\nDistancia Estimada: ${mtDistancia} metros.`);
            });
            mapContainer.appendChild(pin);

            // Insertar la tarjeta en la barra lateral izquierda
            const card = document.createElement('div');
            card.className = 'toilet-card';
            const tagClass = currentType === 'baño' ? 'tag-toilet' : 'tag-establishment';
            const tagText = currentType === 'baño' ? 'Del Baño' : 'Del Establecimiento';

            card.innerHTML = `
                <div class="toilet-title">${currentName}</div>
                <div class="toilet-meta">
                    <span class="distance-tag">${mtDistancia} m</span>
                    <span class="stars">${'<i class="fa-solid fa-star"></i>'.repeat(Math.floor(rating))}</span>
                </div>
                <div><span class="origin-tag ${tagClass}">${tagText}</span></div>
            `;
            // Al hacer click en la tarjeta, parpadea el pin simulado
            card.addEventListener('click', () => {
                pin.style.background = 'var(--neon-pink)';
                pin.style.boxShadow = '0 0 25px var(--neon-pink)';
                setTimeout(() => {
                    pin.style.background = 'var(--neon-green)';
                    pin.style.boxShadow = '0 0 12px var(--neon-green)';
                }, 1000);
            });

            resultsList.appendChild(card);
        }
    }
    resultsCount.textContent = detectados;
}

// ==========================================================================
// 3. ACTUALIZACIÓN DEL ÁREA DE BÚSQUEDA (CON INTERNET)
// ==========================================================================
function updateSearchCenter(latlng) {
    if (isOfflineMode) return;

    currentCenter = latlng;
    map.setView(latlng, searchRadius > 2000 ? 13 : 14);

    if (userMarker) {
        userMarker.setLatLng(latlng);
    } else {
        const centerIcon = L.divIcon({
            className: 'center-marker',
            html: `<div style="background: var(--neon-cyan); width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px var(--neon-cyan); border: 2px solid #fff;"></div>`,
            iconSize: [12, 12]
        });
        userMarker = L.marker(latlng, { icon: centerIcon }).addTo(map);
    }

    if (radiusCircle) {
        radiusCircle.setLatLng(latlng);
        radiusCircle.setRadius(searchRadius);
    } else {
        radiusCircle = L.circle(latlng, {
            radius: searchRadius,
            color: '#00f3ff',
            weight: 1,
            fillColor: '#00f3ff',
            fillOpacity: 0.05,
            dashArray: "4, 4"
        }).addTo(map);
    }

    searchNearbyToilets();
}

function searchNearbyToilets() {
    markersGroup.clearLayers();
    resultsList.innerHTML = '';

    // Generador mock de coordenadas alrededor de la posición real de internet
    const names = ["Aseo Público Municipal", "Cafetería Cyber-Sabor", "Estación Subterránea", "Burger Station", "Smart Capsule Toilet"];
    let detectados = 0;

    for (let i = 0; i < 8; i++) {
        const latOffset = (Math.sin(i + 1) * 0.007);
        const lngOffset = (Math.cos(i + 2) * 0.007);
        const tLat = currentCenter.lat + latOffset;
        const tLng = currentCenter.lng + lngOffset;
        
        const distance = currentCenter.distanceTo([tLat, tLng]);

        if (distance <= searchRadius) {
            detectados++;
            const currentName = names[i % names.length] + ` #${i+1}`;
            const rating = (3.5 + (Math.sin(i) * 1.3)).toFixed(1);
            const currentType = i % 2 === 0 ? "baño" : "establecimiento";
            const distText = `${Math.round(distance)} m`;

            // Añadir marcador a Leaflet
            const toiletIcon = L.divIcon({
                className: 'toilet-marker',
                html: `<div style="background: var(--neon-green); width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 12px var(--neon-green); border: 2px solid #000;"></div>`,
                iconSize: [14, 14]
            });

            const marker = L.marker([tLat, tLng], { icon: toiletIcon });
            
            const tagClass = currentType === 'baño' ? 'tag-toilet' : 'tag-establishment';
            const tagText = currentType === 'baño' ? 'Del Baño' : 'Del Establecimiento';
            
            marker.bindPopup(`
                <div class="popup-custom">
                    <div class="toilet-title">${currentName}</div>
                    <div style="color:var(--neon-cyan); margin-bottom:5px;">🚶 ${distText}</div>
                    <span class="origin-tag ${tagClass}">${tagText}</span>
                </div>
            `);
            markersGroup.addLayer(marker);

            // Añadir tarjeta lateral
            const card = document.createElement('div');
            card.className = 'toilet-card';
            card.innerHTML = `
                <div class="toilet-title">${currentName}</div>
                <div class="toilet-meta">
                    <span class="distance-tag">${distText}</span>
                    <span style="color:#ffb703;"><i class="fa-solid fa-star"></i> (${rating})</span>
                </div>
                <div><span class="origin-tag ${tagClass}">${tagText}</span></div>
            `;
            card.addEventListener('click', () => {
                map.setView([tLat, tLng], 15);
                marker.openPopup();
            });
            resultsList.appendChild(card);
        }
    }
    resultsCount.textContent = detectados;
}

// ==========================================================================
// 4. CAPTURA DE EVENTOS DE INTERFAZ
// ==========================================================================
function setupEventListeners() {
    // Control deslizante del rango
    rangeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        rangeValue.textContent = val.toFixed(1);
        searchRadius = val * 1000;
        
        // Recalcular según el modo activo actual
        if (isOfflineMode) {
            // Re-simular en el último punto guardado (o en el centro)
            const centerPin = mapContainer.querySelector('.offline-center');
            if (centerPin) {
                simulateOfflineSearch(parseInt(centerPin.style.left), parseInt(centerPin.style.top));
            }
        } else if (currentCenter) {
            updateSearchCenter(currentCenter);
        }
    });

    // Botón selector de centro manual
    btnSelectCenter.addEventListener('click', () => {
        isSelectCenterMode = !isSelectCenterMode;
        if (isSelectCenterMode) {
            btnSelectCenter.classList.add('active');
            modeIndicator.style.display = 'block';
            mapContainer.style.cursor = 'crosshair';
        } else if (!isOfflineMode) {
            resetCenterSelectMode();
        }
    });

    // Capturador de clicks en la pantalla del mapa
    mapContainer.addEventListener('click', (e) => {
        if (!isSelectCenterMode) return;

        if (isOfflineMode) {
            // Obtener coordenadas de pixel relativas al contenedor negro
            const rect = mapContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            simulateOfflineSearch(x, y);
        }
    });

    // Si Leaflet funciona, asignar su propio evento de mapa
    setTimeout(() => {
        if (!isOfflineMode && map) {
            map.on('click', (e) => {
                if (isSelectCenterMode) {
                    updateSearchCenter(e.latlng);
                    resetCenterSelectMode();
                }
            });
        }
    }, 500);
}

function resetCenterSelectMode() {
    isSelectCenterMode = false;
    btnSelectCenter.classList.remove('active');
    modeIndicator.style.display = 'none';
    mapContainer.style.cursor = '';
}