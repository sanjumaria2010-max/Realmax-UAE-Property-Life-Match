---
name: Approximate map pin interactions
description: Household destinations can share sample area centres; preserve independent hit targets and avoid overlay interception.
---

Sample area-centre locations can be geographically co-located or nearly identical. Raising marker z-index alone does not make every place independently selectable.

**Why:** The school and Internet City sample pins overlapped, preventing a normal marker click even though list selection and persistence worked.

**How to apply:** Keep clickable symbols separated in screen pixels at each zoom without changing the saved geographic meaning. Decorative map captions must not intercept pointer input, and mobile action bars must not cover the map's hit targets.
