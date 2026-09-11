---
"@medalsocial/sdk": minor
---

Correct the status enums the API never accepted, type deal dates as the Unix milliseconds the API returns, add the three missing webhook events, expose every list filter the API accepts, close the remaining string-typed enums, support Node 20+, and derive the version metadata from `package.json`.

**Corrections — the previous values could never succeed against the API (a `400 VALIDATION_ERROR` in every case), so these are fixes rather than breaks, even where TypeScript now rejects code that used to compile:**

- `DealStatus` is `draft | negotiating | offer_sent | signed | completed | declined`. Six of the eight values the SDK, the OpenAPI document and the basic example advertised (`open`, `won`, `lost`, `proposal_sent`, `on_hold`, `churned`) were refused by `deals.update`, and `deals.list({ status: 'won' })` silently returned an empty page.
- `ContactStatus` is `lead | subscriber | customer | churned`. `prospect` and `archived` were refused by create, update, import and the list filter; `subscriber` could not be typed at all. The Pilot `createContact` tool schema moves to the same set.
- `PortalLoginStartInput.locale` is `PortalLocale` (`no | en`). The README and JSDoc told integrators to send `nb`, which the API refuses.
- `Deal.start_date` / `Deal.end_date` are `number | null` — Unix milliseconds — which is what the wire has always carried. They are still *sent* as ISO 8601 / `YYYY-MM-DD` strings on create and update.
- `CreateWebhookInput.event_types` / `UpdateWebhookInput.event_types` are `SubscribableWebhookEventType[]` and the `channels` filters are `HelpdeskChannel[]`; the API rejects any other string, so a typo is now a compile error instead of a runtime `400`.

**Additive:**

- `WebhookEvent` gains `MessageDeletedEvent` (`helpdesk.message_deleted`), `ConversationContactLinkedEvent` and `ConversationContactUnlinkedEvent` — the three server events the union was missing — plus `WebhookEventType` (`WebhookEvent['type']`) and `SubscribableWebhookEventType` for exhaustiveness checks. `WebhookConversationSnapshot` carries the `contactLinkSource`, `contactLinkedAt`, `chatType` and `chatTitle` fields the server includes.
- List filters the API already accepted: `deals.list` takes `close_date_from` / `close_date_to` / `min_value` / `company_name` / `contact_id` / `stage`; `contacts.list` takes `email` (exact match); `posts.list` takes `scheduled_from` / `scheduled_to` / `published_from` / `published_to` / `platforms` / `query`; `bookings.list` takes `created_via`; `helpdesk.conversations.list` takes `chat_type` and `assigned` (including `assigned: false`, the triage question `assignee_user_id` cannot ask). `TimestampInput` (`number | string`) is the shared type for the date filters.
- Closed unions where the API has closed enums: `PostStatus`, `PostVariantStatus`, `EmailSendStatus`, `HelpdeskChannel`, `HelpdeskChatType`, `ContactLinkSource`; `ContactAddress` replaces `Record<string, string>` (the keys are camelCase, `postalCode` included, and the API rejects any other key); `ImportContactInput.status` is `ContactStatus`. `Conversation` carries the `contact_link_source`, `contact_linked_at`, `chat_type` and `chat_title` fields the API returns.
- `engines.node` is `>=20`. Nothing in the client needs a newer runtime (only `fetch`, `AbortController`, `WritableStream` and Web Crypto), and CI now runs the unit suite on Node 20, 22 and 24.
- The `User-Agent` header reports the real package version (it was pinned to `1.0.0` since 1.0.0) and links to this repository; `src/version.ts`, `jsr.json` and the OpenAPI document's `info.version` (stuck at `1.1.7`) are now written from `package.json` by `scripts/sync-version.mjs` during `pnpm run version`, and a test fails on drift.
