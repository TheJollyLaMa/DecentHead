import { config } from '../config.js';
import './Header/IPFSStatus.js';
import './Header/AppTitle.js';
import './Header/WalletConnect.js';
import './Header/AboutModal.js';
const css = new URL('../../css/decent-head.css', import.meta.url).href;
export class DecentHeader extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() {
    for (const [key, value] of Object.entries(config.theme)) {
      const property = key.startsWith('--dh-') ? key : `--dh-${key}`;
      if (/^--dh-[a-z0-9-]+$/.test(property)) this.style.setProperty(property, value);
    }
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${css}" />
      <header><div class="dh-background" aria-hidden="true"></div><ipfs-status></ipfs-status><app-title></app-title><wallet-connect></wallet-connect></header><about-modal></about-modal>`;
    this.shadowRoot.querySelector('app-title').addEventListener('decenthead:about', () => this.shadowRoot.querySelector('about-modal').open());
  }
}
if (!customElements.get('decent-header')) customElements.define('decent-header', DecentHeader);
