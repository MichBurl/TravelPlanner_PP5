import { config } from './config.js';

/**
 * Zamienia nazwę (z inputa) na współrzędne [lng, lat]
 * Szuka miast, wsi ORAZ adresów (usunięto filtry typów)
 */
export async function getCityCoordinates(cityName) {
    try {
        // Brak parametru 'types' oznacza, że szukamy wszystkiego (adresów też)
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityName)}.json?access_token=${config.mapboxToken}&limit=1&language=pl`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.features.length === 0) {
            throw new Error('Nie znaleziono miejsca o takiej nazwie.');
        }

        const location = data.features[0];
        return {
            // text to np. "Marszałkowska", place_name to "Marszałkowska, Warszawa..."
            name: location.text || location.place_name, 
            coords: location.center
        };

    } catch (error) {
        console.error("Błąd Geocoding:", error);
        throw error;
    }
}

/**
 * REVERSE GEOCODING: Zamienia współrzędne [lng, lat] na nazwę (Dla Prawego Kliku)
 */
export async function getCityNameFromCoords(lng, lat) {
    try {
        // Tutaj też pozwalamy na adresy (types=address,place,locality)
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&access_token=${config.mapboxToken}&language=pl`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.features.length === 0) {
            throw new Error('Nie znaleziono adresu w tym punkcie.');
        }

        const location = data.features[0];
        return {
            // Dla adresu 'text' to ulica, dla miasta 'text' to miasto
            name: location.text || "Wybrany punkt",
            coords: location.center
        };

    } catch (error) {
        console.error("Błąd Reverse Geocoding:", error);
        throw error;
    }
}

/**
 * Pobiera prognozę pogody (co 3h)
 */
export async function getWeatherForecast(lat, lng) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${config.openWeatherKey}&units=metric&lang=pl`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Problem z pobraniem pogody');
        
        const data = await response.json();
        return data.list;

    } catch (error) {
        console.error("Błąd Weather API:", error);
        return null;
    }
}

/**
 * Pobiera trasę przejazdu
 */
export async function getRoute(coordsArray) {
    const coordsString = coordsArray
        .map(coord => coord.join(','))
        .join(';');

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${config.mapboxToken}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok') {
            throw new Error('Nie udało się wyznaczyć trasy.');
        }

        return data.routes[0]; 
    } catch (error) {
        console.error("Błąd Routing API:", error);
        throw error;
    }
}

/**
 * Szuka stacji paliw używając Tilequery API
 */
export async function findGasStationsAlongRoute(routeGeometry) {
    if (typeof turf === 'undefined') {
        console.error("Błąd: Brak biblioteki Turf.js!");
        return [];
    }

    const line = turf.lineString(routeGeometry.coordinates);
    const length = turf.length(line, { units: 'kilometers' });
    
    const steps = 20; 
    const searchPoints = [];
    
    for (let i = 0; i < length; i += steps) {
        const point = turf.along(line, i, { units: 'kilometers' });
        searchPoints.push(point.geometry.coordinates);
    }
    searchPoints.push(routeGeometry.coordinates[routeGeometry.coordinates.length - 1]);

    const requests = searchPoints.map(coords => {
        const [lng, lat] = coords;
        const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?radius=3000&limit=10&layers=poi_label&access_token=${config.mapboxToken}`;
        return fetch(url).then(res => res.json());
    });

    const results = await Promise.all(requests);
    const stations = [];
    const seenNames = new Set(); 

    results.forEach(data => {
        if (data.features) {
            data.features.forEach(feature => {
                const props = feature.properties;
                if (props.maki === 'fuel' || (props.type && props.type.toLowerCase().includes('gas'))) {
                    const name = props.name || "Stacja Paliw";
                    const uniqueKey = `${name}-${feature.geometry.coordinates[0]}`;

                    if (!seenNames.has(uniqueKey)) {
                        seenNames.add(uniqueKey);
                        stations.push({
                            name: name,
                            address: "Przy trasie", 
                            coords: feature.geometry.coordinates
                        });
                    }
                }
            });
        }
    });

    return stations;
}

/**
 * AUTOCOMPLETE: Pobiera podpowiedzi (Miasta + Ulice)
 * ZMIANA: Dodano 'address' do parametru types
 */
export async function getCitySuggestions(query) {
    if (query.length < 3) return [];

    try {
        // types=place,locality,address -> Miasta, wsie ORAZ ulice
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${config.mapboxToken}&types=place,locality,address&limit=5&language=pl`;
        
        const response = await fetch(url);
        const data = await response.json();

        return data.features.map(f => ({
            name: f.text,           // Np. "Marszałkowska"
            fullName: f.place_name, // Np. "Marszałkowska, Warszawa, Polska"
            coords: f.center
        }));

    } catch (error) {
        console.error("Autocomplete Error:", error);
        return [];
    }
}