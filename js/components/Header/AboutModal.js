const _aboutBase = new URL('../../../', import.meta.url).href;

// ── DecentEscrow purchase constants ──────────────────────────────────────────
const ESCROW_ADDRESS    = '0x23A457AD3C33d68E4fAd2FCa7c5d9a511E0C350e';
const USDC_ADDRESS      = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'; // USDC on Optimism
const ZERO_ADDRESS      = '0x0000000000000000000000000000000000000000';
const OPTIMISM_CHAIN_ID = 10n; // numeric chainId for Optimism Mainnet

const MSG_NFT_NOT_IN_ESCROW = '⚠ NFT stock not yet loaded into escrow — check back soon.';

const ESCROW_ABI = [
  'function nextListingId() view returns (uint256)',
  'function getListing(uint256 listingId) view returns (tuple(address nftContract, uint256 tokenId, uint256 priceETH, address priceToken, uint256 priceAmount, uint256 available, bool active, string note))',
  'function getNFTBalance(address nftContract, uint256 tokenId) view returns (uint256)',
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
    this._resetPayPalSection();
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

      // Verify actual escrow NFT stock — the listing metadata can be stale if
      // the NFT was never deposited or was withdrawn after listing.
      const nftBalances = await Promise.all(
        matched.map(l => escrow.getNFTBalance(l.nftContract, l.tokenId))
      );

      container.innerHTML = matched.map((l, idx) => {
        const priceUSD   = (Number(l.priceAmount) / 1e6).toFixed(2);
        const nftInStock = nftBalances[idx] > 0n;
        return `
          <div class="buy-card">
            <div class="buy-card-label">${l.note}</div>
            <div class="buy-card-supply">${l.available} available</div>
            ${nftInStock
              ? `<button class="buy-btn" data-listing-id="${l.id}" data-price="${l.priceAmount.toString()}">
                   🎟️ Buy Now — $${priceUSD} USDC
                 </button>`
              : `<span role="status" style="color:#ff8800;font-size:0.8em;">${MSG_NFT_NOT_IN_ESCROW}</span>`
            }
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
      // Decode known contract errors into user-friendly messages
      const data = err?.data ?? err?.info?.error?.data ?? '';
      if (typeof data === 'string' && data.startsWith('0x03dee4c5')) {
        // ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)
        setStatus('⚠ NFT stock not in escrow — the seller needs to deposit NFTs before purchase.', '#ff8800');
      } else {
        setStatus(`⚠ ${err.reason || err.message || 'Unknown error'}`, '#ff4444');
      }
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

    // Pre-flight: verify the escrow actually holds the NFT.
    // The listing's `available` field can be stale if NFTs were never
    // deposited into the escrow or were later withdrawn.
    setStatus('⏳ Verifying NFT stock…');
    const nftBalance = await escrow.getNFTBalance(listing.nftContract, listing.tokenId);
    console.log('[DecentHead] escrow NFT balance:', {
      nftContract: listing.nftContract,
      tokenId: listing.tokenId.toString(),
      balance: nftBalance.toString(),
    });
    if (nftBalance < 1n) {
      btn.disabled = false;
      btn.textContent = '🎟️ Buy Now';
      setStatus(`⚠ ${MSG_NFT_NOT_IN_ESCROW}`, '#ff8800');
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

  // ── PayPal purchase flow ──────────────────────────────────────────────────

  /** Dynamically load the PayPal JS SDK (idempotent — skips if already loaded).
   * Note: SRI cannot be applied to PayPal's SDK URL because it includes dynamic
   * query parameters (client-id, currency), making the content hash unpredictable.
   * PayPal's CDN is trusted and served over HTTPS. */
  _loadPayPalSDK(clientId) {
    return new Promise((resolve, reject) => {
      if (window.paypal) { resolve(window.paypal); return; }
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
      script.onload  = () => resolve(window.paypal);
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      document.head.appendChild(script);
    });
  }

  /** Reset the PayPal section back to its initial state (called on each modal open). */
  _resetPayPalSection() {
    const walletInput  = this.shadowRoot.getElementById('paypal-wallet-address');
    const btnContainer = this.shadowRoot.getElementById('paypal-btn-container');
    const statusEl     = this.shadowRoot.getElementById('paypal-status');
    if (!walletInput) return;
    walletInput.value  = '';
    statusEl.textContent = '';
    // Rebuild only the inner button — the click listener stays on btnContainer (delegated).
    btnContainer.innerHTML = `
      <button class="buy-btn paypal-launch-btn" id="paypal-launch-btn">
        💳 Buy with PayPal — $100
      </button>`;
  }

  /** Called when the user clicks "Buy with PayPal". */
  async _handlePayPalLaunch() {
    const walletInput  = this.shadowRoot.getElementById('paypal-wallet-address');
    const launchBtn    = this.shadowRoot.getElementById('paypal-launch-btn');
    const btnContainer = this.shadowRoot.getElementById('paypal-btn-container');
    const statusEl     = this.shadowRoot.getElementById('paypal-status');

    const walletAddress = (walletInput?.value || '').trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      statusEl.textContent = '⚠ Please enter a valid Ethereum wallet address (0x… 40 hex chars).';
      statusEl.style.color = '#ff8800';
      walletInput?.focus();
      return;
    }

    statusEl.textContent = '⏳ Loading PayPal…';
    statusEl.style.color = '#aaa';
    if (launchBtn) launchBtn.disabled = true;

    try {
      const cfg       = window.DECENT_CONFIG || {};
      const clientId  = cfg.paypalClientId  || 'test';
      const adminEmail = cfg.paypalDnftEmail || '';

      const paypal = await this._loadPayPalSDK(clientId);

      btnContainer.innerHTML = '<div id="paypal-sdk-buttons"></div>';
      const sdkContainer = this.shadowRoot.getElementById('paypal-sdk-buttons');
      statusEl.textContent = '';

      await paypal.Buttons({
        style: { layout: 'horizontal', color: 'blue', shape: 'rect', label: 'pay' },

        createOrder(data, actions) {
          return actions.order.create({
            purchase_units: [{
              description: `Supporter DNFT \u2014 Wallet: ${walletAddress}`,
              custom_id: walletAddress,
              amount: { currency_code: 'USD', value: '100.00' },
            }],
          });
        },

        onApprove: async (data, actions) => {
          const details    = await actions.order.capture();
          const txId       = details.id;
          const paidAt     = details.update_time || details.create_time || new Date().toISOString();
          statusEl.innerHTML = `
            ✅ <strong>Payment confirmed!</strong><br>
            PayPal Transaction: <code>${txId}</code><br>
            Wallet: <code>${walletAddress}</code><br>
            <em>Admin has been notified — your Supporter DNFT will arrive within 24 h.</em>`;
          statusEl.style.color = '#00e5ff';
          btnContainer.innerHTML = '';

          if (adminEmail) {
            const subject = encodeURIComponent('Supporter DNFT Purchase \u2014 PayPal');
            const body    = encodeURIComponent(
              `PayPal Transaction ID: ${txId}\n` +
              `Wallet Address: ${walletAddress}\n` +
              `Amount: $100 USD\n` +
              `Timestamp: ${paidAt}`
            );
            window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
          }
        },

        onCancel: () => {
          statusEl.textContent = 'Payment cancelled. Try again when ready.';
          statusEl.style.color = '#aaa';
          this._resetPayPalSection();
        },

        onError: (err) => {
          console.error('[DecentHead] PayPal error:', err);
          statusEl.textContent = '⚠ PayPal encountered an error. Please try again.';
          statusEl.style.color = '#ff4444';
          this._resetPayPalSection();
        },
      }).render(sdkContainer);

    } catch (err) {
      console.error('[DecentHead] PayPal init error:', err);
      statusEl.textContent = '⚠ Could not load PayPal. Check your internet connection.';
      statusEl.style.color = '#ff4444';
      this._resetPayPalSection();
    }
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
        /* ── Dual buy-option layout ─────────────────────────────────────── */
        .buy-options {
          display: flex;
          gap: 1em;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 0.6em;
        }
        .buy-option-card {
          flex: 1;
          min-width: 220px;
          max-width: 320px;
          border: 1px solid #8b00ff55;
          border-radius: 12px;
          padding: 1em;
          background: #120028;
          text-align: center;
        }
        .buy-option-card.paypal-option {
          border-color: #0070ba55;
          background: #001a2c;
        }
        .buy-option-title {
          font-size: 1em;
          font-weight: bold;
          color: #cc88ff;
          margin-bottom: 0.3em;
        }
        .buy-option-card.paypal-option .buy-option-title {
          color: #5bc6f7;
        }
        .buy-option-price {
          font-size: 0.82em;
          color: #aaa;
          margin-bottom: 0.5em;
        }
        .buy-option-desc {
          font-size: 0.8em;
          color: #888;
          margin: 0 0 0.8em;
        }
        #paypal-wallet-address {
          width: 100%;
          box-sizing: border-box;
          background: #000d1a;
          border: 1px solid #0070ba;
          border-radius: 8px;
          color: #5bc6f7;
          font-family: 'Courier New', monospace;
          font-size: 0.82em;
          padding: 8px 10px;
          margin-bottom: 0.6em;
          outline: none;
        }
        #paypal-wallet-address::placeholder { color: #3a6080; }
        #paypal-wallet-address:focus {
          border-color: #5bc6f7;
          box-shadow: 0 0 8px #0070ba55;
        }
        .paypal-launch-btn {
          background: linear-gradient(135deg, #0070ba, #003087);
          box-shadow: 0 0 16px #0070ba55;
        }
        .paypal-launch-btn:hover:not(:disabled) {
          box-shadow: 0 0 28px #5bc6f7aa;
        }
        #paypal-status {
          font-size: 0.82em;
          color: #aaa;
          margin-top: 0.8em;
          min-height: 1.2em;
          overflow-wrap: break-word;
          text-align: left;
          line-height: 1.5;
        }
        #paypal-status code {
          font-size: 0.9em;
          color: #00e5ff;
          word-break: break-all;
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
            <div class="buy-options">

              <!-- ── PayPal option ───────────────────────────────────────── -->
              <div class="buy-option-card paypal-option">
                <div class="buy-option-title">💳 Buy with PayPal</div>
                <div class="buy-option-price">$100 one-time payment</div>
                <p class="buy-option-desc">Enter your wallet address — admin will transfer your Supporter DNFT after verifying your payment.</p>
                <input
                  id="paypal-wallet-address"
                  type="text"
                  placeholder="0x… your receiving wallet address"
                  autocomplete="off"
                  spellcheck="false"
                />
                <div id="paypal-btn-container">
                  <button class="buy-btn paypal-launch-btn" id="paypal-launch-btn">
                    💳 Buy with PayPal — $100
                  </button>
                </div>
                <div id="paypal-status"></div>
              </div>

              <!-- ── Crypto option (unchanged) ───────────────────────────── -->
              <div class="buy-option-card crypto-option">
                <div class="buy-option-title">🔗 Buy with Crypto</div>
                <div class="buy-option-price">USDC on Optimism — instant &amp; trustless</div>
                <div id="buy-cards">⏳ Loading…</div>
                <div id="buy-status"></div>
                <p class="escrow-note">
                  Sold via <a href="https://optimistic.etherscan.io/address/0x23A457AD3C33d68E4fAd2FCa7c5d9a511E0C350e" target="_blank" rel="noopener">DecentEscrow on Optimism</a> — instant, trustless, on-chain.
                </p>
              </div>

            </div>
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
    // Delegate PayPal button clicks on the container so the listener survives
    // innerHTML resets in _resetPayPalSection().
    this.shadowRoot.getElementById('paypal-btn-container').addEventListener('click', (e) => {
      if (e.target.id === 'paypal-launch-btn') this._handlePayPalLaunch();
    });
  }
}

customElements.define('about-modal', AboutModal);