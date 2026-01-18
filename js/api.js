import { config } from './config.js';

export async function getCityCoordinates(cityName) {
    try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityName)}.json?access_token=${config.mapboxToken}&limit=1&types=place`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.features.length === 0) {
            throw new Error('Nie znaleziono miasta o takiej nazwie.');
        }

        const location = data.features[0];
        return {
            name: location.text,
            coords: location.center
        };

    } catch (error) {
        console.error("Błąd Geocoding:", error);
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

export async function findGasStationsAlongRoute(routeGeometry) {
    // 1. Sprawdzamy Turf.js
    if (typeof turf === 'undefined') {
        console.error("Błąd: Brak biblioteki Turf.js w index.html!");
        return [];
    }

    const line = turf.lineString(routeGeometry.coordinates);
    const length = turf.length(line, { units: 'kilometers' });
    
    // 2. Punkty skanowania co 20 km (gęściej dla lepszej dokładności)
    const steps = 20; 
    const searchPoints = [];
    
    for (let i = 0; i < length; i += steps) {
        const point = turf.along(line, i, { units: 'kilometers' });
        searchPoints.push(point.geometry.coordinates);
    }
    searchPoints.push(routeGeometry.coordinates[routeGeometry.coordinates.length - 1]);

    // 3. Generujemy zapytania do Tilequery API
    const requests = searchPoints.map(coords => {
        const [lng, lat] = coords;
        
        // radius=2000 -> szukamy w promieniu 2000 metrów (2km) od autostrady
        // limit=10 -> max 10 wyników na punkt
        // layers=poi_label -> szukamy tylko punktów zainteresowania
        const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?radius=2000&limit=10&layers=poi_label&access_token=${config.mapboxToken}`;
        
        return fetch(url).then(res => res.json());
    });

    const results = await Promise.all(requests);

    // 4. Filtrowanie wyników
    const stations = [];
    const seenNames = new Set();

    results.forEach(data => {
        if (data.features) {
            data.features.forEach(feature => {
                const props = feature.properties;
                
                if (props.maki === 'fuel' || (props.type && props.type.toLowerCase().includes('gas'))) {
                    
                    const name = props.name || props.name_en || "Stacja Paliw";
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
 * REVERSE GEOCODING: Zamienia współrzędne [lng, lat] na nazwę miasta
 */
export async function getCityNameFromCoords(lng, lat) {
    try {
        // types=place -> chcemy tylko nazwy miejscowości, a nie konkretne ulice
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&limit=1&access_token=${config.mapboxToken}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.features.length === 0) {
            throw new Error('Nie znaleziono miejscowości w tym punkcie.');
        }

        const location = data.features[0];
        return {
            name: location.text,
            coords: location.center
        };

    } catch (error) {
        console.error("Błąd Reverse Geocoding:", error);
        throw error;
    }
}