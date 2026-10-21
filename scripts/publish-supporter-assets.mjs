// Reusable release CLI: publish a frozen manifest and/or register public mint
// evidence once. This never signs transactions or contacts Discord.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateEvidence, validateManifest } from './supporter-protocol.mjs';
const { TAG: tag, GITHUB_REPOSITORY: repo } = process.env;
if (!tag || tag.startsWith('-') || !/^[\w./-]+$/.test(tag) || !/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('TAG and GITHUB_REPOSITORY required');
const args = process.argv.slice(2);
if (args.length !== 2 || !['--manifest', '--evidence'].includes(args[0])) throw new Error('Usage: node scripts/publish-supporter-assets.mjs --manifest FILE | --evidence FILE');
const gh = args => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const release = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'assets,isDraft']));
if (release.isDraft) throw new Error('Published release required');
const manifestMode = args[0] === '--manifest';
const name = manifestMode ? 'supporter-release.json' : 'supporter-evidence.json';
if (release.assets.some(a => a.name === name)) throw new Error(`${name} already registered; refusing replacement`);
const input = JSON.parse(readFileSync(args[1], 'utf8'));
let output;
if (manifestMode) {
  output = validateManifest(input);
  if (output.repo !== repo || output.version !== tag) throw new Error('Manifest release identity mismatch');
} else {
  gh(['release', 'download', tag, '--repo', repo, '--pattern', 'supporter-release.json', '--clobber']);
  const manifest = validateManifest(JSON.parse(readFileSync('supporter-release.json', 'utf8')));
  if (manifest.repo !== repo || manifest.version !== tag) throw new Error('Prepared release identity mismatch');
  output = { schema: 1, repo, version: tag, metadataURI: manifest.metadataURI, mint: validateEvidence(input) };
}
writeFileSync(name, JSON.stringify(output, null, 2) + '\n');
gh(['release', 'upload', tag, name, '--repo', repo]);
console.log(`${name} published; evidence remains unverified until scheduled on-chain verification succeeds.`);
