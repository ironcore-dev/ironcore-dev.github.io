# Documentation Style Guide

This section covers conventions for contributing to the [IronCore documentation site](https://ironcore.dev), built
with [VitePress](https://vitepress.dev/).

## Language and Tone

- Write in **U.S. English**.
- Use **second person** ("you") to address the reader directly.
- Use **active voice** and **present tense**.
- Keep sentences short and direct.

| Do | Don't |
| --- | --- |
| You can create a Machine by applying the manifest. | The Machine can be created by the user by applying the manifest. |
| Run `kubectl apply` to create the resource. | The resource should be created by running `kubectl apply`. |

## Content Types

Structure documentation pages according to these types:

- **Concept** — Explains *what* something is and *why* it matters. Prose and headings, no step-by-step instructions.
- **Task** — Shows *how* to do a single thing. Numbered steps with minimal explanation.
- **Tutorial** — Walks through a larger goal involving multiple tasks. Includes objectives, prerequisites, and cleanup.
- **Reference** — API or CLI documentation. Covers synopsis, options, and examples.

## API Object Names

Use **UpperCamelCase** when referring to IronCore or Kubernetes API kinds. Do not wrap them in backticks — the casing
alone signals they are API objects.

| Do | Don't |
| --- | --- |
| Create a Machine resource. | Create a `machine` resource. |
| The Volume object stores block data. | The volume object stores block data. |
| A NetworkInterface belongs to a Network. | A network interface belongs to a network. |

## Inline Code

Use backticks for commands, tools, field names, file paths, and namespaces. Do not use backticks for API kind names
or field values.

| Do | Don't |
| --- | --- |
| Set `replicas` to 3. | Set `replicas` to `3`. |
| The `kubelet` reports node status. | `kubelet` reports node status. |

Never start a sentence with a backticked word — prefix with an article (e.g., "The `kubeadm` tool...").

## Placeholders

Use angle brackets and explain each placeholder:

```shell
kubectl get machine <machine-name> -n <namespace>
```

## Headings

- One `#` (H1) per page as the document title.
- Use `##` and below for sections. Do not skip heading levels.
- Use **title case**: capitalize major words (nouns, verbs, adjectives, adverbs) and lowercase minor words (articles, prepositions, conjunctions) unless they are the first word.
- Keep headings unique within a document — they generate anchor links.
- Do not number headings.

## Lists

- Use `1.` for every numbered list item — the renderer handles numbering.
- Use `-` for bulleted lists.
- Use 4-space indentation for nested items.

## Code Blocks

Use fenced code blocks with a language identifier for syntax highlighting. Use meaningful names — avoid `foo` and
`bar`. For plain text output, use `text` as the language.

## Links

- Use site-relative paths for internal links: `[Getting started](/iaas/getting-started)`.
- Do not use full URLs for internal links or relative paths with `../`.
- Write links as natural parts of the sentence — avoid "click here" or "this link".

## Diagrams

- Prefer [Mermaid](https://mermaid.js.org) for inline diagrams rendered in VitePress.
- For complex visuals, use [draw.io](https://draw.io) or [Excalidraw](https://excalidraw.com) and export as PNG.
- Store source files alongside exported images. Use the suffix `.diagram.png`.

## Images and Screenshots

- Use sparingly — they become outdated quickly.
- Blur or remove sensitive information.
- Use light mode and crop to the relevant area.

## File and Folder Naming

Use lowercase with hyphens. No spaces or underscores:

| Do | Don't |
| --- | --- |
| `getting-started.md` | `Getting Started.md` |
| `bare-metal-management/` | `bare_metal_management/` |
