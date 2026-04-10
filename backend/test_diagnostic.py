#!/usr/bin/env python3
"""
Diagnostic test to compare direct vs service-based approach
"""
import sys
sys.path.insert(0, 'c:/Users/abhay/Downloads/beyond-eta-main/beyond-eta-main/backend')

from pathlib import Path
from dotenv import load_dotenv
import os

ROOT_DIR = Path('c:/Users/abhay/Downloads/beyond-eta-main/beyond-eta-main/backend')
load_dotenv(ROOT_DIR / '.env')

print("=" * 60)
print("TEST 1: Direct Twilio API call (inline)")
print("=" * 60)

try:
    from twilio.rest import Client
    
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    
    client = Client(account_sid, auth_token)
    message = client.messages.create(
        from_='whatsapp:+14155238886',
        body='Test 1 - Direct inline call',
        to='whatsapp:+916396941307'
    )
    print(f"SUCCESS: Message SID = {message.sid}\n")
except Exception as e:
    print(f"FAILED: {e}\n")

print("=" * 60)
print("TEST 2: Via WhatsApp service module")
print("=" * 60)

try:
    from whatsapp_service import whatsapp_service
    
    result = whatsapp_service.send_message(
        to_number='whatsapp:+916396941307',
        body='Test 2 - Via service module'
    )
    
    if result['success']:
        print(f"SUCCESS: Message SID = {result['message_sid']}\n")
    else:
        print(f"FAILED: {result['error']}\n")
except Exception as e:
    print(f"FAILED: {e}\n")
    import traceback
    traceback.print_exc()

print("=" * 60)
