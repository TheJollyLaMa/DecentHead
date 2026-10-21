import { config } from '../../config.js';
import { wallet, loadEthers } from '../../wallet.js';
import { escapeHTML as esc, safeURL, modalStyles } from '../../ui.js';
const ZERO = '0x0000000000000000000000000000000000000000';
const ESCROW_ABI = [
  'function getListing(uint256) view returns (tuple(address nftContract,uint256 tokenId,uint256 priceETH,address priceToken,uint256 priceAmount,uint256 available,bool active,string note))',
  'function getNFTBalance(address,uint256) view returns (uint256)',
  'function purchaseWithETH(uint256,uint256) payable', 'function purchaseWithToken(uint256,uint256)',
];
const ERC20_ABI = ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];
const links = items => (items || []).map(item => {
  const url = safeURL(item.url);
  return url ? `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.label || item.title || url)}</a></li>` : '';
}).join('');
export class AboutModal extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() { this.render(); }
  open() { this.shadowRoot.querySelector('dialog').showModal(); }
  close() { this.shadowRoot.querySelector('dialog').close(); }
  render() {
    const about = config.about, supporter = config.supporterDnft;
    this.shadowRoot.innerHTML = `<style>${modalStyles}</style><dialog aria-labelledby="about-title">
      <h2 id="about-title">${esc(about.title)}</h2><p>${esc(about.summary)}</p>
      ${(about.sections || []).map(section => `<section><h3>${esc(section.title)}</h3><p>${esc(section.body || section.text)}</p></section>`).join('')}
      <ul>${links(config.links)}</ul>
      ${config.relatedDapps.length ? `<section><h3>Related Decent dapps</h3><ul>${links(config.relatedDapps)}</ul></section>` : ''}
      ${supporter ? `<section><h3>${esc(supporter.title || 'Supporter DNFT')}</h3>
        <p>Contract: ${esc(supporter.contract)} · Token: ${esc(supporter.tokenId)} · Chain: ${esc(supporter.chain?.chainName || supporter.chain?.chainId)}</p>
        <ul>${links(supporter.marketUrl ? [{ label: 'View on marketplace', url: supporter.marketUrl }] : [])}</ul>
        ${supporter.escrowAddress && supporter.listingId !== undefined ? '<button id="buy">Buy from escrow</button>' : ''}
        ${supporter.paypal?.clientId ? `<label>Recipient wallet <input id="recipient" autocomplete="off" /></label><button id="paypal">Buy with PayPal — ${esc(supporter.paypal.amount)} ${esc(supporter.paypal.currency || 'USD')}</button><div id="paypal-buttons"></div><p>PayPal purchases require manual fulfillment after merchant verification. Payment is not an on-chain mint.</p>` : ''}
        <p id="purchase-status" role="status"></p></section>` : ''}
      <button id="close">Close</button></dialog>`;
    this.shadowRoot.querySelector('#close').onclick = () => this.close();
    this.shadowRoot.querySelector('#buy')?.addEventListener('click', () => this.buy());
    this.shadowRoot.querySelector('#paypal')?.addEventListener('click', () => this.paypal());
  }
  status(message) { this.shadowRoot.querySelector('#purchase-status').textContent = message; }
  async buy() {
    const button = this.shadowRoot.querySelector('#buy'), cfg = config.supporterDnft;
    if (this.busy) return;
    this.busy = true;
    button.disabled = true;
    try {
      if (!cfg.chain) throw new Error('Configure the supporter chain before purchasing');
      if (!wallet.snapshot().connected) await wallet.connect();
      const provider = await wallet.ensureChain(cfg.chain);
      const ethers = await loadEthers(), signer = await provider.getSigner();
      const escrow = new ethers.Contract(cfg.escrowAddress, ESCROW_ABI, signer);
      this.status('Checking listing and escrow stock…');
      const listing = await escrow.getListing(cfg.listingId);
      if (listing.nftContract.toLowerCase() !== cfg.contract.toLowerCase() || listing.tokenId !== BigInt(cfg.tokenId)) throw new Error('Listing does not match configured supporter token');
      if (!listing.active || listing.available < 1n || await escrow.getNFTBalance(cfg.contract, cfg.tokenId) < 1n) throw new Error('Supporter token is not available in escrow');
      const price = listing.priceETH > 0n ? `${ethers.formatEther(listing.priceETH)} ETH` : `${listing.priceAmount} raw token units (${listing.priceToken === ZERO ? cfg.paymentToken : listing.priceToken})`;
      if (!confirm(`Buy one supporter DNFT for ${price}? Review the wallet transaction before signing.`)) { this.status('Cancelled.'); return; }
      let tx;
      if (listing.priceETH > 0n) {
        tx = await escrow.purchaseWithETH(cfg.listingId, 1, { value: listing.priceETH });
      } else {
        const tokenAddress = listing.priceToken === ZERO ? cfg.paymentToken : listing.priceToken;
        if (!tokenAddress || tokenAddress === ZERO) throw new Error('Configure the escrow default payment token');
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const buyer = await signer.getAddress();
        if (await token.allowance(buyer, cfg.escrowAddress) < listing.priceAmount) {
          this.status('Approve the exact token amount in your wallet…');
          await (await token.approve(cfg.escrowAddress, listing.priceAmount)).wait();
        }
        tx = await escrow.purchaseWithToken(cfg.listingId, 1);
      }
      this.status('Waiting for purchase confirmation…');
      await tx.wait();
      this.status(`Purchase confirmed: ${tx.hash}`);
    } catch (error) { this.status(error.shortMessage || error.message); }
    finally { this.busy = false; button.disabled = false; }
  }
  async paypal() {
    const cfg = config.supporterDnft.paypal, button = this.shadowRoot.querySelector('#paypal');
    const recipient = this.shadowRoot.querySelector('#recipient').value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) { this.status('Enter a valid recipient wallet address.'); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(String(cfg.amount)) || Number(cfg.amount) <= 0) { this.status('Configure a positive PayPal amount.'); return; }
    button.disabled = true;
    try {
      if (!window.paypal) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${encodeURIComponent(cfg.currency || 'USD')}&intent=capture`;
        script.onload = resolve; script.onerror = () => reject(new Error('Could not load PayPal')); document.head.append(script);
      });
      const container = this.shadowRoot.querySelector('#paypal-buttons');
      container.replaceChildren();
      await window.paypal.Buttons({
        createOrder: (data, actions) => actions.order.create({ purchase_units: [{
          description: `${config.appName} Supporter DNFT`, custom_id: recipient,
          amount: { currency_code: cfg.currency || 'USD', value: String(cfg.amount) },
        }] }),
        onApprove: async (data, actions) => {
          try {
            const receipt = await actions.order.capture();
            if (receipt.status !== 'COMPLETED') throw new Error('Payment is not completed');
            this.status(`Payment captured: ${receipt.id}. Contact the merchant for verified manual fulfillment to ${recipient}.`);
            container.replaceChildren();
            if (cfg.adminEmail) {
              const link = document.createElement('a');
              link.textContent = 'Email merchant with receipt';
              link.href = `mailto:${encodeURIComponent(cfg.adminEmail)}?subject=Supporter%20DNFT%20receipt&body=${encodeURIComponent(`Receipt: ${receipt.id}\nWallet: ${recipient}\nAmount: ${cfg.amount} ${cfg.currency || 'USD'}`)}`;
              container.append(link);
            }
          } catch (error) { this.status(error.message); }
        },
        onCancel: () => { this.status('Payment cancelled.'); button.disabled = false; },
        onError: error => { this.status(error.message || 'PayPal payment failed'); button.disabled = false; },
      }).render(container);
    } catch (error) { this.status(error.message); button.disabled = false; }
  }
}
if (!customElements.get('about-modal')) customElements.define('about-modal', AboutModal);
