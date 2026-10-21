import '../js/main.js';
import { config } from '../js/config.js';
import { loadEthers } from '../js/wallet.js';
import { parseSupporterPurchase, validateSupporterPurchase, SUPPORTER_ESCROW_ABI } from '../js/supporter-purchase.js';

const status = document.getElementById('status'), review = document.getElementById('review');
let provider;
try {
  const selection = parseSupporterPurchase(location.search);
  const ethers = await loadEthers();
  provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  if ((await provider.getNetwork()).chainId !== BigInt(selection.chainId)) throw new Error('Listing RPC is not on Base.');
  const escrow = new ethers.Contract(selection.escrow, SUPPORTER_ESCROW_ABI, provider);
  const listing = await escrow.getListing(selection.listingId);
  validateSupporterPurchase(listing, await escrow.getNFTBalance(listing.nftContract, listing.tokenId), await escrow.paused());
  config.supporterDnft = {
    title: `${config.appName} Supporter edition · $10 USDC`,
    contract: selection.nft, tokenId: listing.tokenId.toString(), escrowAddress: selection.escrow,
    listingId: selection.listingId, paymentToken: selection.usdc, expectedPriceAmount: '10000000',
    chain: { chainId: 8453, chainName: 'Base', rpcUrls: ['https://mainnet.base.org'],
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] },
  };
  status.textContent = `Verified $10 USDC listing #${selection.listingId} · token #${listing.tokenId}.`;
  review.hidden = false;
  review.onclick = () => {
    const modal = document.querySelector('decent-header').shadowRoot.querySelector('about-modal');
    modal.render();
    modal.open();
  };
} catch (error) {
  status.textContent = `Purchase unavailable: ${error.shortMessage || error.message}`;
  status.setAttribute('role', 'alert');
} finally { provider?.destroy(); }
