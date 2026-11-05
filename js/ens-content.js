// Browser- and Node-safe ENS content helpers shared by the steward signing page and release scripts.
export const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
export const NAME_WRAPPER = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401';
export const CID_V1 = /^b[a-z2-7]{20,}$/;
export const ENS_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+eth$/;
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

function base32Decode(text) {
  const out = [];
  let bits = 0, value = 0;
  for (const char of text) {
    const index = B32.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 CID');
    value = ((value << 5) | index) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return out;
}
function base32Encode(bytes) {
  let out = '', bits = 0, value = 0;
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return bits ? out + B32[(value << (5 - bits)) & 31] : out;
}

// ENSIP-7: 0xe301 (ipfs-ns) followed by the binary CIDv1.
export function encodeContenthash(cid) {
  if (!CID_V1.test(cid || '')) throw new Error('CIDv1 (base32) required');
  return '0xe301' + base32Decode(cid.slice(1)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function decodeContenthash(hex) {
  const clean = String(hex || '').toLowerCase();
  if (!/^0xe30101(?:[0-9a-f]{2})+$/.test(clean)) return null;
  const bytes = clean.slice(6).match(/../g).map(h => parseInt(h, 16));
  return `b${base32Encode(bytes)}`;
}

export function parseEnsDeployLink(search) {
  const q = new URLSearchParams(search);
  const link = { name: (q.get('name') || '').toLowerCase(), cid: q.get('cid') || '', repo: q.get('repo') || '', version: q.get('version') || '' };
  if (!ENS_NAME.test(link.name)) throw new Error('The link needs a valid .eth name.');
  if (!CID_V1.test(link.cid)) throw new Error('The link needs a CIDv1 site folder.');
  if (link.repo && !/^[\w-][\w.-]*\/[\w-][\w.-]*$/.test(link.repo)) throw new Error('Invalid repository in link.');
  if (link.version && !/^[\w./-]{1,64}$/.test(link.version)) throw new Error('Invalid version in link.');
  return link;
}
