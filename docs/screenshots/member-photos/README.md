# Member photos: browser pass

A person's photo shows wherever Collaboration draws that person, for staff and for outside participants, and a person without one keeps their initials. Each screen is asserted before its capture, in light and dark.

```
node --env-file=.env.base docs/screenshots/member-photos/take-screenshots.mjs [--who participant|staff|all] [--theme light|dark|both] [--only <name>,<name>]
node --env-file=.env.base docs/screenshots/member-photos/take-screenshots.mjs --save-staff-session
```

It needs MJAPI and Explorer running on the sample world (`MJAPI_URL`, `EXPLORER_URL`; defaults 4119 and 4218), `MJ_API_KEY` for the seed, and `SCREENSHOT_STAFF_EMAIL` set to the signed-in staff person, who holds a seat on Northwind. The staff session is the one PR 10's runner saves (`docs/screenshots/pr10/staff-session.json`, git-ignored). Without it the staff screens are skipped and the run says so.

## Where a photo comes from

Two sources, read side by side:

1. **The person's own user**, `MJ: Users.UserImageURL`. It comes first, because MJ's chat draws that one and a person should look the same in both.
2. **The People record linked to that user**, `MJ_BizApps_Common: People.PhotoURL`. It fills in where the user has no photo, or where the reader may not read that user.

The second source is what an outside participant sees of other people. A Space Participant reads only their own row of `MJ: Users` (the `Collaboration: Own User` row filter), and reads the People records of everyone they share a space with (`Collaboration: People In Reach`). Field security on People now lets them read `PhotoURL` beside the name and email. So a member whose photo is only on their user, with none on a linked People record, is still drawn as initials to a participant.

## The seed

Made once, over GraphQL as the harness user, and found again on later runs. Each photo is a generated PNG held as a data URI, in its own color, so a screen can tell by the bytes which source it drew.

| Person | On their user | On their People record | Staff see | A participant sees |
| --- | --- | --- | --- | --- |
| Ada | a photo | a different photo | the user's | the People one |
| Casey | none | a photo | the People one | the People one |
| Bea | a photo | none | the user's | her own (the user's) |
| Sam | none | none | initials | initials |

Also one thread reply from Ada under Bea's message in `discovery-general`, saved as Ada.

## The screens

Each screen reads what every avatar drew (the photo's bytes and whether the browser decoded it, or the initials) and compares it with the table above.

| Screen | Who | What it proves |
| --- | --- | --- |
| `01-people-participant` | Bea, by magic link | People list on Discovery: her own photo from her user, Ada's and Casey's from their People records, Sam as initials, her own email still read |
| `02-overview-participant` | Bea | Overview on Discovery: the Discussion card and both header stacks draw the same photos |
| `11-people-staff` | staff | People list on Northwind: Ada's user photo (not her People one), Casey's People photo, the signed-in person's own, Sam as initials |
| `12-overview-staff` | staff | Overview on Northwind: the Discussion card and both header stacks draw the same photos |
| `13-thread-reply-staff` | staff | Chat on Discovery: the thread bar and the thread draw Ada's photo. **Acts:** posts a thread reply once, reloads, and finds it kept and drawn as the signed-in person's own photo |
| `14-chat-people-menu-staff` | staff | Chat on Discovery: the people menu draws Ada's, Bea's and Casey's photos and Sam's initials. **Acts:** opens the menu |

## Not the app's

- **A participant's chat draws no messages on MJ next (6.2.0-edge.8).** MJ's conversation engine filters ratings and artifacts with `IN (SELECT ID FROM [__mj].[vwConversationDetails] WHERE …)`, and MJ's client-clause screen refuses that for a user whose read of `MJ: Conversation Details` is row-filtered (`Invalid ExtraFilter: entity 'MJ: Conversation Details' is row-level-security filtered for you`). The whole message load fails. Staff are not affected. This is why the chat screens run as staff only.
- Console errors on participant screens: `PermissionConstrainedError … MJ: AI Agents`, and reads of `MJ: Themes` and `MJ: Identity Claims` a participant has no grant for. They come from MJ's shell.
