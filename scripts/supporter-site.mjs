import { execFileSync } from 'node:child_process';
import { ethers } from './supporter-protocol.mjs';
import { CID_V1, ENS_NAME, ENS_REGISTRY, NAME_WRAPPER, decodeContenthash, encodeContenthash } from '../js/ens-content.js';
export { CID_V1, ENS_NAME, ENS_REGISTRY, NAME_WRAPPER, decodeContenthash, encodeContenthash };

export const DEFAULT_ENS_RPC = 'https://ethereum-rpc.publicnode.com';
export const SIGNING_PAGE = 'https://thejollylama.github.io/DecentHead/supporter/ens.html';
const requireThat = (test, message) => { if (!test) throw new Error(message); };

// Same rule as DecentCanopy's repo pins: tracked blobs minus dot-paths, rooted in a folder named after the repo,
// so a release pin and a Canopy snapshot of the same commit share one CID.
export function siteFiles(commit, git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 })) {
  requireThat(/^[a-f0-9]{40}$/.test(commit || ''), 'Full commit SHA required');
  return git(['ls-tree', '-r', '-z', commit]).split('\0').filter(Boolean).map(line => {
    const [meta, path] = line.split('\t');
    const [mode, type] = meta.split(' ');
    return { mode, type, path };
  }).filter(f => f.type === 'blob' && (f.mode === '100644' || f.mode === '100755'))
    .map(f => f.path).filter(path => !path.split('/').some(part => part.startsWith('.')));
}

export async function pinSite({ repo, commit, jwt, files = siteFiles(commit), readBlob = path => execFileSync('git', ['cat-file', 'blob', `${commit}:${path}`], { maxBuffer: 256 << 20 }), fetchImpl = fetch }) {
  requireThat(/^[\w.-]+\/[\w.-]+$/.test(repo || '') && jwt, 'Repository and PINATA_JWT required for the site pin');
  requireThat(files.includes('index.html'), `${repo} has no root index.html at ${commit.slice(0, 7)}; it is not a static site`);
  const folder = repo.split('/')[1], form = new FormData();
  let bytes = 0;
  for (const path of files) {
    const blob = readBlob(path);
    bytes += blob.length;
    form.append('file', new Blob([blob]), `${folder}/${path}`);
  }
  form.append('pinataMetadata', JSON.stringify({ name: `${folder} site ${commit.slice(0, 7)}` }));
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
  const response = await fetchImpl('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form, signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  if (!response.ok) throw new Error(`Pinata site upload failed (HTTP ${response.status})`);
  const cid = (await response.json()).IpfsHash;
  requireThat(CID_V1.test(cid || ''), 'Pinata did not return a CIDv1 site folder');
  return { cid, fileCount: files.length, bytes };
}

export function validateEnsRpc(url) {
  const rpc = new URL(url);
  requireThat(rpc.protocol === 'https:' && !rpc.username && !rpc.password && !rpc.search && !rpc.hash, 'ENS RPC must be public, credential-free HTTPS');
  return rpc.href;
}

export async function readEnsState(name, rpcUrl = DEFAULT_ENS_RPC) {
  requireThat(ENS_NAME.test(name || ''), 'Valid .eth name required');
  const provider = new ethers.JsonRpcProvider(validateEnsRpc(rpcUrl), 1, { staticNetwork: true });
  try {
    const node = ethers.namehash(name);
    const registry = new ethers.Contract(ENS_REGISTRY, ['function owner(bytes32) view returns (address)', 'function resolver(bytes32) view returns (address)'], provider);
    const [registryOwner, resolver] = await Promise.all([registry.owner(node), registry.resolver(node)]);
    let owner = registryOwner;
    if (ethers.getAddress(registryOwner) === ethers.getAddress(NAME_WRAPPER)) {
      owner = await new ethers.Contract(NAME_WRAPPER, ['function ownerOf(uint256) view returns (address)'], provider).ownerOf(BigInt(node));
    }
    let contenthash = '0x';
    if (resolver !== ethers.ZeroAddress) {
      contenthash = await new ethers.Contract(resolver, ['function contenthash(bytes32) view returns (bytes)'], provider).contenthash(node);
    }
    return { name, node, owner, resolver, contenthash, cid: decodeContenthash(contenthash) };
  } finally { provider.destroy(); }
}

// deployed: ENS serves this release; superseded: ENS already serves a newer release's site; pending: steward must sign.
export function ensDeployment(manifest, state, newerSiteCids = []) {
  if (!manifest.ensName || !manifest.siteCid) return { status: 'unconfigured' };
  requireThat(state?.name === manifest.ensName, 'ENS state is for a different name');
  if (state.cid === manifest.siteCid) return { status: 'deployed', cid: state.cid };
  if (state.cid && newerSiteCids.includes(state.cid)) return { status: 'superseded', cid: state.cid };
  requireThat(state.resolver !== ethers.ZeroAddress, `${manifest.ensName} has no resolver; set one before pointing content`);
  return { status: 'pending', current: state.cid };
}

export function signingLink(manifest) {
  const url = new URL(SIGNING_PAGE);
  url.search = new URLSearchParams({ name: manifest.ensName, cid: manifest.siteCid, repo: manifest.repo, version: manifest.version }).toString();
  return url.href;
}

export const ensIssueTitle = m => `Point ${m.ensName} at ${m.version} site`;
export function ensIssueBody(m, state) {
  return `## Point ENS at the freshly minted release (steward wallet, no keys in CI)\n\n` +
    `The ${m.version} Supporter DNFT is minted and verified on Base. Its exact-commit site is pinned, and the Discord announcement waits until ENS serves it.\n\n` +
    `- Name: \`${m.ensName}\`\n- Owner (must sign): \`${state.owner}\`\n- Resolver: \`${state.resolver}\`\n` +
    `- Current content: ${state.cid ? `\`ipfs://${state.cid}\`` : 'none'}\n- New content: \`ipfs://${m.siteCid}\` (${m.repo}@${m.commit.slice(0, 7)})\n\n` +
    `**[Open the one-click signing page](${signingLink(m)})** — connect the owner wallet on Ethereum mainnet, check the CIDs, and sign one \`setContenthash\` transaction.\n\n` +
    `Preview first: https://ipfs.filebase.io/ipfs/${m.siteCid}/\n\n` +
    `The announce workflow re-checks ENS every 30 minutes. Once the record matches it records \`supporter-ens-deployed.json\` on the release, closes this issue and announces on Discord.\n`;
}
