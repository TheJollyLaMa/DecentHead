# Changelog

All notable changes to **Decent Head** are documented here.

---

## [v2.0.0] — 2026-10-21

### Breaking

- Remove the retired web3.storage / w3up client, browser script and login flow.
- Replace implicit app-specific storage with explicit host adapters / data hooks.
- Replace auto-connect and hard-coded supporter contracts with configured chain,
  click-only wallet consent and configured supporter listings. Base is default.
- Replace fixed ankh/menu styling with the v2 theme surface and clickable title.

### Added

- Pinata (user JWT/key or host worker), local Kubo, confirmed backup/restore,
  opt-in community pins, and unchanged version 1 host capability contract.
- EIP-6963 discovery, ethers v6 BrowserProvider, switch/add chain, wallet lifecycle
  DOM events, mobile MetaMask links, and shared S12 widget sessions.
- Config-driven About, related dapps, escrow and PayPal flows; planned UCAN seam.
- Reduced-motion-aware animated background, versioned vendor manifest and guide.
- S11 reusable release preparation: archive and metadata pins, release CID notes,
  steward minting issue, 1000 supply / 10 USDC / Base / 1000 royalty bps.
- Node test CI for host contract, config, wallet logic and supporter metadata.

## [v1.0.0] — 2026-03-13

**Initial stable, forkable drop-in header for web3 data and IPFS projects.**

### ✨ Features

- **`<decent-header>` Web Component** — Drop-in custom element built with native Web Components / Shadow DOM. No framework, no bundler, no build step required.
- **🦊 MetaMask Wallet Connection** — One-click wallet connect via `ethers.js v6`. Displays the connected address in the header.
- **📡 IPFS Storage via Web3.Storage (W3Up)** — Full IPFS integration for data storage and retrieval using the W3Up browser client, pinned and served from IPFS itself.
- **🏷️ White-label Configuration** — Single `decent.config.js` file to brand your app with a custom name, subtitle, token address, and feature flags. Every key is optional with sensible defaults.
- **📂 Ankh (☥) Dropdown Menus** — Expandable left and right dropdown menus for navigation and tooling actions.
- **🔔 About Modal** — Built-in informational modal (🦚) describing the project, key links, and v1.0.0 features.
- **💳 Subscription Modal** — UI scaffolding for three subscription tiers (Donate, Data Registry Access, Model Library Access) — wired for future payment integration.
- **⏳ IPFS Waiting Modal** — User-friendly progress overlay displayed while IPFS operations are in progress.
- **🌐 OMMM Token Integration (forward-compatible)** — Config supports `tokenAddress`, `tokenSymbol`, and `uniswapUrl` for ERC-20 / Uniswap integration in future releases.
- **🗂️ Asset Path Resolution** — All CSS and image URLs inside shadow roots are resolved via `import.meta.url`, working correctly on both local static servers and GitHub Pages project sites.

### 🛣️ Planned for Future Releases

- ERC-20 token balance display in the header
- Uniswap DEX swap integration
- Liquidity pool tooling
- Subscription payment flows (PayPal & crypto)
- Token-rewarded data sharing

---

[v1.0.0]: https://github.com/TheJollyLaMa/DecentHead/releases/tag/v1.0.0
