class RightAnkhDropdown extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="../css/header.css" />
      <div class="ankh-wrapper">
        <div class="ankh-container">
          <span class="ankh-coin">☥</span>
          <div class="dropdown-menu right-ankh-menu" style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); display: none;">
            <div>
              <div class="token-balance">⧉ ⊙ ⚸ ⊙ ⧉</div>
              <div class="dropdown-option">
                <img src="./img/Uniswap_Logo.png" alt="Uni" class="dropdown-icon" />
                <a href="https://app.uniswap.org/explore/tokens/polygon/0x1a74f818F1b42dBFcE449c7Fa93B107C6e4A2433" target="_blank">
                  Buy/Sell on Uniswap
                </a>
              </div>
            </div>
          </div>
        </div>
        <span class="sparkle sparkle-top">✨</span>
        <span class="sparkle sparkle-bottom">✨</span>
        <span class="sparkle sparkle-left">✨</span>
        <span class="sparkle sparkle-right">✨</span>
      </div>
    `;

    this.setupDropdown();
  }

  async setupDropdown() {
    const ethers = window.ethers;

    const container = this.shadowRoot.querySelector('.ankh-coin');
    const popup = this.shadowRoot.querySelector('.dropdown-menu.right-ankh-menu');
    const balanceDiv = this.shadowRoot.querySelector('.token-balance');

    // Add "Share Data" option after existing dropdown-option
    const dropdownMenu = this.shadowRoot.querySelector('.dropdown-menu.right-ankh-menu > div');
    if (dropdownMenu) {
      const shareOption = document.createElement('div');
      shareOption.className = 'dropdown-option';
      shareOption.textContent = 'Share Data';
      dropdownMenu.appendChild(shareOption);
    }

    container?.addEventListener('click', (e) => {
      popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
      e.stopPropagation();
    });

    document.addEventListener('click', () => {
      if (popup) popup.style.display = 'none';
    });

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = signer.address;

      const ommm = new ethers.Contract(
        '0x1a74f818F1b42dBFcE449c7Fa93B107C6e4A2433',
        [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );

      const [raw, decimals] = await Promise.all([
        ommm.balanceOf(address),
        ommm.decimals()
      ]);
      
      const formatted = Number(ethers.formatUnits(raw, decimals)).toFixed(2);

      balanceDiv.innerHTML = `
        <span style="color:white; font-size:1.2rem;">
          <img src="./img/Ommm.png" alt="Ommm" style="height:35px; vertical-align:middle;" />
          ${formatted}
        </span>
      `;
    } catch (err) {
      console.warn("Failed to get OMMM balance", err);
    }
  }
}

customElements.define('right-ankh', RightAnkhDropdown);