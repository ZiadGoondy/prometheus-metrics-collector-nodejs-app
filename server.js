const express = require('express');
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3003;

app.use(express.static('public'));

// Function to delete all files in a directory
const deleteFilesInDirectory = (directory) => {
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
                if (err) throw err;
            });
        }
    });
};

// Function to create a short version of the metric name
const getShortMetricName = (metric) => {
    return metric.split('_').map(word => word[0]).join('');
};

// Function to create a label part of the file name
const getLabelPart = (labels) => {
    return labels.map(label => `${label.key}_${label.value}`).join('_');
};

app.get('/metrics', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:9090/api/v1/label/__name__/values');
        if (response.data.status === 'success') {
            res.json({ metrics: response.data.data });
        } else {
            throw new Error(response.data.error || 'Failed to fetch metrics from Prometheus');
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/labels', async (req, res) => {
    const { metric } = req.query;

    try {
        const response = await axios.get(`http://localhost:9090/api/v1/series?match[]=${metric}`);
        if (response.data.status === 'success') {
            const labels = new Set();
            response.data.data.forEach(series => {
                Object.keys(series).forEach(label => {
                    if (label !== '__name__') {
                        labels.add(label);
                    }
                });
            });
            res.json({ labels: Array.from(labels) });
        } else {
            throw new Error(response.data.error || 'Failed to fetch labels from Prometheus');
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/label-values', async (req, res) => {
    const { metric, label } = req.query;

    try {
        const response = await axios.get(`http://localhost:9090/api/v1/series?match[]=${metric}`);
        if (response.data.status === 'success') {
            const values = new Set();
            response.data.data.forEach(series => {
                if (series[label]) {
                    values.add(series[label]);
                }
            });
            res.json({ values: Array.from(values) });
        } else {
            throw new Error(response.data.error || 'Failed to fetch label values from Prometheus');
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/query', async (req, res) => {
    const { start, end, metric, step, labels } = req.query;

    const downloadsDir = path.join(__dirname, 'public', 'downloads');

    // Delete all existing files in the downloads directory
    deleteFilesInDirectory(downloadsDir);

    const MAX_POINTS = 10000;
    let currentStart = parseInt(start);
    const endTimestamp = parseInt(end);
    const stepValue = parseInt(step);
    const labelFilters = JSON.parse(labels);

    const shortMetricName = getShortMetricName(metric);
    const labelPart = getLabelPart(labelFilters);
    const timePeriod = `${new Date(start * 1000).toISOString().split('T')[0]}-${new Date(end * 1000).toISOString().split('T')[0]}`;

    try {
        const resultData = {};

        while (currentStart < endTimestamp) {
            const currentEnd = Math.min(currentStart + MAX_POINTS * stepValue, endTimestamp);
            const url = `http://localhost:9090/api/v1/query_range?query=${metric}&start=${currentStart}&end=${currentEnd}&step=${step}`;

            const response = await axios.get(url);
            if (response.data.status === 'success') {
                const result = response.data.data.result;
                result.forEach((metricData, metricIndex) => {
                    const metricName = metricData.metric['__name__'];
                    const metricLabels = metricData.metric;

                    const labelMatch = labelFilters.every(filter => {
                        return metricLabels[filter.key] === filter.value;
                    });

                    if (labelMatch) {
                        if (!resultData[metricIndex]) {
                            resultData[metricIndex] = [];
                        }
                        resultData[metricIndex] = resultData[metricIndex].concat(metricData.values);
                    }
                });
            } else {
                throw new Error(response.data.error || 'Failed to fetch data from Prometheus');
            }

            currentStart = currentEnd;
        }

        const fileUrls = [];
        // Create a CSV file for each metric
        for (const metricIndex in resultData) {
            const csvParser = new Parser({ fields: ['timestamp', 'value'] });
            const csv = csvParser.parse(resultData[metricIndex].map(row => ({ timestamp: row[0], value: row[1] })));
            const filename = `${shortMetricName}-${labelPart}-${timePeriod}.csv`;
            const filePath = path.join(downloadsDir, filename);

            fs.writeFileSync(filePath, csv);
            fileUrls.push(`/downloads/${filename}`);
        }

        res.json({ fileUrls });
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).send({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

