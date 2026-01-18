import { map, addMapMarker, flyToLocation, drawRoute } from './map.js';
import { getCityCoordinates, getRoute, getWeatherForecast, findGasStationsAlongRoute } from './api.js';
import { renderStopsList } from './ui.js';
import { addSecondsToDate, findForecastForTime, formatTime } from './utils.js';

// --- CONFIG CHART.JS (WYKRES DWUOSIOWY) ---
let weatherChartInstance = null;
const ctx = document.getElementById('weatherChart').getContext('2d');

function initChart() {
    weatherChartInstance = new Chart(ctx, {
        type: 'bar', // Domyślny typ to słupkowy (dla deszczu)
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    type: 'line', // Nadpisujemy typ na liniowy
                    borderColor: '#f59e0b', // Pomarańczowy
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    yAxisID: 'y', // Przypisanie do lewej osi
                    tension: 0.4,
                    pointRadius: 4,
                    borderWidth: 3,
                    order: 1 // Rysuj na wierzchu
                },
                {
                    label: 'Szansa na deszcz (%)',
                    data: [],
                    type: 'bar', // Słupki
                    backgroundColor: 'rgba(59, 130, 246, 0.6)', // Niebieski półprzezroczysty
                    yAxisID: 'y1', // Przypisanie do prawej osi
                    barPercentage: 0.5,
                    order: 2 // Rysuj pod linią
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: true, position: 'top' }, // Pokaż legendę
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + (context.datasetIndex === 0 ? '°C' : '%');
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                // Lewa oś (Temperatura)
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Temp (°C)' },
                    grid: { color: '#f3f4f6' }
                },
                // Prawa oś (Deszcz)
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100, // Procenty zawsze 0-100
                    title: { display: true, text: 'Deszcz (%)' },
                    grid: {
                        drawOnChartArea: false // Ukryj siatkę prawej osi, żeby nie robić bałaganu
                    }
                },
                x: {
                    grid: { display: false } // Czysta oś X
                }
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

// Pola wyników
const uiStats = {
    dist: document.getElementById('stat-dist'),
    time: document.getElementById('stat-time'),
    cost: document.getElementById('stat-cost')
};

// --- STAN APLIKACJI ---
const state = {
    stops: [],
    lastRouteData: null,
    lastArrivalTime: null,
    gasMarkers: [] // Tablica na markery stacji benzynowych
};

// --- FUNKCJE LOGICZNE ---

// Logika przycisku stacji paliw
gasBtn.addEventListener('click', async () => {
    // 1. Sprawdź czy mamy trasę
    if (!state.lastRouteData) {
        alert("Najpierw wyznacz trasę!");
        return;
    }

    // 2. Jeśli stacje są już pokazane, to je ukryj (toggle)
    if (state.gasMarkers.length > 0) {
        state.gasMarkers.forEach(marker => marker.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";
        return;
    }

    // 3. Pokaż loading
    const originalText = gasBtn.innerText;
    gasBtn.innerText = "Szukam stacji...";
    gasBtn.disabled = true;

    try {
        // 4. Pobierz stacje (logika z api.js)
        const stations = await findGasStationsAlongRoute(state.lastRouteData.geometry);
        console.log(`Znaleziono ${stations.length} stacji.`);

        // 5. Dodaj markery na mapę
        stations.forEach(station => {
            // Tworzymy własny element DOM dla markera
            const el = document.createElement('div');
            el.innerHTML = '⛽'; 
            el.style.fontSize = '20px';
            el.style.cursor = 'pointer';
            el.style.textShadow = '0 0 5px white'; 

            const marker = new mapboxgl.Marker(el)
                .setLngLat(station.coords)
                .setPopup(new mapboxgl.Popup({ offset: 25 }) 
                    .setHTML(`<strong>${station.name}</strong><br>${station.address}`))
                .addTo(map);

            state.gasMarkers.push(marker);
        });

        // Sukces
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
        uiStats.dist.innerText = "0 km";
        uiStats.time.innerText = "0 h";
        uiStats.cost.innerText = "0 PLN";
        return;
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

    // 1. Przelicz koszty
    recalculateCosts();

    // 2. Przygotuj dane do wykresu
    const labels = state.stops.map(s => s.name);
    
    // Dane Temperatura (Dataset 0)
    const temps = state.stops.map(s => {
        return s.weather ? Math.round(s.weather.main.temp) : null;
    });

    // Dane Deszcz (Dataset 1)
    // API zwraca 'pop' (Probability of Precipitation) w skali 0-1 (np. 0.5 to 50%)
    const rainProbs = state.stops.map(s => {
        return s.weather ? Math.round(s.weather.pop * 100) : 0;
    });

    // Aktualizacja Chart.js
    weatherChartInstance.data.labels = labels;
    weatherChartInstance.data.datasets[0].data = temps;     // Temperatura
    weatherChartInstance.data.datasets[1].data = rainProbs; // Deszcz
    weatherChartInstance.update();
}

// Obsługa inputów paliwowych
fuelInput.addEventListener('input', recalculateCosts);
priceInput.addEventListener('input', recalculateCosts);


// --- STANDARDOWE FUNKCJE (CRUD) ---

function render() {
    renderStopsList(state.stops, handleDeleteStop, handleReorderStops);
}

function handleDeleteStop(index) {
    if (state.stops[index].marker) state.stops[index].marker.remove();
    state.stops.splice(index, 1);
    
    if (state.stops.length < 2) {
        if (map.getSource('route')) {
             map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        }
        state.lastRouteData = null;
        
        // Reset stacji benzynowych
        state.gasMarkers.forEach(m => m.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";

        recalculateCosts();
        // Reset wykresu
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
            if (weatherList) {
                state.stops[nextIndex].weather = findForecastForTime(weatherList, currentArrivalTime);
            }
        }

        render();
        updateDashboard(routeData, currentArrivalTime);

    } catch (error) {
        console.error("Błąd trasy:", error);
    }
}

// Init
initChart();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cityName = input.value.trim();
    if (!cityName) return;

    try {
        const btn = form.querySelector('button');
        btn.disabled = true;

        const cityData = await getCityCoordinates(cityName);
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
        
        input.value = '';
    } catch (error) {
        alert(error.message);
    } finally {
        const btn = form.querySelector('button');
        btn.disabled = false;
    }
});