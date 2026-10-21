import { config } from './config.js';
import { discoverProvider, switchChain } from './wallet-logic.js';
let ethersPromise;
export function loadEthers() {
  if (globalThis.ethers) return Promise.resolve(globalThis.ethers);
  return ethersPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/ethers.umd.min.js', import.meta.url).href;
    script.onload = () => resolve(globalThis.ethers);
    script.onerror = () => { ethersPromise = null; reject(new Error('Could not load ethers')); };
    document.head.append(script);
  });
}
const emit = detail => window.dispatchEvent(new CustomEvent('decenthead:wallet', { detail }));
export class WalletSession {
  constructor() {
    this.providers = [];
    this.state = { connected: false, address: null, chainId: null, provider: null };
    this.generation = 0;
    this.announce = event => {
      this.providers = discoverProvider(this.providers, event.detail);
      window.dispatchEvent(new CustomEvent('decenthead:providers'));
    };
    window.addEventListener('eip6963:announceProvider', this.announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
  available() {
    if (this.providers.length) return this.providers;
    return window.ethereum ? [{ info: { name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', uuid: 'fallback' }, provider: window.ethereum }] : [];
  }
  snapshot() { return { ...this.state }; }
  async connect(provider = this.available()[0]?.provider) {
    if (!provider) throw new Error('No injected wallet. Open this page in a wallet browser.');
    this.forget();
    const generation = this.generation;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) throw new Error('Wallet returned no accounts');
    await switchChain(provider, config.chain);
    const ethers = await loadEthers();
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (generation !== this.generation) return;
    this.rawProvider = provider;
    this.browserProvider = new ethers.BrowserProvider(provider, 'any');
    this.state = { connected: true, address: accounts[0], chainId, provider: this.browserProvider };
    this.handlers = {
      accountsChanged: accounts => {
        if (!accounts.length) { this.forget(); return; }
        this.state = { ...this.state, address: accounts[0] };
        emit(this.snapshot());
      },
      chainChanged: chainId => {
        this.browserProvider = new ethers.BrowserProvider(provider, 'any');
        this.state = { ...this.state, chainId, provider: this.browserProvider };
        emit(this.snapshot());
      },
      disconnect: () => this.forget(),
    };
    for (const [event, handler] of Object.entries(this.handlers)) provider.on?.(event, handler);
    emit(this.snapshot());
    return this.snapshot();
  }
  async ensureChain(chain = config.chain) {
    if (!this.rawProvider) throw new Error('Connect a wallet first');
    const provider = this.rawProvider, generation = this.generation;
    await switchChain(provider, chain);
    const ethers = await loadEthers();
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (generation !== this.generation) throw new Error('Wallet session changed; retry the action');
    this.browserProvider = new ethers.BrowserProvider(provider, 'any');
    this.state = { ...this.state, chainId, provider: this.browserProvider };
    emit(this.snapshot());
    return this.browserProvider;
  }
  forget(notify = true) {
    this.generation++;
    for (const [event, handler] of Object.entries(this.handlers || {})) this.rawProvider?.removeListener?.(event, handler);
    this.handlers = null;
    this.rawProvider = null;
    this.browserProvider = null;
    this.state = { connected: false, address: null, chainId: null, provider: null };
    if (notify) emit(this.snapshot());
  }
}
export const wallet = typeof window === 'undefined' ? null : new WalletSession();
