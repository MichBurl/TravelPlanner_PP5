import { config } from './config.js';

mapboxgl.accessToken = config.mapboxToken;

export const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [19.145, 51.919],
    zoom: 6,
    projection: 'globe'
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');
map.on('style.load', () => map.setFog({}));

// --- POMOCNIK: ZNAJDOWANIE MIEJSCA DLA WARSTWY ---
// Szuka ID warstwy z napisami, aby wstawić naszą trasę/korki POD napisy, ale NAD drogi.
function getLayerInsertionPoint() {
    const layers = map.getStyle().layers;
    // Szukamy warstwy etykiet drogowych lub pierwszej warstwy symboli
    for (const layer of layers) {
        if (layer.type === 'symbol' && layer.id.includes('road')) {
            return layer.id;
        }
    }
    // Fallback: jakakolwiek warstwa symboli
    const symbolLayer = layers.find(layer => layer.type === 'symbol');
    return symbolLayer ? symbolLayer.id : undefined;
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
    // 1. Jeśli warstwa już istnieje, tylko aktualizujemy dane
    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'Feature', properties: {}, geometry: geoJsonGeometry
        });
        return;
    }

    // 2. Jeśli nie istnieje, tworzymy nową
    const insertBefore = getLayerInsertionPoint();

    map.addLayer({
        id: 'route',
        type: 'line',
        source: {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: geoJsonGeometry }
        },
        layout: { 
            'line-join': 'round', 
            'line-cap': 'round' 
        },
        paint: {
            'line-color': '#3b82f6',
            'line-width': 6,
            'line-opacity': 0.8
        }
    }, insertBefore); // Wstawiamy pod napisy!
}

// --- Traffic Layer ---
export function toggleTrafficLayer() {
    // A. Jeśli warstwa nie istnieje - dodaj ją
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
                'line-width': 2.5, // Grubość linii korków
                'line-color': [
                    'case',
                    ['==', 'low', ['get', 'congestion']], '#4caf50',      // Zielony
                    ['==', 'moderate', ['get', 'congestion']], '#ff9800', // Pomarańczowy
                    ['==', 'heavy', ['get', 'congestion']], '#f44336',    // Czerwony
                    ['==', 'severe', ['get', 'congestion']], '#8b0000',   // Bordowy (Zator)
                    '#000000' 
                ]
            }
        }, insertBefore); // Wstawiamy pod napisy, ale nad drogi
        
        return true;
    } 
    
    // B. Jeśli warstwa istnieje - przełącz widoczność
    else {
        const visibility = map.getLayoutProperty('traffic', 'visibility');
        if (visibility === 'none') {
            map.setLayoutProperty('traffic', 'visibility', 'visible');
            return true;
        } else {
            map.setLayoutProperty('traffic', 'visibility', 'none');
            return false;
        }
    }
}