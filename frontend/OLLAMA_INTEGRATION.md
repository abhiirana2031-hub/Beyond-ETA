# Beyond ETA - Frontend Integration Guide for LLM Analysis

## Overview

The backend now provides intelligent LLM-powered analysis endpoints for real-time insights. This guide shows how to integrate these in the frontend.

## API Base URL

```javascript
const API_BASE = 'http://localhost:8000/api';
```

## Analysis Endpoints Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/analysis/health` | GET | Check Ollama status |
| `/analysis/sensor` | POST | Analyze vehicle sensors |
| `/analysis/routes` | POST | Compare and recommend routes |
| `/analysis/aqi` | POST | Analyze air quality |
| `/analysis/safety` | POST | Analyze safety metrics |
| `/analysis/drowsiness` | POST | Analyze drowsiness alerts |
| `/analysis/trip-summary` | POST | Generate trip report |
| `/data/store-analysis` | POST | Save analysis to DB |
| `/data/analysis-results` | GET | Retrieve past analyses |

## Integration Examples

### 1. Check Ollama Status Before Analysis

```javascript
async function checkOllamaStatus() {
  try {
    const response = await fetch(`${API_BASE}/analysis/health`);
    const data = await response.json();
    
    if (data.status === 'healthy') {
      console.log('Ollama is ready for analysis');
      return true;
    } else {
      console.warn('Ollama is unavailable');
      return false;
    }
  } catch (error) {
    console.error('Failed to check Ollama status:', error);
    return false;
  }
}
```

### 2. Route Analysis Component

```javascript
async function analyzeRoutes(routes, mode, origin, destination) {
  const isHealthy = await checkOllamaStatus();
  if (!isHealthy) {
    console.warn('Ollama not available, skipping analysis');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/analysis/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          routes: routes,
          mode: mode,
          origin_name: origin,
          destination_name: destination
        },
        analysis_type: 'route'
      })
    });

    const analysis = await response.json();
    
    if (analysis.status === 'success') {
      console.log('Route Analysis:', analysis.analysis);
      // Display recommendations to user
      displayRouteRecommendation(analysis.analysis);
      
      // Store in DB for history
      await storeAnalysisResult(analysis);
      
      return analysis.analysis;
    } else {
      console.error('Analysis failed:', analysis.error);
    }
  } catch (error) {
    console.error('Error analyzing routes:', error);
  }
}

function displayRouteRecommendation(analysis) {
  // Show recommendation UI to user
  const recommendation = analysis.route_recommendation;
  const reasoning = analysis.reasoning;
  
  const ui = document.createElement('div');
  ui.className = 'route-recommendation';
  ui.innerHTML = `
    <h3>${recommendation}</h3>
    <p>${reasoning}</p>
    <details>
      <summary>Full Analysis</summary>
      <pre>${JSON.stringify(analysis, null, 2)}</pre>
    </details>
  `;
  
  document.getElementById('analysis-container').appendChild(ui);
}
```

### 3. Real-time Sensor Analysis

```javascript
async function analyzeSensorData(sensorReading) {
  try {
    const response = await fetch(`${API_BASE}/analysis/sensor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        gyroscope: sensorReading.gyro,
        accelerometer: sensorReading.accel,
        pothole_detected: sensorReading.isPothole,
        severity: sensorReading.severity || 'low'
      })
    });

    const analysis = await response.json();
    
    if (analysis.status === 'success') {
      // Alert driver of hazards
      const hazards = analysis.analysis.hazards || [];
      if (hazards.length > 0) {
        showDangerAlert(hazards[0]);
      }
      
      return analysis.analysis;
    }
  } catch (error) {
    console.error('Sensor analysis failed:', error);
  }
}

function showDangerAlert(hazard) {
  // Show alert to driver
  const alert = document.createElement('div');
  alert.className = 'danger-alert';
  alert.textContent = `⚠️ ${hazard}`;
  document.body.appendChild(alert);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => alert.remove(), 5000);
}
```

### 4. Drowsiness Detection with Analysis

```javascript
async function checkAndAnalyzeDrowsiness(drowsinessData) {
  if (!drowsinessData.warning) {
    return; // No warning, skip analysis
  }

  try {
    const response = await fetch(`${API_BASE}/analysis/drowsiness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(drowsinessData)
    });

    const analysis = await response.json();
    
    if (analysis.status === 'success') {
      const actions = analysis.analysis.immediate_actions || [];
      
      // Show urgent alert
      if (drowsinessData.warning) {
        showUrgentAlert('Pull Over - Drowsiness Detected!', actions[0]);
      }
    }
  } catch (error) {
    console.error('Drowsiness analysis failed:', error);
  }
}

function showUrgentAlert(title, message) {
  // Critical alert styling
  const alert = document.createElement('div');
  alert.className = 'urgent-alert critical-red';
  alert.innerHTML = `
    <h2>${title}</h2>
    <p>${message}</p>
    <button onclick="this.parentElement.remove()">Dismiss</button>
  `;
  document.body.appendChild(alert);
  
  // Sound alert
  playAlertSound();
}
```

### 5. Air Quality Display with Analysis

```javascript
async function displayAQIWithAnalysis(aqiData) {
  try {
    const response = await fetch(`${API_BASE}/analysis/aqi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aqiData)
    });

    const analysis = await response.json();
    
    if (analysis.status === 'success') {
      const healthTips = analysis.analysis.immediate_actions || [];
      const protectionMeasures = analysis.analysis.protection_measures || [];
      
      updateAQIDisplay(aqiData, healthTips, protectionMeasures);
    }
  } catch (error) {
    console.error('AQI analysis failed:', error);
  }
}

function updateAQIDisplay(aqiData, tips, measures) {
  const container = document.getElementById('aqi-display');
  container.innerHTML = `
    <div class="aqi-card">
      <h2>Air Quality: ${aqiData.category}</h2>
      <p>AQI: ${aqiData.aqi} | PM2.5: ${aqiData.pm25} µg/m³</p>
      
      <div class="health-tips">
        <h3>Recommendations:</h3>
        <ul>
          ${tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      </div>
      
      <div class="protection">
        <h3>Protection Measures:</h3>
        <ul>
          ${measures.map(m => `<li>${m}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}
```

### 6. Trip Summary After Journey

```javascript
async function generateTripSummary(tripData) {
  try {
    const response = await fetch(`${API_BASE}/analysis/trip-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_location: tripData.start,
        end_location: tripData.end,
        duration_minutes: tripData.durationMin,
        distance_km: tripData.distanceKm,
        sensor_readings: tripData.sensorReadings,
        emergency_alerts: tripData.emergencyAlerts,
        pothole_count: tripData.potholeCount,
        average_aqi: tripData.averageAQI,
        route_taken: tripData.routeType
      })
    });

    const summary = await response.json();
    
    if (summary.status === 'success') {
      showTripReportModal(summary.summary);
    }
  } catch (error) {
    console.error('Trip summary failed:', error);
  }
}

function showTripReportModal(summary) {
  const modal = document.createElement('div');
  modal.className = 'modal trip-report';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Trip Summary</h2>
      <div class="summary-sections">
        <section>
          <h3>Overview</h3>
          <p>${summary.overview}</p>
        </section>
        
        <section>
          <h3>Efficiency</h3>
          <p>${summary.efficiency}</p>
        </section>
        
        <section>
          <h3>Environmental Impact</h3>
          <p>${summary.environmental_impact}</p>
        </section>
        
        <section>
          <h3>Recommendations</h3>
          <ul>
            ${(summary.recommendations || []).map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </section>
      </div>
      
      <button onclick="this.parentElement.parentElement.remove()">Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}
```

### 7. Store and Retrieve Analysis History

```javascript
async function storeAnalysisResult(analysisResult) {
  try {
    const response = await fetch(`${API_BASE}/data/store-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisResult)
    });

    const result = await response.json();
    console.log('Analysis stored:', result.id);
    return result.id;
  } catch (error) {
    console.error('Failed to store analysis:', error);
  }
}

async function getAnalysisHistory(limit = 10) {
  try {
    const response = await fetch(`${API_BASE}/data/analysis-results?limit=${limit}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      displayAnalysisHistory(data.results);
      return data.results;
    }
  } catch (error) {
    console.error('Failed to retrieve history:', error);
  }
}

function displayAnalysisHistory(results) {
  const timeline = document.getElementById('analysis-timeline');
  timeline.innerHTML = results.map(result => `
    <div class="analysis-item">
      <time>${new Date(result.timestamp).toLocaleString()}</time>
      <p>${result.analysis_type}</p>
      <details>
        <summary>View Details</summary>
        <pre>${JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  `).join('');
}
```

## Error Handling Best Practices

```javascript
async function safeAnalysis(endpoint, data, fallback = null) {
  try {
    // First check if Ollama is healthy
    const health = await checkOllamaStatus();
    if (!health) {
      console.warn('Ollama unavailable, using fallback');
      return fallback;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      console.error('Analysis error:', result.error);
      return fallback;
    }

    return result;
  } catch (error) {
    console.error('Analysis request failed:', error);
    console.warn('Falling back to default behavior');
    return fallback;
  }
}
```

## Performance Tips

1. **Cache Results:** Store analysis results in localStorage for frequently analyzed data
2. **Batch Requests:** Send multiple analyses together when possible
3. **Debounce:** Don't analyze on every sensor update, use debouncing
4. **Lazy Loading:** Only analyze when needed, not preemptively
5. **Show Loading:** Display loading state while waiting for Ollama response

```javascript
// Example debounced analysis
const debounceAnalysis = debounce(analyzeSensorData, 1000);

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

## Testing

Use the FastAPI docs to test endpoints:
```
http://localhost:8000/docs
```

Or use curl:
```bash
curl -X POST "http://localhost:8000/api/analysis/health"
```

## Troubleshooting

**"Cannot reach Ollama"**
- Ensure Ollama is running on localhost:11434
- Check backend logs for connection errors

**"Analysis timeout"**
- First request loads model (takes 2-5 seconds)
- Increase frontend timeout values
- Consider using a faster Ollama model

**"Blank analysis response"**
- Check that Ollama model is properly loaded
- Verify API response format is correct
- Check browser console for JSON parse errors
