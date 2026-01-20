# 🗺️ Travel Planner Pro

> Profesjonalna aplikacja webowa do planowania tras podróży z podglądem natężenia ruchu, prognozą pogody i kalkulatorem kosztów paliwa.

## 🚀 Funkcjonalności

Aplikacja oferuje zestaw narzędzi niezbędnych dla każdego kierowcy i podróżnika:

* **📍 Planowanie Trasy:** Dodawanie przystanków poprzez wyszukiwarkę (z autouzupełnianiem adresów) lub prawym przyciskiem myszy na mapie.
* **🖱️ Drag & Drop:** Łatwa zmiana kolejności przystanków na liście metodą "przeciągnij i upuść".
* **🚦 Traffic Layer:** Podgląd natężenia ruchu na żywo (korki) nakładany na mapę jednym kliknięciem.
* **⛽ Lokalizator Stacji:** Inteligentne wyszukiwanie stacji paliw wzdłuż wyznaczonej trasy (skanowanie korytarza trasy).
* **🌥️ Smart Weather:** Prognoza pogody dopasowana do czasu przyjazdu do danego miasta (obliczana na podstawie czasu podróży).
* **📊 Dashboard Statystyk:**
    * Automatyczne obliczanie dystansu i czasu przejazdu.
    * Kalkulator kosztów paliwa (na podstawie spalania i ceny za litr).
    * Wykres temperatury i opadów dla całej trasy.
* **💾 Auto-Save:** Trasa zapisuje się automatycznie w pamięci przeglądarki (LocalStorage).
* **🔗 Udostępnianie:** Generowanie unikalnego linku do trasy, który można wysłać znajomym.
* **🎨 Dark Mode:** Nowoczesny, ciemny interfejs oparty na Bootstrap 5, idealny do pracy w nocy.

## 🛠️ Technologie

Projekt został zbudowany w oparciu o nowoczesne standardy webowe (ES6+ Modules) i nie wymaga frameworków typu React/Vue, zachowując wysoką wydajność.

* **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
* **Stylizacja:** Bootstrap 5.3 + Bootstrap Icons + Custom CSS
* **Mapy & Routing:** [Mapbox GL JS](https://www.mapbox.com/)
* **Geocoding:** Mapbox Geocoding API (Miejsca + Adresy)
* **Pogoda:** [OpenWeatherMap API](https://openweathermap.org/)
* **Wykresy:** Chart.js
* **Analiza przestrzenna:** Turf.js (do szukania stacji wzdłuż linii trasy)

## ⚙️ Instalacja i Uruchomienie

Aby uruchomić projekt lokalnie, wykonaj poniższe kroki:

1.  **Sklonuj repozytorium:**
    ```bash
    git clone [https://github.com/MichBurl/TravelPlanner_PP5.git](https://github.com/MichBurl/TravelPlanner_PP5.git)
    cd travel-planner-pro
    ```

2.  **Skonfiguruj klucze API:**
    * Zmień nazwę pliku `js/config.template.js` na `js/config.js`.
    * Otwórz plik i wklej swoje klucze:
        ```javascript
        export const config = {
            mapboxToken: 'TWOJ_TOKEN_MAPBOX',     // Pobierz z mapbox.com
            openWeatherKey: 'TWOJ_KLUCZ_OWM'      // Pobierz z openweathermap.org
        };
        ```

3.  **Uruchom serwer lokalny:**
    Ponieważ projekt używa modułów ES6 (`import/export`), nie zadziała po dwukrotnym kliknięciu w `index.html`. Musisz użyć serwera lokalnego. **(Polecam używać na incognito aby wtyczki nie blokowały funkcjonalności)**
    
    * **VS Code (Polecane):** Zainstaluj rozszerzenie *Live Server*, kliknij prawym na `index.html` i wybierz *"Open with Live Server"*.
    * **Python:** `python -m http.server`
    * **Node/NPM:** `npx serve`

## 📂 Struktura Projektu

```text
travel-planner-pro/
├── index.html              # Główny widok aplikacji
├── style.css               # Style CSS (Custom + nadpisania Bootstrapa)
├── README.md               # Dokumentacja
└── js/
    ├── app.js              # Główny kontroler (Event Listeners)
    ├── api.js              # Komunikacja z API (Mapbox, OpenWeather)
    ├── map.js              # Konfiguracja mapy i warstw
    ├── routeController.js  # Logika biznesowa trasy (dodawanie/usuwanie)
    ├── state.js            # Stan aplikacji (Single Source of Truth)
    ├── storage.js          # LocalStorage i obsługa URL
    ├── dashboard.js        # Obsługa panelu statystyk
    ├── chartManager.js     # Konfiguracja wykresu Chart.js
    ├── autocomplete.js     # Logika podpowiedzi w wyszukiwarce
    ├── utils.js            # Funkcje pomocnicze (czas, daty)
    └── config.js           # Plik z kluczami API (ignorowany przez git)