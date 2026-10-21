import { IPFS_CAPABILITIES, readIPFSHostStatus, openIPFSHostControls, validateIPFSHost } from '../../ipfs-host.js';

const base = new URL('../../../', import.meta.url).href;

export class IPFSControls extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.busy = false;
    this.operation = null;
    this.request = 0;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font: 14px/1.5 system-ui, sans-serif; color: #edf9ff; }
        button { font: inherit; cursor: pointer; }
        button:focus-visible { outline: 3px solid #73e8df; outline-offset: 3px; }
        button:disabled { cursor: not-allowed; opacity: .55; }
        #open { display: grid; place-items: center; width: 64px; height: 64px;
          border-radius: 50%; border: 1px solid #73e8df; background: #101b27; }
        #open img { width: 38px; height: 38px; }
        dialog { box-sizing: border-box; width: min(30rem, calc(100vw - 24px)); max-height: calc(100dvh - 24px);
          overflow: auto; border: 1px solid #73e8df; border-radius: 12px; padding: 20px;
          background: #101b27; color: #edf9ff; overflow-wrap: anywhere; }
        dialog::backdrop { background: #000a; }
        h2 { margin-top: 0; }
        section { border-top: 1px solid #536575; padding: 12px 0; }
        h3 { margin: 0; font-size: 1rem; }
        p { margin: 8px 0; }
        section button, #refresh, #close { padding: 8px 12px; background: #20374c;
          color: inherit; border: 1px solid #8faaba; border-radius: 6px; }
        #message { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        @media (max-width: 600px) { #open { width: 42px; height: 42px; } #open img { width: 28px; height: 28px; } }
      </style>
      <button id="open" type="button" aria-label="Open IPFS controls" aria-haspopup="dialog">
        <img src="${base}img/IPFS_Logo.png" alt="" />
      </button>
      <p id="message" role="status" aria-live="polite"></p>
      <dialog aria-labelledby="title">
        <h2 id="title">IPFS data controls</h2>
        <p id="app"></p>
        <p>Backups, public replication and reward participation are separate.
          Opening these controls does not upload data, pin content or make a payment.</p>
        ${Object.entries(IPFS_CAPABILITIES).map(([key, label]) => `
          <section><h3>${label}</h3><p id="${key}-status">Not checked.</p>
            <button type="button" data-capability="${key}" disabled>Open ${label.toLowerCase()} controls</button>
          </section>`).join('')}
        <p id="status-error" role="alert"></p>
        <button id="refresh" type="button">Refresh status</button>
        <button id="close" type="button">Close</button>
      </dialog>`;
    const root = this.shadowRoot;
    this.dialog = root.querySelector('dialog');
    root.getElementById('open').addEventListener('click', () => {
      this.dialog.showModal();
      this.refresh();
    });
    root.getElementById('close').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      if (this.operation === 'status') {
        this.request++;
        this.setBusy(false);
        root.getElementById('message').textContent = 'Status check dismissed. Open the controls to retry.';
      }
    });
    root.getElementById('refresh').addEventListener('click', () => this.refresh());
    root.querySelectorAll('[data-capability]').forEach(button => {
      button.addEventListener('click', () => this.openControls(button.dataset.capability));
    });
  }

  disconnectedCallback() {
    this.request++;
    this.dialog?.close();
    this.busy = false;
    this.operation = null;
  }

  setBusy(busy) {
    this.busy = busy;
    if (!busy) this.operation = null;
    this.shadowRoot.getElementById('open').disabled = busy;
    this.shadowRoot.getElementById('refresh').disabled = busy;
    this.shadowRoot.querySelectorAll('[data-capability]').forEach(button => { button.disabled = true; });
  }

  async refresh() {
    if (this.busy) return;
    const request = ++this.request;
    this.operation = 'status';
    this.setBusy(true);
    const root = this.shadowRoot;
    root.getElementById('status-error').textContent = '';
    root.getElementById('app').textContent = '';
    root.getElementById('message').textContent = 'Checking app-reported IPFS status...';
    root.querySelectorAll('[id$="-status"]').forEach(el => { el.textContent = 'Checking...'; });
    try {
      validateIPFSHost(this.adapter);
      root.getElementById('app').textContent = this.adapter.label;
      const status = await readIPFSHostStatus(this.adapter);
      if (request !== this.request) return;
      this.setBusy(false);
      for (const [key, entry] of Object.entries(status)) {
        root.getElementById(`${key}-status`).textContent = `${entry.state}: ${entry.detail}`;
        root.querySelector(`[data-capability="${key}"]`).disabled =
          entry.state === 'unavailable' || entry.state === 'pending';
      }
      root.getElementById('message').textContent = 'Status supplied by this app; not independent storage or reward verification.';
    } catch (error) {
      if (request !== this.request) return;
      this.setBusy(false);
      root.getElementById('status-error').textContent = `IPFS status unavailable: ${error.message}`;
      root.getElementById('message').textContent = 'IPFS configuration or status failed. No storage action was performed.';
      root.querySelectorAll('[id$="-status"]').forEach(el => { el.textContent = 'Status unavailable; see error below.'; });
      console.warn('[DecentHead IPFS]', error);
    }
  }

  async openControls(capability) {
    if (this.busy) return;
    const request = ++this.request;
    this.operation = 'controls';
    this.setBusy(true);
    this.dialog.close();
    const message = this.shadowRoot.getElementById('message');
    message.textContent = 'Opening app controls...';
    try {
      await openIPFSHostControls(this.adapter, capability);
      if (request !== this.request) return;
      message.textContent = 'App controls opened. This is not confirmation of a backup, pin or reward.';
    } catch (error) {
      if (request !== this.request) return;
      this.dialog.showModal();
      this.shadowRoot.getElementById('status-error').textContent = `Could not open controls: ${error.message}`;
      message.textContent = 'App controls failed to open.';
      console.warn('[DecentHead IPFS]', error);
    } finally {
      if (request === this.request) this.setBusy(false);
    }
  }
}

if (!customElements.get('ipfs-controls')) customElements.define('ipfs-controls', IPFSControls);
