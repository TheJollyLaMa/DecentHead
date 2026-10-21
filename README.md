# DecentHead v2

The canonical Decent dapp boilerplate head: IPFS on the left, a configurable
About title in the center, and a consent-driven wallet session on the right.
Static ES modules and native custom elements. No framework, bundler, or build.

## Start

Serve this directory over HTTP (for example `python3 -m http.server 8080`),
then open `http://localhost:8080`. Edit **decent.config.js** before the module
loads to configure identity, theme, chain, About sections, links, and supporter
listings. No credentials belong in this public file.

- **IPFS:** Pinata by default, your own JWT/key, or IPFS Desktop/local Kubo.
  Provider selection does not upload anything. Backup/restore uses host-owned
  data hooks or the version 1 [host contract](docs/IPFS-HOST.md). Community
  pinning is opt-in, separate from reward eligibility and payouts.
- **Wallet:** EIP-6963 discovery (MetaMask preferred), injected-provider fallback,
  ethers v6 BrowserProvider, click-only account access, configured-chain
  switch/add, account/network/disconnect events, local forget, and MetaMask
  mobile links. No cross-chain ENS lookups are made just to label the button.
- **About:** text-only configured sections, links, related dapps, supporter
  contract/token/chain/market links, and optional escrow/PayPal purchase paths.
- **Theme:** inherited CSS properties `--dh-bg-1`, `--dh-bg-2`, `--dh-bg-3`,
  `--dh-accent`, `--dh-title`, `--dh-text`, `--dh-muted`, `--dh-glow-opacity`.
  Override `art.ipfsIcon`, `art.titleIcon`, and `--dh-background-image` for host art.
  The subtle animated background honors reduced-motion preferences.
- **Widgets (S12):** `window.DecentHead.getIpfs()`, `.getWallet()`, and
  `.on('wallet', callback)` reuse the page’s shared sessions.

## Adopt / vendor

[docs/ADOPTING.md](docs/ADOPTING.md) is the distribution manifest and migration
guide. Vendor the documented files into `vendor/decent-head/2.0.0/`, keep their
relative layout and licenses, and copy **decent-head.config.js** for your host.
Vendored ethers 6.16.0 loads locally only on wallet use; its MIT license is in
`js/vendor/ethers.LICENSE.md`.

## Validate

```sh
npm test
```

No package install is needed. Unit tests cover the host contract, nested config
merge, chain switch/add, wallet discovery, and S11 supporter metadata.
`test/ipfs-host.html` is a synthetic host fixture, not a storage verification.
For optional browser checks, serve the repo and run
`BASE_URL=http://localhost:8080 node test/browser-smoke.mjs` with Playwright
available. `PLAYWRIGHT_MODULE` can point to an existing installation;
`SCREENSHOT_DIR` enables desktop/mobile/provider/About/wallet screenshots.
The smoke script uses only mocked provider/wallet data and makes no real uploads.

## Supporter DNFT release preparation (S11)

`.github/workflows/supporter-dnft-release.yml` runs for published releases or
as a reusable `workflow_call` with an existing release tag and optional image.
It archives the tag, pins source and metadata using `PINATA_JWT` (or emits a
notice and explicit missing-CID markers), updates release notes, and opens an
idempotent steward minting issue. Defaults: 1000 supply, 10 USDC, Base, 1000
royalty bps. **No keys, signing, minting, tags, or releases are created by it.**
The steward must verify the deployed contract ABI, mint, deposit/list in
escrow, and configure the resulting addresses/IDs. Repositories reusing the
workflow must vendor the two `scripts/*supporter*.mjs` files, grant contents and
issues write permissions, and configure the image if they lack our default.

## Planned authorization

`providers.ucanAuth` is a reserved, currently inert extension point for the
future email → UCAN delegation flow. The design should reuse ArtFi’s browser
identity/delegation implementation; see [the adoption notes](docs/ADOPTING.md#planned-ucan-authorization).
No email authorization or delegation verification is claimed in v2.

## Breaking changes

v2 removes the retired storage client and its email login. There is no automatic
fitness-data/localStorage snapshotting or automatic wallet connection. Old
identity settings still work, but token/subscription flags and ankh menus are
not part of the v2 head. Configure `ipfsAdapter` or explicit `data` hooks,
`chain`, and `supporterDnft`; see the adoption guide for migration details.

## 📄 License

Code: [Apache-2.0](LICENSE) · Art and docs: [CC BY 4.0](LICENSES/CC-BY-4.0.txt) · Please keep the [NOTICE](NOTICE) and give The Jolly LaMa / A Decent Agency a head nod when you reuse this work.
Support the work with a [Supporter DNFT](https://thejollylama.github.io/DecentMarket/).  
Built with ❣️💗❣️ by ⚕️ 🦚 ⚸ The Jolly LaMa & The RoboSoul 🤖 🦚 ⚕️

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.
