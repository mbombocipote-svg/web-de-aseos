// ==========================================================================
// CONFIGURACIÓN DE ESTADO Y VARIABLES GLOBALES
// ==========================================================================
let map;
let currentCenter;
let searchRadius = 1000; // 1 km por defecto
let isSelectCenterMode = false;

// Capas de Leaflet
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

// ==========================================================================
// 1. INICIALIZACIÓN DIRECTA DEL MAPA
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Crear el mapa centrado en unas coordenadas por defecto (Madrid)
    map = L.map('map').setView([40.4167, -3.7037], 14);

    // 2. Cargar las calles reales de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // 3. Crear el grupo donde se guardarán los pines de los baños
    markersGroup = L.layerGroup().addTo(map);

    // 4. Configurar los botones y el deslizador
    setupEventListeners();

    // 5. Intentar centrar en la posición real del usuario si da permiso GPS
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentCenter = L.latLng(position.coords.latitude, position.coords.longitude);
                updateSearchCenter(currentCenter);
            },
            () => {
                // Si deniega el GPS, se queda en el centro por defecto de forma segura
                currentCenter = map.getCenter();
                updateSearchCenter(currentCenter);
            }
        );
    } else {
        currentCenter = map.getCenter();
        updateSearchCenter(currentCenter);
    }

    // Parche para asegurar que Leaflet dibuje las imágenes correctamente en la pantalla
    setTimeout(() => {
        map.invalidateSize();
    }, 400);
});

// ==========================================================================
// 2. ACTUALIZACIÓN DEL RADAR Y LOS PINCHAZOS EN EL MAPA
// ==========================================================================
function updateSearchCenter(latlng) {
    currentCenter = latlng;
    map.setView(latlng, 14);

    // Dibujar o mover el pin azul central
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

    // Dibujar o mover el círculo del radar de neón
    if (radiusCircle) {
        radiusCircle.setLatLng(latlng);
        radiusCircle.setRadius(searchRadius);
    } else {
        radiusCircle = L.circle(latlng, {
            radius: searchRadius,
            color: '#00f3ff',
            weight: 2,
            fillColor: '#00f3ff',
            fillOpacity: 0.08,
            dashArray: "4, 4"
        }).addTo(map);
    }

    // Escanear los baños simulados alrededor de este punto
    searchNearbyToilets();
}

// ==========================================================================
// 3. GENERADOR DE BAÑOS ALREDEDOR DEL CENTRO
// ==========================================================================
function searchNearbyToilets() {
    markersGroup.clearLayers();
    resultsList.innerHTML = '';

    const names = ["Aseo Público Municipal", "Cafetería Cyber-Sabor", "Estación Subterránea", "Burger Station", "Smart Capsule Toilet"];
    let detectados = 0;

    // Generamos 6 baños falsos distribuidos matemáticamente alrededor del click
    for (let i = 0; i < 6; i++) {
        const latOffset = (Math.sin(i + 1) * 0.005);
        const lngOffset = (Math.cos(i + 2) * 0.005);
        const tLat = currentCenter.lat + latOffset;
        const tLng = currentCenter.lng + lngOffset;
        
        const distance = currentCenter.distanceTo([tLat, tLng]);

        // Si el baño cae dentro del rango del slider, lo mostramos
        if (distance <= searchRadius) {
            detectados++;
            const currentName = names[i % names.length] + ` #${i+1}`;
            const rating = (3.5 + (Math.sin(i) * 1.3)).toFixed(1);
            const currentType = i % 2 === 0 ? "baño" : "establecimiento";
            const distText = `${Math.round(distance)} m`;

            // Marcador visual verde en el mapa
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
                    <div style="color:var(--neon-cyan); margin-bottom:5px;">🚶 Distancia: ${distText}</div>
                    <span class="origin-tag ${tagClass}">${tagText}</span>
                </div>
            `);
            markersGroup.addLayer(marker);

            // Crear la tarjeta interactiva en la barra lateral
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
            
            // Al hacer click en la tarjeta, nos lleva al pin del mapa
            card.addEventListener('click', () => {
                map.setView([tLat, tLng], 16);
                marker.openPopup();
            });
            resultsList.appendChild(card);
        }
    }
    resultsCount.textContent = detectados;
}

// ==========================================================================
// 4. CONTROL DE EVENTOS DE LA INTERFAZ
// ==========================================================================
function setupEventListeners() {
    // Control del deslizador de distancia (Slider)
    rangeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        rangeValue.textContent = val.toFixed(1);
        searchRadius = val * 1000;
        if (currentCenter) {
            updateSearchCenter(currentCenter);
        }
    });

    // Botón para activar el modo "Fijar Centro Manual"
    btnSelectCenter.addEventListener('click', () => {
        isSelectCenterMode = !isSelectCenterMode;
        if (isSelectCenterMode) {
            btnSelectCenter.classList.add('active');
            modeIndicator.textContent = "Modo Selección Activo: Haz click en el mapa";
            modeIndicator.style.display = 'block';
        } else {
            resetCenterSelectMode();
        }
    });

    // Detectar el click real sobre el mapa
    map.on('click', (e) => {
        if (isSelectCenterMode) {
            updateSearchCenter(e.latlng);
            resetCenterSelectMode();
        }
    });
}

function resetCenterSelectMode() {
    isSelectCenterMode = false;
    btnSelectCenter.classList.remove('active');
    modeIndicator.style.display = 'none';
}
