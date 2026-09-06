---
"@medalsocial/sdk": patch
---

`retry: false` is now honoured by `patch` and `delete` as well as `post` (it was silently ignored on those verbs), and `medal.portal.updateMe` is sent exactly once because a `marketing_consent` change records a consent event that a retry would repeat.
