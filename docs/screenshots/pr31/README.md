# PR 31 browser pass: Space Meetings (`B23 / T5`)

Screens captured and asserted in MJ Explorer (light and dark) against the unified workspace (`MJ_LOCAL_APPS=common,tasks,collab,committees`) on a fresh database (`COLLAB_DEMO_FRESH`):

| Screen | Persona | Shows |
|---|---|---|
| `01-overview-coming-up-shared` | `bea.member@collab-world.example` (`Space Participant` on Discovery) | Discovery space Overview with the `Coming up` agenda card showing the `Standard` meeting (`Discovery Architecture & Roadmap Review`) and hiding both the `Private` meeting (`Internal Executive Budget Session`) and the outsider meeting (`Q3 Audit Committee Meeting`). |
| `02-meetings-tab-shared` | `bea.member@collab-world.example` (`Space Participant` on Discovery) | Discovery space `Meetings` tab (`SpaceMeetingsTabComponent`) showing `+ Schedule meeting`, `Discovery Architecture & Roadmap Review` (`UPCOMING (1)`), and hiding both `Internal Executive Budget Session` (`Private` non-attendee) and `Q3 Audit Committee Meeting`. |
| `03-meetings-tab-team-attendee` | `sam.member@collab-world.example` (`UI` role, Team attendee on Discovery) | Discovery space `Meetings` tab showing `+ Schedule meeting` and both `Discovery Architecture & Roadmap Review` and `Internal Executive Budget Session` (`UPCOMING (2)`, `Private` badge visible to an explicit attendee), with `Q3 Audit Committee Meeting` absent. |
| `04-schedule-meeting-modal` | `bea.member@collab-world.example` (`Space Participant` on Discovery) | Inline `Schedule meeting in Discovery` dialog (`mj-dialog`) with Title, Date, Start/End time, Location, Band-scoped Visibility (`Standard — All space participants`), and Join link fields. |

## End-to-End Browser Script (`take-screenshots.mjs`)

Run against the running Explorer (`http://localhost:4218`) and MJAPI (`http://localhost:4119` on `COLLAB_DEMO_FRESH`):

```bash
node --env-file=/Users/bcianzygmunt/Projects/collab-workspace/MJ/.env docs/screenshots/pr31/take-screenshots.mjs
```

In addition to capturing light and dark screenshots, `take-screenshots.mjs` verifies:
1. Submitting a new meeting via `Schedule meeting` (`CreateSpaceMeeting` GraphQL mutation) and rendering the new card in `UPCOMING`.
2. Clicking `Start chat` (`EnsureMeetingSpaceChat` GraphQL mutation) and navigating to `?tab=chat&conv=<ConversationID>`.
3. Clicking `Open` on the meeting card and opening the `MJ_BizApps_Tasks: Meetings` entity record in MJ Explorer.
