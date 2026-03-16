const _aboutBase = new URL('../../../', import.meta.url).href;

// ── DecentEscrow purchase constants ──────────────────────────────────────────
const ESCROW_ADDRESS    = '0x23A457AD3C33d68E4fAd2FCa7c5d9a511E0C350e';
const USDC_ADDRESS      = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'; // USDC on Optimism
const ZERO_ADDRESS      = '0x0000000000000000000000000000000000000000';
const OPTIMISM_CHAIN_ID = 10n; // numeric chainId for Optimism Mainnet

const ESCROW_ABI = [
  'function nextListingId() view returns (uint256)',
  'function getListing(uint256 listingId) view returns (tuple(address nftContract, uint256 tokenId, uint256 priceETH, address priceToken, uint256 priceAmount, uint256 available, bool active, string note))',
  'function purchaseWithToken(uint256 listingId, uint256 amount)',
];

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

class AboutModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    console.log('📦 AboutModal connected to DOM');
    this.render();
  }

  open() {
    console.log('📬 AboutModal.open() triggered');
    this.shadowRoot.querySelector('.modal-container').style.display = 'block';
    this._loadDecentHeadListings();
  }

  close() {
    this.shadowRoot.querySelector('.modal-container').style.display = 'none';
  }

  // ── Escrow purchase flow ──────────────────────────────────────────────────
  async _loadDecentHeadListings() {
    const container = this.shadowRoot.getElementById('buy-cards');
    const statusEl  = this.shadowRoot.getElementById('buy-status');

    container.innerHTML = '<p style="color:#aaa;font-size:0.85em;">⏳ Loading available editions…</p>';

    try {
      const ethers = window.ethers;
      if (!ethers || !window.ethereum) {
        container.innerHTML = '<p style="color:#aaa;font-size:0.85em;">Connect MetaMask to see live availability.</p>';
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const escrow   = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);

      const count = Number(await escrow.nextListingId());

      const raws = await Promise.all(
        Array.from({ length: count }, (_, i) => escrow.getListing(i))
      );

      const matched = raws
        .map((raw, i) => ({
          id:          i,
          nftContract: raw[0],
          tokenId:     raw[1],
          priceETH:    raw[2],
          priceToken:  raw[3],
          priceAmount: raw[4],
          available:   raw[5],
          active:      raw[6],
          note:        raw[7],
        }))
        .filter(l =>
          l.active &&
          l.available > 0n &&
          l.note.toLowerCase().includes('decenthead')
        );

      if (matched.length === 0) {
        container.innerHTML = '<p style="color:#aaa;font-size:0.85em;">No editions currently listed — check back soon.</p>';
        return;
      }

      container.innerHTML = matched.map(l => {
        const priceUSD = (Number(l.priceAmount) / 1e6).toFixed(2);
        return `
          <div class="buy-card">
            <div class="buy-card-label">${l.note}</div>
            <div class="buy-card-supply">${l.available} available</div>
            <button class="buy-btn" data-listing-id="${l.id}" data-price="${l.priceAmount.toString()}">
              🎟️ Buy Now — $${priceUSD} USDC
            </button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const listingId = parseInt(btn.dataset.listingId);
          const price     = BigInt(btn.dataset.price);
          this._handleBuy(listingId, price, btn, statusEl);
        });
      });

    } catch (err) {
      console.warn('_loadDecentHeadListings failed:', err);
      container.innerHTML = '<p style="color:#aaa;font-size:0.85em;">Could not load listings — please refresh.</p>';
    }
  }

  async _handleBuy(listingId, price, btn, statusEl) {
    const setStatus = (msg, color = '#aaa') => {
      statusEl.style.color = color;
      statusEl.textContent = msg;
    };

    if (!window.ethereum) {
      setStatus('⚠ MetaMask not found. Please install it to buy on-chain.', '#ff8800');
      return;
    }
    const ethers = window.ethers;
    if (!ethers) {
      setStatus('⚠ ethers.js not loaded.', '#ff8800');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = '⏳ Connecting wallet…';

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);

      // Ensure we're on Optimism
      const network = await provider.getNetwork();
      if (network.chainId !== OPTIMISM_CHAIN_ID) {
        setStatus('⏳ Switching to Optimism…');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa' }],
          });
        } catch (switchErr) {
          // Chain not added — add it
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xa',
                chainName: 'Optimism Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.optimism.io'],
                blockExplorerUrls: ['https://optimistic.etherscan.io'],
              }],
            });
          } else {
            throw switchErr;
          }
        }
        // Re-create provider after chain switch
        const freshProvider = new ethers.BrowserProvider(window.ethereum);
        await this._doPurchase(freshProvider, ethers, listingId, price, btn, setStatus);
        return;
      }

      await this._doPurchase(provider, ethers, listingId, price, btn, setStatus);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '🎟️ Buy Now';
      setStatus(`⚠ ${err.reason || err.message || 'Unknown error'}`, '#ff4444');
    }
  }

  async _doPurchase(provider, ethers, listingId, price, btn, setStatus) {
    const signer = await provider.getSigner();
    const buyer  = signer.address;

    // Verify listing is active
    setStatus('⏳ Checking listing…');
    const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
    const listing = await escrow.getListing(listingId);

    if (!listing.active) {
      btn.disabled = false;
      btn.textContent = '🎟️ Buy Now';
      setStatus('⚠ This listing is no longer active.', '#ff8800');
      return;
    }
    if (listing.available === BigInt(0)) {
      btn.disabled = false;
      btn.textContent = '🎟️ Buy Now';
      setStatus('⚠ Sold out — no tokens remaining.', '#ff8800');
      return;
    }

    // Read fresh on-chain price values from the listing
    const tokenAmount  = listing.priceAmount;          // ERC20 amount (e.g. 1_000_000 for $1 USDC)
    const priceETH     = listing.priceETH ?? 0n;       // ETH to send with the tx (0 for token-only listings)
    const rawToken     = listing.priceToken;            // ERC20 address stored in listing (may be address(0))

    // Some escrow deployments store address(0) as priceToken to mean "use the contract's
    // default payment token (USDC)".  Fall back to USDC_ADDRESS in that case so we always
    // approve the right token before calling purchaseWithToken.
    const paymentToken = (rawToken && rawToken !== ZERO_ADDRESS)
      ? rawToken
      : USDC_ADDRESS;

    console.log('[DecentHead] listing fields:', {
      listingId,
      rawToken,
      resolvedToken: paymentToken,
      tokenAmount: tokenAmount.toString(),
      priceETH: priceETH.toString(),
    });

    // Approve ERC20 payment token if the listing requires a token payment
    if (tokenAmount > 0n) {
      setStatus('⏳ Checking token allowance…');
      const token = new ethers.Contract(paymentToken, ERC20_ABI, signer);
      const allowance = await token.allowance(buyer, ESCROW_ADDRESS);

      console.log('[DecentHead] allowance check:', {
        token: paymentToken,
        allowance: allowance.toString(),
        required: tokenAmount.toString(),
      });

      if (allowance < tokenAmount) {
        setStatus('⏳ Approving USDC spend (confirm in MetaMask)…');
        btn.textContent = '⏳ Approving…';
        const approveTx = await token.approve(ESCROW_ADDRESS, tokenAmount);
        setStatus('⏳ Waiting for approval confirmation…');
        await approveTx.wait();
      }
    }

    // Purchase — include ETH value if the listing requires it
    setStatus('⏳ Confirm purchase in MetaMask…');
    btn.textContent = '⏳ Purchasing…';
    const txOptions = priceETH > 0n ? { value: priceETH } : {};
    const purchaseTx = await escrow.purchaseWithToken(listingId, 1, txOptions);
    setStatus('⏳ Waiting for purchase confirmation…');
    await purchaseTx.wait();

    btn.disabled = false;
    btn.textContent = '✅ Purchased!';
    setStatus(
      `✅ Success! DNFT transferred to your wallet. Tx: ${purchaseTx.hash.slice(0, 10)}…`,
      '#00e5ff'
    );

    // Refresh all listing cards
    this._loadDecentHeadListings();
  }

  render() {
    const cfg = window.DECENT_CONFIG || {};
    const appName = cfg.appName || 'Decent Header';

    this.shadowRoot.innerHTML = `
      <style>
        .modal-container {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 99999;
          backdrop-filter: blur(6px);
          padding: 40px;
          box-sizing: border-box;
          overflow-y: auto;
        }
        .modal-box {
          background: #111;
          border: 2px solid #00e5ff;
          border-radius: 16px;
          max-width: 720px;
          margin: auto;
          padding: 24px;
          color: white;
          font-family: 'Courier New', monospace;
          animation: fadeIn 0.4s ease;
          box-shadow: 0 0 20px #00e5ffaa;
        }
        .modal-box h2 {
          margin-top: 0;
          font-size: 1.8rem;
          color: #00e5ff;
          text-align: center;
        }
        .about-section {
          margin: 1.5em 0;
        }
        .about-section img {
          height: 20px;
          vertical-align: middle;
          margin-right: 6px;
        }
        .close-btn {
          float: right;
          background: #00e5ff;
          color: black;
          border: none;
          padding: 6px 12px;
          font-weight: bold;
          cursor: pointer;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        a {
          color: #00e5ff;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .future-note {
          margin-top: 1em;
          font-size: 0.85em;
          color: #aaa;
        }
        .buy-section {
          margin: 1.5em 0;
          text-align: center;
          border: 1px solid #8b00ff88;
          border-radius: 12px;
          padding: 1.2em 1em;
          background: #1a0033;
        }
        .buy-section h3 {
          color: #cc88ff;
          margin-top: 0;
        }
        .buy-card {
          margin: 0.8em auto;
          padding: 0.8em 1em;
          border: 1px solid #8b00ff55;
          border-radius: 10px;
          background: #120028;
          max-width: 420px;
        }
        .buy-card-label {
          font-size: 0.95em;
          color: #cc88ff;
          margin-bottom: 0.3em;
          font-weight: bold;
        }
        .buy-card-supply {
          font-size: 0.82em;
          color: #aaa;
          margin-bottom: 0.6em;
        }
        .buy-btn {
          display: inline-block;
          background: linear-gradient(135deg, #8b00ff, #00e5ff);
          color: white;
          font-weight: bold;
          font-size: 1.1rem;
          padding: 12px 28px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          letter-spacing: 0.04em;
          box-shadow: 0 0 16px #8b00ff88;
          transition: box-shadow 0.2s, transform 0.1s;
          font-family: 'Courier New', monospace;
        }
        .buy-btn:hover:not(:disabled) {
          box-shadow: 0 0 28px #00e5ffaa;
          transform: translateY(-2px);
        }
        .buy-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        #buy-status {
          font-size: 0.82em;
          color: #aaa;
          margin-top: 0.8em;
          min-height: 1.2em;
          overflow-wrap: break-word;
        }
        .escrow-note {
          font-size: 0.78em;
          color: #888;
          margin-top: 0.6em;
        }
        .escrow-note a {
          color: #8b00ff;
        }
      </style>
      <div class="modal-container">
        <div class="modal-box">
          <button class="close-btn" id="close-about">Close</button>
          <h2>🦚 About ${appName} 🦚</h2>

          <div class="about-section">
            <p>This project is part of the <strong>Decent Agency and Decent Smart Home</strong> suite of web3-powered tools and interfaces.</p>
            <p><strong>${appName}</strong> is a drop-in, forkable web3 header designed to give any static website a decentralized foundation. In this <strong>v1.0.0</strong> release the focus is simple: connect your <strong>MetaMask wallet</strong> and connect to <strong>IPFS</strong> via Web3.Storage — two pillars of the open, decentralized web.</p>
            <p>It leverages the <strong>Web3.Storage (W3Up)</strong> service for IPFS data storage and retrieval, and integrates with <strong>MetaMask</strong> for wallet connectivity.</p>
            <p>Decent Head is meant to be forked, cloned, and customized. It is a living submodule — a generic starting point for your organization's decentralized web3 journey. Drop it into any static HTML project and you are ready to go.</p>
          </div>

          <div class="buy-section">
            <h3>🎟️ Own a Piece of Web3 History</h3>
            <div id="buy-cards">⏳ Loading…</div>
            <div id="buy-status"></div>
            <p class="escrow-note">
              Sold via <a href="https://optimistic.etherscan.io/address/0x23A457AD3C33d68E4fAd2FCa7c5d9a511E0C350e" target="_blank" rel="noopener">DecentEscrow on Optimism</a> — instant, trustless, on-chain.
            </p>
          </div>

          <div class="about-section">
            <h3>🔗 Key Links:</h3>
            <ul>
              <li><img src="${_aboutBase}img/IPFS_Logo.png"/> <a href="https://w3s.link" target="_blank">Web3.Storage Console</a></li>
              <li><img src="${_aboutBase}img/MetaMaskFox.png"/> <a href="https://metamask.io/" target="_blank">MetaMask</a></li>
            </ul>
          </div>

          <div class="about-section">
            <h3>✨ v1.0.0 Features:</h3>
            <ul>
              <li>🦊 MetaMask wallet connection & address display</li>
              <li>📡 IPFS data storage & retrieval with W3Up</li>
              <li>🏷️ Configurable app name, subtitle, and branding via <code>decent.config.js</code></li>
              <li>📂 Expandable left &amp; right ankh (☥) dropdown menus</li>
              <li>🌐 Pure static HTML — no build step required</li>
            </ul>
            <p class="future-note">
              🔮 <em>Coming in future releases: ERC-20 token balance display, Uniswap DEX integration, liquidity pool tooling, subscription tiers, and token-rewarded data sharing. Stay tuned!</em>
            </p>
          </div>

          <div class="about-section">
            <p>Built with a ton of ❣️💗❣️ and a bare minimum of ingeniuty by</p>
            <p>⚕️ 🦚 ⚸ The Jolly LaMa 📜 & 📜 The RoboSoul 🤖 🦚 ⚕️</p>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('close-about').addEventListener('click', () => this.close());
  }
}

customElements.define('about-modal', AboutModal);