"""
WhatsApp Service Module for Beyond ETA
Handles all WhatsApp messaging automation via Twilio using REST API
"""

import os
import logging
import requests
from typing import Optional, Dict, List
from datetime import datetime
import base64

logger = logging.getLogger(__name__)

class WhatsAppService:
    """Manages WhatsApp message sending through Twilio REST API"""
    
    TWILIO_API_URL = "https://api.twilio.com/2010-04-01"
    
    def __init__(self):
        """Initialize service with credentials from environment"""
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.from_number = os.getenv('TWILIO_FROM_WHATSAPP')
        self.is_configured = False
        
        if self.account_sid and self.auth_token:
            try:
                self.is_configured = True
                logger.info("✅ WhatsApp Service initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize WhatsApp Service: {e}")
                self.is_configured = False
        else:
            logger.warning("⚠️ WhatsApp credentials not configured in environment")
    
    def _get_auth_header(self) -> str:
        """Get basic auth header for Twilio API"""
        credentials = f"{self.account_sid}:{self.auth_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    def send_message(
        self,
        to_number: str,
        body: str,
        media_url: Optional[str] = None
    ) -> Dict:
        """
        Send a simple text message via WhatsApp
        
        Args:
            to_number: Recipient WhatsApp number (format: whatsapp:+country_code_number)
            body: Message text
            media_url: Optional media URL to attach
            
        Returns:
            Dict with message SID or error details
        """
        if not self.is_configured:
            logger.warning("WhatsApp service not configured")
            return {
                "success": False,
                "error": "WhatsApp service not configured",
                "timestamp": datetime.now().isoformat()
            }
        
        try:
            if not to_number.startswith('whatsapp:'):
                to_number = f'whatsapp:{to_number}'
            
            # Build request
            url = f"{self.TWILIO_API_URL}/Accounts/{self.account_sid}/Messages.json"
            
            data = {
                'From': self.from_number,
                'Body': body,
                'To': to_number,
            }
            
            if media_url:
                data['MediaUrl'] = media_url
            
            headers = {
                'Authorization': self._get_auth_header(),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            response = requests.post(url, data=data, headers=headers, timeout=10)
            response.raise_for_status()
            
            message_sid = response.json().get('sid')
            logger.info(f"✅ WhatsApp message sent to {to_number}: {message_sid}")
            
            return {
                "success": True,
                "message_sid": message_sid,
                "to": to_number,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"❌ Failed to send WhatsApp message: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def send_emergency_alert(
        self,
        to_number: str,
        location: str,
        vehicle_number: str,
        maps_link: str,
        additional_info: Optional[Dict] = None,
        media_url: Optional[str] = None
    ) -> Dict:
        """
        Send an emergency/SOS alert via WhatsApp
        
        Args:
            to_number: Recipient number
            location: Current location/address
            vehicle_number: Vehicle registration number
            maps_link: Google Maps link to location
            additional_info: Dictionary with extra info (name, phone, etc)
            
        Returns:
            Dict with message result
        """
        message_body = (
            f"🚨 *EMERGENCY ALERT FROM BEYOND ETA* 🚨\n\n"
            f"📍 *Location:* {location}\n"
            f"🗺️ *Maps Link:* {maps_link}\n"
            f"🚗 *Vehicle:* {vehicle_number}\n"
            f"⏰ *Time:* {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
        )
        
        if additional_info:
            if additional_info.get('name'):
                message_body += f"👤 *Name:* {additional_info['name']}\n"
            if additional_info.get('phone'):
                message_body += f"📱 *Phone:* {additional_info['phone']}\n"
            if additional_info.get('details'):
                message_body += f"ℹ️ *Details:* {additional_info['details']}\n"
        
        message_body += "\n🆘 *URGENT - IMMEDIATE ASSISTANCE NEEDED!* 🆘"
        
        return self.send_message(to_number, message_body, media_url)
    
    def send_safety_notification(
        self,
        to_number: str,
        notification_type: str,
        details: Dict
    ) -> Dict:
        """
        Send safety-related notifications
        
        Args:
            to_number: Recipient number
            notification_type: Type of notification (pothole, unsafe_area, route_warning, etc)
            details: Dictionary with notification details
            
        Returns:
            Dict with message result
        """
        notifications = {
            "pothole": f"⚠️ *Pothole Alert*\n📍 Location: {details.get('location', 'N/A')}\n"
                      f"🚗 Severity: {details.get('severity', 'Medium')}\n⚡ Stay safe!",
            
            "unsafe_area": f"🛑 *Unsafe Area Alert*\n📍 Near: {details.get('location', 'N/A')}\n"
                          f"⚠️ Incidents: {details.get('incident_count', 0)}\n"
                          f"💡 Recommendation: Avoid or take precautions",
            
            "route_warning": f"🛣️ *Route Warning*\n📍 Route: {details.get('route_name', 'N/A')}\n"
                            f"⚠️ Issue: {details.get('warning', 'N/A')}\n"
                            f"✅ Suggested Alternative: {details.get('alternative', 'Available in app')}",
            
            "drowsiness": f"😴 *Drowsiness Alert*\n⚠️ Alert: Stay alert while driving!\n"
                         f"💧 Pull over safely and rest if needed.",
            
            "route_update": f"📍 *Route Update*\n{details.get('message', 'Your route has been updated')}\n"
                           f"✅ Check the app for details."
        }
        
        message_body = notifications.get(
            notification_type,
            f"⚠️ *Safety Notification*\n{details.get('message', 'Please check the app')}"
        )
        
        return self.send_message(to_number, message_body)
    
    def send_bulk_messages(
        self,
        recipients: List[str],
        message_body: str,
        on_error: str = "continue"
    ) -> Dict:
        """
        Send messages to multiple recipients
        
        Args:
            recipients: List of WhatsApp numbers
            message_body: Message text to send to all
            on_error: "continue" to send to remaining or "stop" to halt on error
            
        Returns:
            Dict with results summary
        """
        results = {
            "total": len(recipients),
            "successful": 0,
            "failed": 0,
            "messages": []
        }
        
        for recipient in recipients:
            try:
                result = self.send_message(recipient, message_body)
                if result["success"]:
                    results["successful"] += 1
                else:
                    results["failed"] += 1
                    if on_error == "stop":
                        break
                results["messages"].append(result)
            except Exception as e:
                logger.error(f"Error sending to {recipient}: {e}")
                results["failed"] += 1
                if on_error == "stop":
                    break
        
        return results
    
    def send_template_message(
        self,
        to_number: str,
        content_sid: str,
        content_variables: Dict[str, str]
    ) -> Dict:
        """
        Send a Twilio template message (pre-approved templates)
        
        Args:
            to_number: Recipient number
            content_sid: Template SID from Twilio Content API
            content_variables: Dictionary of template variables
            
        Returns:
            Dict with message result
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "WhatsApp service not configured",
                "timestamp": datetime.now().isoformat()
            }
        
        try:
            if not to_number.startswith('whatsapp:'):
                to_number = f'whatsapp:{to_number}'
            
            # Convert variables dict to string format expected by Twilio
            import json
            from twilio.rest import Client
            
            variables_str = json.dumps(content_variables)
            
            # Create a fresh client for this request
            client = Client(self.account_sid, self.auth_token)
            
            message = client.messages.create(
                from_=self.from_number,
                content_sid=content_sid,
                content_variables=variables_str,
                to=to_number
            )
            
            logger.info(f"✅ Template message sent to {to_number}: {message.sid}")
            return {
                "success": True,
                "message_sid": message.sid,
                "to": to_number,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"❌ Failed to send template message: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


# Initialize service
whatsapp_service = WhatsAppService()
