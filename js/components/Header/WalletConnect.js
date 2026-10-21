import { wallet } from '../../wallet.js';
import { config } from '../../config.js';
import { safeURL } from '../../ui.js';
import { orbitMarkup, orbitCSS, setRing } from './orbit.js';
const base = new URL('../../../', import.meta.url).href;
const chainName = chainId => {
  const id = BigInt(chainId);
  if (id === BigInt(config.chain.chainId)) return config.chain.chainName;
  return { 1: 'Ethereum', 10: 'Optimism', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum' }[Number(id)] || `chain ${id}`;
};
export class WalletConnect extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() {
    const icon = safeURL(config.art.walletIcon) || `${base}img/MetaMaskFox.png`;
    this.shadowRoot.innerHTML = `<style>${orbitCSS}
      :host { display:grid; justify-items:center; align-content:start; gap:4px; font:12px/1.35 system-ui,sans-serif; color:var(--dh-text,#eef8ff); }
      #connect { width:100%; height:100%; border:0; border-radius:50%; padding:0; cursor:pointer; display:grid; place-items:center;
        background:radial-gradient(circle at 32% 28%,#ffffff2b,#ffffff08 62%),var(--dh-bg-1,#0a1220);
        --glow:#ff6b6bbf; box-shadow:0 0 0 2px #ff6b6b22,0 0 26px #ff6b6b5c,0 10px 26px #0008; transition:transform .18s ease, box-shadow .3s ease; }
      #connect::before { content:''; position:absolute; inset:-14%; z-index:-1; border-radius:50%; background:radial-gradient(circle,var(--glow) 0%,transparent 62%); filter:blur(6px); }
      #connect:hover:not(:disabled) { transform:scale(1.05); } #connect:active:not(:disabled) { transform:scale(.97); }
      #connect:disabled { cursor:default; filter:grayscale(.55) brightness(.8); }
      #connect:focus-visible { outline:3px solid var(--dh-accent,#7af0c6); outline-offset:4px; }
      #connect img { width:64%; height:64%; object-fit:contain; filter:drop-shadow(0 2px 6px #0009); }
      .orb[data-state="connected"] #connect { --glow:color-mix(in srgb,var(--dh-accent,#7af0c6) 78%,transparent);
        box-shadow:0 0 0 2px color-mix(in srgb,var(--dh-accent,#7af0c6) 18%,transparent),0 0 28px color-mix(in srgb,var(--dh-accent,#7af0c6) 45%,transparent),0 10px 26px #0008; }
      .meta { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:6px; max-width:200px; text-align:center; }
      select,#forget,a { font:inherit; color:var(--dh-text,#eef8ff); background:color-mix(in srgb,var(--dh-bg-2,#10202a) 85%,transparent);
        border:1px solid color-mix(in srgb,var(--dh-accent,#7af0c6) 55%,transparent); border-radius:999px; padding:3px 10px; text-decoration:none; }
      select { max-width:150px; } #forget { cursor:pointer; }
      select:focus-visible,#forget:focus-visible,a:focus-visible { outline:2px solid var(--dh-accent,#7af0c6); outline-offset:2px; }
      #status { margin:0; color:var(--dh-muted,#b9cfe0); letter-spacing:.04em; overflow-wrap:anywhere; }
      [hidden] { display:none !important; }
      @media(max-width:600px) { :host { font-size:10.5px; } .meta { max-width:104px; gap:3px; } select { max-width:100px; } select,#forget,a { padding:2px 7px; } }
      </style>${orbitMarkup(`<button id="connect" type="button" aria-label="Connect wallet"><img alt="" src="${icon}" /></button>`)}
      <div class="meta"><select aria-label="Choose wallet"></select><button id="forget" type="button" hidden>Forget wallet</button>
      <a id="mobile" hidden>Open MetaMask</a><p id="status" role="status"></p></div>`;
    this.update = () => this.renderState();
    window.addEventListener('decenthead:providers', this.update);
    window.addEventListener('decenthead:wallet', this.update);
    this.shadowRoot.querySelector('#connect').onclick = async () => {
      if (this.connecting || wallet.snapshot().connected) return;
      this.connecting = true;
      let failure;
      this.renderState();
      try {
        const index = Number(this.shadowRoot.querySelector('select').value);
        await wallet.connect(wallet.available()[index]?.provider);
      } catch (error) { failure = error.shortMessage || error.message; }
      finally {
        this.connecting = false;
        this.renderState();
        if (failure) { this.shadowRoot.querySelector('#status').textContent = failure; setRing(this.shadowRoot, '✦ CONNECTION CANCELLED ✦ TAP THE FOX TO TRY AGAIN ', 'error'); }
      }
    };
    this.shadowRoot.querySelector('#forget').onclick = () => wallet.forget();
    this.renderState();
  }
  disconnectedCallback() {
    window.removeEventListener('decenthead:providers', this.update);
    window.removeEventListener('decenthead:wallet', this.update);
  }
  orbRect() { return this.shadowRoot.querySelector('.orb')?.getBoundingClientRect(); }
  renderState() {
    const root = this.shadowRoot, available = wallet.available(), state = wallet.snapshot();
    const select = root.querySelector('select'), previous = select.value, connect = root.querySelector('#connect');
    select.replaceChildren(...available.map((item, i) => new Option(item.info.name, String(i))));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    select.hidden = available.length < 2 || state.connected;
    connect.disabled = !state.connected && (this.connecting || !available.length);
    connect.setAttribute('aria-label', state.connected ? `Wallet connected: ${state.address}` : 'Connect wallet');
    connect.title = state.connected ? state.address : available.length ? 'Connect wallet' : 'No injected wallet detected';
    root.querySelector('#forget').hidden = !state.connected;
    const mobile = root.querySelector('#mobile');
    mobile.hidden = !!available.length;
    mobile.href = `https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}${location.hash}`;
    root.querySelector('#status').textContent = state.connected
      ? `${state.address.slice(0, 6)}…${state.address.slice(-4)} · ${chainName(state.chainId)}`
      : this.connecting ? 'Check your wallet…' : available.length ? 'Connect only when you choose.' : 'No injected wallet detected.';
    if (state.connected) setRing(root, `${state.address} ✦ `, 'connected');
    else setRing(root, this.connecting ? '✦ WAITING FOR YOUR WALLET ✦ APPROVE IN METAMASK ' : '✦ CONNECT WALLET ✦ ONLY WHEN YOU CHOOSE ', 'idle');
  }
}
if (!customElements.get('wallet-connect')) customElements.define('wallet-connect', WalletConnect);
