/**
 * decent.config.js — Decent Head Configuration
 *
 * Copy and customise this file when white-labelling or forking Decent Head.
 * All values set here are available to every component via `window.DECENT_CONFIG`.
 *
 * Every key is optional — components fall back to their built-in defaults when
 * a key is missing or when this file is not loaded at all.
 */

window.DECENT_CONFIG = {
  // ── App identity ──────────────────────────────────────────────────────────
  /** Main title text displayed in the header (without decorative symbols). */
  appName: 'Decent Header',

  /** Short tagline rendered below the main title. */
  subtitle: '(Another Decent Frankenstein)',

  // ── Token / DeFi ─────────────────────────────────────────────────────────
  /**
   * ERC-20 token contract address used for balance display in the right-ankh
   * dropdown.  Must be a checksummed Ethereum/Polygon address.
   */
  tokenAddress: '0x1a74f818F1b42dBFcE449c7Fa93B107C6e4A2433',

  /** Human-readable symbol for the token (shown next to the balance). */
  tokenSymbol: 'Ommm',

  /**
   * Full URL of the Uniswap (or other DEX) page for the token.
   * Used in the right-ankh dropdown and the About modal.
   */
  uniswapUrl: 'https://app.uniswap.org/explore/tokens/polygon/0x1a74f818F1b42dBFcE449c7Fa93B107C6e4A2433',

  // ── Feature flags ─────────────────────────────────────────────────────────
  /** Set to false to hide the IPFS / W3Up status bar entirely. */
  enableIPFS: true,

  /** Set to false to hide the "Share Data" toggle in the right-ankh menu. */
  enableShareData: true,

  /** Set to false to hide the "Subscribe" toggle and subscription modal. */
  enableSubscription: true,

  // ── PayPal ─────────────────────────────────────────────────────────────────
  /**
   * PayPal JS SDK client-id for Supporter DNFT purchases ($100 one-time).
   * Use your live client-id for production; use 'test' for sandbox testing.
   * Get your client-id at https://developer.paypal.com/dashboard/
   */
  paypalClientId: 'test',

  /**
   * Admin email address notified (via mailto: link) after a successful PayPal
   * Supporter DNFT purchase.  Admin then manually calls safeTransferFrom to
   * send the DNFT to the buyer's wallet.
   */
  paypalDnftEmail: '',
};
