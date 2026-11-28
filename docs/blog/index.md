<script setup>
// injected via vite.define in .vitepress/config.mts
const posts = __POSTS__
</script>

# Blog

News, announcements, and technical deep dives from the IronCore project.

## Posts

<ul>
  <li v-for="post of posts" :key="post.url">
    <a :href="post.url">{{ post.title }}</a> — {{ post.date }}
  </li>
</ul>
