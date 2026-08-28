---
name: Native Android bridge validation
description: Validation rule for custom native modules in the generated Expo Android project
---

Custom Android modules can pass JavaScript and Expo prebuild checks while still failing Kotlin compilation because React Native bridge APIs are version-sensitive.

**Why:** A document-save bridge reached `compileReleaseKotlin` with unresolved activity access even though its config plugin generated and registered the expected source.

**How to apply:** After changing a native module or its config plugin, run the generated Android project’s Gradle compile in an environment with a valid Android SDK before considering the change verified. Treat source generation as an intermediate check only.