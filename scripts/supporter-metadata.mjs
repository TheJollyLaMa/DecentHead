export function buildSupporterMetadata({ repo, version, commit, codeArchiveCid = null, image, externalUrl }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Expected owner/repo');
  if (!version || !/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('Version and full commit SHA required');
  const properties = { repo, version, commit, code_archive_cid: codeArchiveCid,
    license: 'Apache-2.0 + NOTICE', supply: 1000, price: '10 USDC', chain: 'Base', royalty_bps: 1000 };
  return {
    name: `${repo.split('/')[1]} ${version} Supporter DNFT`,
    description: `Support ${repo} ${version}. Source licensed Apache-2.0 + NOTICE. Steward-signed minting; no ownership or financial return promised.`,
    image: image || `https://raw.githubusercontent.com/${repo}/${commit}/img/IPFS_Logo.png`,
    external_url: externalUrl || `https://github.com/${repo}/releases/tag/${encodeURIComponent(version)}`,
    attributes: Object.entries(properties).map(([trait_type, value]) => ({ trait_type, value })), properties,
  };
}
