# Beyond ETA - Ollama & MongoDB Integration Setup Guide

## Overview

This guide explains the integration of:
- **Ollama LLM** for intelligent data analysis
- **MongoDB Atlas** for cloud database storage
- **Enhanced API endpoints** for LLM-powered insights

## Prerequisites

### 1. Ollama Setup

Ollama is a local LLM runtime. Follow these steps:

**Windows/macOS/Linux:**
1. Download Ollama from [ollama.ai](https://ollama.ai)
2. Install and launch the application
3. Open terminal and pull a model:
   ```bash
   ollama pull mistral
   ```
   (or try `llama2`, `neural-chat`, or other models)

4. Ollama will run on `http://localhost:11434` by default

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

### 2. Python Environment Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies with new Ollama package
pip install -r requirements.txt
```

### 3. Environment Configuration

The `.env` file is already set up with:
- MongoDB Atlas credentials (via `MONGO_URL`)
- Ollama configuration
- Mapbox API token

**Current .env configuration:**
```
MONGO_URL=mongodb+srv://sagarpanwar199999_db_user:TWbc7RXj5kljeN2y@cluster0.mongodb.net/beyond_eta?retryWrites=true&w=majority
DB_NAME=beyond_eta
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN_HERE
```

## Running the Application

### 1. Start Ollama (in a separate terminal)

```bash
ollama serve
```

### 2. Start the Backend Server

```bash
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

## New LLM Analysis Endpoints

### 1. **Sensor Data Analysis**
```
POST /api/analysis/sensor
```
Analyzes vehicle sensor data (accelerometer, gyroscope) for road hazards and vehicle conditions.

**Request Body:**
```json
{
  "timestamp": "2026-04-04T12:00:00Z",
  "gyroscope": {"x": 0.5, "y": -0.2, "z": 0.1},
  "accelerometer": {"x": -0.3, "y": 0.2, "z": 9.8},
  "pothole_detected": true,
  "severity": "high"
}
```

**Response:**
```json
{
  "status": "success",
  "analysis": {
    "analysis": "Detected pothole with high impact...",
    "hazards": ["Road damage detected"],
    "safety_assessment": "Immediate caution needed",
    "recommendations": ["Slow down", "Avoid pothole if possible"]
  },
  "timestamp": "2026-04-04T12:00:00Z"
}
```

### 2. **Route Comparison Analysis**
```
POST /api/analysis/routes
```
Analyzes and recommends best route based on potholes, AQI, safety scores.

**Request Body:**
```json
{
  "data": {
    "routes": [
      {
        "id": "route_fastest",
        "mode": "Fastest Route",
        "distance": 12.5,
        "duration": 20,
        "pothole_count": 18,
        "aqi_average": 115,
        "safety_score": 68
      }
    ],
    "mode": "balanced",
    "origin_name": "Home",
    "destination_name": "Office"
  },
  "analysis_type": "route"
}
```

### 3. **Air Quality Analysis**
```
POST /api/analysis/aqi
```
Analyzes air quality impacts and health recommendations.

**Request Body:**
```json
{
  "aqi": 95,
  "category": "Moderate",
  "pm25": 35.5,
  "no2": 75,
  "explanation": "Moderate pollution levels",
  "health_impact": "Sensitive groups affected",
  "recommendations": ["Limit outdoor activities"]
}
```

### 4. **Safety Metrics Analysis**
```
POST /api/analysis/safety
```
Analyzes street safety metrics and provides precautions.

**Request Body:**
```json
{
  "street_lighting": 82,
  "vehicle_density": 75,
  "isolation_level": 12,
  "overall_score": 85
}
```

### 5. **Drowsiness Alert Analysis**
```
POST /api/analysis/drowsiness
```
Analyzes driver drowsiness indicators and provides immediate recommendations.

**Request Body:**
```json
{
  "alertness_level": 55,
  "eye_closure_rate": 0.35,
  "yawn_count": 4,
  "warning": true,
  "recommendation": "Take a break"
}
```

### 6. **Trip Summary**
```
POST /api/analysis/trip-summary
```
Generates comprehensive trip analysis including efficiency, environmental impact, and recommendations.

**Request Body:**
```json
{
  "start_location": {"lat": 28.7041, "lng": 77.1025},
  "end_location": {"lat": 28.6139, "lng": 77.2090},
  "duration_minutes": 45,
  "distance_km": 18.5,
  "sensor_readings": [],
  "emergency_alerts": [],
  "pothole_count": 5,
  "average_aqi": 95,
  "route_taken": "fastest"
}
```

### 7. **Check Ollama Health**
```
GET /api/analysis/health
```
Verifies that Ollama service is running and accessible.

**Response:**
```json
{
  "status": "healthy",
  "ollama_url": "http://localhost:11434",
  "model": "mistral",
  "timestamp": "2026-04-04T12:00:00Z"
}
```

## MongoDB Database Structure

### Collections Created Automatically:

1. **emergency_alerts** - Emergency alerts stored during trips
2. **analysis_results** - LLM analysis results stored via API
3. **sensor_data** - Historical sensor readings
4. **route_preferences** - User route preferences and history

### Example Document (Analysis Result):
```json
{
  "analysis_type": "sensor",
  "data": {
    "gyroscope": {...},
    "accelerometer": {...}
  },
  "result": {...},
  "timestamp": "2026-04-04T12:00:00Z"
}
```

## API Data Storage Endpoints

### Store Analysis Result
```
POST /api/data/store-analysis
```
Save LLM analysis results to MongoDB.

### Retrieve Recent Analysis
```
GET /api/data/analysis-results?limit=10
```
Get the 10 most recent analysis results from MongoDB.

## MongoDB Connection Configuration

The backend uses optimized MongoDB connection parameters:
- **Max Pool Size:** 50 connections
- **Min Pool Size:** 10 connections
- **Idle Timeout:** 5 minutes
- **Connection Timeout:** 10 seconds
- **Socket Timeout:** 30 seconds

These settings are suitable for production workloads with normal request patterns.

## Available Ollama Models

Common models to try:
- `mistral` (7B, fast, good for analysis)
- `llama2` (7B, versatile)
- `neural-chat` (7B, conversational)
- `openchat` (3.5B, lightweight)

Pull a different model:
```bash
ollama pull llama2
```

Then update `.env` with `OLLAMA_MODEL=llama2`

## Troubleshooting

### Ollama Connection Error
- Ensure Ollama is running: `ollama serve`
- Check URL in .env: `http://localhost:11434`
- Test: `curl http://localhost:11434/api/tags`

### MongoDB Connection Error
- Verify internet connection (Atlas cluster requires it)
- Check credentials in .env are correct
- Ensure IP is whitelisted in MongoDB Atlas

### Slow Response Times
- First request to Ollama will load the model (~2-5 seconds)
- Subsequent requests are faster
- Consider using a faster model if needed

## Development Notes

### Adding New Analysis Functions

Edit `backend/ollama_service.py`:

```python
async def analyze_custom_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
    """Your analysis function"""
    prompt = f"""Analyze this data: {data}
    
    Provide analysis in key-value JSON format."""
    
    result = await self._query_ollama(prompt)
    # Parse and return
    return {"status": "success", "analysis": result}
```

Then add endpoint in `server.py`:

```python
@api_router.post("/analysis/custom")
async def analyze_custom(request: CustomRequest):
    result = await ollama_service.analyze_custom_data(request.data)
    return AnalysisResponse(**result)
```

## Performance Tips

1. **Caching:** Save frequent analyses in MongoDB to avoid re-running
2. **Batch Processing:** Send related data together
3. **Model Selection:** Use smaller models (3B-7B) for faster responses
4. **Background Tasks:** Use Celery/RQ for long-running analyses

## Next Steps

1. ✅ Pull an Ollama model
2. ✅ Start Ollama service
3. ✅ Install Python dependencies
4. ✅ Start backend server
5. Test endpoints using the provided examples
6. Integrate with frontend

## Support

For issues:
- Check Ollama logs: `ollama serve` terminal
- Check FastAPI docs: `http://localhost:8000/docs`
- MongoDB troubleshooting: Check MongoDB Atlas dashboard
