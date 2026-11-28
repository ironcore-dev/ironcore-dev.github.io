<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed } from 'vue'

const { Layout } = DefaultTheme
const { page, frontmatter } = useData()

// Blog posts carry date and author frontmatter; render a byline
// above the post content. The blog index has no date, so it is excluded
// naturally.
const isBlogPost = computed(
  () => page.value.relativePath.startsWith('blog/') && frontmatter.value.date
)

// Unquoted YAML dates reach us as ISO strings (page data is serialized);
// normalize to YYYY-MM-DD, consistent with the dates on the blog index.
const bylineDate = computed(() => String(frontmatter.value.date).slice(0, 10))
</script>

<template>
  <Layout>
    <template #doc-before>
      <p v-if="isBlogPost" class="blog-post-meta">
        {{ bylineDate }} · {{ frontmatter.author }}
      </p>
    </template>
  </Layout>
</template>
