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
  switch/add, account/network/disconnect events, and MetaMask mobile links.
  Click the fox again to disconnect this dapp. Mainnet ENS reverse names are
  forward-verified before display, with an address fallback on failure.
  Four ENS/ETH Breathe icons orbit the button; bundled chain glyphs mark the
  connected Base, Ethereum, or Optimism network. Text and icons share one rotor,
  with a reserved icon arc on the same radius, so they stay aligned.
- **About:** text-only configured sections, links, related dapps, supporter
  contract/token/chain/market links, and optional escrow/PayPal purchase paths.
  Both dialogs use compact expandable sections, a sticky close button, Escape,
  and outside-click dismissal. Credentials and advanced fields start collapsed.
- **Ankh menus:** themed left/right title controls expose **Admin** and
  **My Profile** placeholders. Item clicks intentionally do nothing; no account
  access, navigation or privileges are attached. Escape/outside click closes them.
- **Theme:** inherited CSS properties `--dh-bg-1`, `--dh-bg-2`, `--dh-bg-3`,
  `--dh-accent`, `--dh-accent-2`, `--dh-title`, `--dh-title-font`, `--dh-text`, `--dh-muted`,
  `--dh-glow-opacity`, `--dh-orbit-size`, `--dh-orbit-size-mobile`.
  Override `art.ipfsIcon`, `art.titleIcon`, `art.walletIcon`, `art.titleEnds`, and
  `--dh-background-image` for host art.
- **Look:** the Decent orbit style shared by DecentBusking, DecentCanopy, and ArtFi:
  an IPFS orbit on the left, a MetaMask fox orbit on the right whose ring spells out the
  verified ENS name/address, a neon title, and pulsing wires between them. All motion stops
  under `prefers-reduced-motion`.
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

Unit tests need no package install. They cover the host contract, nested config,
wallet/ENS lifecycle, verified mint/listing evidence, delivery deduplication,
purchase-route validation, and S11 metadata.
`test/ipfs-host.html` is a synthetic host fixture, not a storage verification.
For optional browser checks, run `npm ci` and `npx playwright install chromium`,
serve the repo and run
`BASE_URL=http://localhost:8080 node test/browser-smoke.mjs` with Playwright
available. `PLAYWRIGHT_MODULE` can point to an existing installation;
`SCREENSHOT_DIR` enables desktop/mobile/provider/About/wallet screenshots.
The smoke script uses only mocked provider/wallet data and makes no real uploads.

## Supporter DNFT release preparation (S11)

`.github/workflows/supporter-dnft-release.yml` runs for published releases or
as a reusable `workflow_call` with an existing release tag, frozen release date
and public mainnet ENS RPC. It renders the actual tagged header, stamps the
creator ENS/address, date, version and $10 price, then pins the source,
front/back artwork, rotatable HTML and metadata using `PINATA_JWT`. Missing
inputs fail explicitly. It updates release notes and opens a steward minting
issue. Defaults: 1000 supply, 10 USDC, Base, 1000
royalty bps. **No keys, signing, minting, tags, or releases are created by it.**
The steward must verify the deployed contract ABI, mint, deposit/list in
escrow, and configure the resulting addresses/IDs. Repositories reusing the
workflow must vendor the compatible scripts/card/ethers and pinned renderer
dependency, grant contents and issues write permissions, and configure secrets
and public variables as described in the [shared release protocol](docs/SUPPORTER-RELEASES.md).

**Artwork.** Preview `supporter-front.png`, `supporter-back.png`, and
`supporter-presentation.html`. Regenerate from the served checkout with
`RELEASE_DATE=2026-10-21T20:50:34.000Z ENS_RPC_URL=https://ethereum-rpc.publicnode.com BASE_URL=http://127.0.0.1:8790 node scripts/render-supporter-image.mjs v2.0.0`.
The address is resolved from `thejollylama.eth`; there is no placeholder fallback.
CI regenerates at the actual release date before pinning. The front is the
standard wallet/Discord image; HTML front/back support depends on the viewer.

**Lobby announcements.** A reusable scheduled workflow verifies registered mint
evidence, confirmed metadata and a stocked $10 USDC listing before posting the
front image, purchase link and release blurb to a Discord webhook named
**Decent DNFT Bot**. Configure `DISCORD_SUPPORTER_WEBHOOK` and opt in with
`SUPPORTER_DISCORD_ENABLED=true`. Register public evidence once after signing;
the checks and announcement then run automatically. Durable delivery claims
prevent automatic repeat sends after an ambiguous failure. See the protocol
for setup, recovery, and other-product adoption. No bot is connected until
the webhook is provisioned.

## Planned authorization

`providers.ucanAuth` is a reserved, currently inert extension point for the
future email → UCAN delegation flow. The design should reuse ArtFi’s browser
identity/delegation implementation; see [the adoption notes](docs/ADOPTING.md#planned-ucan-authorization).
No email authorization or delegation verification is claimed in v2.

## Breaking changes

v2 removes the retired storage client and its email login. There is no automatic
fitness-data/localStorage snapshotting or automatic wallet connection. Old
identity settings still work, but legacy token/subscription flags and ankh-menu
actions are not part of the v2 head. The new ankh menus are inert skeletons.
Configure `ipfsAdapter` or explicit `data` hooks,
`chain`, and `supporterDnft`; see the adoption guide for migration details.

## 📄 License

Code: [Apache-2.0](LICENSE) · Art and docs: [CC BY 4.0](LICENSES/CC-BY-4.0.txt) · Please keep the [NOTICE](NOTICE) and give The Jolly LaMa / A Decent Agency a head nod when you reuse this work.
Support the work with a [Supporter DNFT](https://thejollylama.github.io/DecentMarket/).  
Built with ❣️💗❣️ by ⚕️ 🦚 ⚸ The Jolly LaMa & The RoboSoul 🤖 🦚 ⚕️

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.
