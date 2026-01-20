import { map, toggleTrafficLayer, addMapMarker, flyToLocation } from './map.js';
import { getCityCoordinates, getCityNameFromCoords, findGasStationsAlongRoute } from './api.js';
import { initChart } from './chartManager.js';
import { initFuelListeners, calculateAndDisplayStats } from './dashboard.js';
import { state } from './state.js';
import { loadFromUrl, loadFromLocalStorage, generateShareLink } from './storage.js';
import { handleAddCity, updateRoute, resetApp } from './routeController.js';
import { initAutocomplete } from './autocomplete.js'; // Import Autocomplete

// --- ELEMENTY DOM ---
const form = document.getElementById('add-city-form');
const input = document.getElementById('city-input');
const gasBtn = document.getElementById('show-gas-stations');
const trafficBtn = document.getElementById('toggle-traffic');
const shareBtn = document.getElementById('share-btn');
const resetBtn = document.getElementById('reset-btn');
const googleMapsBtn = document.getElementById('google-maps-btn');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');

// --- MODALE (BOOTSTRAP) ---
const confirmModalEl = document.getElementById('confirmModal');
const confirmModalName = document.getElementById('confirm-city-name');
const confirmAddBtn = document.getElementById('confirm-add-btn');

const resetModalEl = document.getElementById('resetModal');
const confirmResetBtn = document.getElementById('confirm-reset-btn');

// Zmienne stanu dla UI
let pendingCityData = null;
let confirmModalInstance = null;
let resetModalInstance = null;

// --- START APLIKACJI ---

// 1. Wykresy i Dashboard
initChart();
initFuelListeners(() => calculateAndDisplayStats(state.lastRouteData));

// 2. Inicjalizacja Modali (po załadowaniu DOM)
document.addEventListener('DOMContentLoaded', () => {
    confirmModalInstance = new bootstrap.Modal(confirmModalEl);
    resetModalInstance = new bootstrap.Modal(resetModalEl);
});

// 3. AUTOCOMPLETE (Podpowiedzi)
initAutocomplete(input, async (selectedItem) => {
    // Ta funkcja wykonuje się po kliknięciu w podpowiedź z listy
    const btn = form.querySelector('button');
    btn.disabled = true;

    try {
        await handleAddCity(selectedItem);
        input.value = ''; 
    } catch (error) {
        console.error(error);
        showToast("Błąd dodawania miasta");
    } finally {
        btn.disabled = false;
    }
});

// 4. Wczytywanie Danych (URL ma priorytet nad LocalStorage)
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


// --- OBSŁUGA ZDARZEŃ (EVENT LISTENERS) ---

// 1. Formularz (ENTER / Kliknięcie przycisku +)
// To jest fallback, gdyby ktoś nie użył autocomplete, tylko wpisał nazwę i wcisnął Enter
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;

    try {
        form.querySelector('button').disabled = true;
        const data = await getCityCoordinates(val);
        await handleAddCity(data);
        input.value = '';
    } catch (err) {
        // Używamy toasta zamiast alertu
        showToast("Nie znaleziono miasta!");
    } finally {
        form.querySelector('button').disabled = false;
    }
});

// 2. Prawy Klik na Mapie (Context Menu)
map.on('contextmenu', async (e) => {
    const { lng, lat } = e.lngLat;
    
    // Mały popup Mapboxa "Szukam..."
    const popup = new mapboxgl.Popup({ closeButton: false })
        .setLngLat([lng, lat])
        .setHTML('<div style="color:#333; font-size:12px">🔍 Szukam...</div>')
        .addTo(map);

    try {
        const data = await getCityNameFromCoords(lng, lat);
        popup.remove();
        
        // Zapisujemy dane i otwieramy Modal
        pendingCityData = data;
        confirmModalName.innerText = data.name;
        confirmModalInstance.show();

    } catch (err) {
        popup.setHTML('<span style="color:red">Tu nie ma miasta!</span>');
        setTimeout(() => popup.remove(), 2000);
    }
});

// Potwierdzenie dodania w Modalu
confirmAddBtn.addEventListener('click', async () => {
    if (pendingCityData) {
        confirmModalInstance.hide();
        await handleAddCity(pendingCityData);
        pendingCityData = null;
    }
});

// 3. Stacje Paliw
gasBtn.addEventListener('click', async () => {
    if (!state.lastRouteData) return showToast("Najpierw wyznacz trasę!");
    
    // Toggle OFF
    if (state.gasMarkers.length > 0) {
        state.gasMarkers.forEach(m => m.remove());
        state.gasMarkers = [];
        gasBtn.classList.remove('active');
        gasBtn.innerHTML = '<i class="bi bi-fuel-pump me-2"></i> Stacje paliw';
        return;
    }

    // Toggle ON
    const originalContent = gasBtn.innerHTML;
    gasBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Szukam...';
    gasBtn.disabled = true;

    try {
        const stations = await findGasStationsAlongRoute(state.lastRouteData.geometry);
        
        if (stations.length === 0) {
            showToast("Nie znaleziono stacji w pobliżu trasy.");
        } else {
            stations.forEach(s => {
                const el = document.createElement('div');
                el.innerHTML = '⛽'; 
                el.style.fontSize='24px'; 
                el.style.cursor='pointer'; 
                el.style.filter='drop-shadow(0 0 4px rgba(0,0,0,0.5))'; // Lepszy cień ikony
                
                const m = new mapboxgl.Marker(el)
                    .setLngLat(s.coords)
                    .setPopup(new mapboxgl.Popup({offset:25}).setHTML(`<b>${s.name}</b><br>${s.address}`))
                    .addTo(map);
                state.gasMarkers.push(m);
            });
            gasBtn.classList.add('active');
            gasBtn.innerHTML = '<i class="bi bi-fuel-pump-fill me-2"></i> Ukryj stacje';
            showToast(`Znaleziono ${stations.length} stacji paliw.`);
        }
    } catch (e) {
        console.error(e);
        showToast("Błąd pobierania stacji");
        gasBtn.innerHTML = originalContent;
    } finally {
        gasBtn.disabled = false;
    }
});

// 4. Korki (Traffic)
trafficBtn.addEventListener('click', () => {
    const visible = toggleTrafficLayer();
    if (visible) {
        trafficBtn.innerHTML = '<i class="bi bi-stoplights-fill me-2"></i> Ukryj natężenie';
        trafficBtn.classList.add('active');
    } else {
        trafficBtn.innerHTML = '<i class="bi bi-stoplights me-2"></i> Natężenie ruchu';
        trafficBtn.classList.remove('active');
    }
});

// 5. NAWIGACJA GOOGLE MAPS
googleMapsBtn.addEventListener('click', () => {
    if (state.stops.length < 2) return showToast("Wyznacz trasę, aby nawigować!");

    // Mapbox: [lng, lat] -> Google: lat,lng
    const origin = state.stops[0];
    const destination = state.stops[state.stops.length - 1];
    
    // Pobieramy punkty pośrednie (wszystko co nie jest startem ani metą)
    const waypoints = state.stops.slice(1, -1);

    const originStr = `${origin.coords[1]},${origin.coords[0]}`;
    const destStr = `${destination.coords[1]},${destination.coords[0]}`;

    // Budujemy URL
    let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}`;

    if (waypoints.length > 0) {
        // Punkty pośrednie oddzielamy pionową kreską |
        const waypointsStr = waypoints.map(s => `${s.coords[1]},${s.coords[0]}`).join('|');
        url += `&waypoints=${waypointsStr}`;
    }

    // Dodajemy tryb podróży (samochód)
    url += `&travelmode=driving`;

    // Otwieramy w nowej karcie
    window.open(url, '_blank');
});

// 6. Udostępnianie (Share)
shareBtn.addEventListener('click', () => {
    const link = generateShareLink();
    if (!link) return showToast("Za mało punktów do udostępnienia!");
    
    navigator.clipboard.writeText(link)
        .then(() => showToast("Link skopiowany do schowka! 📋"))
        .catch(() => {
            prompt("Twój link do trasy:", link);
        });
});

// 7. Resetowanie Trasy
resetBtn.addEventListener('click', () => {
    if (state.stops.length === 0) return showToast("Trasa jest pusta.");
    resetModalInstance.show();
});

confirmResetBtn.addEventListener('click', () => {
    resetApp();
    resetModalInstance.hide();
    showToast("Trasa została wyczyszczona 🗑️");
});


// --- FUNKCJA POMOCNICZA: TOAST ---
function showToast(message) {
    if(toastMsg) toastMsg.innerText = message;
    
    toast.classList.add('show');
    toast.classList.remove('opacity-0');
    
    // Automatyczne ukrycie po 3 sekundach
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('opacity-0');
    }, 3000);
}