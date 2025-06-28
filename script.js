Chart.defaults.font.family = "'Tektur', sans-serif";
Chart.defaults.font.weight = '500';
Chart.defaults.color = '#333';

const fileInput = document.getElementById('htmlFileInput');
const fileSelect = document.getElementById('fileSelect');
const analyzeUploadedBtn = document.getElementById('analyzeUploadedBtn');
const analyzeSelectedBtn = document.getElementById('analyzeSelectedBtn');
const statusDiv = document.getElementById('status');
const chartSection = document.getElementById('chartSection');
const chartContext = document.getElementById('combinedChart').getContext('2d');
let combinedChartInstance;

analyzeUploadedBtn.disabled = true;

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        statusDiv.textContent = `Обрано файл: ${fileInput.files[0].name}.`;
        analyzeUploadedBtn.disabled = false;
    } else {
        analyzeUploadedBtn.disabled = true;
    }
});

analyzeSelectedBtn.addEventListener('click', () => {
    const selectedFile = fileSelect.value;
    statusDiv.textContent = `Завантаження файлу зі списку: ${selectedFile}...`;
    setButtonsDisabled(true);

    fetch(selectedFile)
        .then(response => {
            if (!response.ok) throw new Error(`Не вдалося завантажити файл '${selectedFile}'. Переконайтесь, що він знаходиться в тій же папці.`);
            return response.text();
        })
        .then(htmlContent => analyzeHtmlContent(htmlContent))
        .catch(error => {
            statusDiv.textContent = `Помилка: ${error.message}`;
            statusDiv.style.color = 'red';
            setButtonsDisabled(false);
        });
});

analyzeUploadedBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => analyzeHtmlContent(event.target.result);
    reader.onerror = () => { statusDiv.textContent = `Помилка: неможливо прочитати файл.`; statusDiv.style.color = 'red'; setButtonsDisabled(false); };

    statusDiv.textContent = "Читання файла...";
    setButtonsDisabled(true);
    reader.readAsText(file);
});

function setButtonsDisabled(isDisabled) {
    analyzeSelectedBtn.disabled = isDisabled;
    analyzeUploadedBtn.disabled = isDisabled || fileInput.files.length === 0;
}

function analyzeHtmlContent(htmlContent) {
    try {
        statusDiv.textContent = "Парсинг HTML-файла...";
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const budgetDivs = doc.querySelectorAll("div.payment-1.request-status-14");
        if (budgetDivs.length === 0) throw new Error("Не знайдено жодного студента-бюджетника в наданому файлі.");

        statusDiv.textContent = `Знайдено ${budgetDivs.length} студентів. Видобування оцінок...`;
        const ratings = [], tznk = [], eng = [], profi = [];

        budgetDivs.forEach(budgetDiv => {
            const ratingEl = budgetDiv.querySelector("div.offer-request-kv");
            if (ratingEl) {
                const score = parseFloat(ratingEl.innerText.slice(34, 41).replace(",", "."));
                if (!isNaN(score)) ratings.push(score);
            }
            const subjectDivs = budgetDiv.querySelectorAll("div.offer-subject");
            subjectDivs.forEach(sub => {
                const scoreEl = sub.querySelector("div.f");
                if (scoreEl && scoreEl.innerText.match(/\d+/)) {
                    const score = parseFloat(scoreEl.innerText.match(/\d+/)[0]);
                    if (sub.innerText.includes("ТЗНК")) tznk.push(score);
                    else if (sub.innerText.includes("Іноземна")) eng.push(score);
                    else if (sub.innerText.includes("Фахове")) profi.push(score);
                }
            });
        });
        statusDiv.textContent = "Створення візуалізації...";
        createCombinedBoxPlotChart(ratings, tznk, eng, profi);
        chartSection.style.display = 'block';

        statusDiv.textContent = `Аналіз успішно завершено! Проаналізовано ${budgetDivs.length} студентів.`;
        statusDiv.style.color = 'green';
    } catch (error) {
        console.error("Помилка під час аналізу:", error);
        statusDiv.textContent = `Помилка: ${error.message}`;
        statusDiv.style.color = 'red';
        chartSection.style.display = 'none';
    } finally {
        setButtonsDisabled(false);
    }
}
const asc = arr => arr.sort((a, b) => a - b);

const sum = arr => arr.reduce((a, b) => a + b, 0);

const mean = arr => sum(arr) / arr.length;

const quantile = (arr, q) => {
    const sorted = asc(arr);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

function createCombinedBoxPlotChart(ratingsData, tznkData, engData, profiData) {
    if (combinedChartInstance) {
        combinedChartInstance.destroy();
    }

    const data = [ratingsData, tznkData, engData, profiData];
    const labels = ['Рейтинг', 'ТЗНК', 'Іноземна мова', 'Фаховий іспит'];

    combinedChartInstance = new Chart(chartContext, {
        type: 'boxplot',
        data: {
            labels: labels,
            datasets: [{
                label: 'Статистика',
                data: data,
                backgroundColor: [
                    'rgba(0, 123, 255, 0.2)',
                    'rgba(40, 167, 69, 0.2)',
                    'rgba(255, 193, 7, 0.2)',
                    'rgba(220, 53, 69, 0.2)'
                ],
                borderColor: [
                    'rgba(0, 123, 255, 1)',
                    'rgba(40, 167, 69, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(220, 53, 69, 1)'
                ],
                borderWidth: 2,
                itemRadius: 3,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            devicePixelRatio: window.devicePixelRatio,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => {
                            const stats = context.raw;

                            return [
                                `MAX: ${quantile(stats, 1.0)}`,
                                `Q3: ${quantile(stats, 0.75)}`,
                                `Median: ${quantile(stats, 0.5)}`,
                                `Q1: ${quantile(stats, 0.25)}`,
                                `MIN: ${quantile(stats, 0.0)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                },
                x: {
                    beginAtZero: false,
                    title: { display: true, text: 'Оцінка' }
                }
            }
        }
    });
}

document.getElementById('ratingForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const tznk = parseFloat(document.getElementById('tznk').value);
    const english = parseFloat(document.getElementById('english').value);
    const professional = parseFloat(document.getElementById('professional').value);

    if (isNaN(tznk) || isNaN(english) || isNaN(professional)) {
        alert('Будь ласка, заповніть усі поля коректними числами.');
        return;
    }

    const w_tznk = 0.2;
    const w_english = 0.2;
    const w_professional = 0.6;

    const rating = (tznk * w_tznk) + (english * w_english) + (professional * w_professional);

    const resultContainer = document.getElementById('result');
    const scoreElement = document.getElementById('score');

    scoreElement.textContent = rating.toFixed(3);

    resultContainer.classList.add('visible');
});