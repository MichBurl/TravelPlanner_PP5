// js/chartManager.js

let weatherChartInstance = null;
const ctx = document.getElementById('weatherChart').getContext('2d');

export function initChart() {
    weatherChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    type: 'line',
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 4,
                    borderWidth: 3,
                    order: 1
                },
                {
                    label: 'Szansa na deszcz (%)',
                    data: [],
                    type: 'bar',
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    yAxisID: 'y1',
                    barPercentage: 0.5,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
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
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Temp (°C)' }, grid: { color: '#f3f4f6' } },
                y1: { type: 'linear', display: true, position: 'right', min: 0, max: 100, title: { display: true, text: 'Deszcz (%)' }, grid: { drawOnChartArea: false } },
                x: { grid: { display: false } }
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