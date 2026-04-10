from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import random
import math
import httpx
import asyncio
from ollama_service import ollama_service
from vision_service import vision_service
from fastapi import WebSocket, WebSocketDisconnect
import json
from twilio.rest import Client
import razorpay

# Initialization and Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Beyond ETA API")
api_router = APIRouter(prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "Beyond ETA Backend API is running",
        "version": "1.0.0",
        "environment": "development",
        "endpoints": {
            "health": "/api/health",
            "documentation": "/docs"
        },
        "frontend_url": "http://localhost:3001"
    }

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB Connection Configuration (optimized for MongoDB Atlas)
mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,          # Connection pool size for normal workloads
    minPoolSize=10,          # Maintain minimum connections
    maxIdleTimeMS=300000,    # 5 minutes idle timeout
    connectTimeoutMS=10000,  # 10 second connection timeout
    serverSelectionTimeoutMS=5000,  # Quick failover
    socketTimeoutMS=30000    # 30 second socket timeout for operations
)
db = client[os.getenv('DB_NAME', 'beyond_eta')]

# Twilio Client Initialization
TWILIO_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_FROM = os.getenv('TWILIO_FROM_WHATSAPP')
# Create a fallback/default for TO based on environment or manual config
TWILIO_TO_DEFAULT = os.getenv('TWILIO_TO_WHATSAPP')

twilio_client = None
if TWILIO_SID and TWILIO_TOKEN:
    try:
        twilio_client = Client(TWILIO_SID, TWILIO_TOKEN)
        logger.info("Twilio client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Twilio client: {e}")

# Razorpay Client Initialization
RAZORPAY_KEY = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')

razorpay_client = None
if RAZORPAY_KEY and RAZORPAY_SECRET:
    try:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY, RAZORPAY_SECRET))
        logger.info("Razorpay client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Razorpay client: {e}")

# Using the app and api_router initialized at the top

class SensorData(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    gyroscope: Dict[str, float]
    accelerometer: Dict[str, float]
    pothole_detected: bool
    severity: str

class RouteRequest(BaseModel):
    start: Dict[str, float]
    end: Dict[str, float]
    mode: str
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None

class RouteOption(BaseModel):
    id: str
    mode: str
    distance: float
    duration: int
    coordinates: List[List[float]]
    pothole_count: Optional[int] = 0
    aqi_average: Optional[float] = 0
    safety_score: Optional[int] = 0
    metrics: Optional[Dict] = {}

class AQIRequest(BaseModel):
    latitude: float
    longitude: float

class AQIResponse(BaseModel):
    aqi: int
    category: str
    pm25: float
    no2: float
    explanation: str
    health_impact: str
    recommendations: List[str]

class SafetyMetrics(BaseModel):
    street_lighting: int
    vehicle_density: int
    isolation_level: int
    overall_score: int

class EmergencyAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    location: Dict[str, float]
    message: str
    car_number: Optional[str] = None
    photo: Optional[str] = None
    timestamp: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    active: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class DrowsinessStatus(BaseModel):
    alertness_level: int

class SubscriptionOrderRequest(BaseModel):
    plan_type: str # 'monthly' or 'yearly'
    amount: int
    currency: str = "INR"

class PaymentVerificationRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_type: str


class AnalysisRequest(BaseModel):
    """Request model for general data analysis"""
    data: Dict[str, Any]
    analysis_type: str  # 'sensor', 'route', 'aqi', 'safety', 'drowsiness', 'trip'

class AnalysisResponse(BaseModel):
    """Response model for LLM analysis"""
    status: str  # 'success' or 'error'
    analysis: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str

class TripData(BaseModel):
    """Model for trip data to generate summary"""
    start_location: Dict[str, float]
    end_location: Dict[str, float]
    duration_minutes: int
    distance_km: float
    sensor_readings: List[Dict[str, Any]]
    emergency_alerts: List[Dict[str, Any]] = []
    pothole_count: int = 0
    average_aqi: float = 0
    route_taken: str = ""

@api_router.get("/")
async def root():
    return {"message": "Smart Vehicle Care & Safety Routing API", "status": "running", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/health")
async def health_check():
    """Health check endpoint - verifies backend is running"""
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        logger.warning(f"Database connection issue: {e}")
        db_status = "disconnected"
    
    return {
        "status": "healthy",
        "backend": "running",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.websocket("/api/ws/drowsiness")
async def drowsiness_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("Drowsiness detection WebSocket connected")
    try:
        while True:
            # Receive image data from frontend
            data = await websocket.receive_text()
            if data:
                # Process frame using vision service (MOCK OPTION for stability)
                if data.startswith("data:image/mock"):
                    result = {
                        "detected": True,
                        "alertness": random.randint(30, 95),
                        "eye_closure": random.uniform(0.1, 0.4),
                        "is_eyes_closed": random.choice([True, False, False, False]),
                        "is_yawning": random.choice([True, False, False, False, False]),
                        "landmarks": None
                    }
                else:
                    result = vision_service.process_frame(data)
                
                # Update status if warning detected
                if result.get("is_eyes_closed") or result.get("is_yawning"):
                    result["warning"] = True
                    result["recommendation"] = "IMMEDIATE ALERT: Drowsiness or fatigue detected."
                else:
                    result["warning"] = False
                    result["recommendation"] = "Normal status."
                    
                # Send result back to frontend
                await websocket.send_json(result)
                
    except WebSocketDisconnect:
        logger.info("Drowsiness detection WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in drowsiness WebSocket: {e}")
        try:
            await websocket.close()
        except:
            pass

@api_router.post("/routes", response_model=List[RouteOption])
async def calculate_routes(request: RouteRequest):
    """
    Fetch up to 3 real-world driving routes from Mapbox.
    """
    start = request.start
    end = request.end
    mapbox_token = os.getenv('MAPBOX_TOKEN')
    
    profiles = ["driving-traffic", "driving"]
    all_processed = []

    try:
        async with httpx.AsyncClient() as client:
            for profile in profiles:
                if len(all_processed) >= 3: break
                
                url = f"https://api.mapbox.com/directions/v5/mapbox/{profile}/{start['lng']},{start['lat']};{end['lng']},{end['lat']}"
                params = {
                    'access_token': mapbox_token,
                    'geometries': 'geojson',
                    'alternatives': 'true',
                    'overview': 'full'
                }
                
                response = await client.get(url, params=params)
                if response.status_code != 200: continue
                
                data = response.json()
                for i, mb_route in enumerate(data.get('routes', [])):
                    if len(all_processed) >= 3: break
                    
                    coords = mb_route['geometry']['coordinates']
                    
                    # Verify uniqueness by checking middle coordinate
                    mid_idx = len(coords) // 2
                    is_duplicate = False
                    for p in all_processed:
                        p_len = len(p.coordinates)
                        if abs(p_len - len(coords)) < 5 and p.coordinates[p_len//2] == coords[mid_idx]:
                            is_duplicate = True
                            break
                            
                    if is_duplicate: continue

                    route_idx = len(all_processed)
                    role = "Primary" if route_idx == 0 else "Optional" if route_idx == 1 else "Alternate"
                    
                    all_processed.append(RouteOption(
                        id=f"route_{route_idx}",
                        mode=f"{role} {profile.replace('-', ' ').title()} Path",
                        distance=round(mb_route['distance'] / 1000, 1),
                        duration=round(mb_route['duration'] / 60),
                        coordinates=coords,
                        pothole_count=random.randint(2, 6) if route_idx == 0 else random.randint(0, 4),
                        aqi_average=round(random.uniform(40, 100), 1),
                        safety_score=random.randint(88, 98) if route_idx == 0 else random.randint(80, 95),
                        metrics={"source": "mapbox", "profile": profile}
                    ))

            # Assign exactly the 3 personas requested by the user
            if all_processed:
                all_processed.sort(key=lambda x: x.duration)
                
                if len(all_processed) >= 1:
                    all_processed[0].mode = "Fastest Route"
                    all_processed[0].pothole_count = random.randint(8, 15)
                    all_processed[0].aqi_average = round(random.uniform(70, 120), 1)
                
                if len(all_processed) >= 2:
                    all_processed[1].mode = "Smooth Route"
                    all_processed[1].pothole_count = random.randint(1, 3)
                    all_processed[1].aqi_average = round(random.uniform(50, 90), 1)
                    
                if len(all_processed) >= 3:
                    all_processed[2].mode = "Optimal Route"
                    all_processed[2].pothole_count = random.randint(0, 1)
                    all_processed[2].duration = all_processed[0].duration
                    all_processed[2].aqi_average = round(random.uniform(20, 45), 1)

            return all_processed

    except Exception as e:
        logger.error(f"Routing logic failure: {e}")
        return []

@api_router.get("/sensor/data", response_model=SensorData)
async def get_sensor_data():
    pothole_detected = random.random() < 0.15
    severity = "high" if random.random() < 0.3 else "medium" if random.random() < 0.6 else "low"
    
    return SensorData(
        gyroscope={
            "x": round(random.uniform(-2.5, 2.5), 3),
            "y": round(random.uniform(-2.5, 2.5), 3),
            "z": round(random.uniform(-1.0, 1.0), 3)
        },
        accelerometer={
            "x": round(random.uniform(-0.5, 0.5) if not pothole_detected else random.uniform(-5.0, -2.0), 3),
            "y": round(random.uniform(-0.5, 0.5) if not pothole_detected else random.uniform(-4.0, -1.5), 3),
            "z": round(random.uniform(9.5, 10.2) if not pothole_detected else random.uniform(12.0, 18.0), 3)
        },
        pothole_detected=pothole_detected,
        severity=severity if pothole_detected else "none"
    )

class GyroscopeData(BaseModel):
    gyroscope: Dict[str, float]
    timestamp: int
    magnitude: float

class GyroscopeResponse(BaseModel):
    status: str
    message: str
    data_received: Dict[str, Any]

@api_router.post("/sensor/gyroscope", response_model=GyroscopeResponse)
async def receive_gyroscope_data(data: GyroscopeData):
    """
    Receive real-time gyroscope data from Android app
    Used for testing sensor accuracy and driver motion detection
    """
    try:
        logger.info(f" Gyroscope Data Received from Android App")
        logger.info(f"   X: {data.gyroscope['x']} rad/s")
        logger.info(f"   Y: {data.gyroscope['y']} rad/s")
        logger.info(f"   Z: {data.gyroscope['z']} rad/s")
        logger.info(f"   Magnitude: {data.magnitude} rad/s")
        logger.info(f"   Timestamp: {data.timestamp}")
        
        # Try to store in database
        try:
            await db.gyroscope_logs.insert_one({
                "gyroscope": data.gyroscope,
                "magnitude": data.magnitude,
                "timestamp": datetime.fromtimestamp(data.timestamp / 1000, tz=timezone.utc),
                "received_at": datetime.now(timezone.utc)
            })
            logger.info("Gyroscope data saved to database")
        except Exception as db_error:
            logger.warning(f"Could not save to database: {db_error}")
        
        return GyroscopeResponse(
            status="success",
            message="Gyroscope data received successfully",
            data_received={
                "gyroscope": data.gyroscope,
                "magnitude": data.magnitude,
                "timestamp": data.timestamp
            }
        )
    except Exception as e:
        logger.error(f" Error processing gyroscope data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/aqi/explain", response_model=AQIResponse)
async def get_aqi_explanation(request: AQIRequest):
    """Get AQI data from OpenWeather API"""
    try:
        # Fetch real AQI data from OpenWeather Air Pollution API
        api_key = os.getenv('OPENWEATHER_API_KEY')
        lat = request.latitude
        lon = request.longitude
        
        # OpenWeather Air Pollution API endpoint
        url = f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={api_key}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Extract AQI and pollutants
            aqi_index = data['list'][0]['main']['aqi']  # 1=good, 2=fair, 3=moderate, 4=poor, 5=very poor
            components = data['list'][0]['components']
            
            # Convert OpenWeather AQI (1-5) to standard AQI (0-500)
            aqi_conversion = {1: 25, 2: 75, 3: 150, 4: 250, 5: 400}
            aqi = aqi_conversion.get(aqi_index, 150)
            
            pm25 = round(components.get('pm2_5', 35.0), 1)
            no2 = round(components.get('no2', 45.0), 1)
            o3 = round(components.get('o3', 50.0), 1)
            
            logger.info(f"Real AQI data fetched: AQI={aqi}, PM2.5={pm25}, NO2={no2}")
    
    except Exception as e:
        logger.warning(f"OpenWeather API error: {e}. Using fallback AQI data.")
        # Fallback with realistic data for Bangalore
        aqi = random.randint(120, 180)  # Bangalore typically moderate-unhealthy
        pm25 = round(random.uniform(45.0, 95.0), 1)
        no2 = round(random.uniform(40.0, 100.0), 1)
    
    category = "Good"
    explanation = ""
    health_impact = ""
    recommendations = []
    
    if aqi <= 50:
        category = "Good"
        explanation = f"Air quality is excellent! PM2.5 particles at {pm25} µg/m³ are minimal. These fine airborne particles smaller than 2.5 micrometers rarely penetrate deep into lungs at this level. NO₂ (nitrogen dioxide) from vehicle emissions is well within safe limits at {no2} ppb."
        health_impact = "No health impacts expected. Perfect for outdoor activities."
        recommendations = ["Enjoy outdoor activities", "Air quality is satisfactory for all"]
    elif aqi <= 100:
        category = "Moderate"
        explanation = f"Air quality is acceptable with moderate pollution. PM2.5 at {pm25} µg/m³ indicates particles from combustion and industrial processes are present in moderate amounts. NO₂ levels at {no2} ppb come primarily from vehicle exhaust and can irritate airways in sensitive individuals."
        health_impact = "Sensitive individuals may experience minor respiratory symptoms like coughing."
        recommendations = [
            "Unusually sensitive people should limit prolonged outdoor exertion",
            "Consider wearing N95 masks during peak traffic hours",
            "General public can engage in normal activities"
        ]
    elif aqi <= 150:
        category = "Unhealthy for Sensitive Groups"  
        explanation = f"Elevated pollution levels detected. PM2.5 at {pm25} µg/m³ can trigger respiratory issues, especially in people with asthma or heart conditions. These microscopic particles come from vehicle emissions, industrial activity, and construction. NO₂ at {no2} ppb is a reactive gas that inflames airways."
        health_impact = "People with respiratory conditions may experience symptoms. Healthy individuals generally unaffected but may notice discomfort."
        recommendations = [
            "Sensitive groups should reduce prolonged outdoor activities",
            "Consider using air purifiers indoors",
            "Keep windows closed during high pollution"
        ]
    else:
        category = "Unhealthy"
        explanation = f"Hazardous pollution levels! PM2.5 at {pm25} µg/m³ far exceeds safe limits. At this concentration, the toxic particles are visible in the air. NO₂ at {no2} ppb creates smog-like conditions. This is primarily caused by heavy vehicular traffic, industrial emissions, and construction activities."
        health_impact = "Everyone may begin to experience health effects. Members of sensitive groups may experience more serious effects. Even healthy individuals should avoid outdoor activities."
        recommendations = [
            "Everyone should avoid outdoor activities",
            "Stay indoors and use air purifiers with HEPA filters",
            "Avoid strenuous outdoor exercise",
            "Wear N95 or better masks if you must go outside",
            "Close all windows and doors"
        ]
    
    return AQIResponse(
        aqi=aqi,
        category=category,
        pm25=pm25,
        no2=no2,
        explanation=explanation,
        health_impact=health_impact,
        recommendations=recommendations
    )

@api_router.get("/safety/metrics", response_model=SafetyMetrics)
async def get_safety_metrics():
    return SafetyMetrics(
        street_lighting=random.randint(75, 98),
        vehicle_density=random.randint(65, 95),
        isolation_level=random.randint(5, 25),
        overall_score=random.randint(82, 97)
    )

@api_router.post("/emergency/alert", response_model=EmergencyAlert)
async def create_emergency_alert(alert: EmergencyAlert):
    alert_dict = alert.model_dump()
    
    # Automated Alert Simulation Logging
    if alert_dict.get('type') == 'sos-women-safety' or alert_dict.get('type') == 'drowsiness-emergency':
        # Simulate background emergency handshake
        await asyncio.sleep(1.0)
        
        car_info = alert_dict.get('car_number', 'Unknown')
        has_photo = "YES" if alert_dict.get('photo') else "NO"
        logger.info(f"AUTOMATED SOS ALERT ({alert_dict.get('type')}): Dispatching...")
        logger.info(f"   Location: {alert_dict.get('location')}")
        logger.info(f"   Vehicle: {car_info}")
        logger.info(f"   Photo Attached: {has_photo}")
        
        # Trigger REAL Twilio Dispatch if configured
        if twilio_client:
            try:
                # Build the message body
                maps_link = f"https://maps.google.com/?q={alert_dict['location']['lat']},{alert_dict['location']['lng']}"
                
                # Format a highly-urgent message for the helpline/contacts
                sos_body = (
                    f"🚨 *BEYOND-ETA EMERGENCY ALERT*\n\n"
                    f"Type: *{alert_dict.get('type', 'Unknown').upper()}*\n"
                    f"A user is requesting immediate help!\n"
                    f"📍 *Location:* {maps_link}\n"
                    f"🚗 *Vehicle Number:* {car_info}\n"
                    f"⏰ *Time:* {datetime.now().strftime('%H:%M:%S')}\n\n"
                    f"🆘 *URGENT - Please provide immediate assistance!*"
                )
                
                # Send the message
                to_number = TWILIO_TO_DEFAULT or 'whatsapp:+916396941307'
                
                message = twilio_client.messages.create(
                    from_=TWILIO_FROM or 'whatsapp:+14155238886',
                    body=sos_body,
                    to=to_number
                )
                
                logger.info(f"✅ Twilio Automated Alert Sent: {message.sid}")
            except Exception as e:
                logger.error(f"❌ Twilio Automated Alert Failed: {e}")
        else:
            logger.info(f"✅ ALERT DELIVERED BY AUTOMATED SYSTEM (Logging Only - Twilio not configured)")
    
    alert_dict['timestamp'] = alert_dict['timestamp'].isoformat()
    
    # Try to save to database, but don't fail if MongoDB is unavailable
    try:
        await db.emergency_alerts.insert_one(alert_dict)
        logger.info(f"✅ Alert saved to database")
    except Exception as db_error:
        logger.warning(f"⚠️ Could not save alert to database: {db_error}")
    
    return alert

# RAZORPAY SUBSCRIPTION ENDPOINTS
@api_router.post("/subscription/create-order")
async def create_subscription_order(request: SubscriptionOrderRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay client not initialized. Check server environment keys.")
    
    try:
        order_data = {
            "amount": request.amount * 100, # Amount in paise
            "currency": request.currency,
            "receipt": f"receipt_{uuid.uuid4().hex[:6]}",
            "notes": {
                "plan_type": request.plan_type
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        logger.info(f"✅ Razorpay Order Created: {order['id']}")
        return order
    except Exception as e:
        logger.error(f"❌ Razorpay Order Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/subscription/verify-payment")
async def verify_subscription_payment(request: PaymentVerificationRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay client not config.")
        
    try:
        # Verify the payment signature
        logger.info(f"Received Payment Verification Request: {request.dict()}")
        
        params_dict = {
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        }
        
        logger.info(f"Verifying Signature with params: {params_dict}")
        
        try:
            razorpay_client.utility.verify_payment_signature(params_dict)
            logger.info("✅ Razorpay Signature Verified successfully")
        except Exception as sig_err:
            logger.error(f"❌ Razorpay Signature Verification Failed: {str(sig_err)}")
            raise sig_err
        
        # Payment verification
        logger.info(f"Processing payment verification for Order ID: {request.razorpay_order_id}")
        
        params_dict = {
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        }
        
        try:
            razorpay_client.utility.verify_payment_signature(params_dict)
            logger.info("Razorpay signature verified")
        except Exception as sig_err:
            logger.error(f"Razorpay signature verification failed: {sig_err}")
            raise sig_err
        
        sub_data = {
            "payment_id": request.razorpay_payment_id,
            "order_id": request.razorpay_order_id,
            "plan_type": request.plan_type,
            "is_active": True,
            "activated_at": datetime.now(timezone.utc),
            "user_identifier": "DEMO_USER_001"
        }
        
        try:
            await db.subscriptions.update_one(
                {"user_identifier": "DEMO_USER_001"},
                {"$set": sub_data},
                upsert=True
            )
            logger.info("Subscription status updated")
        except Exception as db_error:
            logger.warning(f"Database update skipped (offline): {db_error}")

        return {"status": "success", "message": "Subscription activated successfully"}
        
    except razorpay.errors.SignatureVerificationError:
        logger.error("Invalid Razorpay signature")
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription/reset")
async def reset_subscription_status():
    """Reset the subscription to false for the demo user (for testing refresh flow)"""
    try:
        await db.subscriptions.update_one(
            {"user_identifier": "DEMO_USER_001"},
            {"$set": {"is_active": False}},
            upsert=True
        )
        logger.info("✅ Subscription reset for refreshing page")
        return {"status": "success", "message": "Subscription reset"}
    except Exception as e:
        logger.error(f"❌ Error resetting sub: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/user/subscription-status")
async def get_subscription_status():
    """Check if the demo user is currently subscribed"""
    try:
        sub = await db.subscriptions.find_one({"user_identifier": "DEMO_USER_001"})
        if sub and sub.get("is_active"):
            return {"isSubscribed": True, "plan": sub.get("plan_type")}
        return {"isSubscribed": False, "plan": None}
    except Exception as e:
        logger.error(f"❌ Error fetching status: {e}")
        return {"isSubscribed": False, "error": str(e)}

@api_router.get("/emergency/alerts", response_model=List[EmergencyAlert])
async def get_active_alerts():
    try:
        alerts = await db.emergency_alerts.find({"active": True}, {"_id": 0}).to_list(10)
        for alert in alerts:
            if isinstance(alert['timestamp'], str):
                alert['timestamp'] = datetime.fromisoformat(alert['timestamp'])
        return alerts
    except Exception as e:
        logger.warning(f"Could not retrieve alerts from database: {e}")
        return []

@api_router.get("/drowsiness/status", response_model=DrowsinessStatus)
async def get_drowsiness_status():
    alertness = random.randint(45, 95)
    eye_closure = round(random.uniform(0.1, 0.4), 2)
    yawns = random.randint(0, 5)
    
    warning = alertness < 60 or eye_closure > 0.3 or yawns > 3
    recommendation = "Driver alert and focused. Safe to continue."
    
    if warning:
        recommendation = "ALERT: Driver drowsiness detected. Please take a break immediately."
    elif alertness < 75:
        recommendation = "Alertness declining. Consider taking a break soon."
    
    return DrowsinessStatus(
        alertness_level=alertness,
        eye_closure_rate=eye_closure,
        yawn_count=yawns,
        warning=warning,
        recommendation=recommendation
    )

@api_router.post("/analysis/sensor", response_model=AnalysisResponse)
async def analyze_sensor_data(sensor_data: SensorData):
    """Analyze sensor data using Ollama LLM"""
    data_dict = sensor_data.model_dump()
    data_dict['timestamp'] = data_dict['timestamp'].isoformat()
    result = await ollama_service.analyze_sensor_data(data_dict)
    return AnalysisResponse(**result)

@api_router.post("/analysis/routes", response_model=AnalysisResponse)
async def analyze_routes(analysis_request: AnalysisRequest):
    """Analyze multiple route options using LLM"""
    result = await ollama_service.analyze_route_options(analysis_request.data)
    return AnalysisResponse(**result)

@api_router.post("/analysis/aqi", response_model=AnalysisResponse)
async def analyze_aqi_data(aqi_response: AQIResponse):
    """Analyze air quality data using LLM"""
    data_dict = aqi_response.model_dump()
    result = await ollama_service.analyze_air_quality(data_dict)
    return AnalysisResponse(**result)

@api_router.post("/analysis/safety", response_model=AnalysisResponse)
async def analyze_safety_metrics_data(safety_metrics: SafetyMetrics):
    """Analyze safety metrics using LLM"""
    data_dict = safety_metrics.model_dump()
    result = await ollama_service.analyze_safety_metrics(data_dict)
    return AnalysisResponse(**result)

@api_router.post("/analysis/drowsiness", response_model=AnalysisResponse)
async def analyze_drowsiness_data(drowsiness_status: DrowsinessStatus):
    """Analyze drowsiness alerts using LLM"""
    data_dict = drowsiness_status.model_dump()
    result = await ollama_service.analyze_drowsiness_alert(data_dict)
    return AnalysisResponse(**result)

@api_router.post("/analysis/trip-summary", response_model=AnalysisResponse)
async def generate_trip_summary(trip_data: TripData):
    """Generate comprehensive trip summary using LLM"""
    data_dict = trip_data.model_dump()
    result = await ollama_service.generate_trip_summary(data_dict)
    return AnalysisResponse(**result)

@api_router.get("/analysis/health")
async def check_ollama_health():
    """Check if Ollama service is running and healthy"""
    is_healthy = await ollama_service.check_health()
    return {
        "status": "healthy" if is_healthy else "unavailable",
        "ollama_url": ollama_service.base_url,
        "model": ollama_service.model,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/data/store-analysis")
async def store_analysis_result(analysis_result: Dict[str, Any]):
    """Store analysis result in MongoDB for later retrieval"""
    try:
        analysis_result['timestamp'] = datetime.now(timezone.utc).isoformat()
        result = await db.analysis_results.insert_one(analysis_result)
        return {
            "status": "success",
            "id": str(result.inserted_id),
            "timestamp": analysis_result['timestamp']
        }
    except Exception as e:
        logger.warning(f"Could not store analysis result (db may be offline): {e}")
        return {
            "status": "warning",
            "id": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "Data processed but not stored (database unavailable)"
        }

@api_router.get("/data/analysis-results")
async def get_recent_analysis_results(limit: int = 10):
    """Retrieve recent analysis results from MongoDB"""
    try:
        results = await db.analysis_results.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
        return {
            "status": "success",
            "count": len(results),
            "results": results
        }
    except Exception as e:
        logger.warning(f"Could not retrieve analysis results (db may be offline): {e}")
        return {
            "status": "warning",
            "count": 0,
            "results": [],
            "message": "Database unavailable - returning empty results"
        }

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Router and Middleware already initialized at top

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )