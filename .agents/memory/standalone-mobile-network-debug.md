---
name: Standalone mobile network debugging
description: How to distinguish desktop reachability from API reachability for the Android app
---

A phone loading the desktop page does not prove the mobile sync API is reachable. Test the API endpoint itself, such as `/api/healthz`, and check API logs for an incoming request. If no request appears, the failure is before Express (URL, Android networking, or firewall); HTTP status responses indicate the request reached the server.

**Why:** The web UI and API are separate nginx locations, and standalone Android builds can differ from Expo Go in network behavior.

**How to apply:** When diagnosing a standalone APK, test `http://<LAN-IP>:8080/api/healthz` in the phone browser, then rebuild only after confirming the APK's normalized URL and native cleartext setting.
