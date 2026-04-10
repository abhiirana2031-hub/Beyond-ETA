# WhatsApp Automation Guide for Beyond ETA

This guide explains how to use the WhatsApp automation features integrated into the Beyond ETA backend using Twilio.

## 🔐 Security First: Credentials Management

### ⚠️ CRITICAL: Never Expose Credentials

**NEVER commit your `.env` file to version control.** The `.env` file is already in `.gitignore`, so it won't be committed. Use `.env.example` as a template for others setting up the project.

### Step 1: Get Twilio Credentials

1. Sign up at [twilio.com](https://www.twilio.com)
2. Go to [Twilio Console](https://www.twilio.com/console)
3. Copy your **Account SID** and **Auth Token**
4. Set up WhatsApp sender number at [Twilio WhatsApp](https://www.twilio.com/console/sms/whatsapp/learn)
5. Get your **WhatsApp From Number** (provided by Twilio, e.g., `whatsapp:+14155238886`)

### Step 2: Configure Environment Variables

Create/update your `.env` file in the `backend/` directory:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_WHATSAPP=whatsapp:+14155238886  # Your Twilio WhatsApp number
TWILIO_TO_WHATSAPP=whatsapp:+916396941307   # Default recipient (optional)
```

**Replace values with your actual credentials.**

### Step 3: Verify Credentials Are Protected

```bash
# Verify .env is in .gitignore
cat .gitignore | grep "\.env"
# Output should include: *.env
```

## 📱 WhatsApp Features Available

### 1. Send Simple Message

Send a text message with optional media.

**Endpoint:** `POST /api/whatsapp/send`

**Request:**
```json
{
  "to_number": "whatsapp:+916396941307",
  "message": "Your message text here",
  "media_url": null
}
```

**Response:**
```json
{
  "success": true,
  "message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "whatsapp:+916396941307",
    "message": "Hello from Beyond ETA!"
  }'
```

### 2. Send Emergency Alert

Send an emergency/SOS alert with location details.

**Endpoint:** `POST /api/whatsapp/emergency`

**Request:**
```json
{
  "to_number": "whatsapp:+916396941307",
  "location": "Mumbai, Maharashtra, India",
  "vehicle_number": "MH02AB1234",
  "maps_link": "https://maps.google.com/?q=19.0760,72.8777",
  "name": "Priya Sharma",
  "phone": "+919876543210",
  "details": "Car broken down on highway"
}
```

**Response:**
```json
{
  "success": true,
  "message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/emergency \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "whatsapp:+916396941307",
    "location": "Mumbai, Maharashtra",
    "vehicle_number": "MH02AB1234",
    "maps_link": "https://maps.google.com/?q=19.0760,72.8777",
    "name": "Priya",
    "phone": "+919876543210"
  }'
```

### 3. Send Safety Notification

Send different types of safety notifications.

**Endpoint:** `POST /api/whatsapp/notification`

**Notification Types:**
- `pothole` - Pothole alert
- `unsafe_area` - Unsafe area warning
- `route_warning` - Route warning
- `drowsiness` - Drowsiness alert
- `route_update` - Route update notification

**Example: Pothole Alert**
```json
{
  "to_number": "whatsapp:+916396941307",
  "notification_type": "pothole",
  "location": "MG Road, Bangalore",
  "severity": "High"
}
```

**Example: Unsafe Area Alert**
```json
{
  "to_number": "whatsapp:+916396941307",
  "notification_type": "unsafe_area",
  "location": "Colaba, Mumbai",
  "incident_count": 5
}
```

**Example: Route Warning**
```json
{
  "to_number": "whatsapp:+916396941307",
  "notification_type": "route_warning",
  "location": "NH4 Bangalore-Chennai",
  "warning": "Heavy traffic reported",
  "alternative": "Take NH44 via Chikballapur"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/notification \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "whatsapp:+916396941307",
    "notification_type": "pothole",
    "location": "MG Road, Bangalore",
    "severity": "High"
  }'
```

### 4. Send Bulk Messages

Send the same message to multiple recipients.

**Endpoint:** `POST /api/whatsapp/bulk`

**Request:**
```json
{
  "recipients": [
    "whatsapp:+916396941307",
    "whatsapp:+919876543210",
    "whatsapp:+919988776655"
  ],
  "message": "⚠️ Safety Alert: Avoid MG Road due to heavy traffic",
  "on_error": "continue"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "messages": [...]
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["whatsapp:+916396941307", "whatsapp:+919876543210"],
    "message": "Safety Alert: Avoid this route",
    "on_error": "continue"
  }'
```

### 5. Send Template Message

Send pre-approved Twilio template messages.

**Endpoint:** `POST /api/whatsapp/template`

**Request:**
```json
{
  "to_number": "whatsapp:+916396941307",
  "content_sid": "HXb5b62575e6e4ff6129ad7c8efe1f983e",
  "content_variables": {
    "1": "12/1",
    "2": "3pm"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8000/api/whatsapp/template \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "whatsapp:+916396941307",
    "content_sid": "HXb5b62575e6e4ff6129ad7c8efe1f983e",
    "content_variables": {"1": "12/1", "2": "3pm"}
  }'
```

## 🏗️ Architecture

### WhatsApp Service Module (`whatsapp_service.py`)

The service provides a clean interface for WhatsApp operations:

```python
from whatsapp_service import whatsapp_service

# Send a simple message
result = whatsapp_service.send_message(
    to_number="whatsapp:+916396941307",
    body="Hello!"
)

# Send emergency alert
result = whatsapp_service.send_emergency_alert(
    to_number="whatsapp:+916396941307",
    location="Mumbai",
    vehicle_number="MH02AB1234",
    maps_link="https://maps.google.com/?q=19.0760,72.8777"
)
```

### Database Integration

Emergency alerts are automatically saved to MongoDB:

```
Collection: emergency_alerts
```

## 🚦 Usage Examples

### Example 1: Auto-Send Emergency Alert

```python
# When emergency button is pressed in the app
@app.post("/emergency/activate")
async def activate_emergency(data: dict):
    result = whatsapp_service.send_emergency_alert(
        to_number=user.emergency_contact,
        location=data['location'],
        vehicle_number=data['vehicle_number'],
        maps_link=f"https://maps.google.com/?q={data['lat']},{data['lng']}"
    )
    return result
```

### Example 2: Automated Safety Notifications

```python
# Background task to send alerts about unsafe areas
async def check_and_notify_unsafe_areas():
    unsafe_areas = await get_unsafe_areas()
    for area in unsafe_areas:
        whatsapp_service.send_safety_notification(
            to_number=user.whatsapp,
            notification_type="unsafe_area",
            details={
                "location": area.name,
                "incident_count": area.incidents
            }
        )
```

### Example 3: Route Warning System

```python
# Notify users about dangerous routes
def notify_route_danger(route_id):
    whatsapp_service.send_safety_notification(
        to_number=user.whatsapp,
        notification_type="route_warning",
        details={
            "route_name": "Highway 101",
            "warning": "Accident reported",
            "alternative": "Use State Route 85"
        }
    )
```

## ⚙️ Configuration

### Twilio Pricing

- WhatsApp messages from India: ₹1-2 per message (approx)
- Emergency alerts: Can be higher priority
- Check [Twilio Pricing](https://www.twilio.com/en-us/messaging/sms/pricing)

### Rate Limiting

To prevent abuse, implement rate limiting:

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@api_router.post("/whatsapp/send")
@limiter.limit("10/minute")
async def send_whatsapp_message(request: WhatsAppMessageRequest):
    # ...
```

### Error Handling

All endpoints return detailed error information:

```json
{
  "success": false,
  "error": "Invalid phone number format",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔍 Debugging

### Check Twilio Logs

```bash
curl -u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN \
  https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json
```

### Enable Debug Logging

```python
import logging
logging.getLogger('twilio').setLevel(logging.DEBUG)
```

### Health Check

```bash
curl http://localhost:8000/api/health
```

## 📚 Resources

- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)
- [Twilio Python SDK](https://www.twilio.com/docs/libraries/python)
- [WhatsApp Messaging Guide](https://www.twilio.com/docs/whatsapp/tutorial/send-and-receive-messages)
- [Content Templates](https://www.twilio.com/docs/whatsapp/messaging-services/content-templates)

## ❓ FAQ

**Q: How do I test without a real Twilio account?**
A: Use Twilio's free trial. You get $15 trial credit and can test with real phone numbers.

**Q: Can I use international numbers?**
A: Yes, but ensure WhatsApp is available in that country. Format: `whatsapp:+country_code_number`

**Q: What's the message character limit?**
A: 4,096 characters per message. Longer messages will be split.

**Q: How do I use pre-approved templates?**
A: Create templates in Twilio Console, get the Content SID, and use the `/whatsapp/template` endpoint.

**Q: What about delivery confirmation?**
A: Twilio provides webhook callbacks. Configure them in the Twilio Console to track delivery status.

---

**Last Updated:** January 2024
**Version:** 1.0.0
