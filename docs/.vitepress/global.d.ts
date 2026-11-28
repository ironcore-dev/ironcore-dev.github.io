// Global build-time constants injected via vite.define in config.mts.

interface BlogPost {
  title: string
  date: string
  author: string
  url: string
}

// Sorted list of blog posts (newest first), generated from docs/blog/*.md frontmatter.
declare const __POSTS__: BlogPost[]
