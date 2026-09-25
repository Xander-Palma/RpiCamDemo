# RPi Cam Demo (Expo App)

A minimal Expo React Native app that:
1. Scans a QR code shown by the Raspberry Pi
2. Walks the user through joining the Pi's Wi-Fi hotspot
3. Shows the live USB webcam feed (served by `ustreamer` via the Pi's Flask API)

Matches this flow:

```
Phone (Expo App) --Wi-Fi--> Raspberry Pi (Hotspot + Flask API + ustreamer) --USB--> Webcam
```

## 1. Run the app

```bash
npm install
npx expo install --fix   # snaps every Expo package to versions matching your installed Expo Go/SDK
npx expo start
```

> If Expo Go ever says "Project is incompatible with this version of Expo Go" again,
> it means your phone's Expo Go app and this project's `expo` version in
> `package.json` are on different SDKs. Run `npx expo install --fix` to
> auto-correct every dependency to versions compatible with the `expo`
> version you have installed, or install a matching older Expo Go build
> from the link in that error screen.

Scan the Expo dev-server QR with the **Expo Go** app on your phone (this is a
different QR than the one your Pi generates — this one just loads the app).

> Note: `expo-camera`'s QR scanning and any Wi-Fi auto-join behavior work in
> a standard Expo Go / dev client. Actually *programmatically* joining a
> Wi-Fi network (vs. just opening Settings for the user) requires native
> modules like `react-native-wifi-reborn`, which needs a custom dev build —
> out of scope for this simple demo, so the app opens Wi-Fi settings and
> asks the user to confirm they've joined.

## 2. Set up the Pi side

In `pi-side/`:

- `generate_qr.py` — edit the SSID/password/URLs at the top to match your
  hotspot and ustreamer/Flask setup, then run it to produce `qr.png`.
  Display that image (print it, or show it full-screen on a monitor
  attached to the Pi) for the phone to scan.
- `flask_status_stub.py` — a minimal `/status` route your existing Flask
  API can expose so the app can verify it's actually reachable before
  showing the stream.

Your `ustreamer` process should be serving MJPEG at a URL like
`http://192.168.4.1:8080/stream` — that's what goes in the QR payload's
`streamUrl` field.

## 3. Demo flow

1. Launch the app → camera opens automatically.
2. Point it at the Pi's QR code (`qr.png`).
3. App shows the SSID/password → tap "Open Wi-Fi Settings" → join it manually.
4. Back in the app, tap "I'm Connected — View Camera".
5. App pings the Pi's `/status` endpoint, then shows the live stream.

## QR code payload format

The app expects JSON like:

```json
{
  "ssid": "RPI-Hotspot",
  "password": "raspberry123",
  "apiUrl": "http://192.168.4.1:5000",
  "streamUrl": "http://192.168.4.1:8080/stream"
}
```

It also has a fallback parser for standard Wi-Fi QR codes
(`WIFI:S:...;T:WPA;P:...;;`), in which case it defaults `apiUrl`/`streamUrl`
to `192.168.4.1` — edit `DEFAULT_API_URL`/`DEFAULT_STREAM_URL` in `App.js`
if your Pi uses a different address.
