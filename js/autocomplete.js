import { getCitySuggestions } from './api.js';

export function initAutocomplete(inputElement, onSelectCallback) {
    let currentFocus = -1;
    let debounceTimer;

    // Tworzymy kontener na listę (jeśli nie istnieje)
    let listContainer = document.createElement("div");
    listContainer.setAttribute("id", "autocomplete-list");
    listContainer.setAttribute("class", "autocomplete-items");
    // Dodajemy go jako rodzeństwo inputa (wewnątrz .input-group w HTML)
    inputElement.parentNode.appendChild(listContainer);

    // Słuchamy wpisywania tekstu
    inputElement.addEventListener("input", function(e) {
        const val = this.value;
        
        // Czyścimy starą listę
        closeAllLists();
        
        if (!val || val.length < 3) return;

        // DEBOUNCE: Czekamy 300ms zanim zapytamy API
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const suggestions = await getCitySuggestions(val);
            renderSuggestions(suggestions);
        }, 300);
    });

    function renderSuggestions(suggestions) {
        closeAllLists();
        if (suggestions.length === 0) return;

        suggestions.forEach((item) => {
            // Tworzymy element listy (DIV)
            const b = document.createElement("div");
            // Pogrubiamy pasującą część (opcjonalne, tutaj prosta wersja)
            b.innerHTML = `<strong>${item.name}</strong> <small style="color:#aaa">${item.fullName.replace(item.name, '')}</small>`;
            
            // Obsługa kliknięcia
            b.addEventListener("click", function(e) {
                // Wpisujemy nazwę do inputa
                inputElement.value = item.name;
                closeAllLists();
                
                // Wywołujemy callback (czyli funkcję dodawania miasta z app.js)
                if (onSelectCallback) {
                    onSelectCallback(item);
                }
            });
            
            listContainer.appendChild(b);
        });
    }

    function closeAllLists() {
        listContainer.innerHTML = "";
    }

    // Zamknij listę jak klikniemy gdzieś indziej
    document.addEventListener("click", function (e) {
        if (e.target !== inputElement) {
            closeAllLists();
        }
    });
}