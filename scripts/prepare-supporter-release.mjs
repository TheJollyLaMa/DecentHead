import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSupporterMetadata } from './supporter-metadata.mjs';
const { TAG: tag, GITHUB_REPOSITORY: repo, PINATA_JWT: jwt, SUPPORTER_IMAGE: image } = process.env;
if (!tag || tag.startsWith('-') || !/^[\w./-]+$/.test(tag)) throw new Error('A valid release tag is required');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const commit = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]);
run('git', ['archive', '--format=tar.gz', '--output=supporter-source.tar.gz', commit]);
async function pin(file, name, type) {
  if (!jwt) return null;
  const body = new FormData();
  body.append('file', new Blob([file], { type }), name);
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body, signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Pinata upload failed (HTTP ${response.status})`);
  const result = await response.json();
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/.test(result.IpfsHash || '')) throw new Error('Invalid Pinata CID');
  return result.IpfsHash;
}
if (!jwt) console.log('::notice::PINATA_JWT absent: skipping IPFS pins. Steward must pin before minting.');
const codeArchiveCid = await pin(readFileSync('supporter-source.tar.gz'), 'supporter-source.tar.gz', 'application/gzip');
// Convention: each release commits its Supporter artwork at img/supporter-dnft.png (see scripts/render-supporter-image.mjs).
const IMAGE_PATH = 'img/supporter-dnft.png';
let imageCid = null, imageURI = image;
if (!imageURI) {
  let artwork = null;
  try { artwork = execFileSync('git', ['show', `${commit}:${IMAGE_PATH}`]); } catch { /* no release artwork committed */ }
  if (artwork) {
    imageCid = await pin(artwork, `supporter-dnft-${tag}.png`, 'image/png');
    imageURI = imageCid ? `ipfs://${imageCid}` : `https://raw.githubusercontent.com/${repo}/${commit}/${IMAGE_PATH}`;
  }
}
const metadata = buildSupporterMetadata({ repo, version: tag, commit, codeArchiveCid, image: imageURI });
writeFileSync('supporter-metadata.json', JSON.stringify(metadata, null, 2) + '\n');
const metadataCid = await pin(readFileSync('supporter-metadata.json'), 'supporter-metadata.json', 'application/json');
const release = JSON.parse(run('gh', ['release', 'view', tag, '--repo', repo, '--json', 'body']));
const start = '<!-- supporter-dnft:start -->', end = '<!-- supporter-dnft:end -->';
const section = `${start}\n### Supporter DNFT preparation\n- Code archive CID: ${codeArchiveCid || 'not pinned (PINATA_JWT absent)'}\n- Image: ${metadata.image}\n- Metadata CID: ${metadataCid || 'not pinned (PINATA_JWT absent)'}\n- Source commit: ${commit}\n- Steward wallet signs all minting and escrow transactions.\n${end}`;
const body = (release.body || '').replace(/<!-- supporter-dnft:start -->[\s\S]*?<!-- supporter-dnft:end -->/g, '').trim();
writeFileSync('supporter-release-notes.md', `${body}\n\n${section}\n`);
run('gh', ['release', 'edit', tag, '--repo', repo, '--notes-file', 'supporter-release-notes.md']);
const title = `Mint Supporter DNFT for ${tag}`;
const issueBody = `## Steward wallet checklist (no private keys in CI)\n\n` +
  `- Repository: ${repo}\n- Version: ${tag}\n- Commit: ${commit}\n` +
  `- Code archive CID: ${codeArchiveCid || 'PIN REQUIRED'}\n- Image: ${metadata.image}${imageCid || image ? '' : ' (not pinned)'}\n- Metadata CID: ${metadataCid || 'PIN REQUIRED'}\n` +
  `- License: Apache-2.0 + NOTICE\n- Chain: Base (8453)\n- Supply: 1000\n- Price: 10 USDC\n- Royalty: 1000 bps (10%)\n\n` +
  `1. Verify both pins, archive contents, image, and metadata before signing. If pins were skipped, pin and update this issue.\n` +
  `2. DecentNFT.registerToken: metadata URI = ${metadataCid ? `ipfs://${metadataCid}` : 'REQUIRED'}, maxSupply = 1000, royaltyBps = 1000; set your royalty recipient and record the returned tokenId. Confirm the deployed ABI.\n` +
  `3. mintProduct: use that tokenId, quantity 1000, steward treasury recipient; confirm actual ABI and mint authority.\n` +
  `4. DecentEscrow: approve/deposit the supporter tokens, create an active token listing for the registered contract/tokenId, quantity 1000, Base USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, priceAmount 10000000 (6 decimals), priceETH 0.\n` +
  `5. Record NFT/escrow addresses, tokenId, listingId, royalty recipient, and transaction hashes. Configure supporterDnft and verify one purchase.\n\n` +
  `No transactions have been submitted by this workflow. Steward verifies addresses/ABIs and signs in their wallet.\n`;
writeFileSync('supporter-mint-issue.md', issueBody);
const issues = JSON.parse(run('gh', ['issue', 'list', '--repo', repo, '--state', 'all', '--search', `${title} in:title`, '--limit', '100', '--json', 'number,title']));
const existing = issues.find(issue => issue.title === title);
if (existing) run('gh', ['issue', 'edit', String(existing.number), '--repo', repo, '--body-file', 'supporter-mint-issue.md']);
else run('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body-file', 'supporter-mint-issue.md']);
