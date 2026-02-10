# Coding Style Guide

This style guide defines the conventions for contributing code and tests across all IronCore projects.
Following these standards ensures consistency and helps maintainers review contributions efficiently.

## Code Style

### Go Conventions

All IronCore projects are written in Go. We follow the standard Go style guides as our baseline:

- [Effective Go](https://go.dev/doc/effective_go) — the foundational language guide.
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments) — the de facto standard for code reviews.

The rules below supplement these upstream guides with IronCore-specific conventions. Do not duplicate what is already
covered upstream — read those guides first.

### Formatting

- Run `gofmt` (or `goimports`) on all code before committing. This is non-negotiable.
- Use your editor or a pre-commit hook to automate formatting.

### Naming

- Follow Go naming conventions: `MixedCaps` for exported identifiers, `mixedCaps` for unexported ones. Never use
  underscores in Go names.
- Keep initialisms consistent: `URL` not `Url`, `ID` not `Id`, `HTTP` not `Http`.
- Use descriptive package names. Avoid generic names like `util`, `common`, `helpers`, or `misc`.
- Controller and reconciler types should clearly indicate the resource they manage
  (e.g., `MachineReconciler`, `VolumeController`).

### Imports

Organize imports into three groups separated by blank lines:

```go
import (
    // Standard library
    "context"
    "fmt"

    // Third-party packages
    "sigs.k8s.io/controller-runtime/pkg/client"

    // IronCore packages
    "github.com/ironcore-dev/ironcore/api/compute/v1alpha1"
)
```

Avoid renaming imports unless there is a name collision.

### Error Handling

- Never discard errors with `_`. Handle every error or explicitly document why it is safe to ignore.
- Return errors as the last return value. Handle errors early and return — keep the happy path at minimal indentation.
- Use lowercase error strings without trailing punctuation: `fmt.Errorf("failed to create machine")`.
- Wrap errors with context: `fmt.Errorf("reconciling machine %s: %w", name, err)`.

### Comments

- Write comments that explain *why*, not *what*. The code itself shows what it does.
- Comments on exported identifiers become godoc — start with the identifier name and write complete sentences.
- If reviewers ask questions about why code is written a certain way, that is a sign that a comment would help.

### Logging

- Use structured logging consistently. Prefer key-value pairs over formatted strings.
- Use appropriate log levels:
    - **Error** — the reconciler cannot proceed; requires attention.
    - **Info** — significant events (resource created, deleted, reconciled).
    - **Debug/V(1)** — detailed information useful for troubleshooting.

### Linting

All projects should use [golangci-lint](https://golangci-lint.run/) with the project's `.golangci.yml` configuration.
Run linters locally before pushing:

```shell
make lint
```

## Testing

Good tests are as important as good code. Tests protect against regressions, document expected behavior, and give
reviewers confidence that changes work correctly.

### Testing Pyramid

IronCore projects use three levels of testing:

| Level | Purpose | Tools |
| --- | --- | --- |
| **Unit tests** | Test individual functions and methods in isolation. | Go standard `testing` package |
| **Integration tests** | Test controllers against a real API server using envtest. | [controller-runtime envtest](https://pkg.go.dev/sigs.k8s.io/controller-runtime/pkg/envtest) |
| **End-to-end tests** | Test the full system with real components deployed. | [Ginkgo](https://onsi.github.io/ginkgo/) + [Gomega](https://onsi.github.io/gomega/) |

### Writing Tests

- **Table-driven tests** are the preferred pattern for unit tests with multiple input/output cases:

```go
func TestValidateMachineName(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
    }{
        {name: "valid name", input: "my-machine", wantErr: false},
        {name: "empty name", input: "", wantErr: true},
        {name: "name with spaces", input: "my machine", wantErr: true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateMachineName(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateMachineName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
            }
        })
    }
}
```

- **Test names** should be descriptive and specific. Use the pattern `Test<Function>_<scenario>` for unit tests.
- **Assertions** in Ginkgo/Gomega tests should use matchers, not boolean checks:

| Do | Don't |
| --- | --- |
| `Expect(pod.Status.Phase).To(Equal(corev1.PodRunning))` | `Expect(pod.Status.Phase == corev1.PodRunning).To(BeTrue())` |

- **Failure messages** must be actionable. Include what was expected, what was received, and enough context to debug
  without re-running:

| Do | Don't |
| --- | --- |
| `"expected Machine %s to be in Running phase, got %s"` | `"wrong phase"` |

### Test Reliability

- Tests must be deterministic. A test that passes 99% of the time is unreliable in CI.
- Use `gomega.Eventually` for polling conditions instead of `time.Sleep`.
- Clean up resources after tests. Use `DeferCleanup` in Ginkgo or `t.Cleanup` in standard tests.
- Keep tests fast. Unit tests should complete in seconds; integration tests in under two minutes.

### Running Tests

Before submitting a pull request, run the full test suite locally:

```shell
make test          # Unit and integration tests
make lint          # Linter checks
make verify        # Code generation and manifests are up to date
```

## Commit Messages

- **Subject line**: imperative mood, max 72 characters, capitalize the first word, no trailing period.
- **Body**: wrap at 72 characters, explain *what* and *why*, separate from the subject with a blank line.
- Reference related issues: `Fixes #123` or `Relates to #456`.

| Do | Don't |
| --- | --- |
| `Add volume snapshot support` | `Added volume snapshot support` |
| `Fix nil pointer in machine reconciler` | `fixed stuff` |

## Pull Requests

- Keep pull requests small and focused — one logical change per PR.
- Separate bug fixes from refactoring from new features.
- Include tests for any new functionality or bug fix.
- Ensure all CI checks pass before requesting review.
- Write a clear PR description explaining what changed and why.
