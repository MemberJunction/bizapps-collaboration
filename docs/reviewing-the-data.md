# Reviewing the data

The sample world is `COLLAB-WORLD`. It is one tenant, Northwind, plus an unrelated sibling, Harbor, so a leak check has somewhere to fail. The catalog is the CSV under `packages/IntegrationTests/src/world/data/`.

## People

| Key | Who | Where they belong |
| --- | --- | --- |
| ada | Staff owner | Owns Northwind, the committee, and the cohort |
| sam | Staff member | Northwind, and the sealed Delivery space |
| casey | Client admin | Discovery |
| bea | Client member | Discovery, and both closed sub-spaces |
| dana | Outside director | The audit committee only |
| lee | Learner | The spring cohort |
| nora | Staff with no space | Nowhere. A leak check that must see nothing |
| harbor | Sibling owner | Harbor only |

## Spaces

Northwind is the relationship root. Discovery inherits membership from it. Delivery does not: its roster is sealed. The audit committee and the spring cohort are separate roots. Harbor is a second client and must never appear for a Northwind person.

Two children of Northwind are closed. `Closed this month` is still inside a one-month retention window. `Closed last year` is past it. Staff keep access either way. A former client keeps read access only inside the window. The loader that applies those dates, and the files, tasks, and governance rows, land with the features that own them.

## What is not in the CSV yet

Real files in a storage account, conversations, share notices, item uses, the project plan, and committee governance rows are part of this world. They are added as those features are seeded, because a task or a file row needs the store it belongs to.
