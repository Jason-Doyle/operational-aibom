# Releasing

## npm trusted publishing

The package uses GitHub Actions OIDC and does not require an `NPM_TOKEN`.

| Field                | Value                |
| -------------------- | -------------------- |
| Organisation or user | `Jason-Doyle`        |
| Repository           | `operational-aibom`  |
| Workflow filename    | `release.yml`        |
| Environment          | Leave empty          |
| Allowed action       | Direct `npm publish` |

Publishing access requires two-factor authentication and disallows token-based publishing.

## Versioned releases

1. Update `package.json`, `package-lock.json` and `CHANGELOG.md` in a pull request.
2. Run:

   ```powershell
   npm run check
   npm run standards:check
   ```

3. Merge the reviewed pull request.
4. Create and push a tag that exactly matches the package version:

   ```powershell
   git tag -a v1.0.0 -m "Operational AIBOM 1.0.0"
   git push origin v1.0.0
   ```

The release workflow validates that the tag belongs to `main`, rebuilds and tests the package, verifies the committed GitHub Action bundle, creates and attests the npm tarball, publishes the package through npm trusted publishing, and creates the GitHub release.

## GitHub Action major tag

After a successful release, create or update the floating major tag used by Action consumers:

```powershell
git tag -f v1 v1.0.0
git push origin v1 --force
```

Move the major tag only after the versioned release succeeds. Version tags such as `v1.0.0` remain immutable.
