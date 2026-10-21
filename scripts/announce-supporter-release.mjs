import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { alreadySent, assertDeliveryNotPending, deliverDiscordRelease, markerName, pendingReleases, validateEvidence, validateManifest, verifyOnChain } from './supporter-protocol.mjs';

const { TAG: tag, GITHUB_REPOSITORY: repo, DISCORD_SUPPORTER_WEBHOOK: webhook } = process.env;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Repository required');
const gh = args => execFileSync('gh', args, { encoding: 'utf8' }).trim();
async function announce(tag) {
if (!tag || tag.startsWith('-') || !/^[\w./-]+$/.test(tag)) throw new Error('Valid release tag required');
const release = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'assets,isDraft']));
if (release.isDraft) throw new Error('Published release required');
if (!release.assets.some(a => a.name === 'supporter-release.json')) {
  console.log('Release is not prepared; awaiting supporter-release.json.');
  return;
}
const download = name => {
  gh(['release', 'download', tag, '--repo', repo, '--pattern', name, '--clobber']);
  return JSON.parse(readFileSync(name, 'utf8'));
};
const manifest = download('supporter-release.json');
validateManifest(manifest);
if (manifest.repo !== repo || manifest.version !== tag) throw new Error('Release identity mismatch');
const marker = release.assets.some(a => a.name === markerName()) ? download(markerName()) : null;
if (alreadySent(marker, manifest)) {
  console.log('Release already announced; no Discord request made.');
} else {
  assertDeliveryNotPending(release.assets);
  if (!webhook || !/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w.-]+$/.test(webhook)) throw new Error('DISCORD_SUPPORTER_WEBHOOK required');
  if (!release.assets.some(a => a.name === 'supporter-evidence.json')) throw new Error('Register supporter-evidence.json once after signing; no evidence is inferred');
  const envelope = download('supporter-evidence.json');
  if (envelope.repo !== repo || envelope.version !== tag || envelope.metadataURI !== manifest.metadataURI) throw new Error('Registered evidence release mismatch');
  const evidence = validateEvidence(envelope.mint);
  const verified = await verifyOnChain(manifest, evidence);
  const purchase = await fetch(evidence.purchaseUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!purchase.ok) throw new Error('Purchase URL is not reachable');
  const publicManifest = { ...manifest, mint: evidence, verification: verified };
  writeFileSync('supporter-minted.json', JSON.stringify(publicManifest, null, 2) + '\n');
  gh(['release', 'upload', tag, 'supporter-minted.json', '--repo', repo, '--clobber']);
  await deliverDiscordRelease({
    manifest, verified, webhook, assets: release.assets,
    saveAsset(name, value) {
      writeFileSync(name, JSON.stringify(value, null, 2) + '\n');
      gh(['release', 'upload', tag, name, '--repo', repo]);
    },
  });
  console.log('Verified release announced; durable delivery marker saved.');
}
}
if (process.env.SCAN_RELEASES === 'true') {
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`]));
  const tags = pendingReleases(pages.flat());
  console.log(`Found ${tags.length} prepared releases with registered evidence awaiting delivery.`);
  let failed = false;
  for (const pending of tags) {
    try { await announce(pending); }
    catch (error) {
      failed = true;
      // Avoid logging RPC URLs, purchase URLs or webhook credentials from nested errors.
      const reason = String(error.message).split('\n')[0].replace(/https?:\/\/\S+/g, '[URL redacted]');
      console.error(`Verification/delivery failed for ${JSON.stringify(pending)}: ${reason}`);
    }
  }
  if (failed) process.exitCode = 1;
} else {
  await announce(tag);
}
