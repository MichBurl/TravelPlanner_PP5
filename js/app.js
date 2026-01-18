import { map, toggleTrafficLayer, addMapMarker, flyToLocation } from './map.js';
import { getCityCoordinates, getCityNameFromCoords, findGasStationsAlongRoute } from './api.js';
import { initChart } from './chartManager.js';
import { initFuelListeners, calculateAndDisplayStats } from './dashboard.js';
import { state } from './state.js';
import { loadFromUrl, loadFromLocalStorage, generateShareLink } from './storage.js';
import { handleAddCity, updateRoute, resetApp } from './routeController.js';

// --- ELEMENTY DOM ---
const form = document.getElementById('add-city-form');
const input = document.getElementById('city-input');
const gasBtn = document.getElementById('show-gas-stations');
const trafficBtn = document.getElementById('toggle-traffic');
const shareBtn = document.getElementById('share-btn');
const resetBtn = document.getElementById('reset-btn');
const toast = document.getElementById('toast');

// --- MODALE ---

// 1. Modal Potwierdzenia (Dodawanie miasta)
const confirmModalEl = document.getElementById('confirmModal');
const confirmModalName = document.getElementById('confirm-city-name');
const confirmAddBtn = document.getElementById('confirm-add-btn');

// 2. Modal Resetowania (NOWY)
const resetModalEl = document.getElementById('resetModal');
const confirmResetBtn = document.getElementById('confirm-reset-btn');

// Zmienne instancji i stanu
let pendingCityData = null;
let confirmModalInstance = null; 
let resetModalInstance = null; // Instancja dla resetu

// --- START ---
initChart();
initFuelListeners(() => calculateAndDisplayStats(state.lastRouteData));

// Inicjalizacja Modali Bootstrapa po załadowaniu
document.addEventListener('DOMContentLoaded', () => {
    confirmModalInstance = new bootstrap.Modal(confirmModalEl);
    resetModalInstance = new bootstrap.Modal(resetModalEl); // Inicjalizacja resetu
});

// Inicjalizacja danych (URL / LocalStorage)
window.addEventListener('load', async () => {
    const hasUrl = loadFromUrl();
    if (hasUrl) {
        showToast("Wczytano udostępnioną trasę! 🚀");
        if(state.stops.length > 0) flyToLocation(state.stops[0].coords);
        await updateRoute();
    } else {
        const hasLocal = loadFromLocalStorage();
        if (hasLocal) {
            if(state.stops.length > 0) flyToLocation(state.stops[state.stops.length-1].coords);
            await updateRoute();
        }
    }
});

// --- OBSŁUGA ZDARZEŃ ---

// 1. Dodawanie miasta (Formularz)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    try {
        form.querySelector('button').disabled = true;
        const data = await getCityCoordinates(val);
        await handleAddCity(data);
        input.value = '';
    } catch (err) { alert(err.message); }
    finally { form.querySelector('button').disabled = false; }
});

// 2. Prawy Klik na Mapie
map.on('contextmenu', async (e) => {
    const { lng, lat } = e.lngLat;
    const popup = new mapboxgl.Popup({ closeButton: false })
        .setLngLat([lng, lat])
        .setHTML('<div style="color:#333; font-size:12px">🔍 Szukam...</div>')
        .addTo(map);

    try {
        const data = await getCityNameFromCoords(lng, lat);
        popup.remove(); 
        pendingCityData = data;
        confirmModalName.innerText = data.name;
        confirmModalInstance.show();
    } catch (err) {
        popup.setHTML('<span style="color:red">Tu nie ma miasta!</span>');
        setTimeout(() => popup.remove(), 2000);
    }
});

// Potwierdzenie dodania miasta (w Modalu)
confirmAddBtn.addEventListener('click', async () => {
    if (pendingCityData) {
        confirmModalInstance.hide();
        await handleAddCity(pendingCityData);
        pendingCityData = null;
    }
});

// 3. Stacje Paliw
gasBtn.addEventListener('click', async () => {
    if (!state.lastRouteData) return alert("Najpierw wyznacz trasę!");
    
    if (state.gasMarkers.length > 0) {
        state.gasMarkers.forEach(m => m.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerText = "⛽ Pokaż stacje na trasie";
        return;
    }
    const originalText = gasBtn.innerText;
    gasBtn.innerText = "Szukam...";
    gasBtn.disabled = true;
    try {
        const stations = await findGasStationsAlongRoute(state.lastRouteData.geometry);
        stations.forEach(s => {
            const el = document.createElement('div');
            el.innerHTML = '⛽'; el.style.fontSize='20px'; el.style.cursor='pointer'; el.style.textShadow='0 0 5 white';
            const m = new mapboxgl.Marker(el).setLngLat(s.coords).setPopup(new mapboxgl.Popup({offset:25}).setHTML(`<b>${s.name}</b><br>${s.address}`)).addTo(map);
            state.gasMarkers.push(m);
        });
        gasBtn.classList.add('active');
        gasBtn.innerText = "⛽ Ukryj stacje";
    } catch (e) { alert("Błąd pobierania stacji"); gasBtn.innerText = originalText; }
    finally { gasBtn.disabled = false; }
});

// 4. Korki
trafficBtn.addEventListener('click', () => {
    const visible = toggleTrafficLayer();
    trafficBtn.innerText = visible ? "🚦 Ukryj natężenie ruchu" : "🚦 Pokaż natężenie ruchu";
    trafficBtn.classList.toggle('active', visible);
});

// 5. Udostępnianie
shareBtn.addEventListener('click', () => {
    const link = generateShareLink();
    if (!link) return alert("Za mało punktów do udostępnienia!");
    navigator.clipboard.writeText(link)
        .then(() => showToast("Link skopiowany! 📋"))
        .catch(() => prompt("Skopiuj link:", link));
});

// 6. Resetowanie (POPRAWIONE)
// Krok A: Kliknięcie ikony kosza otwiera modal
resetBtn.addEventListener('click', () => {
    resetModalInstance.show();
});

// Krok B: Kliknięcie "Usuń wszystko" w modalu wykonuje akcję
confirmResetBtn.addEventListener('click', () => {
    resetApp();                 // Czyścimy aplikację
    resetModalInstance.hide();  // Zamykamy modal
    showToast("Trasa została usunięta 🗑️"); // Potwierdzenie
});


// --- UTILS ---
function showToast(msg) {
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.add('show');
    toast.classList.remove('opacity-0');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('opacity-0');
    }, 3000);
}