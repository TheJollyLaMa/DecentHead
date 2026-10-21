import './IPFSControls.js';
import { config } from '../../config.js';
import { ipfs } from '../../ipfs.js';
export class IPFSStatus extends HTMLElement {
  connectedCallback() {
    if (!config.enableIPFS) return;
    const controls = document.createElement('ipfs-controls');
    const hasData = typeof config.data?.export === 'function' || typeof config.data?.import === 'function';
    controls.adapter = config.ipfsAdapter || {
      version: 1, label: config.appName,
      capabilities: hasData ? { backup: { open: () => controls.openBackup() } } : {},
      getStatus: async () => hasData ? { backup: { state: 'idle', detail: 'Host data controls available; no backup verified.' } } : {},
    };
    ipfs.adapter = controls.adapter;
    this.replaceChildren(controls);
  }
}
if (!customElements.get('ipfs-status')) customElements.define('ipfs-status', IPFSStatus);
