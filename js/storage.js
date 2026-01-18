import { state } from './state.js';
import { addMapMarker, flyToLocation } from './map.js';

// --- LOCAL STORAGE ---

export function saveToLocalStorage() {
    const dataToSave = state.stops.map(stop => ({
        name: stop.name,
        coords: stop.coords
    }));
    localStorage.setItem('travelApp_stops', JSON.stringify(dataToSave));
}

export function loadFromLocalStorage() {
    const json = localStorage.getItem('travelApp_stops');
    if (!json) return false;

    try {
        const savedStops = JSON.parse(json);
        if (!Array.isArray(savedStops) || savedStops.length === 0) return false;

        reconstructStops(savedStops);
        return true;
    } catch (error) {
        console.error("Błąd LocalStorage:", error);
        return false;
    }
}

// --- URL SHARING ---

export function generateShareLink() {
    if (state.stops.length < 2) return null;

    const routeString = state.stops.map(s => {
        return `${encodeURIComponent(s.name)},${s.coords[0].toFixed(4)},${s.coords[1].toFixed(4)}`;
    }).join(';');

    return `${window.location.origin}${window.location.pathname}?route=${routeString}`;
}

export function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const routeParam = params.get('route');

    if (!routeParam) return false;

    try {
        const stopsData = routeParam.split(';').map(segment => {
            const [encodedName, lng, lat] = segment.split(',');
            return {
                name: decodeURIComponent(encodedName),
                coords: [parseFloat(lng), parseFloat(lat)]
            };
        });

        reconstructStops(stopsData);
        // Czyścimy URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    } catch (error) {
        console.error("Błąd URL:", error);
        return false;
    }
}

// Funkcja pomocnicza (prywatna)
function reconstructStops(stopsData) {
    // Czyścimy obecne markery jeśli jakieś są (zabezpieczenie)
    state.stops.forEach(s => s.marker && s.marker.remove());
    state.stops = [];

    for (const stopData of stopsData) {
        const marker = addMapMarker(stopData.coords);
        state.stops.push({
            name: stopData.name,
            coords: stopData.coords,
            marker: marker,
            weather: null,
            arrivalTime: null
        });
    }
}