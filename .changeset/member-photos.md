---
"@mj-biz-apps/collaboration-ng-widgets": patch
"@mj-biz-apps/collaboration-ng": patch
---

A member's photo now shows wherever a space draws that person: the People list, the header's avatar stacks, the Overview's Discussion card, and the thread bar, thread and people menu in chat. These drew initials only. The photo is the person's own user photo (`UserImageURL`, the one MJ's chat draws), or else the photo on the People record linked to their user (`PhotoURL`). An outside participant, who reads only their own user, sees other members' photos through People: Space Participant may now read `PhotoURL` on the People records of everyone they share a space with. A member with no photo keeps their initials.
