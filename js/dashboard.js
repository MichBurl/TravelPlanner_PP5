// js/dashboard.js

// Elementy DOM
const uiStats = {
    dist: document.getElementById('stat-dist'),
    time: document.getElementById('stat-time'),
    cost: document.getElementById('stat-cost')
};

const fuelInput = document.getElementById('fuel-consumption');
const priceInput = document.getElementById('fuel-price');

// Funkcja eksportowana, aby app.js mógł podpiąć nasłuchiwanie zmian
export function initFuelListeners(callback) {
    fuelInput.addEventListener('input', callback);
    priceInput.addEventListener('input', callback);
}

// Główna funkcja przeliczająca
export function calculateAndDisplayStats(routeData) {
    if (!routeData) {
        uiStats.dist.innerText = "0 km";
        uiStats.time.innerText = "0 h";
        uiStats.cost.innerText = "0 PLN";
        return;
    }

    // Pobierz wartości z inputów
    const fuelConsumption = parseFloat(fuelInput.value) || 0;
    const fuelPrice = parseFloat(priceInput.value) || 0;

    const distanceKm = routeData.distance / 1000;
    const durationSeconds = routeData.duration;

    // Matematyka
    const fuelNeeded = (distanceKm / 100) * fuelConsumption;
    const totalCost = fuelNeeded * fuelPrice;

    // Aktualizacja DOM
    uiStats.dist.innerText = `${distanceKm.toFixed(1)} km`;
    uiStats.time.innerText = `${(durationSeconds / 3600).toFixed(1)} h`;
    uiStats.cost.innerText = `${totalCost.toFixed(2)} PLN`;
}