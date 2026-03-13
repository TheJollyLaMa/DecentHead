const _aboutBase = new URL('../../../', import.meta.url).href;

class AboutModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    console.log("AboutModal connected");
    console.log('📦 AboutModal connected to DOM');
    this.render();
  }

  open() {
    console.log("AboutModal open() called");
    console.log('📬 AboutModal.open() triggered');
    this.shadowRoot.querySelector('.modal-container').style.display = 'block';
  }

  close() {
    this.shadowRoot.querySelector('.modal-container').style.display = 'none';
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
      </style>
      <div class="modal-container">
        <div class="modal-box">
          <button class="close-btn" id="close-about">Close</button>
          <h2>🦚 About ${appName} 🦚</h2>

          <div class="about-section">
            <p>This project is part of the <strong>Decent Agency and Decent Smart Home</strong> suite of web3-powered tools and interfaces.</p>
            <p><strong>${appName}</strong> is a drop-in, forkable web3 header designed to give any static website a decentralized foundation. In this v1 release the focus is simple: connect your <strong>MetaMask wallet</strong> and connect to <strong>IPFS</strong> via Web3.Storage — two pillars of the open, decentralized web.</p>
            <p>It leverages the <strong>Web3.Storage (W3Up)</strong> service for IPFS data storage and retrieval, and integrates with <strong>MetaMask</strong> for wallet connectivity.</p>
            <p>Decent Head is meant to be forked, cloned, and customized. It is a living submodule — a generic starting point for your organization's decentralized web3 journey. Drop it into any static HTML project and you are ready to go.</p>
          </div>

          <div class="about-section">
            <h3>🔗 Key Links:</h3>
            <ul>
              <li><img src="${_aboutBase}img/IPFS_Logo.png"/> <a href="https://w3s.link" target="_blank">Web3.Storage Console</a></li>
              <li><img src="${_aboutBase}img/MetaMaskFox.png"/> <a href="https://metamask.io/" target="_blank">MetaMask</a></li>
            </ul>
          </div>

          <div class="about-section">
            <h3>✨ v1 Features:</h3>
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