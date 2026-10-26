import { supporterPrice } from '../scripts/supporter-metadata.mjs';
export const BASE_SUPPORTER = Object.freeze({
  chainId: 8453,
  nft: '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B',
  escrow: '0x31b07b83e99A9bdF379bf40225b8A80d3804C89d',
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
});
export const SUPPORTER_ESCROW_ABI = [
  'function getListing(uint256) view returns (tuple(address nftContract,uint256 tokenId,uint256 priceETH,address priceToken,uint256 priceAmount,uint256 available,bool active,string note))',
  'function getNFTBalance(address,uint256) view returns (uint256)',
  'function paused() view returns (bool)',
];
export function parseSupporterPurchase(search) {
  const params = new URLSearchParams(search);
  if (params.getAll('priceUSDC').length > 1) throw new Error('Only one Supporter price may be selected.');
  if (params.get('chainId') !== String(BASE_SUPPORTER.chainId) ||
      params.get('escrow')?.toLowerCase() !== BASE_SUPPORTER.escrow.toLowerCase() ||
      !/^(0|[1-9]\d*)$/.test(params.get('listingId') || '')) {
    throw new Error('Use a verified Base Supporter listing link with chainId, escrow and listingId.');
  }
  const listingId = params.get('listingId');
  if (BigInt(listingId) >= 2n ** 256n) throw new Error('Listing ID is out of range.');
  return { ...BASE_SUPPORTER, listingId, priceUSDC: supporterPrice(params.get('priceUSDC') ?? undefined) };
}
export function validateSupporterPurchase(listing, stock, paused, expectedPrice = '10000000') {
  supporterPrice(expectedPrice);
  if (paused) throw new Error('Supporter sales are paused.');
  if (!listing.active || listing.available < 1n || stock < 1n) throw new Error('This Supporter listing is not available.');
  if (listing.nftContract.toLowerCase() !== BASE_SUPPORTER.nft.toLowerCase() ||
      listing.priceToken.toLowerCase() !== BASE_SUPPORTER.usdc.toLowerCase() ||
      listing.priceETH !== 0n || listing.priceAmount !== BigInt(expectedPrice)) {
    throw new Error('This listing does not match the approved Supporter price.');
  }
}
