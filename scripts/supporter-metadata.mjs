export function supporterQuantity(value = '1000') {
  if (!['100', '1000'].includes(value)) throw new Error('Supporter quantity must be 100 or 1000');
  return value;
}

export function buildSupporterMetadata({ repo, version, commit, codeArchiveCid = null, image, externalUrl, release }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('Expected owner/repo');
  if (!version || !/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('Version and full commit SHA required');
  const properties = { repo, version, commit, code_archive_cid: codeArchiveCid,
    license: 'Apache-2.0 + NOTICE', supply: Number(supporterQuantity(release?.quantity)), price: '10 USDC', chain: 'Base', royalty_bps: 1000 };
  if (release) Object.assign(properties, {
    release_date: release.releaseDate, creator: release.creator, creator_address: release.creatorAddress,
    back_image: release.back, presentation: 'Self-contained rotatable front/back HTML',
    product: {
      version, repo_url: `https://github.com/${repo}`,
      commit: `https://github.com/${repo}/commit/${commit}`,
      artifact_cid: codeArchiveCid ? `ipfs://${codeArchiveCid}` : null,
      ...(release.siteCid ? { site: `ipfs://${release.siteCid}` } : {}),
      ...(release.ensName ? { ens: release.ensName } : {}),
    },
  });
  if (release?.siteCid) properties.site_cid = release.siteCid;
  if (release?.ensName) properties.ens_name = release.ensName;
  return {
    name: `${repo.split('/')[1]} ${version} Supporter DNFT`,
    description: `Support ${repo} ${version}. Source licensed Apache-2.0 + NOTICE. Steward-signed minting; no ownership or financial return promised.`,
    image: image || `https://raw.githubusercontent.com/${repo}/${commit}/img/IPFS_Logo.png`,
    ...(release ? { animation_url: release.animation } : {}),
    external_url: externalUrl || `https://github.com/${repo}/releases/tag/${encodeURIComponent(version)}`,
    attributes: Object.entries(properties).filter(([, value]) => value === null || typeof value !== 'object').map(([trait_type, value]) => ({ trait_type, value })), properties,
  };
}
