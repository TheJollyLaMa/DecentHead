import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSupporterMetadata } from './supporter-metadata.mjs';
import { validateManifest } from './supporter-protocol.mjs';
import { ENS_NAME, pinSite } from './supporter-site.mjs';
const { TAG: tag, GITHUB_REPOSITORY: repo, PINATA_JWT: jwt } = process.env;
if (!tag || tag.startsWith('-') || !/^[\w./-]+$/.test(tag)) throw new Error('A valid release tag is required');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !jwt) throw new Error('Repository and PINATA_JWT required; preparation must be fully pinned');
const existingRelease = JSON.parse(run('gh', ['release', 'view', tag, '--repo', repo, '--json', 'body,assets,isDraft']));
if (existingRelease.isDraft) throw new Error('Published release required');
if (existingRelease.assets.some(asset => asset.name === 'supporter-release.json')) throw new Error('Release already frozen; do not replace its preparation. Use a new version.');
const commit = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]);
if (run('git', ['rev-parse', 'HEAD']) !== commit) throw new Error('Render and prepare from the exact release tag checkout');
const artwork = JSON.parse(readFileSync('supporter-artwork.json', 'utf8'));
if (artwork.version !== tag || artwork.releaseDate !== process.env.RELEASE_DATE) throw new Error('Artwork release identity mismatch');
run('git', ['archive', '--format=tar.gz', '--output=supporter-source.tar.gz', commit]);
async function pin(file, name, type) {
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
const codeArchiveCid = await pin(readFileSync('supporter-source.tar.gz'), 'supporter-source.tar.gz', 'application/gzip');
const front = `ipfs://${await pin(readFileSync('supporter-front.png'), 'supporter-front.png', 'image/png')}`;
const back = `ipfs://${await pin(readFileSync('supporter-back.png'), 'supporter-back.png', 'image/png')}`;
const animation = `ipfs://${await pin(readFileSync('supporter-presentation.html'), 'supporter-presentation.html', 'text/html')}`;
const ensName = String(process.env.SUPPORTER_ENS_NAME || '').trim().toLowerCase();
if (ensName && !ENS_NAME.test(ensName)) throw new Error('SUPPORTER_ENS_NAME must be a .eth name');
// The runnable site at this exact commit; ENS is pointed at it after the mint is verified.
const site = await pinSite({ repo, commit, jwt });
console.log(`Pinned ${site.fileCount} site files (${site.bytes} bytes) as ${site.cid}`);
const summary = String(existingRelease.body || '').replace(/<!--[\s\S]*?-->/g, '').replace(/[#*`>\r\n]+/g, ' ').trim().slice(0, 280);
const manifest = { schema: 1, repo, version: tag, commit, ...artwork, chainId: 8453, quantity: '1000', codeArchiveCid, siteCid: site.cid, ...(ensName ? { ensName } : {}), front, back, animation, summary };
const metadata = buildSupporterMetadata({ repo, version: tag, commit, codeArchiveCid, image: front, release: manifest });
writeFileSync('supporter-metadata.json', JSON.stringify(metadata, null, 2) + '\n');
const metadataCid = await pin(readFileSync('supporter-metadata.json'), 'supporter-metadata.json', 'application/json');
manifest.metadataURI = `ipfs://${metadataCid}`;
validateManifest(manifest);
writeFileSync('supporter-release.json', JSON.stringify(manifest, null, 2) + '\n');
// Metadata points to already pinned assets; only this later manifest points to metadata.
run('gh', ['release', 'upload', tag, 'supporter-source.tar.gz', 'supporter-front.png', 'supporter-back.png', 'supporter-presentation.html', 'supporter-metadata.json', 'supporter-release.json', '--repo', repo]);
const release = existingRelease;
const start = '<!-- supporter-dnft:start -->', end = '<!-- supporter-dnft:end -->';
const section = `${start}\n### Supporter DNFT preparation\n- Code archive CID: ${codeArchiveCid || 'not pinned (PINATA_JWT absent)'}\n- Site CID (exact commit): ipfs://${site.cid}${ensName ? ` → ${ensName} after mint` : ''}\n- Image: ${metadata.image}\n- Metadata CID: ${metadataCid || 'not pinned (PINATA_JWT absent)'}\n- Source commit: ${commit}\n- Steward wallet signs all minting and escrow transactions.\n${end}`;
const body = (release.body || '').replace(/<!-- supporter-dnft:start -->[\s\S]*?<!-- supporter-dnft:end -->/g, '').trim();
writeFileSync('supporter-release-notes.md', `${body}\n\n${section}\n`);
run('gh', ['release', 'edit', tag, '--repo', repo, '--notes-file', 'supporter-release-notes.md']);
const title = `Mint Supporter DNFT for ${tag}`;
const issueBody = `## Steward wallet checklist (no private keys in CI)\n\n` +
  `- Repository: ${repo}\n- Version: ${tag}\n- Commit: ${commit}\n` +
  `- Release date (not minted date): ${manifest.releaseDate}\n- Creator: ${manifest.creator} (${manifest.creatorAddress})\n` +
  `- Code archive CID: ${codeArchiveCid}\n- Site CID: ${site.cid} (${site.fileCount} files; preview https://ipfs.filebase.io/ipfs/${site.cid}/)\n- ENS: ${ensName || 'none (set SUPPORTER_ENS_NAME to deploy via ENS)'}\n- Front: ${metadata.image}\n- Back: ${back}\n- 3D HTML: ${animation}\n- Metadata CID: ${metadataCid}\n` +
  `- License: Apache-2.0 + NOTICE\n- Chain: Base (8453)\n- Supply: 1000\n- Price: 10 USDC\n- Royalty: 1000 bps (10%)\n\n` +
  `1. Verify all pins, archive contents, front/back, frozen manifest and metadata before signing. HTML animation support depends on the viewer (not guaranteed in MetaMask).\n` +
  `2. DecentNFT_v0.2.registerToken(1000, "${manifest.metadataURI}", 0 /* Product */, royaltyReceiver, 1000); set your royalty recipient and record the returned tokenId. Confirm the deployed ABI.\n` +
  `3. mintProduct: use that tokenId, quantity 1000, steward treasury recipient; confirm actual ABI and mint authority.\n` +
  `4. DecentEscrow: approve/deposit the supporter tokens, create an active token listing for the registered contract/tokenId, quantity 1000, Base USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, priceAmount 10000000 (6 decimals), priceETH 0.\n` +
  `5. Record NFT/escrow addresses, tokenId, listingId, royalty recipient, and transaction hashes. Configure supporterDnft and verify the purchase route. Then run supporter-announce.yml with public evidence per docs/SUPPORTER-RELEASES.md; it independently verifies chain state before Discord.\n` +
  (ensName ? `6. Post-mint deployment: after verification the announce workflow opens "Point ${ensName} at ${tag} site" with a one-click signing link. Discord waits until ENS serves ipfs://${site.cid}.\n` : '') + `\n` +
  `No transactions have been submitted by this workflow. Steward verifies addresses/ABIs and signs in their wallet.\n`;
writeFileSync('supporter-mint-issue.md', issueBody);
const issues = JSON.parse(run('gh', ['issue', 'list', '--repo', repo, '--state', 'all', '--search', `${title} in:title`, '--limit', '100', '--json', 'number,title']));
const existing = issues.find(issue => issue.title === title);
if (existing) run('gh', ['issue', 'edit', String(existing.number), '--repo', repo, '--body-file', 'supporter-mint-issue.md']);
else run('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body-file', 'supporter-mint-issue.md']);
