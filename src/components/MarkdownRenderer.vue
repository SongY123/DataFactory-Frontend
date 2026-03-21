<template>
  <div class="markdown-renderer markdown-body">
    <details v-if="frontMatter" class="readme-metadata">
      <summary>{{ frontMatterLabel }}</summary>
      <pre><code>{{ frontMatter }}</code></pre>
    </details>

    <div v-if="bodyHtml" class="markdown-content" v-html="bodyHtml"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  frontMatterLabel: {
    type: String,
    default: 'metadata'
  }
})

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
})

const defaultLinkRender = markdown.renderer.rules.link_open
  || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const href = String(token.attrGet('href') || '')

  if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noreferrer noopener')
  }

  return defaultLinkRender(tokens, idx, options, env, self)
}

const splitFrontMatter = (value) => {
  const raw = String(value || '').replace(/\r/g, '')
  const lines = raw.split('\n')
  if (!lines.length) {
    return { frontMatter: '', body: '' }
  }

  const firstLine = lines[0]?.replace(/^\uFEFF/, '').trim()
  if (firstLine !== '---') {
    return { frontMatter: '', body: raw }
  }

  let closingIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    const current = lines[index].trim()
    if (current === '---' || current === '...') {
      closingIndex = index
      break
    }
  }

  if (closingIndex < 0) {
    return { frontMatter: '', body: raw }
  }

  return {
    frontMatter: lines.slice(1, closingIndex).join('\n').trim(),
    body: lines.slice(closingIndex + 1).join('\n').trimStart()
  }
}

const normalizedContent = computed(() => splitFrontMatter(props.content))
const frontMatter = computed(() => normalizedContent.value.frontMatter)
const bodyHtml = computed(() => markdown.render(normalizedContent.value.body || ''))
</script>

<style scoped>
.markdown-renderer {
  color: #2b3648;
  line-height: 1.75;
}

.readme-metadata {
  margin-bottom: 1rem;
  border: 1px solid rgba(27, 43, 65, 0.12);
  border-radius: 18px;
  background: rgba(245, 248, 252, 0.92);
  overflow: hidden;
}

.readme-metadata summary {
  padding: 0.8rem 1rem;
  cursor: pointer;
  font-weight: 700;
  color: #1f3350;
  text-transform: lowercase;
  user-select: none;
}

.readme-metadata[open] summary {
  border-bottom: 1px solid rgba(27, 43, 65, 0.1);
}

.readme-metadata summary:hover {
  background: rgba(27, 43, 65, 0.04);
}

.readme-metadata pre {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 0;
  background: rgba(28, 40, 61, 0.97);
  color: #f7f8fb;
  overflow: auto;
}

.readme-metadata code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  color: #172033;
  margin-top: 1.2rem;
  margin-bottom: 0.65rem;
}

.markdown-content :deep(p) {
  margin-bottom: 0.85rem;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.35rem;
  margin-bottom: 0.85rem;
}

.markdown-content :deep(li) {
  margin-bottom: 0.25rem;
}

.markdown-content :deep(blockquote) {
  margin: 0 0 0.9rem;
  padding: 0.8rem 1rem;
  border-left: 4px solid rgba(35, 49, 75, 0.24);
  background: rgba(35, 49, 75, 0.05);
  color: #4b5a72;
  border-radius: 0 14px 14px 0;
}

.markdown-content :deep(hr) {
  margin: 1.2rem 0;
  border: 0;
  border-top: 1px solid rgba(27, 43, 65, 0.12);
}

.markdown-content :deep(pre) {
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(28, 40, 61, 0.95);
  color: #f7f8fb;
  overflow: auto;
  margin-bottom: 0.9rem;
}

.markdown-content :deep(code) {
  border-radius: 8px;
  background: rgba(27, 43, 65, 0.08);
  padding: 0.1rem 0.35rem;
}

.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.markdown-content :deep(a) {
  color: #1f63c6;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 14px;
}

.markdown-content :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  margin-bottom: 1rem;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid rgba(27, 43, 65, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
}

.markdown-content :deep(thead) {
  background: rgba(27, 43, 65, 0.06);
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 0.72rem 0.82rem;
  border-right: 1px solid rgba(27, 43, 65, 0.08);
  border-bottom: 1px solid rgba(27, 43, 65, 0.08);
  white-space: nowrap;
  text-align: left;
  vertical-align: top;
}

.markdown-content :deep(th:last-child),
.markdown-content :deep(td:last-child) {
  border-right: 0;
}

.markdown-content :deep(tbody tr:last-child td) {
  border-bottom: 0;
}
</style>
