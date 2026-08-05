---
name: Vehicle owners and job times
description: Compatibility rules for optional vehicle owners and the transition from one job time to started and finished times
---

Vehicle owners are optional. Vehicles from older local or synced data may have no owner and should be grouped under a visible fallback label rather than rejected.

Jobs now use optional `timeStarted` and `timeFinished` fields. Legacy jobs may only contain `time`; display that value as both started and finished, and sort using it.

**Why:** The mobile and desktop apps share existing persisted and synced records, so changing the data shape must not make older records disappear or render blank.

**How to apply:** Keep compatibility fallbacks at display, sorting, and edit-form initialization boundaries. When saving a new or edited job, write the two explicit time fields.