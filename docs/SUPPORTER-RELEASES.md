# Supporter release protocol

Standard: 1,000 ERC-1155 product editions on Base; **$10 (10 USDC,
10,000,000 base units)**, no ETH purchase quote. Every preparation has a front
showing the actual tagged product header, a provenance back, and a self-contained
click/tap/keyboard-rotatable front/back HTML presentation. The front is metadata
`image`, the back is `properties.back_image`, and HTML is `animation_url`.
Wallet/viewer HTML support varies: **MetaMask HTML rendering is not promised**.
DecentMarket consumes `image` and `properties.back_image` as a thin two-sided 3D
collectible in its product gallery; older single-image editions remain sprites.
Its detail panel can flip either face explicitly. Automatic collectible rotation
stops under reduced motion.

## Prepare (not mint)

1. Review the product release tag and publish the GitHub release. Use the
   `supporter-dnft-release.yml` release trigger or reusable workflow. The reusable
   inputs are `tag`, `release_date` (canonical UTC, e.g.
   `2026-10-21T20:00:00.000Z`), and `ens_rpc_url` (public credential-free Ethereum
   mainnet RPC). On release events, the frozen date is GitHub `published_at`,
   canonicalized to UTC. Configure repository variable `SUPPORTER_ENS_RPC_URL`.
   This is a **release date**, never a claim of a confirmed minted date.
2. Configure secret **`PINATA_JWT`**. The preparation workflow provisions
   Playwright/Chromium, serves the tagged checkout locally, and resolves
   `thejollylama.eth` through mainnet ENS before rendering. Failure to resolve
   stops preparation: there is no placeholder wallet or fake address fallback.
   Both identity and resolved address are visibly stamped on both faces;
   `ensObservedBlock` records when resolution was observed (not historical proof).
3. Review all uploaded assets and `supporter-release.json`. It freezes source
   commit, version, release date, creator/address, $10 price, quantity, front,
   back, animation and metadata URI. Preparation refuses replacement once this
   manifest exists; corrections need a new version. Treat release asset editing
   privileges as trusted: GitHub assets are not a cryptographic immutability
   guarantee. Never replace a prepared manifest after mint.
4. Follow the generated steward issue and sign only in a wallet. Confirm the
   deployed ABI: `DecentNFT_v0.2.registerToken(maxSupply, tokenURI, kind,
   royaltyReceiver, royaltyFeeBps)`, Product kind `0`, then `mintProduct`.
   Deposit to escrow and `listDNFT(nftContract, tokenId, 0, BaseUSDC, 10000000,
   quantity, note)`. Preparation submits **no transactions** and is not minting.
   Royalties are not universally enforced; this is support, not promised profit.

Pin order avoids cycles: source/archive and front/back/HTML → metadata → release
manifest. The embedded HTML contains its own PNGs and needs no remote scripts.
Metadata does not refer back to its own CID or to the later manifest.

The renderer writes `supporter-front.png`, `supporter-back.png`,
`supporter-presentation.html`, and `supporter-artwork.json` at repository root.
It also refreshes legacy `img/supporter-dnft.png` with the identical new front.
Render from the exact release checkout before preparing; do not reuse a stale
legacy image. Supply the release tag verbatim (no implicit `v` prefix).

## Release site pin and ENS deployment (post-mint gate)

Preparation also pins the **runnable site at the exact release commit**: every
tracked blob except dot-paths (`.github`, `.gitignore`, …), symlinks and
submodules, uploaded as one CIDv1 folder named after the repository. This is the
same rule DecentCanopy uses for repo pins, so both produce the same CID for the
same commit. The manifest records `siteCid` and, when repository variable
**`SUPPORTER_ENS_NAME`** (e.g. `decenthead.decentagency.eth`) is set, `ensName`.
Metadata exposes them as `properties.site_cid`, `properties.ens_name` and
`properties.product.site`. Both fields are optional, so older frozen manifests
stay valid.

After the announce workflow verifies the mint and listing, it reads the name's
mainnet contenthash (`SUPPORTER_ENS_RPC_URL`, default publicnode):

- **matches `siteCid`** → uploads `supporter-ens-deployed.json` (name, CID,
  owner, resolver, time), closes the steward issue, then announces on Discord
  with a `https://<name>.limo` link;
- **already serves a newer prepared release of the same name** → recorded as
  `superseded` and announced, never rolled back;
- **anything else** → opens or refreshes the issue *"Point `<name>` at `<version>`
  site"* and **withholds Discord** (the run succeeds; it is pending, not failed).

The issue links to [`supporter/ens.html`](../supporter/ens.html)
(`?name=&cid=&repo=&version=`). That page reads owner, resolver and the current
content, refuses any wallet other than the owner (NameWrapper-aware), switches to
Ethereum mainnet and sends one `setContenthash`. No ENS key is ever in CI. Without
`SUPPORTER_ENS_NAME` the site is still pinned and announcement behaves as before.

## Verify and announce after wallet transactions

Create a lobby webhook named **Decent DNFT Bot**. Store it only as secret
**`DISCORD_SUPPORTER_WEBHOOK`**; never put it in evidence, config, logs or artwork.
Set repository variable **`SUPPORTER_DISCORD_ENABLED=true`** after provisioning
the secret. The notification job is explicitly disabled until this opt-in;
DecentHead ships with that variable set to `false`.
No webhook is posted during preparation or local tests. No signing keys belong
in CI. After signing, **register public evidence once per release**. The
`supporter-announce.yml` dispatch takes the prepared `tag` and optional
`mint_evidence` JSON. Supplied evidence is saved as `supporter-evidence.json`
before verification; omit that input on subsequent runs. All evidence is public;
never include credentialed RPCs:

```json
{
  "chainId": 8453,
  "rpcUrl": "https://mainnet.base.org",
  "mintTxHash": "REPLACE_WITH_REAL_0x_TRANSACTION_HASH",
  "nftContract": "0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B",
  "tokenId": "REPLACE_WITH_DECIMAL_TOKEN_ID",
  "escrow": "0x31b07b83e99A9bdF379bf40225b8A80d3804C89d",
  "listingId": "REPLACE_WITH_DECIMAL_LISTING_ID",
  "confirmations": 12,
  "purchaseUrl": "https://PRODUCT_HOST/supporter/buy.html?chainId=8453&escrow=0x31b07b83e99A9bdF379bf40225b8A80d3804C89d&listingId=REAL_LISTING_ID"
}
```

**Automatic part:** on the default branch, the workflow runs at minutes 17 and
47 each hour (GitHub scheduling is best effort). It paginates published releases
and selects those with a prepared manifest plus registered evidence and no sent
marker. For each, it independently verifies confirmed/current chain state and
automatically sends once checks succeed. A mint awaiting confirmations or a
not-yet-stocked listing is retried on later schedules. One invalid release does
not prevent other pending releases being processed; the run fails if any selected
entry fails. Published/edited release events also check the relevant tag.
GitHub has no dedicated release-asset-upload event; uploads alone are picked up
by the next schedule. Events produced by `GITHUB_TOKEN` need not trigger other
workflows, so the schedule is the reliable fallback.

**Not installed:** an on-chain mint event watcher or historic log scanner. A
new mint with no registered evidence is deliberately **not** announced. This
bounded evidence-registration design avoids public RPC log-range limits and
cannot discover arbitrary mint transactions unaided. The steward must register
the transaction, token and listing identifiers after signing, once per version.
Dispatch registration immediately proceeds to verification; CLI registration
waits for a scheduled/event check unless explicitly dispatched.

CLI registration (authenticated `gh`, no webhook needed):

```sh
GITHUB_REPOSITORY=OWNER/PRODUCT TAG=vVERSION \
  node scripts/publish-supporter-assets.mjs --evidence path/to/public-mint.json
```

The input file is the raw evidence object above. The uploaded envelope is:
`{schema:1, repo, version, metadataURI, mint: evidence}`. Both CLI and verifier
reject unapproved contract addresses before delivery. Evidence references the
prepared metadata URI; it is still an unverified claim until runtime RPC checks.
The verifier also accepts the unchanged raw `supporter-evidence.json` exported
by Market Studio and attached to its official release. It still binds that
evidence to the release through the actual mint receipt, token URI and listing;
an existing public evidence asset is never rewritten just to wrap it.
The CLI refuses replacement; if a steward registered incorrect evidence,
reconcile any possible Discord delivery first, then explicitly remove only the
incorrect evidence asset and register corrected public evidence.

External preparation tooling can publish the same validated, canonical manifest:

```sh
GITHUB_REPOSITORY=OWNER/PRODUCT TAG=vVERSION \
  node scripts/publish-supporter-assets.mjs --manifest path/to/prepared.json
```

This uploads it as `supporter-release.json`, checks repo/version, and refuses
replacement. It does **not** pin assets, verify artwork, sign or send Discord.
The normal preparation script already uploads that manifest and its assets.

The script downloads the release's preparation manifest; submitted fields are
**claims, not verification**. The verifier uses the public RPC to check:

- chain 8453; successful receipt and at least 12 confirmations;
- fixed approved Base NFT `0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B`
  and escrow `0x31b07b83e99A9bdF379bf40225b8A80d3804C89d` (DecentMarket
  deployed addresses); arbitrary form-supplied contracts fail closed;
- the exact transaction and NFT contract; zero-from ERC-1155 `TransferSingle`
  or `TransferBatch` mint for the specified token totaling exactly 1,000;
- on-chain `uri(tokenId)` exactly equals prepared pinned metadata URI;
- `DecentEscrow_v001.listings` has the same NFT/token, is active with positive
  stock, escrow is not paused, and balance covers stock;
- only Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
  price `10000000`, `priceETH == 0`;
- listing/metadata/balance at a confirmed block **and** latest state; purchase
  URL is reachable without a redirect and binds chain/escrow/listing in query.

ABIs were read from DecentMarket's `DecentNFT_v0.2.sol` and
`DecentEscrow_v001.sol`. An incompatible deployed ABI must fail, not guess.
This verifies a stocked offer, not a buyer's completed purchase. A steward must
test that the product's purchase route actually consumes those query parameters,
displays the verified item and invokes the right escrow. HTTP reachability
cannot establish frontend behavior. Approval/USDC, changed state, RPC honesty,
reorgs, contract upgrades and other concurrent listings can still affect buying.
No financial-return guarantee or universal royalty claim is made.

The workflow publishes `supporter-minted.json` containing the public evidence
and verified block, then posts a short blurb, front image and purchase link.
It suppresses Discord mentions (`allowed_mentions.parse = []`).
The release asset `supporter-discord-sent.json` persists repo+version delivery;
reruns check it before sending. Preparation and announcement share the same
repository-wide concurrency group, without cancellation, including registration,
preparation, scheduled runs and dispatches. Direct external CLI asset uploads
must not run concurrently with these workflows.

**Delivery crash window:** before sending, the workflow uploads
`supporter-discord-pending.json`. If Discord acknowledgement or the final
marker upload fails, later scheduled runs refuse to send again while this
claim exists. Verification failures before that claim are automatically retried;
ambiguous delivery requires manual reconciliation instead of risking a duplicate.
This is not exactly-once delivery. Inspect the lobby, recover the message ID and
upload a sent marker with `repo`, `version`, `sentAt` (UTC), and `messageId`.
Only if you establish that nothing was delivered should you explicitly remove
the pending claim to permit a new attempt. Never delete a valid sent marker to
replay automatically.

## Adoption and remaining gates

Each product needs its own reviewed tagged header/card and these scripts,
vendored ethers, workflows and renderer dependencies. Copy the protocol and
customize only the product's visual copy, not price/creator/schema checks.
Alternatively call the preparation/announcement workflows at a reviewed pinned
commit with explicit inputs and secrets; checkout runs in the caller repository,
so the caller must still carry the compatible scripts/card/vendor files.
Include the pinned Playwright dev dependency and lockfile used by `npm ci`.
Grant `contents: write` and `issues: write` (preparation and announcement), configure
`PINATA_JWT`, `SUPPORTER_ENS_RPC_URL`, optional `SUPPORTER_ENS_NAME`, `SUPPORTER_DISCORD_ENABLED=true`, and
`DISCORD_SUPPORTER_WEBHOOK`. Tags must
already contain this tooling. No event watcher, cross-repo installation,
contract deployment, mint, listing or purchase is performed by adding these
files. **Deploy the workflow on the default branch and enable scheduled Actions**
for automatic verification/delivery after evidence registration. Calling the
reusable workflow alone does not install a schedule in another repository;
adopters must add their own scheduled caller (omit `tag` to scan pending entries)
or copy this workflow.

The current preview was rendered using a real mainnet resolution of
`thejollylama.eth`; preparation repeats this for the actual release timestamp.
The purchase route is `supporter/buy.html` and is browser-tested with synthetic
listings. DecentMarket's front/back mesh path is validated with Three.js.
Remaining live gates: review of the actual release artwork, IPFS pins,
steward-signed mint/deposit/listing, a real-listing purchase check, public
evidence registration, webhook provisioning, and adopting this protocol in
each other product repository. No token or announcement is fabricated by tests.

Local verification (no RPC, Discord or signing):
`node --test test/supporter-protocol.test.mjs`.
