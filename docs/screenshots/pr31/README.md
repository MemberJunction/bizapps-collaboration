# PR 31 browser pass: Space Meetings (`B23 / T5`)

Screens captured and asserted in MJ Explorer (light and dark) against the unified workspace (`MJ_LOCAL_APPS=common,tasks,collab,committees`) on a fresh database (`COLLAB_DEMO_FRESH`):

| Screen | Persona | Shows |
|---|---|---|
| `01-overview-coming-up-shared` | `bea.member@collab-world.example` (`Space Participant` on Discovery) | Discovery space Overview with the `Coming up` agenda card showing the `Standard` meeting (`Discovery Shared Planning Sync`) and hiding both the `Private` meeting (`Internal Executive Budget Session`) and the outsider meeting (`Outsider Secret Meeting`). |
| `02-meetings-tab-shared` | `bea.member@collab-world.example` (`Space Participant` on Discovery) | Discovery space `Meetings` tab (`SpaceMeetingsTabComponent`) showing `Discovery Shared Planning Sync` (`1 meeting`) and hiding both `Internal Executive Budget Session` (`Private` non-attendee) and `Outsider Secret Meeting`. |
| `03-meetings-tab-team-attendee` | `sam.member@collab-world.example` (`UI` role, Team attendee on Discovery) | Discovery space `Meetings` tab showing both `Discovery Shared Planning Sync` and `Internal Executive Budget Session` (`2 meetings`, `Private` badge visible to an explicit attendee), with `Outsider Secret Meeting` absent. |
