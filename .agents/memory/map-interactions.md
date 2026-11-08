---
name: Approximate map pin interactions
description: Household destinations can share sample area centres; preserve independent hit targets and avoid overlay interception.
---

Sample area-centre locations can be geographically co-located or nearly identical. Raising marker z-index alone does not make every place independently selectable.

**Why:** The school and Internet City sample pins overlapped, preventing a normal marker click even though list selection and persistence worked.

**How to apply:** Keep clickable symbols separated in screen pixels at each zoom without changing the saved geographic meaning. Decorative map captions must not intercept pointer input, and mobile action bars must not cover the map's hit targets.

An HTTP 200 response from a public tile URL does not prove the tile contains a usable map.

**Why:** A previously public basemap returned successful PNG responses containing an “API KEY REQUIRED” watermark rather than streets.

**How to apply:** Visually inspect a returned tile or the rendered map when selecting providers. Never treat status code and image content type alone as proof of a working basemap.
