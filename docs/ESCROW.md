# DecentEscrow — Listing Naming Convention

## Overview

The `AboutModal` in DecentHead dynamically scans all listings on [DecentEscrow](https://optimistic.etherscan.io/address/0x23A457AD3C33d68E4fAd2FCa7c5d9a511E0C350e) (deployed on Optimism Mainnet) and automatically displays any listing whose `note` field contains the string `"DecentHead"` (case-insensitive).

This means **no code changes are required** to add new editions, test listings, or price tiers — simply create a new escrow listing with a compliant note and it will appear in the modal automatically.

## Naming Convention

All DecentHead escrow listings **MUST** have a note containing `"DecentHead"` for the modal filter to pick them up.

### ✅ Valid Examples

| Note | Appears in Modal? |
|------|-------------------|
| `DecentHead v1.0.0 Supporter DNFT` | ✅ Yes |
| `DecentHead v2.0.0` | ✅ Yes |
| `DecentHead v1.0.0 Test - $1` | ✅ Yes |
| `decenthead early access` | ✅ Yes (case-insensitive match) |

### ❌ Invalid Examples

| Note | Appears in Modal? |
|------|-------------------|
| `Decent Head v1.0.0` | ❌ No — note the space between "Decent" and "Head" |
| `DNFT Supporter` | ❌ No — does not contain "DecentHead" |
| `""` (empty) | ❌ No — empty notes are excluded |

## Filter Logic

A listing is shown in the modal if **all** of the following are true:

1. `listing.active === true`
2. `listing.available > 0` (not sold out)
3. `listing.note.toLowerCase().includes('decenthead')`

## Listing Lifecycle in the Modal

| Scenario | Modal Behaviour |
|----------|-----------------|
| New listing created with valid note | Appears automatically on next modal open |
| Supply decrements after a sale | Available count updates live after purchase |
| Listing sells out (`available === 0`) | Disappears from the modal automatically |
| Listing deactivated (`active === false`) | Disappears from the modal automatically |
| No active DecentHead listings | Modal shows "No editions currently listed — check back soon." |

## Contract Details

| Item | Value |
|------|-------|
| Network | Optimism Mainnet (Chain ID 10) |
| Escrow Address | `0x23A457AD3C33d68E4fAd2FCa7c5d9a511E0C350e` |
| Payment Token (USDC) | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| ABI methods used | `nextListingId()`, `getListing(uint256)`, `purchaseWithToken(uint256, uint256)` |

## Known Listings

| Listing ID | Note | Price |
|------------|------|-------|
| 0 | `DecentHead v1.0.0 Supporter DNFT` | $100 USDC |
| 1 | `DecentHead v1.0.0 Test - $1` | $1 USDC |
