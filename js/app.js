import { map, addMapMarker, flyToLocation, drawRoute } from './map.js';
import { getCityCoordinates, getRoute, getWeatherForecast, findGasStationsAlongRoute, getCityNameFromCoords } from './api.js';
import { renderStopsList } from './ui.js';
import { addSecondsToDate, findForecastForTime, formatTime } from './utils.js';

// --- CONFIG CHART.JS ---
let weatherChartInstance = null;
const ctx = document.getElementById('weatherChart').getContext('2d');

function initChart() {
    weatherChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 4,
                    borderWidth: 3,
                    order: 1
                },
                {
                    label: 'Szansa na deszcz (%)',
                    data: [],
                    type: 'bar',
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    yAxisID: 'y1',
                    barPercentage: 0.5,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += context.parsed.y + (context.datasetIndex === 0 ? '°C' : '%');
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Temp (°C)' }, grid: { color: '#f3f4f6' } },
                y1: { type: 'linear', display: true, position: 'right', min: 0, max: 100, title: { display: true, text: 'Deszcz (%)' }, grid: { drawOnChartArea: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- ELEMENTY DOM ---
const form = document.getElementById('add-city-form');
const input = document.getElementById('city-input');
const fuelInput = document.getElementById('fuel-consumption');
const priceInput = document.getElementById('fuel-price');
const gasBtn = document.getElementById('show-gas-stations');

const uiStats = {
    dist: document.getElementById('stat-dist'),
    time: document.getElementById('stat-time'),
    cost: document.getElementById('stat-cost')
};

// Nowe elementy Modala
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeModalBtn = document.getElementById('close-modal');

// --- STAN APLIKACJI ---
const state = {
    stops: [],
    lastRouteData: null,
    lastArrivalTime: null,
    gasMarkers: []
};

// --- LOGIKA MODALA (INSTRUKCJA) ---
helpBtn.addEventListener('click', () => {
    helpModal.classList.add('open');
});

closeModalBtn.addEventListener('click', () => {
    helpModal.classList.remove('open');
});

// Zamknij jak klikniemy w tło
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.classList.remove('open');
    }
});

// --- LOGIKA UNIWERSALNA ---
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


// --- INTERAKCJA Z MAPĄ ---
map.on('contextmenu', async (e) => {
    const { lng, lat } = e.lngLat;
    const loadingPopup = new mapboxgl.Popup()
        .setLngLat([lng, lat])
        .setHTML('<div style="color: #666;">Szukam nazwy miasta...</div>')
        .addTo(map);

    try {
        const cityData = await getCityNameFromCoords(lng, lat);
        loadingPopup.remove();
        const userConfirmed = confirm(`Czy chcesz dodać przystanek: ${cityData.name}?`);
        if (userConfirmed) {
            await handleAddCity(cityData);
        }
    } catch (error) {
        loadingPopup.remove();
        console.error(error);
        new mapboxgl.Popup()
            .setLngLat([lng, lat])
            .setHTML('<div style="color: red;">Tu nie ma miasta!</div>')
            .addTo(map);
    }
});


// --- LOGIKA STACJI PALIW ---
gasBtn.addEventListener('click', async () => {
    if (!state.lastRouteData) { alert("Najpierw wyznacz trasę!"); return; }
    if (state.gasMarkers.length > 0) {
        state.gasMarkers.forEach(marker => marker.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";
        return;
    }
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

function recalculateCosts() {
    if (!state.lastRouteData) {
        uiStats.dist.innerText = "0 km"; uiStats.time.innerText = "0 h"; uiStats.cost.innerText = "0 PLN"; return;
    }
    const fuelConsumption = parseFloat(fuelInput.value) || 0;
    const fuelPrice = parseFloat(priceInput.value) || 0;
    const distanceKm = state.lastRouteData.distance / 1000;
    const durationSeconds = state.lastRouteData.duration;
    const fuelNeeded = (distanceKm / 100) * fuelConsumption;
    const totalCost = fuelNeeded * fuelPrice;
    uiStats.dist.innerText = `${distanceKm.toFixed(1)} km`;
    uiStats.time.innerText = `${(durationSeconds / 3600).toFixed(1)} h`;
    uiStats.cost.innerText = `${totalCost.toFixed(2)} PLN`;
}

function updateDashboard(routeData, arrivalTime) {
    state.lastRouteData = routeData;
    state.lastArrivalTime = arrivalTime;
    recalculateCosts();
    const labels = state.stops.map(s => s.name);
    const temps = state.stops.map(s => s.weather ? Math.round(s.weather.main.temp) : null);
    const rainProbs = state.stops.map(s => s.weather ? Math.round(s.weather.pop * 100) : 0);
    weatherChartInstance.data.labels = labels;
    weatherChartInstance.data.datasets[0].data = temps;
    weatherChartInstance.data.datasets[1].data = rainProbs;
    weatherChartInstance.update();
}

fuelInput.addEventListener('input', recalculateCosts);
priceInput.addEventListener('input', recalculateCosts);

function render() { renderStopsList(state.stops, handleDeleteStop, handleReorderStops); }

function handleDeleteStop(index) {
    if (state.stops[index].marker) state.stops[index].marker.remove();
    state.stops.splice(index, 1);
    if (state.stops.length < 2) {
        if (map.getSource('route')) map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        state.lastRouteData = null;
        state.gasMarkers.forEach(m => m.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";
        recalculateCosts();
        weatherChartInstance.data.labels = [];
        weatherChartInstance.data.datasets[0].data = [];
        weatherChartInstance.data.datasets[1].data = [];
        weatherChartInstance.update();
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

async function updateRoute() {
    if (state.stops.length < 2) return;
    const coordsArray = state.stops.map(stop => stop.coords);
    try {
        const routeData = await getRoute(coordsArray);
        drawRoute(routeData.geometry);
        const legs = routeData.legs;
        let currentArrivalTime = new Date();
        state.stops[0].arrivalTime = currentArrivalTime;
        const startWeather = await getWeatherForecast(state.stops[0].coords[1], state.stops[0].coords[0]);
        if (startWeather) state.stops[0].weather = findForecastForTime(startWeather, currentArrivalTime);
        for (let i = 0; i < legs.length; i++) {
            currentArrivalTime = addSecondsToDate(currentArrivalTime, legs[i].duration);
            const nextIndex = i + 1;
            state.stops[nextIndex].arrivalTime = currentArrivalTime;
            const stop = state.stops[nextIndex];
            const weatherList = await getWeatherForecast(stop.coords[1], stop.coords[0]);
            if (weatherList) state.stops[nextIndex].weather = findForecastForTime(weatherList, currentArrivalTime);
        }
        render();
        updateDashboard(routeData, currentArrivalTime);
    } catch (error) { console.error("Błąd trasy:", error); }
}

initChart();

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