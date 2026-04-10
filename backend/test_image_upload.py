#!/usr/bin/env python3
"""
Test script for SOS alert with image attachment
"""
import requests
import json
import time

def test_emergency_alert_with_image():
    """Test emergency alert endpoint with image attachment"""
    
    # Test the emergency alert with a sample image URL
    test_data = {
        "type": "sos-women-safety",
        "location": {"lat": 28.6139, "lng": 77.2090},
        "message": "Test SOS with image attached - Should see photo link in message",
        "car_number": "DL01AB9999", 
        "photo": "https://via.placeholder.com/300x300.jpg?text=Emergency+SOS",
        "active": True
    }
    
    print("\n" + "="*60)
    print("Testing Emergency Alert with Image Upload")
    print("="*60)
    print("\nSending Test Data:")
    print(json.dumps(test_data, indent=2))
    
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
        print(f"\nResponse Data:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code == 200:
            print("\n✅ SOS Alert sent successfully!")
            print("📱 Check your WhatsApp for the message with image attachment")
        else:
            print(f"\n❌ Failed with status code: {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    test_emergency_alert_with_image()
    print("\n⏳ Waiting a moment for processing...")
    time.sleep(3)
    print("✅ Test complete!")
