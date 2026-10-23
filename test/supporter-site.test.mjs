import test from 'node:test';
import assert from 'node:assert/strict';
import { ensDeployment, ensIssueBody, ensIssueTitle, pinSite, signingLink, siteFiles, validateEnsRpc } from '../scripts/supporter-site.mjs';
import { decodeContenthash, encodeContenthash, parseEnsDeployLink } from '../js/ens-content.js';
import { buildDiscordPayload, validateManifest } from '../scripts/supporter-protocol.mjs';
import { buildSupporterMetadata } from '../scripts/supporter-metadata.mjs';

const CID = 'bafybeie6yd4kiyr7amfkmoop56xtc6wuz46hwizv6wkkvoaw3fqcdkk5xm';
const NEWER = 'bafybeieu4ypnyluhjokrpjyjcr6rcguwokvawsgrq7qqcaa264vc2qqt34';
const commit = 'a'.repeat(40);
const manifest = {
  schema: 1, repo: 'TheJollyLaMa/DecentHead', version: 'v2.1.0', commit, releaseDate: '2026-10-21T20:00:00.000Z',
  creator: 'thejollylama.eth', creatorAddress: '0x3333333333333333333333333333333333333333', chainId: 8453, quantity: '1000', priceUSDC: '10000000',
  metadataURI: 'ipfs://bafymeta', front: 'ipfs://bafyfront', back: 'ipfs://bafyback', animation: 'ipfs://bafyhtml',
  siteCid: CID, ensName: 'decenthead.decentagency.eth',
};
const state = (cid, extra = {}) => ({ name: manifest.ensName, owner: '0xcAeEd8422fB5682C298B7F0971906d446fFd4e7a', resolver: '0xF29100983E058B709F3D539b0c765937B804AC15', cid, ...extra });

test('contenthash encoding matches ENSIP-7 and round-trips', () => {
  const hex = encodeContenthash(CID);
  assert.match(hex, /^0xe30101701220[0-9a-f]{64}$/);
  assert.equal(decodeContenthash(hex), CID);
  assert.equal(decodeContenthash('0x'), null);
  assert.equal(decodeContenthash('0xe50101'), null);
  assert.throws(() => encodeContenthash('QmNotV1'), /CIDv1/);
});

test('signing links carry only a valid name and CIDv1', () => {
  const link = new URL(signingLink(manifest));
  assert.equal(link.origin + link.pathname, 'https://thejollylama.github.io/DecentHead/supporter/ens.html');
  assert.deepEqual(parseEnsDeployLink(link.search), { name: manifest.ensName, cid: CID, repo: manifest.repo, version: 'v2.1.0' });
  assert.throws(() => parseEnsDeployLink('?name=evil.com&cid=' + CID), /\.eth/);
  assert.throws(() => parseEnsDeployLink('?name=a.eth&cid=QmX'), /CIDv1/);
  assert.throws(() => parseEnsDeployLink(`?name=a.eth&cid=${CID}&repo=../x`), /repository/);
});

test('site and ENS fields are optional but validated', () => {
  const { siteCid, ensName, ...legacy } = manifest;
  assert.equal(validateManifest(legacy), legacy);
  assert.equal(validateManifest({ ...legacy, siteCid }).siteCid, CID);
  assert.equal(validateManifest(manifest), manifest);
  assert.throws(() => validateManifest({ ...legacy, ensName }), /ensName/);
  assert.throws(() => validateManifest({ ...manifest, siteCid: 'QmLegacy' }), /siteCid/);
  assert.throws(() => validateManifest({ ...manifest, ensName: 'Decent.Head.com' }), /ensName/);
});

test('metadata advertises the site only when the release has one', () => {
  const base = { repo: manifest.repo, version: manifest.version, commit, codeArchiveCid: 'bafyarchive', image: manifest.front };
  const withSite = buildSupporterMetadata({ ...base, release: manifest });
  assert.equal(withSite.properties.site_cid, CID);
  assert.equal(withSite.properties.ens_name, manifest.ensName);
  assert.equal(withSite.properties.product.site, `ipfs://${CID}`);
  assert.ok(withSite.attributes.some(a => a.trait_type === 'site_cid' && a.value === CID));
  const { siteCid, ensName, ...legacy } = manifest;
  const without = buildSupporterMetadata({ ...base, release: legacy });
  assert.equal('site_cid' in without.properties, false);
  assert.equal('site' in without.properties.product, false);
});

test('site files are tracked blobs minus dot-paths, symlinks and submodules', () => {
  const tree = ['100644 blob x\tindex.html', '100755 blob x\tscripts/run.sh', '100644 blob x\t.github/workflows/a.yml',
    '100644 blob x\tjs/.cache/x.js', '120000 blob x\tlink', '160000 commit x\tvendor/sub', '100644 blob x\timg/a b.png'].join('\0') + '\0';
  assert.deepEqual(siteFiles(commit, () => tree), ['index.html', 'scripts/run.sh', 'img/a b.png']);
  assert.throws(() => siteFiles('main', () => tree), /commit/);
});

test('site pin uploads one repo-named CIDv1 folder', async () => {
  let request;
  const fetchImpl = async (url, init) => { request = { url, init }; return { ok: true, json: async () => ({ IpfsHash: CID }) }; };
  const result = await pinSite({ repo: manifest.repo, commit, jwt: 'jwt', files: ['index.html', 'js/a.js'], readBlob: p => Buffer.from(p), fetchImpl });
  assert.deepEqual(result, { cid: CID, fileCount: 2, bytes: 'index.html'.length + 'js/a.js'.length });
  assert.equal(request.url, 'https://api.pinata.cloud/pinning/pinFileToIPFS');
  assert.deepEqual(request.init.body.getAll('file').map(f => f.name), ['DecentHead/index.html', 'DecentHead/js/a.js']);
  assert.deepEqual(JSON.parse(request.init.body.get('pinataOptions')), { cidVersion: 1 });
  await assert.rejects(pinSite({ repo: manifest.repo, commit, jwt: 'jwt', files: ['README.md'], readBlob: () => Buffer.alloc(0), fetchImpl }), /index\.html/);
  await assert.rejects(pinSite({ repo: manifest.repo, commit, jwt: 'jwt', files: ['index.html'], readBlob: () => Buffer.alloc(0), fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
});

test('ENS gate: deployed, superseded, pending, unconfigured', () => {
  assert.deepEqual(ensDeployment(manifest, state(CID)), { status: 'deployed', cid: CID });
  assert.deepEqual(ensDeployment(manifest, state(NEWER), [NEWER]), { status: 'superseded', cid: NEWER });
  assert.deepEqual(ensDeployment(manifest, state(NEWER)), { status: 'pending', current: NEWER });
  assert.deepEqual(ensDeployment(manifest, state(null)), { status: 'pending', current: null });
  const { ensName, ...noEns } = manifest;
  assert.deepEqual(ensDeployment(noEns, null), { status: 'unconfigured' });
  assert.throws(() => ensDeployment(manifest, state(null, { resolver: '0x0000000000000000000000000000000000000000' })), /no resolver/);
  assert.throws(() => ensDeployment(manifest, { ...state(CID), name: 'other.eth' }), /different name/);
});

test('steward issue names the owner, both CIDs and the one-click link', () => {
  const body = ensIssueBody(manifest, state(NEWER));
  assert.equal(ensIssueTitle(manifest), 'Point decenthead.decentagency.eth at v2.1.0 site');
  for (const part of [signingLink(manifest), `ipfs://${CID}`, `ipfs://${NEWER}`, '0xcAeEd8422fB5682C298B7F0971906d446fFd4e7a', 'no keys in CI']) assert.ok(body.includes(part), part);
});

test('Discord links the live ENS site only when configured', () => {
  const verified = { verifiedBlock: 1, purchaseUrl: 'https://example.org/buy' };
  assert.match(buildDiscordPayload(manifest, verified).embeds[0].description, /https:\/\/decenthead\.decentagency\.eth\.limo/);
  const { ensName, ...noEns } = manifest;
  assert.doesNotMatch(buildDiscordPayload(noEns, verified).embeds[0].description, /\.limo/);
});

test('ENS RPC must be credential-free HTTPS', () => {
  assert.equal(validateEnsRpc('https://ethereum-rpc.publicnode.com'), 'https://ethereum-rpc.publicnode.com/');
  assert.throws(() => validateEnsRpc('https://rpc.example/?key=secret'), /credential-free/);
  assert.throws(() => validateEnsRpc('http://rpc.example'), /HTTPS/);
});
