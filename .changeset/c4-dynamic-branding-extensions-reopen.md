---
'@mj-biz-apps/collaboration-ng-widgets': minor
'@mj-biz-apps/collaboration-ng': minor
---

Replace hardcoded Assistant and Collaboration branding with dynamic agent display names and active application names (`CX-8`), wire declared UI extension points (`NeedsYouProvider`, `BaseSpaceHeaderChipProvider`, `GetHeaderChips`, `GetHeaderActions`, `GetSettingsSections`) with live non-null `Space` records in `SpaceUIContext` (`CX-9`), and align UI Reopen rules with terminal `Closed` vs resumable `Paused` server status behavior (`CX-12`).
