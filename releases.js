/* Explicitly published Mac install package; download directly from GitHub Releases. */
const RELEASES = Object.freeze({
  mac: Object.freeze({
    url: 'https://github.com/mikristian/exo-sample-3d/releases/download/v0.3.0-dev-20261101/EXO-ClothCraft-Studio-V2-macOS-Apple-Silicon-2026-11-01.dmg',
    version: 'EXO ClothCraft Studio V2',
    architecture: 'Apple Silicon arm64',
    label: 'for Mac',
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
    ? `${info.architecture} · Apple notarization unavailable; macOS may require Open Anyway.`
    : `Verified ${info.version} · ${info.architecture} · See release notes`;
}
