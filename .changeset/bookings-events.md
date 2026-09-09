---
"@medalsocial/sdk": minor
---

Add `medal.bookings.events.register(id, input)`: a guardian registering a child for an arrangement. It lands as a `Booking` with `event_id`/`event_order` set, and starts a Vipps payment when the arrangement's service requires one — `payment` carries the same show-once redirect `bookings.payment.start` does, and is `null` when nothing is owed. A payment failure does not undo the registration: the booking is still created and `payment_error` says what to retry, so poll or retry the payment on the returned booking rather than registering again. `consent_accepted: true` is required, mirroring `StartBookingPaymentInput.terms_accepted`.

Also adds an optional `host_id` filter to `medal.bookings.events.list(...)`.

Requires a Medal Social API deployment that supports arrangement registrations; older API deployments 404 on the new endpoint.
