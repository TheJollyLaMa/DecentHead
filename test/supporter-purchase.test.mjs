import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_SUPPORTER, parseSupporterPurchase, validateSupporterPurchase } from '../js/supporter-purchase.js';

test('purchase route binds query parameters to approved Base deployment without truncating IDs', () => {
  const query = `?chainId=8453&escrow=${BASE_SUPPORTER.escrow}&listingId=9007199254740993`;
  assert.equal(parseSupporterPurchase(query).listingId, '9007199254740993');
  for (const bad of ['', query.replace('8453', '10'), query.replace(BASE_SUPPORTER.escrow, BASE_SUPPORTER.nft), query.replace('9007199254740993', '-1'), query.replace('9007199254740993', '1e3')]) {
    assert.throws(() => parseSupporterPurchase(bad));
  }
});

test('purchase route rejects unavailable or incorrectly priced listings', () => {
  const listing = { nftContract: BASE_SUPPORTER.nft, priceToken: BASE_SUPPORTER.usdc, priceETH: 0n, priceAmount: 10000000n, available: 1n, active: true };
  assert.doesNotThrow(() => validateSupporterPurchase(listing, 1n, false));
  for (const change of [{ active: false }, { available: 0n }, { nftContract: BASE_SUPPORTER.escrow }, { priceToken: BASE_SUPPORTER.nft }, { priceAmount: 1n }, { priceETH: 1n }]) {
    assert.throws(() => validateSupporterPurchase({ ...listing, ...change }, 1n, false));
  }
  assert.throws(() => validateSupporterPurchase(listing, 0n, false));
  assert.throws(() => validateSupporterPurchase(listing, 1n, true));
});
