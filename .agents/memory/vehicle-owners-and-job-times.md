---
name: Vehicle owners and job times
description: Compatibility rules for optional vehicle owners and the transition from one job time to started and finished times
---

Vehicle owners are optional. Vehicles from older local or synced data may have no owner and should be grouped under a visible fallback label rather than rejected.

Jobs now use optional `timeStarted` and `timeFinished` fields. Legacy jobs may only contain `time`; use that value for duration compatibility and sorting.

New owner values are normalized to uppercase at input/save boundaries, but legacy owner values keep their stored casing when displayed so differently-cased historical records remain distinguishable.

**Why:** The mobile and desktop apps share existing persisted and synced records, so changing the data shape must not make older records disappear or render blank.

**How to apply:** Keep compatibility fallbacks at duration display, sorting, and edit-form initialization boundaries. Show elapsed time in job overviews, except display the single time when started and finished match, while keeping explicit started/finished fields in edit forms. When saving a new or edited job, write the two explicit time fields. Offer existing owners as case-insensitive autocomplete suggestions.