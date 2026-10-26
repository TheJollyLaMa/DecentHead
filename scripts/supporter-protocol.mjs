import '../js/vendor/ethers.umd.min.js';
import { supporterQuantity, supporterPrice, supporterPriceLabel } from './supporter-metadata.mjs';
export const ethers = globalThis.ethers;
export const CREATOR = 'thejollylama.eth';
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const APPROVED_NFT = '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B';
export const APPROVED_ESCROW = '0x31b07b83e99A9bdF379bf40225b8A80d3804C89d';
export const nftABI = [
  'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)',
  'event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)',
  'function uri(uint256) view returns (string)',
  'function balanceOf(address,uint256) view returns (uint256)',
];
export const escrowABI = [
  'function listings(uint256) view returns (address nftContract,uint256 tokenId,uint256 priceETH,address priceToken,uint256 priceAmount,uint256 available,bool active,string note)',
  'function paused() view returns (bool)',
];
const equal = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const requireThat = (test, message) => { if (!test) throw new Error(message); };
export function validateManifest(m) {
  requireThat(m?.schema === 1 && /^[\w.-]+\/[\w.-]+$/.test(m.repo || '') && typeof m.version === 'string' && m.version.length > 0, 'Invalid release identity');
  requireThat(Number.isFinite(Date.parse(m.releaseDate)) && new Date(m.releaseDate).toISOString() === m.releaseDate, 'Explicit canonical UTC releaseDate required');
  requireThat(m.creator === CREATOR && ethers.isAddress(m.creatorAddress) && m.creatorAddress !== ethers.ZeroAddress, 'Resolved creator address required');
  requireThat(m.chainId === 8453 && typeof m.priceUSDC === 'string', 'Explicit Base USDC price required');
  supporterPrice(m.priceUSDC);
  requireThat(typeof m.quantity === 'string', 'Explicit supporter quantity required');
  supporterQuantity(m.quantity);
  requireThat(/^ipfs:\/\/[^/\s]+$/.test(m.metadataURI || ''), 'Pinned prepared metadata URI required');
  for (const key of ['front', 'back', 'animation']) requireThat(/^ipfs:\/\/[^/\s]+$/.test(m[key] || ''), `Pinned ${key} required`);
  // Optional (older frozen manifests predate them): the exact-commit site pin and the ENS name it deploys to.
  requireThat(m.siteCid === undefined || /^b[a-z2-7]{20,}$/.test(m.siteCid), 'siteCid must be a CIDv1 folder');
  requireThat(m.ensName === undefined || (m.siteCid && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+eth$/.test(m.ensName)), 'ensName must be a .eth name with a siteCid');
  return m;
}
export function validateEvidence(e) {
  requireThat(e?.chainId === 8453 && typeof e.rpcUrl === 'string' && new URL(e.rpcUrl).protocol === 'https:', 'Public HTTPS Base RPC required');
  const rpc = new URL(e.rpcUrl);
  requireThat(!rpc.username && !rpc.password && !rpc.search && !rpc.hash, 'RPC must be public and credential-free');
  requireThat(/^0x[a-fA-F0-9]{64}$/.test(e.mintTxHash || ''), 'Mint transaction hash required');
  for (const key of ['nftContract', 'escrow']) requireThat(ethers.isAddress(e[key]) && !equal(e[key], ethers.ZeroAddress), `${key} address required`);
  requireThat(equal(e.nftContract, APPROVED_NFT) && equal(e.escrow, APPROVED_ESCROW), 'Unapproved Base NFT or escrow contract');
  for (const key of ['tokenId', 'listingId']) requireThat(/^(0|[1-9]\d*)$/.test(e[key] || ''), `${key} decimal string required`);
  requireThat(Number.isSafeInteger(e.confirmations) && e.confirmations >= 12, 'At least 12 confirmations required');
  const url = new URL(e.purchaseUrl);
  requireThat(url.protocol === 'https:' && !url.username && !url.password, 'Public HTTPS purchase URL required');
  // A canonical link binds the advertised destination to the verified listing.
  requireThat(url.searchParams.get('chainId') === '8453' && equal(url.searchParams.get('escrow'), e.escrow) && url.searchParams.get('listingId') === e.listingId, 'Purchase URL must identify chainId, escrow and listingId');
  return e;
}
export function verifySnapshot(m, e, s) {
  validateManifest(m); validateEvidence(e);
  const routePrice = new URL(e.purchaseUrl).searchParams.get('priceUSDC') ?? '10000000';
  requireThat(routePrice === m.priceUSDC, 'Purchase URL must identify the frozen USDC price');
  requireThat(Number(s.chainId) === 8453, 'RPC chain mismatch');
  const r = s.receipt;
  requireThat(r && Number(r.status) === 1 && equal(r.hash, e.mintTxHash), 'Missing, malformed or failed mint receipt');
  requireThat(Number.isSafeInteger(r.blockNumber) && r.blockNumber > 0 && Number.isSafeInteger(s.blockNumber) && s.blockNumber - r.blockNumber + 1 >= e.confirmations, 'Insufficient confirmations');
  requireThat(Array.isArray(r.logs), 'Malformed receipt logs');
  const iface = new ethers.Interface(nftABI);
  let quantity = 0n;
  for (const log of r.logs) {
    if (!equal(log.address, e.nftContract)) continue;
    const parsed = iface.parseLog(log);
    if (!parsed || !['TransferSingle', 'TransferBatch'].includes(parsed.name)) continue;
    if (!equal(parsed.args.from, ethers.ZeroAddress) || equal(parsed.args.to, ethers.ZeroAddress)) continue;
    if (parsed.name === 'TransferSingle') {
      if (parsed.args.id === BigInt(e.tokenId)) quantity += parsed.args.value;
    } else {
      const ids = parsed.args[3], values = parsed.args[4];
      requireThat(ids.length === values.length, 'Malformed batch mint');
      ids.forEach((id, i) => { if (id === BigInt(e.tokenId)) quantity += values[i]; });
    }
  }
  requireThat(quantity === BigInt(m.quantity), 'Mint token/quantity mismatch');
  requireThat(s.metadataURI === m.metadataURI, 'On-chain metadata URI differs from prepared release');
  const l = s.listing;
  requireThat(l && equal(l.nftContract, e.nftContract) && BigInt(l.tokenId) === BigInt(e.tokenId), 'Listing token mismatch');
  requireThat(l.active === true && s.paused === false && BigInt(l.available) > 0n && BigInt(l.available) <= quantity, 'Listing inactive, paused or out of stock');
  requireThat(equal(l.priceToken, USDC) && BigInt(l.priceAmount) === BigInt(m.priceUSDC) && BigInt(l.priceETH) === 0n, 'Listing must match the frozen Base USDC price');
  requireThat(BigInt(s.escrowBalance) >= BigInt(l.available), 'Escrow stock insufficient');
  return { ...e, verifiedBlock: s.blockNumber, available: String(l.available) };
}
export function registeredEvidence(manifest, input) {
  validateManifest(manifest);
  if (input?.schema === 1) {
    requireThat(input.repo === manifest.repo && input.version === manifest.version
      && input.metadataURI === manifest.metadataURI, 'Registered evidence release mismatch');
    return validateEvidence(input.mint);
  }
  // Studio exports raw evidence. verifyOnChain still binds its receipt and URI
  // to this release; never rewrite an already published asset just to wrap it.
  return validateEvidence(input);
}
export async function verifyOnChain(m, e) {
  validateManifest(m); validateEvidence(e);
  const provider = new ethers.JsonRpcProvider(e.rpcUrl);
  try {
    const network = await provider.getNetwork();
    requireThat(network.chainId === 8453n, 'RPC chain mismatch');
    const latest = await provider.getBlockNumber();
    // Read confirmed state, not an unconfirmed latest listing.
    const blockTag = latest - e.confirmations + 1;
    requireThat(blockTag > 0, 'Insufficient chain history');
    const nft = new ethers.Contract(e.nftContract, nftABI, provider);
    const escrow = new ethers.Contract(e.escrow, escrowABI, provider);
    const [receipt, metadataURI, listing, paused, escrowBalance] = await Promise.all([
      provider.getTransactionReceipt(e.mintTxHash), nft.uri(e.tokenId, { blockTag }),
      escrow.listings(e.listingId, { blockTag }), escrow.paused({ blockTag }),
      nft.balanceOf(e.escrow, e.tokenId, { blockTag }),
    ]);
    const confirmed = verifySnapshot(m, e, { chainId: network.chainId, blockNumber: latest, receipt, metadataURI, listing, paused, escrowBalance });
    // Also reject a listing already delisted, paused or exhausted in latest state.
    const [currentListing, currentPaused, currentBalance, currentURI] = await Promise.all([
      escrow.listings(e.listingId), escrow.paused(), nft.balanceOf(e.escrow, e.tokenId), nft.uri(e.tokenId),
    ]);
    verifySnapshot(m, e, { chainId: network.chainId, blockNumber: latest, receipt, metadataURI: currentURI, listing: currentListing, paused: currentPaused, escrowBalance: currentBalance });
    return confirmed;
  } finally { provider.destroy(); }
}
export const markerName = () => 'supporter-discord-sent.json';
export const pendingMarkerName = () => 'supporter-discord-pending.json';
export function assertDeliveryNotPending(assets) {
  requireThat(!assets.some(asset => asset.name === pendingMarkerName()), 'Prior Discord delivery is unresolved; reconcile the lobby message and delivery markers before retrying');
}
export function pendingReleases(releases) {
  requireThat(Array.isArray(releases), 'Release inventory required');
  return releases.filter(r => {
    const names = new Set((r.assets || []).map(a => a.name));
    return !r.draft && names.has('supporter-release.json') && names.has('supporter-evidence.json') && !names.has(markerName());
  }).map(r => r.tag_name);
}
export function alreadySent(marker, m) {
  if (marker == null) return false;
  requireThat(marker.repo === m.repo && marker.version === m.version && Number.isFinite(Date.parse(marker.sentAt)) && /^\d+$/.test(marker.messageId || ''), 'Invalid delivery marker; manual reconciliation required');
  return true;
}
export function buildDiscordPayload(m, verified) {
  validateManifest(m);
  requireThat(verified?.verifiedBlock > 0, 'Verification required before payload');
  const clean = value => String(value).replace(/[@`*_~<>]/g, '').slice(0, 160);
  return {
    username: 'Decent DNFT Bot', allowed_mentions: { parse: [] },
    content: `${clean(m.repo)} ${clean(m.version)} Supporter DNFT is minted and listed: ${supporterPriceLabel(m.priceUSDC)} on Base. Support the new version and collect a dated artifact of Decent history; no financial return guaranteed. Royalties are not universal.`,
    embeds: [{
      title: `${clean(m.version)} · Supporter DNFT`, url: verified.purchaseUrl,
      description: `${clean(m.summary || 'A new Decent release: support our ongoing development and keep a dated artifact of the work.')}\n\nCreator: ${CREATOR}\nRelease date: ${m.releaseDate.slice(0, 10)}${m.ensName ? `\nLive on IPFS: https://${clean(m.ensName)}.limo` : ''}\n[Purchase](${verified.purchaseUrl}) · [Release notes](https://github.com/${m.repo}/releases/tag/${encodeURIComponent(m.version)})\nCollect, keep or resell where supported; resale value is not guaranteed.`,
      image: { url: `https://gateway.pinata.cloud/ipfs/${m.front.slice(7)}` },
    }],
  };
}
export async function deliverDiscordRelease({ manifest, verified, assets, webhook, saveAsset, fetcher = fetch }) {
  assertDeliveryNotPending(assets);
  requireThat(/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w.-]+$/.test(webhook || ''), 'DISCORD_SUPPORTER_WEBHOOK required');
  const payload = buildDiscordPayload(manifest, verified);
  const { repo, version } = manifest;
  await saveAsset(pendingMarkerName(), { repo, version, attemptedAt: new Date().toISOString() });
  let response;
  try {
    response = await fetcher(`${webhook}?wait=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
  } catch {
    // Network errors can include the credential-bearing URL.
    throw new Error('Discord delivery unconfirmed after network failure; reconcile before retry');
  }
  requireThat(response.ok, `Discord delivery unconfirmed (HTTP ${response.status}); reconcile before retry`);
  const message = await response.json();
  requireThat(/^\d+$/.test(message.id || ''), 'Discord acknowledgement malformed; reconcile before retry');
  await saveAsset(markerName(), { repo, version, sentAt: new Date().toISOString(), messageId: message.id });
}
