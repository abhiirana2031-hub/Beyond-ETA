"""
Ollama LLM Service for data analysis and insights generation
Provides integration with local Ollama models for analyzing sensor and route data
"""

import os
import json
import logging
import httpx
import asyncio
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Ollama configuration from environment
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral')
OLLAMA_TIMEOUT = 120  # 2 minutes timeout for analysis


class OllamaLLMService:
    """Service for interacting with Ollama LLM for data analysis"""
    
    def __init__(self, base_url: str = OLLAMA_BASE_URL, model: str = OLLAMA_MODEL):
        self.base_url = base_url
        self.model = model
        self.api_endpoint = f"{base_url}/api/generate"
        self.health_endpoint = f"{base_url}/api/tags"
        
    async def check_health(self) -> bool:
        """Check if Ollama service is running and accessible"""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(self.health_endpoint)
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False
    
    async def analyze_sensor_data(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze sensor data (accelerometer, gyroscope) to detect anomalies
        and provide insights about vehicle condition and road conditions
        """
        prompt = f"""Analyze the following vehicle sensor data and provide insights:

Sensor Data:
- Accelerometer: {sensor_data.get('accelerometer', {})}
- Gyroscope: {sensor_data.get('gyroscope', {})}
- Pothole Detected: {sensor_data.get('pothole_detected', False)}
- Severity: {sensor_data.get('severity', 'unknown')}
- Timestamp: {sensor_data.get('timestamp', datetime.now(timezone.utc).isoformat())}

Please provide:
1. Analysis of the sensor readings
2. Potential road hazards identified
3. Vehicle safety assessment
4. Recommended actions for the driver

Format your response as JSON with keys: analysis, hazards, safety_assessment, recommendations"""

        try:
            analysis_result = await self._query_ollama(prompt)
            
            # Try to parse JSON response
            try:
                result_json = json.loads(analysis_result)
                return {
                    "status": "success",
                    "analysis": result_json,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "analysis": {"raw_analysis": analysis_result},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Sensor data analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def analyze_route_options(self, route_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze multiple route options considering potholes, AQI, and safety metrics
        Provide recommendation on best route based on user priorities
        """
        prompt = f"""Analyze these route options and recommend the best one:

Route Options:
{json.dumps(route_data.get('routes', []), indent=2)}

User Route Mode: {route_data.get('mode', 'balanced')}
Origin: {route_data.get('origin_name', 'Start')}
Destination: {route_data.get('destination_name', 'End')}

Considering:
- Distance and duration
- Pothole count and severity
- Average AQI (Air Quality Index)
- Safety score
- Overall ride comfort

Please provide:
1. Comparison of route options
2. Pros and cons of each route
3. Recommended route with reasoning
4. Estimated vehicle wear and tear for each route
5. Environmental impact consideration

Format your response as JSON with keys: comparison, route_recommendation, reasoning, vehicle_impact, environmental_impact"""

        try:
            analysis_result = await self._query_ollama(prompt, timeout=60)
            
            try:
                result_json = json.loads(analysis_result)
                return {
                    "status": "success",
                    "analysis": result_json,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "analysis": {"raw_analysis": analysis_result},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Route analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def analyze_air_quality(self, aqi_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze air quality data and provide health recommendations
        """
        prompt = f"""Analyze the following air quality data and provide health insights:

AQI Data:
- AQI Value: {aqi_data.get('aqi', 0)}
- Category: {aqi_data.get('category', 'Unknown')}
- PM2.5: {aqi_data.get('pm25', 0)} µg/m³
- NO2: {aqi_data.get('no2', 0)} ppb
- Location: Latitude {aqi_data.get('latitude')}, Longitude {aqi_data.get('longitude')}

Please provide:
1. Health impact assessment
2. Vulnerable populations affected
3. Immediate recommendations
4. Long-term exposure risks
5. Suggestions for air filtering/protection

Format your response as JSON with keys: health_impact, vulnerable_groups, immediate_actions, long_term_risks, protection_measures"""

        try:
            analysis_result = await self._query_ollama(prompt)
            
            try:
                result_json = json.loads(analysis_result)
                return {
                    "status": "success",
                    "analysis": result_json,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "analysis": {"raw_analysis": analysis_result},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Air quality analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def analyze_safety_metrics(self, safety_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze safety metrics and provide recommendations
        """
        prompt = f"""Analyze these safety metrics for a route and provide recommendations:

Safety Metrics:
- Street Lighting Score: {safety_data.get('street_lighting', 0)}/100
- Vehicle Density Score: {safety_data.get('vehicle_density', 0)}/100
- Isolation Level: {safety_data.get('isolation_level', 0)}/100
- Overall Safety Score: {safety_data.get('overall_score', 0)}/100

Please provide:
1. Safety assessment
2. Time-of-day recommendations
3. Precautions to take
4. Routes to avoid during certain times
5. Emergency resources nearby

Format your response as JSON with keys: safety_assessment, time_recommendations, precautions, avoid_times, emergency_resources"""

        try:
            analysis_result = await self._query_ollama(prompt)
            
            try:
                result_json = json.loads(analysis_result)
                return {
                    "status": "success",
                    "analysis": result_json,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "analysis": {"raw_analysis": analysis_result},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Safety metrics analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def analyze_drowsiness_alert(self, drowsiness_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze drowsiness indicators and provide immediate recommendations
        """
        prompt = f"""Analyze these drowsiness indicators and provide urgent recommendations:

Drowsiness Data:
- Alertness Level: {drowsiness_data.get('alertness_level', 0)}/100
- Eye Closure Rate: {drowsiness_data.get('eye_closure_rate', 0)}
- Yawn Count: {drowsiness_data.get('yawn_count', 0)}
- Warning Status: {drowsiness_data.get('warning', False)}

Please provide:
1. Drowsiness level assessment
2. Immediate actions required
3. Recommended break duration
4. Suggestions for staying alert
5. Health tips for driver wellness

Format your response as JSON with keys: drowsiness_level, immediate_actions, break_duration, alertness_tips, wellness_tips"""

        try:
            analysis_result = await self._query_ollama(prompt)
            
            try:
                result_json = json.loads(analysis_result)
                return {
                    "status": "success",
                    "analysis": result_json,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "analysis": {"raw_analysis": analysis_result},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Drowsiness analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def _query_ollama(self, prompt: str, timeout: int = OLLAMA_TIMEOUT) -> str:
        """
        Internal method to query Ollama API
        Returns the generated response text
        """
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "temperature": 0.7,  # Balanced creativity and stability
            }
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(self.api_endpoint, json=payload)
                response.raise_for_status()
                
                result = response.json()
                return result.get('response', '')
        except httpx.ConnectError:
            raise Exception(f"Cannot connect to Ollama at {self.base_url}. Make sure Ollama is running.")
        except httpx.TimeoutException:
            raise Exception(f"Ollama query timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"Ollama query failed: {str(e)}")
    
    async def generate_trip_summary(self, trip_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a comprehensive trip summary with insights
        """
        prompt = f"""Generate a comprehensive trip summary with insights based on this data:

Trip Data:
{json.dumps(trip_data, indent=2, default=str)}

Please provide:
1. Trip overview and statistics
2. Key events and alerts during trip
3. Route efficiency analysis
4. Environmental impact
5. Vehicle condition assessment
6. Safety incidents
7. Recommendations for future trips

Format your response as JSON with keys: overview, key_events, efficiency, environmental_impact, vehicle_condition, safety, recommendations"""

        try:
            analysis_result = await self._query_ollama(prompt, timeout=90)
            
            try:
                result_json = json.loads(analysis_result)
                return {
                    "status": "success",
                    "summary": result_json,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            except json.JSONDecodeError:
                return {
                    "status": "success",
                    "summary": {"raw_summary": analysis_result},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        except Exception as e:
            logger.error(f"Trip summary generation failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }


# Initialize service
ollama_service = OllamaLLMService()
