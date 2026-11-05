---
"@mj-biz-apps/collaboration-core-entities-server": patch
---

An agent's quoted search in a space now finds what the same words find unquoted. MJ's LIKE search matched the quote marks as text, so Sage's `"Executive Steering Review"` found nothing. In a space turn, a pair of double quotes wrapping the whole query is dropped before MJ's Scoped Search runs. This is interim until MJ's own fix (MemberJunction/MJ#6408) is in the pinned release. `@memberjunction/core-actions` is now a peer dependency of this package; an MJAPI host already loads it.
