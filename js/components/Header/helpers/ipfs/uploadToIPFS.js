import { ipfs } from '../../../../ipfs.js';
// Only upload data explicitly selected by the host; never scrape localStorage.
export async function uploadDataToIPFS(data, session = ipfs) { return session.upload(data); }
