document.addEventListener('DOMContentLoaded', function() {
    let allMetrics = [];
    let labelFilters = {};

    $('#metric-select').select2({
        placeholder: 'Search for a metric',
        allowClear: true
    });

    fetch('/metrics')
        .then(response => response.json())
        .then(data => {
            allMetrics = data.metrics;
            const metricSelect = $('#metric-select');
            data.metrics.forEach(metric => {
                const option = new Option(metric, metric);
                metricSelect.append(option);
            });
        })
        .catch(error => {
            console.error('Error fetching metrics:', error);
        });

    $('#metric-select').on('change', function() {
        const metricName = $(this).val();
        if (metricName) {
            fetch(`/labels?metric=${metricName}`)
                .then(response => response.json())
                .then(data => {
                    labelFilters = data.labels;
                })
                .catch(error => {
                    console.error('Error fetching labels:', error);
                });
        }
    });

    document.getElementById('add-label-filter').addEventListener('click', function() {
        const container = document.getElementById('label-select-container');
        const filterDiv = document.createElement('div');
        filterDiv.className = 'label-filter';

        const keySelect = document.createElement('select');
        keySelect.className = 'label-key';
        keySelect.style.width = '45%';
        labelFilters.forEach(label => {
            const option = new Option(label, label);
            keySelect.append(option);
        });

        const valueSelect = document.createElement('select');
        valueSelect.className = 'label-value';
        valueSelect.style.width = '45%';

        keySelect.addEventListener('change', function() {
            const selectedLabel = keySelect.value;
            if (selectedLabel) {
                const metricName = $('#metric-select').val();
                fetch(`/label-values?metric=${metricName}&label=${selectedLabel}`)
                    .then(response => response.json())
                    .then(data => {
                        valueSelect.innerHTML = '';
                        data.values.forEach(value => {
                            const option = new Option(value, value);
                            valueSelect.append(option);
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching label values:', error);
                    });
            }
        });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', function() {
            container.removeChild(filterDiv);
        });

        filterDiv.appendChild(keySelect);
        filterDiv.appendChild(valueSelect);
        filterDiv.appendChild(removeButton);

        container.appendChild(filterDiv);
    });

    document.getElementById('query-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const startDate = document.getElementById('start-date').value;
        const startTime = document.getElementById('start-time').value;
        const endDate = document.getElementById('end-date').value;
        const endTime = document.getElementById('end-time').value;
        const metricName = document.getElementById('metric-select').value;
        const step = parseInt(document.getElementById('step').value);

        const labelFilters = Array.from(document.querySelectorAll('.label-filter')).map(filterDiv => {
            const key = filterDiv.querySelector('.label-key').value;
            const value = filterDiv.querySelector('.label-value').value;
            return { key, value };
        });

        // Combine date and time, then convert to Unix timestamp
        const startDateTime = new Date(`${startDate}T${startTime}`).getTime() / 1000;
        const endDateTime = new Date(`${endDate}T${endTime}`).getTime() / 1000;

        const progressBar = document.getElementById('progress-bar');
        const progressContainer = document.getElementById('progress-container');
        const resultContainer = document.getElementById('result');
        resultContainer.innerHTML = ''; // Clear previous results
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        const updateProgress = (percentage) => {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
        };

        fetch(`/query?start=${startDateTime}&end=${endDateTime}&metric=${metricName}&step=${step}&labels=${encodeURIComponent(JSON.stringify(labelFilters))}`)
            .then(response => response.json())
            .then(data => {
                const { fileUrls } = data;
                let progress = 0;

                fileUrls.forEach((fileUrl, index) => {
                    const link = document.createElement('a');
                    link.href = fileUrl;
                    link.textContent = `Download ${fileUrl.split('/').pop()}`;
                    link.download = fileUrl.split('/').pop();
                    link.style.display = 'block';
                    resultContainer.appendChild(link);

                    progress = ((index + 1) / fileUrls.length) * 100;
                    updateProgress(progress);
                });

                updateProgress(100);
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 500);
            })
            .catch(error => {
                resultContainer.textContent = 'Error: ' + error.message;
                progressContainer.style.display = 'none';
            });
    });
});

