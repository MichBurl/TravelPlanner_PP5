import { state } from './state.js';
import { getRoute, getWeatherForecast } from './api.js';
import { addMapMarker, flyToLocation, drawRoute } from './map.js';
import { renderStopsList } from './ui.js';
import { addSecondsToDate, findForecastForTime } from './utils.js';
import { updateChartData, clearChart } from './chartManager.js';
import { calculateAndDisplayStats } from './dashboard.js';
import { saveToLocalStorage } from './storage.js';

// --- GŁÓWNA FUNKCJA AKTUALIZACJI ---
export async function updateRoute() {
    if (state.stops.length < 2) {
        // Jeśli za mało punktów - czyścimy widok
        clearRouteView();
        return;
    }

    const coordsArray = state.stops.map(stop => stop.coords);

    try {
        const routeData = await getRoute(coordsArray);
        state.lastRouteData = routeData;
        drawRoute(routeData.geometry);

        await calculateWeatherAndTimes(routeData);

        // Odśwież widoki
        render();
        updateDashboardView();

    } catch (error) {
        console.error("Błąd trasy:", error);
    }
}

// --- LOGIKA WEATHER & TIME ---
async function calculateWeatherAndTimes(routeData) {
    const legs = routeData.legs;
    let currentArrivalTime = new Date();
    state.lastArrivalTime = currentArrivalTime;
    
    // Start
    state.stops[0].arrivalTime = currentArrivalTime;
    const startWeather = await getWeatherForecast(state.stops[0].coords[1], state.stops[0].coords[0]);
    if (startWeather) state.stops[0].weather = findForecastForTime(startWeather, currentArrivalTime);

    // Pętla po odcinkach
    for (let i = 0; i < legs.length; i++) {
        currentArrivalTime = addSecondsToDate(currentArrivalTime, legs[i].duration);
        const nextIndex = i + 1;
        state.stops[nextIndex].arrivalTime = currentArrivalTime;
        
        const stop = state.stops[nextIndex];
        const weatherList = await getWeatherForecast(stop.coords[1], stop.coords[0]);
        if (weatherList) state.stops[nextIndex].weather = findForecastForTime(weatherList, currentArrivalTime);
    }
}

// --- AKCJE UŻYTKOWNIKA (CRUD) ---

export async function handleAddCity(cityData) {
    const marker = addMapMarker(cityData.coords);
    
    state.stops.push({
        name: cityData.name,
        coords: cityData.coords,
        marker: marker,
        weather: null,
        arrivalTime: new Date()
    });

    saveToLocalStorage();
    flyToLocation(cityData.coords);
    render();
    await updateRoute();
}

export function handleDeleteStop(index) {
    if (state.stops[index].marker) state.stops[index].marker.remove();
    state.stops.splice(index, 1);
    
    saveToLocalStorage();
    render();
    updateRoute();
}

export function handleReorderStops(fromIndex, toIndex) {
    const [movedItem] = state.stops.splice(fromIndex, 1);
    state.stops.splice(toIndex, 0, movedItem);
    
    saveToLocalStorage();
    render();
    updateRoute();
}

export function resetApp() {
    // Usuń markery
    state.stops.forEach(s => s.marker && s.marker.remove());
    state.stops = [];
    
    // Wyczyść storage
    localStorage.removeItem('travelApp_stops');
    
    clearRouteView();
    render();
}

// --- FUNKCJE POMOCNICZE WIDOKU ---

function render() {
    renderStopsList(state.stops, handleDeleteStop, handleReorderStops);
}

function updateDashboardView() {
    calculateAndDisplayStats(state.lastRouteData);

    const labels = state.stops.map(s => s.name);
    const temps = state.stops.map(s => s.weather ? Math.round(s.weather.main.temp) : null);
    const rainProbs = state.stops.map(s => s.weather ? Math.round(s.weather.pop * 100) : 0);
    
    updateChartData(labels, temps, rainProbs);
}

function clearRouteView() {
    // Importujemy map dynamicznie lub zakładamy że drawRoute obsłuży puste dane
    // Tutaj użyjemy drawRoute z pustą geometrią
    drawRoute({ type: 'LineString', coordinates: [] });
    
    state.lastRouteData = null;
    state.gasMarkers.forEach(m => m.remove());
    state.gasMarkers = [];
    
    // Reset przycisku gazu (brzydkie, ale skuteczne - lepiej byłoby mieć UI managera)
    const gasBtn = document.getElementById('show-gas-stations');
    if(gasBtn) {
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";
    }

    calculateAndDisplayStats(null);
    clearChart();
}