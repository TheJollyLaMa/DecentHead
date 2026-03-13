# Decent Header

A standalone web3 header component (`<decent-header>`) for the Decent suite of decentralized applications.

## Features

- **IPFS / W3Up status** — connect, upload data snapshots, and browse snapshot history
- **App Title** — animated neon title with left/right ankh (☥) dropdown menus
- **MetaMask wallet connect** — animated ticker circle showing your wallet address
- **Right-Ankh dropdown** — OMMM token balance, Uniswap link, Share Data & Subscribe toggles
- **About modal** — project info and key links
- **Subscription modal** — tiered subscription options

## Live Demo

[https://thejollylama.github.io/DecentHead/](https://thejollylama.github.io/DecentHead/)

## Local Development

No build step required. Serve the repo root as a static site:

```bash
# Option 1 – Python (built-in)
python3 -m http.server 5173
# then open http://localhost:5173/

# Option 2 – Node.js
npx serve .
# then open the URL printed in the terminal
```

## Project Structure

```
DecentHead/
├── index.html            # Demo page
├── css/
│   ├── styles.css        # Global base styles
│   └── header.css        # Header component styles (used inside shadow roots)
├── img/                  # All image assets
└── js/
    ├── main.js           # Entry point – imports & registers all components
    ├── components/
    │   ├── Header.js          # <decent-header> root component
    │   ├── IPFSStatus.js      # <ipfs-status>
    │   ├── AppTitle.js        # <app-title>
    │   ├── WalletConnect.js   # <wallet-connect>
    │   ├── RightAnkhDropdown.js # <right-ankh>
    │   ├── AboutModal.js      # <about-modal>
    │   ├── SubscriptionModal.js # <subscription-modal>
    │   └── IPFSWaitingModal.js  # <waiting-modal>
    └── helpers/
        ├── data/fitnessData.js
        └── ipfs/
            ├── w3upClient.js
            └── uploadToIPFS.js
```

## Asset Path Notes

All CSS and image URLs inside shadow roots are constructed with `import.meta.url` so they resolve correctly on both local static servers and GitHub Pages project sites (e.g., `/DecentHead/css/header.css`). No `<base>` tag tricks required.

## Dependencies (via CDN)

- [ethers.js v6](https://docs.ethers.org/) – wallet & contract interactions
- [W3Up browser client](https://web3.storage/) – IPFS storage
- [Bungee font](https://fonts.google.com/specimen/Bungee) – Google Fonts

## White-Label Configuration

All user-facing strings and DeFi parameters are controlled through a single file,
`decent.config.js`, which is loaded in `index.html` before the component scripts.

### Quick start

1. Open `decent.config.js` in the project root.
2. Edit the values you want to change and save the file.
3. Reload the page — no build step required.

### Available keys

| Key | Type | Default | Description |
|---|---|---|---|
| `appName` | `string` | `'Decent Header'` | Main title displayed in the header |
| `subtitle` | `string` | `'(Another Decent Frankenstein)'` | Tagline below the title |
| `tokenAddress` | `string` | Ommm contract address | ERC-20 contract used for balance lookup |
| `tokenSymbol` | `string` | `'Ommm'` | Symbol shown next to the balance |
| `uniswapUrl` | `string` | Ommm Uniswap page | DEX URL in the right-ankh menu & About modal |
| `enableIPFS` | `boolean` | `true` | Show / hide the IPFS status bar |
| `enableShareData` | `boolean` | `true` | Show / hide the "Share Data" toggle |
| `enableSubscription` | `boolean` | `true` | Show / hide the "Subscribe" toggle & modal |

### Example: renaming the app for a fork

```js
window.DECENT_CONFIG = {
  appName: 'My Web3 Hub',
  subtitle: 'Powered by Decent Head',
  tokenAddress: '0xYourTokenAddressHere',
  tokenSymbol: 'MYT',
  uniswapUrl: 'https://app.uniswap.org/explore/tokens/polygon/0xYourTokenAddressHere',
  enableIPFS: true,
  enableShareData: false,
  enableSubscription: false,
};
```

### Backward compatibility

The config file is entirely optional. If `decent.config.js` is not loaded, or if
any individual key is omitted, every component falls back to its built-in default,
so the project continues to work exactly as before.
