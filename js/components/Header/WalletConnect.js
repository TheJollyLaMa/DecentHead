import { wallet } from '../../wallet.js';
export class WalletConnect extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() {
    this.shadowRoot.innerHTML = `<style>
      :host { display:block; text-align:right; font:14px system-ui; }
      button,select,a { font:inherit; color:var(--dh-text,#eef8ff); background:var(--dh-bg-2,#192c40); border:1px solid var(--dh-accent,#80edd2); border-radius:8px; padding:9px; }
      button { cursor:pointer; } select { max-width:140px; } a { display:inline-block; }
      #status { max-width:230px; overflow-wrap:anywhere; } [hidden] { display:none; }
      @media(max-width:600px) { button,select,a { padding:7px; font-size:12px; } select { max-width:100px; } }
      </style><select aria-label="Choose wallet"></select> <button id="connect">Connect wallet</button>
      <button id="forget" hidden>Forget wallet</button><a id="mobile" hidden>Open MetaMask</a><p id="status" role="status"></p>`;
    this.update = () => this.renderState();
    window.addEventListener('decenthead:providers', this.update);
    window.addEventListener('decenthead:wallet', this.update);
    this.shadowRoot.querySelector('#connect').onclick = async () => {
      const button = this.shadowRoot.querySelector('#connect');
      if (this.connecting) return;
      this.connecting = true;
      let failure;
      button.disabled = true;
      try {
        const index = Number(this.shadowRoot.querySelector('select').value);
        await wallet.connect(wallet.available()[index]?.provider);
      } catch (error) { failure = error.shortMessage || error.message; }
      finally {
        this.connecting = false;
        this.renderState();
        if (failure) this.shadowRoot.querySelector('#status').textContent = failure;
      }
    };
    this.shadowRoot.querySelector('#forget').onclick = () => wallet.forget();
    this.renderState();
  }
  disconnectedCallback() {
    window.removeEventListener('decenthead:providers', this.update);
    window.removeEventListener('decenthead:wallet', this.update);
  }
  renderState() {
    const root = this.shadowRoot, available = wallet.available(), state = wallet.snapshot();
    const select = root.querySelector('select'), previous = select.value;
    select.replaceChildren(...available.map((item, i) => new Option(item.info.name, String(i))));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    select.hidden = available.length < 2 || state.connected;
    root.querySelector('#connect').hidden = state.connected;
    root.querySelector('#connect').disabled = this.connecting || !available.length;
    root.querySelector('#forget').hidden = !state.connected;
    const mobile = root.querySelector('#mobile');
    mobile.hidden = !!available.length;
    mobile.href = `https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}${location.hash}`;
    root.querySelector('#status').textContent = state.connected
      ? `${state.address.slice(0, 6)}…${state.address.slice(-4)} · chain ${BigInt(state.chainId)}`
      : available.length ? 'Connect only when you choose.' : 'No injected wallet detected.';
  }
}
if (!customElements.get('wallet-connect')) customElements.define('wallet-connect', WalletConnect);
