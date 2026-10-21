// Load before js/main.js. Every setting is optional; never put secrets here.
window.DECENT_CONFIG = {
  version: '2.0.0',
  appName: 'DecentHead',
  subtitle: 'Your dapp. Your data. Your wallet.',
  art: { ipfsIcon: null, titleIcon: null }, // Optional host image URLs; relative to the page.
  theme: { 'bg-1': '#0b1424', 'bg-2': '#192c40', 'bg-3': '#153c38', accent: '#80edd2' },
  chain: { chainId: 8453, chainName: 'Base', rpcUrls: ['https://mainnet.base.org'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] },
  providers: {
    default: 'pinata',
    pinata: { uploadUrl: 'https://api.pinata.cloud/pinning/pinFileToIPFS' },
    local: { apiUrl: 'http://127.0.0.1:5001' },
    gateway: 'https://ipfs.io/ipfs/',
    ucanAuth: null, // Planned: email → UCAN delegation. No authorization flow implemented yet.
  },
  about: {
    title: 'About DecentHead', summary: 'The canonical, customizable web3 boilerplate for Decent dapps.',
    sections: [ { title: 'Own the experience', body: 'Customize one config object and CSS properties. Widgets share a single wallet and IPFS session.' },
      { title: 'Your data stays yours', body: 'The host dapp chooses backup contents, validates restored data, and controls opt-in pinning reward participation.' } ],
  },
  links: [{ label: 'Source · Apache-2.0 + NOTICE', url: 'https://github.com/TheJollyLaMa/DecentHead' }],
  relatedDapps: [ { label: 'DecentBusking', url: 'https://github.com/TheJollyLaMa/DecentBusking' },
    { label: 'DecentCanopy', url: 'https://github.com/TheJollyLaMa/DecentCanopy' } ],
  supporterDnft: null, // See the complete listing / PayPal example in docs/ADOPTING.md.
  // ipfsAdapter: yourVersion1HostAdapter,
  // data: { export: async () => selectedData, import: async data => validateAndRestore(data) },
};
