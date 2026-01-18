// js/app.js

// 1. Importy
import { map, addMapMarker, flyToLocation, drawRoute, toggleTrafficLayer } from './map.js';
import { getCityCoordinates, getRoute, getWeatherForecast, findGasStationsAlongRoute, getCityNameFromCoords } from './api.js';
import { renderStopsList } from './ui.js';
import { addSecondsToDate, findForecastForTime } from './utils.js';
import { initChart, updateChartData, clearChart } from './chartManager.js';
import { initFuelListeners, calculateAndDisplayStats } from './dashboard.js';

// 2. Stan Aplikacji
const state = {
    stops: [],
    lastRouteData: null,
    lastArrivalTime: null,
    gasMarkers: []
};

// 3. Elementy DOM (Tylko te, które obsługujemy bezpośrednio w app.js)
const form = document.getElementById('add-city-form');
const input = document.getElementById('city-input');
const gasBtn = document.getElementById('show-gas-stations');
const trafficBtn = document.getElementById('toggle-traffic');

// Elementy Modala Pomocy
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeModalBtn = document.getElementById('close-modal');

// 4. Inicjalizacja
initChart();

// Nasłuchiwanie zmian w paliwie (przeliczamy koszty na żywo)
initFuelListeners(() => {
    calculateAndDisplayStats(state.lastRouteData);
});


// 5. GŁÓWNA LOGIKA (Core Logic)

async function handleAddCity(cityData) {
    const marker = addMapMarker(cityData.coords);
    
    state.stops.push({
        name: cityData.name,
        coords: cityData.coords,
        marker: marker,
        weather: null,
        arrivalTime: new Date()
    });

    flyToLocation(cityData.coords);
    render();
    await updateRoute();
}

async function updateRoute() {
    if (state.stops.length < 2) return;

    const coordsArray = state.stops.map(stop => stop.coords);

    try {
        const routeData = await getRoute(coordsArray);
        state.lastRouteData = routeData;
        drawRoute(routeData.geometry);

        const legs = routeData.legs;
        let currentArrivalTime = new Date();
        state.lastArrivalTime = currentArrivalTime;
        
        // Start trasy - pogoda
        state.stops[0].arrivalTime = currentArrivalTime;
        const startWeather = await getWeatherForecast(state.stops[0].coords[1], state.stops[0].coords[0]);
        if (startWeather) state.stops[0].weather = findForecastForTime(startWeather, currentArrivalTime);

        // Kolejne punkty
        for (let i = 0; i < legs.length; i++) {
            currentArrivalTime = addSecondsToDate(currentArrivalTime, legs[i].duration);
            const nextIndex = i + 1;
            state.stops[nextIndex].arrivalTime = currentArrivalTime;
            
            const stop = state.stops[nextIndex];
            const weatherList = await getWeatherForecast(stop.coords[1], stop.coords[0]);
            if (weatherList) state.stops[nextIndex].weather = findForecastForTime(weatherList, currentArrivalTime);
        }

        render();
        updateDashboardView(); // Aktualizuj panel dolny

    } catch (error) {
        console.error("Błąd trasy:", error);
    }
}

// Funkcja pomocnicza do odświeżania widoków
function updateDashboardView() {
    // 1. Statystyki
    calculateAndDisplayStats(state.lastRouteData);

    // 2. Wykres
    const labels = state.stops.map(s => s.name);
    const temps = state.stops.map(s => s.weather ? Math.round(s.weather.main.temp) : null);
    const rainProbs = state.stops.map(s => s.weather ? Math.round(s.weather.pop * 100) : 0);
    
    updateChartData(labels, temps, rainProbs);
}

// Funkcje CRUD (przekazywane do ui.js)
function render() {
    renderStopsList(state.stops, handleDeleteStop, handleReorderStops);
}

function handleDeleteStop(index) {
    if (state.stops[index].marker) state.stops[index].marker.remove();
    state.stops.splice(index, 1);
    
    if (state.stops.length < 2) {
        resetApp();
    }
    
    render();
    updateRoute();
}

function handleReorderStops(fromIndex, toIndex) {
    const [movedItem] = state.stops.splice(fromIndex, 1);
    state.stops.splice(toIndex, 0, movedItem);
    render();
    updateRoute();
}

function resetApp() {
    if (map.getSource('route')) {
        map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    }
    state.lastRouteData = null;
    
    // Reset stacji
    state.gasMarkers.forEach(m => m.remove());
    state.gasMarkers = [];
    gasBtn.classList.remove('active');
    gasBtn.innerText = "⛽ Pokaż stacje na trasie";
    
    // Reset widoków
    calculateAndDisplayStats(null);
    clearChart();
}


// 6. OBSŁUGA ZDARZEŃ (Event Listeners)

// Formularz dodawania miasta
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cityName = input.value.trim();
    if (!cityName) return;

    try {
        const btn = form.querySelector('button');
        btn.disabled = true;

        const cityData = await getCityCoordinates(cityName);
        await handleAddCity(cityData);
        
        input.value = '';
    } catch (error) {
        alert(error.message);
    } finally {
        const btn = form.querySelector('button');
        btn.disabled = false;
    }
});

// Prawy klik na mapie
map.on('contextmenu', async (e) => {
    const { lng, lat } = e.lngLat;
    const loadingPopup = new mapboxgl.Popup()
        .setLngLat([lng, lat])
        .setHTML('<div style="color: #666;">Szukam nazwy miasta...</div>')
        .addTo(map);

    try {
        const cityData = await getCityNameFromCoords(lng, lat);
        loadingPopup.remove();
        
        // Timeout, żeby popup zniknął zanim pojawi się confirm
        setTimeout(async () => {
            const userConfirmed = confirm(`Czy chcesz dodać przystanek: ${cityData.name}?`);
            if (userConfirmed) {
                await handleAddCity(cityData);
            }
        }, 100);

    } catch (error) {
        loadingPopup.remove();
        new mapboxgl.Popup()
            .setLngLat([lng, lat])
            .setHTML('<div style="color: red;">Tu nie ma miasta!</div>')
            .addTo(map);
    }
});

// Obsługa Stacji Paliw
gasBtn.addEventListener('click', async () => {
    if (!state.lastRouteData) { alert("Najpierw wyznacz trasę!"); return; }
    
    // Toggle OFF
    if (state.gasMarkers.length > 0) {
        state.gasMarkers.forEach(marker => marker.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";
        return;
    }

    // Toggle ON
    const originalText = gasBtn.innerText;
    gasBtn.innerText = "Szukam stacji...";
    gasBtn.disabled = true;

    try {
        const stations = await findGasStationsAlongRoute(state.lastRouteData.geometry);
        stations.forEach(station => {
            const el = document.createElement('div');
            el.innerHTML = '⛽'; 
            el.style.fontSize = '20px';
            el.style.cursor = 'pointer';
            el.style.textShadow = '0 0 5px white'; 
            
            const marker = new mapboxgl.Marker(el)
                .setLngLat(station.coords)
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${station.name}</strong><br>${station.address}`))
                .addTo(map);
            state.gasMarkers.push(marker);
        });
        gasBtn.classList.add('active');
        gasBtn.innerText = "⛽ Ukryj stacje";
    } catch (error) {
        console.error(error);
        alert("Nie udało się pobrać stacji.");
        gasBtn.innerText = originalText;
    } finally {
        gasBtn.disabled = false;
    }
});

// Obsługa Korków (Traffic)
trafficBtn.addEventListener('click', () => {
    const isVisible = toggleTrafficLayer();
    if (isVisible) {
        trafficBtn.classList.add('active');
        trafficBtn.innerText = "🚦 Ukryj natężenie ruchu";
    } else {
        trafficBtn.classList.remove('active');
        trafficBtn.innerText = "🚦 Pokaż natężenie ruchu";
    }
});

// Obsługa Modala Pomocy
helpBtn.addEventListener('click', () => helpModal.classList.add('open'));
closeModalBtn.addEventListener('click', () => helpModal.classList.remove('open'));
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('open');
});