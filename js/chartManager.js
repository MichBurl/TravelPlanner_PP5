let weatherChartInstance = null;

export function initChart() {
    // NAPRAWA: Pobieramy kontekst TUTAJ, wewnątrz funkcji, a nie na zewnątrz
    const canvas = document.getElementById('weatherChart');
    if (!canvas) {
        console.error("Błąd: Nie znaleziono elementu <canvas id='weatherChart'> w HTML.");
        return;
    }
    const ctx = canvas.getContext('2d');

    // Kolory pasujące do Bootstrap Dark Mode
    const gridColor = '#373b3e'; 
    const textColor = '#adb5bd'; 

    weatherChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    type: 'line',
                    borderColor: '#ffc107', // Żółty (Warning)
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 4,
                    borderWidth: 2,
                    order: 1
                },
                {
                    label: 'Szansa na deszcz (%)',
                    data: [],
                    type: 'bar',
                    backgroundColor: 'rgba(13, 110, 253, 0.5)', // Niebieski (Primary)
                    yAxisID: 'y1',
                    barPercentage: 0.6,
                    borderRadius: 4,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { color: textColor, font: { family: 'Inter' } }
                },
                tooltip: {
                    backgroundColor: '#212529',
                    titleColor: '#fff',
                    bodyColor: '#adb5bd',
                    borderColor: '#495057',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += context.parsed.y + (context.datasetIndex === 0 ? '°C' : '%');
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    type: 'linear', 
                    display: true, 
                    position: 'left', 
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y1: { 
                    type: 'linear', 
                    display: true, 
                    position: 'right', 
                    min: 0, max: 100, 
                    grid: { drawOnChartArea: false },
                    ticks: { color: textColor, callback: (v) => v + '%' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

export function updateChartData(labels, temps, rainProbs) {
    if (!weatherChartInstance) return;
    
    weatherChartInstance.data.labels = labels;
    weatherChartInstance.data.datasets[0].data = temps;
    weatherChartInstance.data.datasets[1].data = rainProbs;
    weatherChartInstance.update();
}

export function clearChart() {
    if (!weatherChartInstance) return;
    
    weatherChartInstance.data.labels = [];
    weatherChartInstance.data.datasets[0].data = [];
    weatherChartInstance.data.datasets[1].data = [];
    weatherChartInstance.update();
}