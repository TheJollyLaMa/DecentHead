// Optional progress dialog for host-owned operations.
export class IPFSWaitingModal extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<dialog><p role="status">IPFS operation in progress…</p><button>Dismiss</button></dialog>';
    this.querySelector('button').onclick = () => this.close();
  }
  open() { this.querySelector('dialog').showModal(); }
  close() { this.querySelector('dialog').close(); }
}
if (!customElements.get('ipfs-waiting-modal')) customElements.define('ipfs-waiting-modal', IPFSWaitingModal);
