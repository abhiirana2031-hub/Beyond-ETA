#!/usr/bin/env python3
"""
Direct test of WhatsApp service outside FastAPI context
"""
import sys
sys.path.insert(0, 'c:/Users/abhay/Downloads/beyond-eta-main/beyond-eta-main/backend')

from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path('c:/Users/abhay/Downloads/beyond-eta-main/beyond-eta-main/backend')
load_dotenv(ROOT_DIR / '.env')

# Import the service
from whatsapp_service import whatsapp_service

print(f"Service configured: {whatsapp_service.is_configured}")
print(f"Service from_number: {whatsapp_service.from_number}")

# Test send_message
result = whatsapp_service.send_message(
    to_number='whatsapp:+916396941307',
    body='Direct test - WhatsApp automation is working!',
)

print(f"\nResult: {result}")
print(f"Success: {result['success']}")
if result['success']:
    print(f"Message SID: {result.get('message_sid')}")
else:
    print(f"Error: {result.get('error')}")
