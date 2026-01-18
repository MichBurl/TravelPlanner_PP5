import { formatTime } from './utils.js';

const stopsListElement = document.getElementById('stops-list');

/**
 * Renderuje listę, obsługuje usuwanie i przesuwanie (Drag & Drop)
 * @param {Array} stops - Dane
 * @param {Function} onDelete - Funkcja wywoływana po kliknięciu kosza (index)
 * @param {Function} onReorder - Funkcja wywoływana po upuszczeniu (oldIndex, newIndex)
 */
export function renderStopsList(stops, onDelete, onReorder) {
    stopsListElement.innerHTML = '';

    stops.forEach((stop, index) => {
        const li = document.createElement('li');
        li.className = 'stop-item';
        
        // --- DRAG & DROP SETUP ---
        li.draggable = true; // Pozwól na przesuwanie elementu
        li.dataset.index = index; // Zapisz indeks w HTML, żeby wiedzieć co przesuwamy

        // Zdarzenie: Zaczynamy ciągnąć
        li.addEventListener('dragstart', (e) => {
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Przekazujemy indeks elementu, który jest ciągnięty
            e.dataTransfer.setData('text/plain', index);
        });

        // Zdarzenie: Kończymy ciągnąć (niezależnie czy upuściliśmy poprawnie czy nie)
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });

        // Zdarzenie: Jesteśmy NAD innym elementem (pozwalamy na upuszczenie)
        li.addEventListener('dragover', (e) => {
            e.preventDefault(); // To jest wymagane, by pozwolić na Drop!
            e.dataTransfer.dropEffect = 'move';
        });

        // Zdarzenie: Upuszczamy element NA ten element
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index; // Indeks elementu, na który upuściliśmy

            if (fromIndex !== toIndex) {
                onReorder(fromIndex, toIndex);
            }
        });

        // --- BUDOWANIE TREŚCI KAFELKA ---
        
        let infoHTML = '<small style="color: #666;">Start podróży</small>';
        let weatherHTML = '';

        if (stop.arrivalTime) {
            infoHTML = `<small>Przyjazd: <strong>${formatTime(stop.arrivalTime)}</strong></small>`;
        }

        if (stop.weather) {
            const temp = Math.round(stop.weather.main.temp);
            const iconCode = stop.weather.weather[0].icon;
            weatherHTML = `
                <div style="display: flex; align-items: center; gap: 5px; margin-top: 5px;">
                    <img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="pogoda" style="width: 25px; height: 25px;">
                    <strong>${temp}°C</strong>
                </div>
            `;
        }

        li.innerHTML = `
            <div class="stop-content">
                <strong>${index + 1}. ${stop.name}</strong>
                <br>
                ${infoHTML}
                ${weatherHTML}
            </div>
        `;

        // --- PRZYCISK USUWANIA ---
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;'; // Symbol X
        deleteBtn.title = "Usuń ten przystanek";
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Żeby kliknięcie nie uruchomiło innych zdarzeń
            onDelete(index);
        });

        li.appendChild(deleteBtn);
        stopsListElement.appendChild(li);
    });
}