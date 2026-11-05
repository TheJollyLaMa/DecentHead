import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { alreadySent, assertDeliveryNotPending, deliverDiscordRelease, markerName, pendingReleases, registeredEvidence, validateManifest, verifyOnChain } from './supporter-protocol.mjs';
import { DEFAULT_ENS_RPC, ensDeployment, ensIssueBody, ensIssueTitle, readEnsState } from './supporter-site.mjs';
const ENS_DEPLOYED = 'supporter-ens-deployed.json';

const { TAG: tag, GITHUB_REPOSITORY: repo, DISCORD_SUPPORTER_WEBHOOK: webhook } = process.env;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Repository required');
const gh = args => execFileSync('gh', args, { encoding: 'utf8' }).trim();
// Later prepared releases for the same name: if ENS already serves one of them, this release is superseded, not pending.
function newerSiteCids(manifest) {
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`]));
  const cids = [];
  for (const r of pages.flat()) {
    if (r.draft || r.tag_name === manifest.version || !(r.assets || []).some(a => a.name === 'supporter-release.json')) continue;
    try {
      const other = JSON.parse(gh(['release', 'download', r.tag_name, '--repo', repo, '--pattern', 'supporter-release.json', '--output', '-']));
      if (other.ensName === manifest.ensName && other.siteCid && Date.parse(other.releaseDate) > Date.parse(manifest.releaseDate)) cids.push(other.siteCid);
    } catch { /* unreadable older manifests cannot supersede */ }
  }
  return cids;
}
async function ensGate(tag, manifest, assets) {
  if (!manifest.ensName || !manifest.siteCid) return 'unconfigured';
  if (assets.some(a => a.name === ENS_DEPLOYED)) return 'deployed';
  const state = await readEnsState(manifest.ensName, process.env.SUPPORTER_ENS_RPC_URL || DEFAULT_ENS_RPC);
  let result = ensDeployment(manifest, state);
  if (result.status === 'pending' && state.cid) result = ensDeployment(manifest, state, newerSiteCids(manifest));
  const title = ensIssueTitle(manifest);
  const issue = JSON.parse(gh(['issue', 'list', '--repo', repo, '--state', 'all', '--search', `${title} in:title`, '--limit', '20', '--json', 'number,title,state,body']))
    .find(i => i.title === title);
  if (result.status === 'pending') {
    const body = ensIssueBody(manifest, state);
    writeFileSync('supporter-ens-issue.md', body);
    if (!issue) gh(['issue', 'create', '--repo', repo, '--title', title, '--body-file', 'supporter-ens-issue.md']);
    else {
      if (issue.state !== 'OPEN') gh(['issue', 'reopen', String(issue.number), '--repo', repo]);
      if (issue.body.trim() !== body.trim()) gh(['issue', 'edit', String(issue.number), '--repo', repo, '--body-file', 'supporter-ens-issue.md']);
    }
    console.log(`${manifest.version}: ENS ${manifest.ensName} serves ${state.cid || 'nothing'}, not ${manifest.siteCid}; Discord waits for the steward signature.`);
    return 'pending';
  }
  const record = { repo, version: manifest.version, ensName: manifest.ensName, siteCid: manifest.siteCid, status: result.status, ensCid: result.cid, owner: state.owner, resolver: state.resolver, verifiedAt: new Date().toISOString() };
  writeFileSync(ENS_DEPLOYED, JSON.stringify(record, null, 2) + '\n');
  gh(['release', 'upload', tag, ENS_DEPLOYED, '--repo', repo, '--clobber']);
  if (issue?.state === 'OPEN') gh(['issue', 'close', String(issue.number), '--repo', repo, '--comment', result.status === 'deployed' ? `ENS now serves ipfs://${manifest.siteCid}; announcing.` : `ENS already serves a newer release (ipfs://${result.cid}); this version is superseded.`]);
  console.log(`${manifest.version}: ENS ${result.status} (${manifest.ensName} → ${result.cid}).`);
  return result.status;
}
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
  const evidence = registeredEvidence(manifest, envelope);
  const verified = await verifyOnChain(manifest, evidence);
  const purchase = await fetch(evidence.purchaseUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!purchase.ok) throw new Error('Purchase URL is not reachable');
  const publicManifest = { ...manifest, mint: evidence, verification: verified };
  writeFileSync('supporter-minted.json', JSON.stringify(publicManifest, null, 2) + '\n');
  gh(['release', 'upload', tag, 'supporter-minted.json', '--repo', repo, '--clobber']);
  if (await ensGate(tag, manifest, release.assets) === 'pending') return;
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
