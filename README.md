# 🦚 Decent Header

> **Drop-in web3 header for static HTML projects** — MetaMask wallet connection + IPFS storage, zero build step.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-00e5ff?style=flat-square)](https://thejollylama.github.io/DecentHead/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## What is DecentHead?

**Decent Head** is a forkable, single-file-drop web3 header component (`<decent-header>`) built for the [Decent Agency](https://github.com/TheJollyLaMa) suite of decentralized applications — but designed to be generic enough for *any* static website that wants a web3 foundation.

### v1 Goals

In this first release, the goals are intentionally focused:

| Goal | Status |
|---|---|
| 🦊 Connect a MetaMask wallet & display the address | ✅ v1 |
| 📡 Connect to IPFS via Web3.Storage (W3Up) | ✅ v1 |
| 🏷️ White-label branding via a single config file | ✅ v1 |
| 📂 Left & right ankh (☥) dropdown menus | ✅ v1 |
| 🔮 ERC-20 token balances, Uniswap, liquidity pools | 🛣️ Future |
| 💎 Subscription tiers & token-rewarded data sharing | 🛣️ Future |

The component uses **Web Components / Custom Elements** with Shadow DOM — no framework, no bundler, no dependencies beyond a couple of CDN scripts.

---

## ⚡ Quick Start — Drop-In Integration

Get Decent Head running in your static HTML project in under 5 minutes.

### 1. Copy the files

```
DecentHead/
├── index.html          ← copy this as your page template, or follow the snippet below
├── decent.config.js    ← copy & edit to brand your app
├── css/
│   ├── styles.css
│   └── header.css
├── img/                ← copy the whole img/ folder
└── js/                 ← copy the whole js/ folder
```

You can fork or download this repo, or copy the folders manually into your project root.

### 2. Add to your HTML

Paste the following into your `<head>` and `<body>`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Web3 App</title>

  <!-- Fonts & base styles -->
  <link href="https://fonts.googleapis.com/css2?family=Bungee&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/styles.css" />
  <link rel="stylesheet" href="css/header.css" />

  <!-- CDN dependencies -->
  <script src="https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.umd.min.js"></script>

  <!-- Optional: customise the header (see decent.config.js below) -->
  <script src="decent.config.js"></script>
</head>
<body>

  <!-- W3Up IPFS client (pinned version hosted on IPFS — CID bafybei…s2mu).
       This is a specific build of the @web3-storage/w3up-client browser bundle.
       You can verify the file at https://bafybeicqxq54ncvkxvwdbov6ljgtyyrcpmek3ic2fxrwwsigmh4ud4s2mu.ipfs.w3s.link/browser.min.js
       and update the CID here if you need a newer version. -->
  <script src="https://bafybeicqxq54ncvkxvwdbov6ljgtyyrcpmek3ic2fxrwwsigmh4ud4s2mu.ipfs.w3s.link/browser.min.js"></script>

  <!-- Drop in the header -->
  <decent-header></decent-header>

  <!-- Your page content goes here -->

  <!-- Load the component -->
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

### 3. Customise via `decent.config.js`

Open `decent.config.js` and edit the values to match your project:

```js
window.DECENT_CONFIG = {
  appName:  'My Web3 Hub',           // title shown in the header
  subtitle: 'Powered by Decent Head', // tagline below the title

  // Feature flags — set to false to hide a section entirely
  enableIPFS:         true,   // IPFS / W3Up status bar
  enableShareData:    false,  // "Share Data" toggle (future feature)
  enableSubscription: false,  // subscription modal (future feature)
};
```

Save the file and reload. **No build step required.**

---

## 📁 Project Structure

```
DecentHead/
├── index.html                    # Demo / template page
├── decent.config.js              # White-label configuration (optional)
├── css/
│   ├── styles.css                # Global base styles
│   └── header.css                # Header component styles (inside shadow roots)
├── img/                          # Image assets (IPFS logo, MetaMask fox, etc.)
└── js/
    ├── main.js                   # Entry point — imports & registers all components
    └── components/
        └── Header/
            ├── Header.js             # <decent-header> root component
            ├── IPFSStatus.js         # <ipfs-status>
            ├── AppTitle.js           # <app-title>
            ├── WalletConnect.js      # <wallet-connect>
            ├── RightAnkhDropdown.js  # <right-ankh>
            ├── AboutModal.js         # <about-modal>
            ├── SubscriptionModal.js  # <subscription-modal>
            └── IPFSWaitingModal.js   # <waiting-modal>
```

> **Entry point:** `js/main.js` — this is the only file your `<script type="module">` needs to load. It registers all custom elements automatically.

---

## ⚙️ Configuration Reference (`decent.config.js`)

All user-facing strings and feature flags live in one file. Every key is optional — components fall back to their built-in defaults if the file is not loaded or a key is omitted.

| Key | Type | Default | Description |
|---|---|---|---|
| `appName` | `string` | `'Decent Header'` | Main title displayed in the header |
| `subtitle` | `string` | `'(Another Decent Frankenstein)'` | Tagline below the title |
| `enableIPFS` | `boolean` | `true` | Show / hide the IPFS status bar |
| `enableShareData` | `boolean` | `true` | Show / hide the "Share Data" toggle |
| `enableSubscription` | `boolean` | `true` | Show / hide the "Subscribe" toggle & modal |

> **Future config keys** (`tokenAddress`, `tokenSymbol`, `uniswapUrl`) are recognised by the config loader but not yet surfaced in the v1 UI. They are documented in the file itself for forward compatibility.

---

## 🔗 Dependencies (CDN — no install needed)

| Library | Purpose |
|---|---|
| [ethers.js v6](https://docs.ethers.org/) | MetaMask wallet & contract interactions |
| [W3Up browser client](https://web3.storage/) | IPFS storage (served from IPFS itself) |
| [Bungee](https://fonts.google.com/specimen/Bungee) | Neon header font (Google Fonts) |

---

## 🛠️ Local Development

No build step required. Serve the repo root as a static site:

```bash
# Python (built-in, zero install)
python3 -m http.server 5173
# → open http://localhost:5173/

# Node.js
npx serve .
# → open the URL shown in the terminal
```

---

## 🗒️ Asset Path Notes

All CSS and image URLs inside shadow roots are resolved with `import.meta.url`, so they work correctly on both local static servers and GitHub Pages project sites (e.g., `/DecentHead/css/header.css`) — no `<base>` tag tricks required.

---

## 🤝 Contributing

Contributions, bug reports, and feature ideas are welcome!

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Make your changes — keep them minimal and focused.
3. Open a Pull Request describing what you changed and why.

Please keep PRs scoped to one concern. The project values simplicity: no bundlers, no frameworks, no unnecessary dependencies.

---

## 📄 License

This project is released under the [MIT License](LICENSE).  
Built with ❣️💗❣️ by ⚕️ 🦚 ⚸ The Jolly LaMa & The RoboSoul 🤖 🦚 ⚕️
