# Security

## Supported versions

| Version        | Security support                 |
| -------------- | -------------------------------- |
| Latest release | Supported                        |
| `main`         | Supported until the next release |
| Older releases | Best effort                      |

## Reporting vulnerabilities

Use GitHub private vulnerability reporting:

<https://github.com/Jason-Doyle/operational-aibom/security/advisories/new>

Do not include credentials, private prompts, customer data, model artifacts, dataset contents, production traces, or exploit details in a public issue.

## Security boundaries

- Repository discovery is conservative, but it is not a data-loss-prevention system. Review generated records before publishing them.
- Prompt, source and dataset contents are not copied into generated records. Paths, identifiers, file sizes and digests may still be sensitive.
- Local model artifacts are hashed without being loaded or executed.
- Public projections include only records explicitly marked `public`.
- Generated CycloneDX and SPDX documents are compatibility views. They do not establish that a component or system is safe, suitable, fair, lawful or compliant.
- Artifact attestations authenticate provenance and integrity. They do not make the underlying claims true.
- Workflows processing untrusted pull requests must retain read-only permissions and must not expose repository or cloud credentials.

## Dependency and workflow security

- GitHub Actions are pinned to full commit SHAs.
- Dependabot monitors npm and GitHub Actions dependencies.
- CodeQL and dependency review run in GitHub Actions.
- Secret scanning and push protection are enabled for the public repository.
