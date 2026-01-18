export function addSecondsToDate(date, seconds) {
    return new Date(date.getTime() + seconds * 1000);
}

export function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function findForecastForTime(forecastList, targetDate) {
    let closest = forecastList[0];
    let minDiff = Infinity;

    const targetTimestamp = targetDate.getTime();

    for (const forecast of forecastList) {
        const forecastTimestamp = forecast.dt * 1000;
        const diff = Math.abs(targetTimestamp - forecastTimestamp);

        if (diff < minDiff) {
            minDiff = diff;
            closest = forecast;
        }
    }
    return closest;
}