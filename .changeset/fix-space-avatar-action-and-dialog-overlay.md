---
"@mj-biz-apps/collaboration-ng-widgets": patch
---

Fix Space Avatar Studio AI image generation extraction and upgrade New Space / Space Settings avatar customization to a full-dialog responsive overlay:

- Parse MJServer `RunAction` output payloads across indexed `CopyScalarsAndArrays` objects (`{ "0": { Name: "Images", ... } }`), `Params` arrays (both JSON-stringified and object arrays), and `ResultData` strings so AI avatar generation never fails with `"The image generator returned no image data."`.
- Match MJ `Generate Image` input parameters (`Prompt`, `NumberOfImages`, `Size`, `OutputFormat`) and convert WebP data URIs to `256×256` PNG base64 before passing `SourceImage` during iterative refinement.
- Replace the cramped inline avatar accordion in `mjc-new-space-dialog` with a sleek `64×64` clickable avatar tile next to Name and a full-dialog Space Avatar Studio overlay (with `← Back to space details`, live `64×64` preview, status pill, quick refinement chips, `Undo`/`Reset to icon`, `Done` footer, and mobile-responsive layout).
- Open `mjc-space-avatar-studio` inside a full `<mj-dialog>` overlay from `mjc-space-settings`.
