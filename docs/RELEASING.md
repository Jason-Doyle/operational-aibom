# Releasing

## One-time npm bootstrap

The `operational-aibom` package name was available when the repository was prepared, but npm trusted publishing can only be configured after the package exists.

1. Sign in to npm with the account that will own the package and ensure two-factor authentication is enabled.
2. From a clean checkout of the reviewed `0.1.0` commit, run:

   ```powershell
   npm ci
   npm run check
   npm run standards:check
   npm publish --access public
   ```

   The bootstrap publish intentionally does not request provenance because it runs outside trusted CI.

3. Open the `operational-aibom` package settings on npmjs.com.
4. Add a GitHub Actions trusted publisher with these exact values:

   | Field                | Value               |
   | -------------------- | ------------------- |
   | Organisation or user | `Jason-Doyle`       |
   | Repository           | `operational-aibom` |
   | Workflow filename    | `release.yml`       |
   | Environment          | Leave empty         |

5. Under publishing access, require two-factor authentication and disallow token-based publishing.
6. Revoke any temporary automation token used during bootstrap. Future releases do not require `NPM_TOKEN`.

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
   git tag -a v0.1.0 -m "Operational AIBOM 0.1.0"
   git push origin v0.1.0
   ```

The release workflow validates that the tag belongs to `main`, rebuilds and tests the package, verifies the committed GitHub Action bundle, creates and attests the npm tarball, publishes the package through npm trusted publishing, and creates the GitHub release.

## GitHub Action major tag

After a successful release, create or update the floating major tag used by Action consumers:

```powershell
git tag -f v0 v0.1.0
git push origin v0 --force
```

Move the major tag only after the versioned release succeeds. Version tags such as `v0.1.0` remain immutable.
