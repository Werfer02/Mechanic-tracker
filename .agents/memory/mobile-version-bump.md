---
name: Mobile version bump
description: Reminder to increment the in-app version string with every mobile update
---

With every change to the Mechanic Tracker mobile app, bump the version in:

  artifacts/mechanic-tracker/constants/version.ts  →  APP_VERSION

**Why:** The mechanic can't tell whether their Expo client has picked up the latest build. The version shows in the Sync tab footer so they can confirm at a glance.

**How to apply:** After any mobile code change (features, fixes, sync logic, UI tweaks), increment the patch number (e.g. 1.0.1 → 1.0.2) as part of the same commit.
