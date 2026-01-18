import { config } from './config.js';

// Przypisanie tokenu do obiektu globalnego mapboxgl
mapboxgl.accessToken = config.mapboxToken;

// Tworzenie instancji mapy
export const map = new mapboxgl.Map({
    container: 'map', // ID elementu HTML, w którym ma być mapa
    style: 'mapbox://styles/mapbox/streets-v11', // Styl mapy (możesz zmienić na 'dark-v10' lub 'satellite-v9')
    center: [19.145, 51.919], // Współrzędne startowe [lng, lat] (Środek Polski)
    zoom: 6, // Poziom przybliżenia (6 pokazuje cały kraj)
    projection: 'globe' // Efekt kuli ziemskiej przy oddalaniu (bajer!)
});

// Dodanie kontrolek nawigacji (plus/minus do zoomu)
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// Opcjonalnie: Dodanie efektu atmosfery przy oddaleniu
map.on('style.load', () => {
    map.setFog({}); 
});

/**
 * Dodaje marker na mapie w podanych współrzędnych.
 * Zwraca instancję markera, abyśmy mogli go później usunąć.
 */
export function addMapMarker(coords) {
    const marker = new mapboxgl.Marker({ color: '#007bff' }) // Niebieski kolor
        .setLngLat(coords)
        .addTo(map);
    
    return marker;
}

/**
 * Przesuwa mapę do podanego punktu (efekt lotu)
 */
export function flyToLocation(coords) {
    map.flyTo({
        center: coords,
        zoom: 12,
        speed: 1.5, // Prędkość lotu
        curve: 1    // Płynność krzywej lotu
    });
}

/**
 * Rysuje linię trasy na mapie.
 * @param {Object} geoJsonGeometry - Obiekt geometrii zwrócony przez API
 */
export function drawRoute(geoJsonGeometry) {
    // Sprawdzamy, czy warstwa trasy już istnieje
    if (map.getSource('route')) {
        // Jeśli tak, tylko aktualizujemy dane (bardzo szybkie!)
        map.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: geoJsonGeometry
        });
    } else {
        // Jeśli nie, dodajemy nową warstwę (tylko raz, przy pierwszej trasie)
        map.addLayer({
            id: 'route',
            type: 'line',
            source: {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: geoJsonGeometry
                }
            },
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#3887be', // Kolor trasy
                'line-width': 5,         // Grubość linii
                'line-opacity': 0.75     // Przezroczystość
            }
        });
    }
}