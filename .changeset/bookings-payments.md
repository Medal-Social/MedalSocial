---
"@medalsocial/sdk": minor
---

Add `medal.bookings.payment.{start,get}` and `medal.bookings.manage.payment.{start,get}`: Vipps payments on a booking, as the business or on the customer's behalf. `start` reserves the booking's amount and returns a one-time wallet redirect URL — hand it to the Vipps Widget SDK unchanged, and learn the outcome from `get` or the booking's `payment_status`, never from the browser's return redirect. `terms_accepted: true` is required: the customer must actively accept your terms before a payment is initiated. `get` returns the newest attempt only and throws a 404 `MedalApiError` when the booking has no payment yet.

Also adds `payment_mode` to `Booking` and `ManageSummary` (`"none" | "reserve" | "prepay"`, frozen when the booking was made) and `payment` to `BookingService` (the per-service requirement; `null` means "follow the workspace rule"). Requires the SP8b server change in medal-monorepo; older servers omit these fields.
