import { config } from './config.js';

mapboxgl.accessToken = config.mapboxToken;

// 1. Inicjalizacja Mapy
export const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11', 
    center: [19.145, 51.919],
    zoom: 6,
    projection: 'globe'
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

map.on('style.load', () => {
    map.setFog({
        'color': 'rgb(186, 210, 235)', 
        'high-color': 'rgb(36, 92, 223)', 
        'horizon-blend': 0.02, 
        'space-color': 'rgb(11, 11, 25)', 
        'star-intensity': 0.6 
    });
});

// --- POMOCNIKI ---
function getLayerInsertionPoint() {
    const layers = map.getStyle().layers;
    for (const layer of layers) {
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
            return layer.id;
        }
    }
    return undefined;
}

// RESTROKCYJNA Walidacja (Anti-Bug 0,0)
function isValidCoordinate(coords) {
    if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
    const [lng, lat] = coords;
    // Odrzucamy 0,0, wartości puste i NaN
    if (lng === 0 && lat === 0) return false; 
    if (isNaN(lng) || isNaN(lat)) return false;
    // Odrzucamy "prawie zero" (błędy zaokrągleń w oceanie przy Afryce)
    if (Math.abs(lng) < 0.1 && Math.abs(lat) < 0.1) return false;
    return true;
}

// --- Marker ---
export function addMapMarker(coords) {
    return new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat(coords)
        .addTo(map);
}

// --- Fly To ---
export function flyToLocation(coords) {
    map.flyTo({ center: coords, zoom: 12, speed: 1.5, curve: 1 });
}

// --- Draw Route ---
export function drawRoute(geoJsonGeometry) {
    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'Feature', properties: {}, geometry: geoJsonGeometry
        });
        return;
    }
    const insertBefore = getLayerInsertionPoint();
    map.addLayer({
        id: 'route',
        type: 'line',
        source: {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: geoJsonGeometry }
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
            'line-color': '#3b82f6', 
            'line-width': 6,
            'line-opacity': 0.8,
            'line-blur': 1
        }
    }, insertBefore);
}

// --- Traffic Layer ---
export function toggleTrafficLayer() {
    if (!map.getSource('mapbox-traffic')) {
        map.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
        });
        const insertBefore = getLayerInsertionPoint();
        map.addLayer({
            'id': 'traffic',
            'type': 'line',
            'source': 'mapbox-traffic',
            'source-layer': 'traffic',
            'paint': {
                'line-width': 2.5,
                'line-color': [
                    'case',
                    ['==', 'low', ['get', 'congestion']], '#10b981',
                    ['==', 'moderate', ['get', 'congestion']], '#f59e0b',
                    ['==', 'heavy', ['get', 'congestion']], '#ef4444',
                    ['==', 'severe', ['get', 'congestion']], '#7f1d1d',
                    '#000000'
                ]
            }
        }, insertBefore); 
        return true;
    } else {
        const visibility = map.getLayoutProperty('traffic', 'visibility');
        const isVisible = visibility === 'none';
        map.setLayoutProperty('traffic', 'visibility', isVisible ? 'visible' : 'none');
        return isVisible;
    }
}

// --- Congestion Markers (WERSJA: ETYKIETY BEZ HOVERA) ---
export function addCongestionMarkers(routeData) {
    const markers = [];
    
    // Sprawdzenie czy są dane
    if (!routeData.legs) return [];

    let congestionList = [];
    routeData.legs.forEach(leg => {
        if (leg.annotation && leg.annotation.congestion) {
            congestionList = congestionList.concat(leg.annotation.congestion);
        }
    });

    const coordinates = routeData.geometry.coordinates;
    const limit = Math.min(congestionList.length, coordinates.length);

    let inJam = false;
    let jamStartIndex = 0;

    for (let i = 0; i < limit; i++) {
        const level = congestionList[i];
        // Interesuje nas Severe (Zator) i Heavy (Duży ruch)
        const isTraffic = (level === 'severe' || level === 'heavy');

        if (isTraffic) {
            if (!inJam) {
                inJam = true;
                jamStartIndex = i;
            }
        } else {
            if (inJam) {
                const jamEndIndex = i;
                const jamLength = jamEndIndex - jamStartIndex;

                // Wyświetlamy, jeśli korek ma sensowną długość
                if (jamLength > 8) { 
                    
                    // Wyznaczamy punkty, gdzie postawimy etykiety
                    const indicesToAdd = [];
                    
                    if (jamLength < 40) {
                        // Jeden na środku
                        indicesToAdd.push(Math.floor((jamStartIndex + jamEndIndex) / 2));
                    } else {
                        // Dwa lub trzy dla długich korków (żeby było widać na mapie)
                        indicesToAdd.push(jamStartIndex + Math.floor(jamLength * 0.3));
                        indicesToAdd.push(jamStartIndex + Math.floor(jamLength * 0.7));
                    }

                    indicesToAdd.forEach(idx => {
                        const coords = coordinates[idx];

                        if (!isValidCoordinate(coords)) return;

                        const midLevel = congestionList[idx] || 'heavy';
                        const isSevere = midLevel === 'severe';

                        // Tworzymy element HTML Etykiety
                        const el = document.createElement('div');
                        
                        // Dodajemy klasy w zależności od wagi korka
                        el.className = `traffic-badge ${isSevere ? 'severe' : 'heavy'}`;
                        
                        el.innerHTML = isSevere 
                            ? '<i class="bi bi-exclamation-triangle-fill"></i> ZATOR' 
                            : 'UTRUDNIENIA';

                        // Tworzymy marker używając tego elementu
                        // Nie dodajemy .setPopup() - bo tekst jest już w elemencie
                        const marker = new mapboxgl.Marker({
                            element: el,
                            anchor: 'center' // Środek etykiety w punkcie GPS
                        })
                        .setLngLat(coords)
                        .addTo(map);

                        markers.push(marker);
                    });
                }
                inJam = false;
            }
        }
    }

    return markers;
}