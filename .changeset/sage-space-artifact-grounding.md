---
"@mj-biz-apps/collaboration-core-entities-server": patch
---

Hydrate latest authorized `MJ: Artifact Versions` content into token-bounded `ChunkTexts` (supporting Markdown/text, `SlideDeckSpec` JSON, and base64 PDF text streams without ever emitting raw base64) and inject a token-bounded Authorized Space Context system message when `executeSpaceChatTurn` runs a non-default agent such as platform `Sage` whose prompt template does not reference `{{ allowedItems }}` or `{{ typeInstructions }}`.
