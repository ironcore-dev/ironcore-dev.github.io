# Contributing to IronCore

Welcome to the IronCore contributor guide! Whether you're fixing a typo, reporting a bug, or building a new feature,
your contributions are welcome at any time. This guide applies to all repositories under the
[ironcore-dev](https://github.com/ironcore-dev) GitHub organization.

## Prerequisites

Before your first contribution, please complete the following:

1. **Create a [GitHub account](https://github.com/signup)** if you don't already have one.
2. **Sign the [Developer Certificate of Origin (DCO)](https://developercertificate.org/)** — all commits must be
   signed off (`git commit -s`) to certify that you wrote the code or have the right to submit it. This is checked
   automatically on every pull request.
3. **Read our [Code of Conduct](https://events.linuxfoundation.org/about/code-of-conduct/)** — we follow the
   Linux Foundation Code of Conduct and are committed to providing a welcoming and respectful community for everyone.

## Find Something to Work On

Not sure where to start? Here are a few ways to find your first contribution:

- **Browse [`good first issue`](https://github.com/search?q=org%3Aironcore-dev+label%3A%22good+first+issue%22+state%3Aopen&type=issues)
  labels** — these are issues where maintainers have committed to providing extra guidance.
- **Look for [`help wanted`](https://github.com/search?q=org%3Aironcore-dev+label%3A%22help+wanted%22+state%3Aopen&type=issues)
  labels** — these are issues open for community contribution.
- **Improve documentation** — clarify existing docs, fix typos, or add missing content. See the
  [documentation conventions](/community/style-guide/documentation) in the style guide.
- **Report a bug** — if you've found an issue, open a GitHub issue with steps to reproduce it.
- **Propose a feature** — open an issue to discuss your idea before starting implementation.

**Tip:** Before working on a larger change, open an issue first to discuss your approach with the maintainers. This
avoids unnecessary work and helps align your contribution with the project's direction.

## Making a Contribution

### 1. Fork and Clone

Fork the repository you want to contribute to and clone it locally:

```shell
git clone git@github.com:<your-username>/<repository>.git
cd <repository>
```

### 2. Create a Branch

Create a feature branch from `main`:

```shell
git checkout -b my-feature
```

If needed, rebase to the current `main` before submitting your pull request:

```shell
git fetch upstream main
git rebase upstream/main
```

### 3. Make Your Changes

- Follow the [coding](/community/style-guide/coding) and [documentation](/community/style-guide/documentation) style guides for code, testing, and documentation standards.
- Keep commits small and focused — each commit should be correct independently.
- Write clear [commit messages](/community/style-guide/coding#commit-messages) that explain *why*, not just *what*.
- Include tests for any new functionality or bug fix.
- Sign off every commit for DCO compliance:

```shell
git commit -s -m "Add support for feature X"
```

### 4. Submit a Pull Request

Push your branch and open a pull request against `main`:

```shell
git push origin my-feature
```

In your pull request description:
- Explain what the change does and why it's needed.
- Reference any related issues (e.g., `Fixes #123`).
- Tag a relevant maintainer if you need a specific reviewer — check the `CODEOWNERS` file in the repository.

### 5. Run Checks

Before submitting, run the project's checks locally to catch issues early. See
[Running tests](/community/style-guide/coding#running-tests) in the coding style guide for details:

```shell
make test          # Unit and integration tests
make lint          # Linter checks
make verify        # Code generation and manifests are up to date
```

## Code Review

All contributions go through code review before merging. Here's what to expect:

- **A maintainer will review your PR** and may request changes. This is normal — reviews improve code quality for
  everyone.
- **Address feedback** by pushing additional commits or amending existing ones.
- **Mark resolved comments** as resolved in GitHub and leave a comment when your changes are ready for another look.

Reviews are a collaborative process. Don't hesitate to ask questions or push back if you disagree with feedback —
respectful discussion leads to better outcomes.

## Reporting Issues

We use GitHub issues to track bugs and feature requests. When opening an issue:

- Check if a similar issue already exists.
- Provide enough context to understand and reproduce the problem.
- Use the issue templates provided in each repository when available.

## Licensing

All contributions to IronCore projects are licensed under the
[Apache 2.0 License](http://www.apache.org/licenses/LICENSE-2.0).

## Need Help?

- Ask questions on any issue or pull request — maintainers are happy to help.
- Join our [Slack workspace](https://join.slack.com/t/ironcore-dev/shared_invite/zt-3o0qo3j90-pbqV0io1B~Z~LqeAp4n2Vg)
  to chat with the community.

Thank you for contributing to IronCore!
