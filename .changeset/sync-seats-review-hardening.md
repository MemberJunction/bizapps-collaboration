---
"@mj-biz-apps/collaboration-core-entities-server": patch
"@mj-biz-apps/collaboration-example-space-types-server": patch
---

Harden `BaseSpaceTypeServerDriver.SyncSeats` and `ExampleBoardServerDriver.SyncSeats` from #44 review:

- Do not soft-remove an existing synced seat when its incoming roster entry fails to resolve (unknown/ambiguous role, missing user/email, invite failure, or transient People/Users lookup failure).
- Pass `actingUser` unchanged to `mintSpaceLink` rather than synthesizing `Type: 'Owner'` for a type-less, role-less caller.
- Forward `options` (`SyncSeatsOptions`) through `ExampleBoardServerDriver.SyncSeats` to `super.SyncSeats`.
