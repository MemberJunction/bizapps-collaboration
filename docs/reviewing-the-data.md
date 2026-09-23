# Reviewing the data

The sample world is `COLLAB-WORLD`. The catalog is the CSV under `packages/IntegrationTests/src/world/data/`. People and spaces have fixed ids. A reload finds the same rows. A purge deletes only rows with those ids, matched by email for the people.

`ClosedAt` values `recent` and `past` are offsets from the moment of load: 7 days ago and 400 days ago. They are not calendar dates.

`MjRole` is the MemberJunction role. `staff` gets UI. Everyone else gets only Space Participant. Harbor owns a root, so Harbor is staff.

## People

| Key | Who | Where they belong |
| --- | --- | --- |
| ada | Staff owner | Owns Northwind, Delivery, the committee, the cohort, the closed spaces, and Studio |
| sam | Staff member | Northwind, Delivery, and Studio |
| casey | Client admin | Seated on Northwind, so Discovery is inherited. Not seated on sealed Delivery |
| bea | Client member | Discovery, and the closed sub-spaces. Cannot invite |
| dana | Outside director | The audit committee only |
| lee, rio | Learners | The spring cohort |
| nora | Staff with no space | Nowhere |
| harbor | Sibling owner | Harbor only |
| harper | Harbor client | Harbor only |
| pat | Invited guest | Committee, status Invited. Approve has a row |
| remy | Removed guest | Discovery, status Removed. Grants nothing |

## Spaces

Northwind is the relationship root. Only staff and one client admin sit on it. Discovery inherits that roster. Delivery is sealed, so it does not: Ada is seated there as owner, then Sam. An owner has to take that seat before anyone else, and the loader must do it in that order.

Delivery's agent scope is `ExcludedFromParentScope`. `Closed last year` is `ExcludedEntirely`. The other spaces are `Included`.

`Closed this month` uses retention `Month` and a close date 7 days ago, so a former client is still inside the window. `Closed last year` uses `Month` and a close date 400 days ago, so the window has passed. `Closed indefinite` leaves `Retention` empty, so the workspace type default `Indefinite` applies.

Studio uses the world-owned Workshop type: `AutoApprove` and a member cap of 2. Ada and Sam fill it.

The extra role `team-reader` is level 10 and can see Team. Casey, a client admin, can invite up to level 10 but cannot see Team, so granting `team-reader` is the flag the ceiling check refuses.

## What the loader still has to do

Load through the gates, as each owner, owners seated before anyone else. `recent` and `past` become offsets at load time. Files, conversations, share notices, item uses, the project plan, and committee governance rows join this catalog when those stores are seeded. Rows that cannot pass a gate are listed in the loader, and only those use the system user.
