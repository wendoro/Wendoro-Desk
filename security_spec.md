# WENDORO Firestore Security Specification (Phase 0 Red-Team TDD)

## 1. Data Invariants
1. **Default Deny**: No Firestore path is readable or writable unless explicitly matched and verified.
2. **PII Isolation**: User emails and full names live solely in `/users/{userId}/private/profile` and are accessible only when `request.auth.uid == userId` and `email_verified == true`.
3. **Master Gate Membership**: Access to `/workspaces/{companyId}/presence/*` requires an active membership document at `/workspaces/{companyId}/members/{request.auth.uid}` or workspace ownership.
4. **Immutable Ownership & Temporal Integrity**: `uid`, `ownerUid`, `companyId`, and `createdAt` cannot be modified after creation; `createdAt` and `updatedAt` must match `request.time`.
5. **No Blanket List Reads**: Every `list` query must constrain `resource.data` against `request.auth.uid`.

## 2. "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Create `/users/u1/private/profile` with `request.auth == null`.
2. **Unverified Email Spoof**: Write `/users/u1/private/profile` with `request.auth.token.email_verified == false`.
3. **Cross-User PII Read**: Authenticated `u2` reads `/users/u1/private/profile`.
4. **Shadow Field Injection**: Create `/users/u1/private/profile` including extra field `isAdmin: true`.
5. **Identity Spoofing**: User `u2` creates `/workspaces/c1/presence/u2` with `uid: "u1"`.
6. **ID Poisoning (Oversized ID)**: Create `/workspaces/<1500-char-junk>/presence/u1`.
7. **Self-Assigned Workspace Role Escalation**: Non-owner `u2` creates `/workspaces/c1/members/u2` with `role: "owner"`.
8. **Orphaned Presence Write**: Non-member `u3` writes `/workspaces/c1/presence/u3` without a parent `/workspaces/c1/members/u3` doc.
9. **Timestamp Forgery**: Create `/workspaces/c1/notifications/n1` with backdated `createdAt` != `request.time`.
10. **Immutable Field Mutation**: Update `/workspaces/c1/notifications/n1` changing `recipientUid` or `createdAt`.
11. **Oversized String DoS**: Update `/workspaces/c1/presence/u1` with 500KB `displayName`.
12. **Blanket List Scraping**: User `u2` runs `list` on `/workspaces/c1/notifications` without `recipientUid == request.auth.uid`.
13. **License Privilege Escalation**: Non-admin `u1` creates `/licenses/WND-ENTR-...` with `maxDevices: 99999` or updates `planTier`/`maxDevices`/`status` after creation.
14. **Orphaned / Cross-Owner Device Activation**: User `u2` writes `/licenses/WND-PROF-.../devices/dev-1` when the parent license `ownerUid` is `u1`.
15. **Revoked License Mutation**: User `u1` attempts to reactivate a `/licenses/WND-...` document after `status` reached terminal `'revoked'` or `'expired'`.

