"""
Run this ON THE RASPBERRY PI to generate the QR code your phone scans.

Install deps:
    pip install qrcode[pil] flask

It encodes a small JSON payload with your hotspot credentials and the
URLs your Flask API / ustreamer are actually serving on. Print the
resulting qr.png, or open it full-screen on an attached display/monitor
for the phone to scan.
"""

import json
import qrcode

# --- EDIT THESE TO MATCH YOUR SETUP ----------------------------------------
SSID = "TunaRpi"
PASSWORD = ""
API_URL = "http://192.168.4.1:5000"       # Flask API base URL
STREAM_URL = "http://192.168.4.1:8080/stream"  # ustreamer MJPEG endpoint
# ----------------------------------------------------------------------------

payload = {
    "ssid": SSID,
    "password": PASSWORD,
    "apiUrl": API_URL,
    "streamUrl": STREAM_URL,
}

data = json.dumps(payload)
img = qrcode.make(data)
img.save("qr.png")

print("QR code saved to qr.png")
print("Encoded payload:", data)
