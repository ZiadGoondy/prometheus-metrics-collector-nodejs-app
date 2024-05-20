# prometheus-metrics-collector-nodejs-app
this app collects metrics through prometheus api calls through this endpoint: 
http://localhost:9090/api/v1/query_range?query=${metric}&start=${currentStart}&end=${currentEnd}&step=${step}

you may need to change port/ip for this application in server.js file to meet your needs
also this app exposed to port 3003 you can modify it also through server.js
