import '../js/main.js';
import { config } from '../js/config.js';
import { loadEthers, wallet } from '../js/wallet.js';
import { ENS_REGISTRY, NAME_WRAPPER, decodeContenthash, encodeContenthash, parseEnsDeployLink } from '../js/ens-content.js';

const MAINNET = { chainId: 1, chainName: 'Ethereum', rpcUrls: [config.ens.rpcUrl],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://etherscan.io'] };
const $ = id => document.getElementById(id);
const status = $('status'), sign = $('sign');
const say = (text, tone = '') => { status.textContent = text; status.className = tone; };
const link = (href, text) => Object.assign(document.createElement('a'), { href, textContent: text, target: '_blank', rel: 'noopener' });

async function readState(ethers, provider, name) {
  const node = ethers.namehash(name);
  const registry = new ethers.Contract(ENS_REGISTRY, ['function owner(bytes32) view returns (address)', 'function resolver(bytes32) view returns (address)'], provider);
  const [registryOwner, resolver] = await Promise.all([registry.owner(node), registry.resolver(node)]);
  const owner = registryOwner.toLowerCase() === NAME_WRAPPER.toLowerCase()
    ? await new ethers.Contract(NAME_WRAPPER, ['function ownerOf(uint256) view returns (address)'], provider).ownerOf(BigInt(node))
    : registryOwner;
  const contenthash = resolver === ethers.ZeroAddress ? '0x'
    : await new ethers.Contract(resolver, ['function contenthash(bytes32) view returns (bytes)'], provider).contenthash(node);
  return { node, owner, resolver, cid: decodeContenthash(contenthash) };
}

try {
  const target = parseEnsDeployLink(location.search);
  const ethers = await loadEthers();
  const reader = new ethers.JsonRpcProvider(config.ens.rpcUrl, 1, { staticNetwork: true });
  $('name').replaceChildren(link(`https://${target.name}.limo`, target.name));
  $('release').textContent = target.repo ? `${target.repo} ${target.version}` : 'unspecified';
  $('next').replaceChildren(link(`https://ipfs.filebase.io/ipfs/${target.cid}/`, `ipfs://${target.cid}`));
  const show = state => {
    $('owner').textContent = state.owner;
    $('resolver').textContent = state.resolver;
    $('current').textContent = state.cid ? `ipfs://${state.cid}` : 'none';
  };
  let state = await readState(ethers, reader, target.name);
  show(state);
  if (state.owner === ethers.ZeroAddress) throw new Error(`${target.name} is not registered.`);
  if (state.resolver === ethers.ZeroAddress) throw new Error(`${target.name} has no resolver; set one in the ENS app first.`);
  if (state.cid === target.cid) {
    say('ENS already serves this release. Nothing to sign; the announce workflow will pick it up.', 'ok');
  } else {
    say(`Connect ${state.owner} to point ${target.name} at the new site.`);
    sign.disabled = false;
    sign.onclick = async () => {
      sign.disabled = true;
      try {
        if (!wallet.snapshot().connected) await wallet.connect();
        const provider = await wallet.ensureChain(MAINNET);
        const signer = await provider.getSigner();
        const account = await signer.getAddress();
        if (account.toLowerCase() !== state.owner.toLowerCase()) throw new Error(`Connected ${account}, but only the owner ${state.owner} can set this record.`);
        const resolver = new ethers.Contract(state.resolver, ['function setContenthash(bytes32,bytes)'], signer);
        say('Confirm the transaction in your wallet…');
        const tx = await resolver.setContenthash(state.node, encodeContenthash(target.cid));
        say('Submitted. Waiting for confirmation… ');
        status.append(link(`https://etherscan.io/tx/${tx.hash}`, tx.hash.slice(0, 12) + '…'));
        await tx.wait();
        state = await readState(ethers, reader, target.name);
        show(state);
        if (state.cid !== target.cid) throw new Error('Transaction confirmed, but ENS does not yet report the new content; refresh in a minute.');
        say(`Done: ${target.name} now serves ipfs://${target.cid}. The announce workflow will record it and post to Discord.`, 'ok');
      } catch (error) {
        say(error.shortMessage || error.message, 'warn');
        sign.disabled = false;
      }
    };
  }
} catch (error) {
  say(error.message, 'warn');
}
