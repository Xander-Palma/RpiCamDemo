"""
Minimal addition to your existing Flask API on the Pi.
Add this route so the phone app can confirm it's actually reachable
before jumping to the stream screen.

    pip install flask flask-cors
"""

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow requests from the Expo app


@app.route("/status")
def status():
    return jsonify({"status": "ok", "message": "Raspberry Pi API is reachable"})


if __name__ == "__main__":
    # 0.0.0.0 so it's reachable from phones on the hotspot, not just localhost
    app.run(host="0.0.0.0", port=5000)
