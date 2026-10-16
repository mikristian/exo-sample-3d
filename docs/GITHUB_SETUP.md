# Publishing Garment Studio on GitHub

The local Git history is preserved. Publish only **after** reviewing staged
source changes and signing into the GitHub account that should own the repo.
Use a private repository by default because the application, third-party
asset notices and production-fit validation are not ready for public release.

## What belongs in this repository

- First-party React app, JavaScript CAD and fabric tools, scripts and tests
- Optional Rust PPF backend **integration** (not a copied third-party solver)
- Native app / experimental C++ sources, kept as optional research components
- Readmes, contributor guidance, license and GitHub Actions workflows

Generated binaries, Qt SDKs, CMake directories, proprietary CLO avatars,
locally cloned upstream code, model datasets, logs, videos and credentials are
excluded by `.gitignore`; retain them on your workstation/backups.

## GitHub login and first push

Install the official GitHub CLI (https://cli.github.com/) and authenticate:

```bash
gh auth login --web
gh auth status
```

From the Garment Studio project directory, after its reviewed initial commit:

```bash
gh repo create garment-studio --private --source=. --remote=origin --push
```

Do not run `gh repo create` twice. If the remote repository already exists,
configure its URL using `git remote add origin <your-repo-URL>` and use
`git push -u origin main` instead. Never force-push without reviewing the
remote history. Keep generated artifacts outside Git or in intentionally
managed release artifacts/storage if distribution is authorized.

Verify from GitHub that the `main` branch, documentation, source and
workflows are all visible. A passing source build does not certify factory
exports, fitted garments or collision-safe simulation.
