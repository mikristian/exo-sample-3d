/* Explicitly curated published artifacts only. Never guess a GitHub release URL.
 * This historical beta is not the updated Studio V2 Mac application. */
const RELEASES = Object.freeze({
  mac: Object.freeze({
    url: 'https://github.com/mikristian/exo-sample-3d/releases/download/v0.3.0-beta.1/EXO-ClothCraft-Studio-V2-macOS-arm64-v0.3.0-beta.1-UNNOTARIZED.dmg',
    version: 'v0.3.0 Beta 1 (legacy)',
    architecture: 'Apple Silicon arm64',
    label: 'legacy Mac beta',
    verified: true,
    unnotarized: true,
  }),
  windows: null,
});

for (const [platform, info] of Object.entries(RELEASES)) {
  const anchor = document.getElementById(`${platform === 'windows' ? 'win' : platform}-download`);
  const status = document.getElementById(`${platform === 'windows' ? 'win' : platform}-status`);
  const note = document.getElementById(`${platform === 'windows' ? 'win' : platform}-note`);
  if (!anchor || !status || !note || !info) continue;
  if (info.verified !== true || !/^https:\/\/github\.com\/mikristian\/exo-sample-3d\/releases\/download\//.test(info.url)) continue;
  anchor.href = info.url;
  anchor.textContent = `Download ${info.label}`;
  anchor.classList.remove('is-disabled');
  anchor.removeAttribute('aria-disabled');
  status.textContent = `${info.version} available`;
  note.textContent = info.unnotarized
    ? `Earlier ${info.architecture} beta only — not the current Studio V2 build. Unnotarized; macOS may block opening it.`
    : `Verified ${info.version} · ${info.architecture} · See release notes`;
}
