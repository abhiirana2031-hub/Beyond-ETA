#!/usr/bin/env python3
"""
Test script for SOS alert with base64 image data
"""
import requests
import json
import time

# Sample 1x1 red pixel PNG in base64 (tiny image for testing)
SAMPLE_BASE64_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

def test_emergency_alert_with_base64_image():
    """Test emergency alert endpoint with base64 image"""
    
    # Test the emergency alert with base64 image data
    test_data = {
        "type": "sos-women-safety",
        "location": {"lat": 28.6139, "lng": 77.2090},
        "message": "Test SOS with base64 image - Check WhatsApp for image link",
        "car_number": "DL01AB9999", 
        "photo": SAMPLE_BASE64_IMAGE,  # Base64 encoded image data
        "active": True
    }
    
    print("\n" + "="*60)
    print("Testing Emergency Alert with Base64 Image")
    print("="*60)
    print("\nTest Data:")
    print(f"  Type: {test_data['type']}")
    print(f"  Location: {test_data['location']}")
    print(f"  Message: {test_data['message']}")
    print(f"  Car: {test_data['car_number']}")
    print(f"  Photo: {test_data['photo'][:50]}... (base64 image data)")
    
    headers = {'Content-Type': 'application/json'}
    
    print("\n📤 Sending to: http://localhost:8000/api/emergency/alert")
    
    try:
        response = requests.post(
            'http://localhost:8000/api/emergency/alert', 
            json=test_data, 
            headers=headers,
            timeout=15
        )
        
        print(f"\n✅ Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ SOS Alert sent successfully!")
            print(f"📌 Alert ID: {result.get('id')}")
            print(f"🚗 Car: {result.get('car_number')}")
            print(f"📱 Check your WhatsApp for the message with image attachment")
        else:
            print(f"\n❌ Failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    test_emergency_alert_with_base64_image()
    print("\n⏳ Processing WhatsApp message...")
    time.sleep(3)
    print("✅ Test complete!")
