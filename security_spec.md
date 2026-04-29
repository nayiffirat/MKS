# Firestore Security Specification

## Data Invariants
1. **User Ownership**: All data under `/MKS/{orgId}/users/{userId}/...` must be owned by `{userId}`.
2. **Admin Access**: The user `nayiffirat@gmail.com` with `email_verified == true` is the Root Admin and has global access.
3. **Role Lock**: Regular users cannot change their `role` or `subscriptionStatus` fields.
4. **ID Integrity**: All document IDs must match `^[a-zA-Z0-9_\\-]+$` and be <= 128 characters.
5. **Collection Specifics**:
   - `farmers`: Must have `fullName` and `phoneNumber`.
   - `prescriptions`: Must have `farmerId` and a valid list of `items`.
   - `inventory`: Must have `pesticideId` and `quantity` >= 0.

## The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing**: Attempt to create a farmer document under User A's path while signed in as User B.
2. **Privilege Escalation**: Attempt to update own `UserProfile` to set `role: 'admin'`.
3. **Ghost Field Injection**: Attempt to create a document with an un-whitelisted sensitive field (e.g., `isVerified: true`).
4. **ID Poisoning**: Attempt to create a document with a 2KB binary string as an ID.
5. **Type Confusion**: Attempt to set `totalDebt` in a `Farmer` doc to a boolean instead of a number.
6. **Negative Inventory**: Attempt to set `quantity` to `-100` in `InventoryItem`.
7. **Cross-Tenant Leak**: Attempt to list farmers of a different `userId`.
8. **Unverified Admin**: Attempt to access as `nayiffirat@gmail.com` but with `email_verified: false`.
9. **Large Payload Attack**: Attempt to write a string field exceeding 1MB (e.g., `fullName`).
10. **Immutable Field Change**: Attempt to change `id` or `farmerId` inside an existing prescription.
11. **Orphaned Prescription**: Attempt to create a prescription for a `farmerId` that doesn't exist.
12. **Status Shortcut**: Attempt to change a status directly to 'COMPLETED' without meeting preconditions (if implemented).

## Red Team Audit Report (Targeted)
| Vulnerability | Status | Defense |
| :--- | :--- | :--- |
| Identity Spoofing | SECURED | `isOwner(userId)` check on every user path. |
| Privilege Escalation | SECURED | `affectedKeys().hasOnly()` gates on updates for profiles. |
| ID Poisoning | SECURED | `isValidId()` regex + size check. |
| Denial of Wallet | SECURED | Mandatory `.size()` checks on strings and lists. |
| Query Scraping | SECURED | `list` rules enforce `resource.data` ownership. |
