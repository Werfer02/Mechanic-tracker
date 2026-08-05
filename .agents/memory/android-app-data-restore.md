---
name: Android app data restore
description: Why mobile AsyncStorage data reappeared after uninstall and reinstall
---

The mobile app stores jobs, vehicles, server URL, and sync-room code in AsyncStorage. Android's generated manifest had `android:allowBackup="true"`, so uninstall/reinstall could restore that data and make it look like seed data bundled in the APK.

**Why:** The project source contained no sample records; the generated native manifest confirmed Android backup was enabled.

**How to apply:** For apps where reinstall should be clean, set `android.allowBackup` to `false` in app.json and verify the generated manifest. Existing restored data may still need one manual Clear storage/uninstall cycle.
