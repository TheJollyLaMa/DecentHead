# Supporter DNFT releases for any Decent dapp

Every Decent dapp uses the same Supporter release pipeline as DecentHead. A dapp adds two small caller
workflows. The rendering, pinning, verification, ENS gate and Discord logic stay here in DecentHead,
pinned to one commit.

## What happens

1. **Publish a GitHub release** (for example `v0.1.0`). This runs `supporter-release.yml`, which:
   - checks out the dapp at that exact tag;
   - screenshots its runnable site for the card front and renders a provenance back;
   - pins the source archive, front and back images, rotating presentation, metadata and the runnable
     site to IPFS;
   - freezes `supporter-release.json` on the release;
   - opens the steward issue **Mint Supporter DNFT for v0.1.0**.
   No transactions are submitted.
2. **The steward reviews ENS, then mints** in their wallet, following the issue checklist.
   ENS can point at the verified exact-commit site before minting. Its controller
   need not have any Base NFT role. Listing/stock transfer requires a separately
   approved primary-sale route; the existing community escrow retains USDC.
3. **Register the public evidence** by running `supporter-announce.yml` with the tag and the
   `mint_evidence` JSON.
4. **The announce workflow** runs on a schedule. It verifies the mint and listing on Base. If
   `SUPPORTER_ENS_NAME` is set, it opens **Point <name> at <version> site** with a one-click signing
   link, and holds Discord until ENS serves the pinned site. Then it posts once to the lobby.
5. **DecentCanopy** picks up the Supporter token and the ENS site on its next refresh.

## Adopt it in a repo

1. Copy [templates/supporter/supporter-release.yml](../templates/supporter/supporter-release.yml) and
   [templates/supporter/supporter-announce.yml](../templates/supporter/supporter-announce.yml) into
   `.github/workflows/`.
2. Replace `DECENTHEAD_SHA` (it appears twice in each file) with one full DecentHead commit SHA from `main`.
   The `uses:` ref and `head_ref` must match.
3. Replace `PRODUCT_NAME` and `PRODUCT_TAGLINE` with the card title and a one-line tagline.
   Set caller input `quantity: '100'` for a 100-edition release, or retain the
   legacy default `'1000'`. These are the supported supplies. The workflow binds
   supply across front/back, metadata, frozen manifest and exact mint verification.
   Set `price_usdc: '100000000'` for 100 Base USDC, or retain the legacy
   `'10000000'` default for 10 USDC. These exact six-decimal amounts are the
   supported prices; artwork, metadata, mint instructions, listing verification
   and Discord use the frozen manifest price. Royalty signal remains 1,000 bps (10%).
   A 100-USDC purchase route includes `priceUSDC=100000000`; old three-parameter
   links remain 10 USDC. Deploy compatible checkout and mint-studio consumers
   before publishing a release that uses the new price.
   Never use a 1,000-edition frozen manifest to mint 100; publish a new version.
4. Add repository secrets:
   - `PINATA_JWT` (required for preparation);
   - `DISCORD_SUPPORTER_WEBHOOK` (the lobby webhook; required for announcements).
5. Add repository variables:
   - `SUPPORTER_ENS_NAME` (optional), e.g. `mydapp.decentagency.eth`. The steward wallet must
     manage this name.
   - `SUPPORTER_DISCORD_ENABLED=true` once the webhook is in place. Until then, announce is skipped.
   - `SUPPORTER_ENS_RPC_URL` (optional). Defaults to the public publicnode mainnet RPC.
6. Add the dapp's ENS name to DecentCanopy `data/agency-map.json` so the map shows its live site.

The repository root must serve the dapp (for example `index.html`), because the card front is a
screenshot of the tagged site.

## Updating the kit

Bump `DECENTHEAD_SHA` in both caller files together. Existing frozen releases are never re-prepared:
a new version gets a new Supporter token.

Protocol details, evidence format and safety rules: [SUPPORTER-RELEASES.md](SUPPORTER-RELEASES.md).
