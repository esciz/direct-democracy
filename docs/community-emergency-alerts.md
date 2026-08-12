# Community emergency alerts

Community pages can show a temporary emergency panel when a live official notice applies to that jurisdiction. The panel is supplemental civic information, not a replacement for 911, Wireless Emergency Alerts, weather apps, or instructions from emergency managers.

## Current sources

- National Weather Service CAP/API active alerts, queried by Nevada county zone or statewide area and refreshed at most once per minute.
- OpenFEMA Disaster Declarations Summaries, filtered to recent Nevada declarations and refreshed every 20 minutes.
- Assistance links point to the American Red Cross shelter finder, 211, Nevada 511, and Nevada emergency management.

No simulated alert appears when official feeds are empty or unavailable. Fetch failures degrade to no panel rather than blocking a community page.

## Coverage

The first release maps every Nevada county and each currently seeded Nevada city or community to its county alert zone. Statewide Nevada pages use the statewide NWS feed. The national overlay does not claim complete emergency coverage.

Local declarations, evacuation orders, cooling centers, sandbag sites, and other fast-changing municipal resources remain source-by-source work. They should be added only through an official, freshness-aware feed with clear coverage labeling.

## Trust rules

- Preserve official instructions and link to the originating record.
- Show effective and expiration times when the source provides them.
- Never infer shelter capacity or availability.
- Keep emergency information above ordinary civic engagement while a notice is active.
- Tell residents to confirm resources before traveling and call 911 for immediate danger.
- Do not use AI-generated language as an evacuation order or safety instruction.

Browser push is not included in this release. Adding it requires explicit opt-in, service-worker delivery, durable subscriptions, alert update/cancellation handling, and emergency-specific notification preferences.
