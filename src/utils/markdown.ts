/**
 * 轻量级 Markdown 渲染器（无外部依赖）。
 *
 * 支持语法：
 * - # / ## / ### / #### 标题
 * - **加粗** / *斜体* / `行内代码`
 * - ```语言\n代码\n``` 围栏代码块
 * - > 引用
 * - - / * / 数字. 列表
 * - [文本](url) 链接（自动加 target="_blank" 和 rel="noopener"）
 * - --- 水平分割线
 * - 自动转义 HTML 特殊字符，防止 XSS
 *
 * 文生图扩展：
 * 当代码块语言命中 DIAGRAM_LANGS 时，输出占位 div 而非 <pre><code>，
 * 占位 div 由 ai-chat.vue 在挂载后通过 querySelectorAll 接管，挂载 DiagramBlock 组件。
 * 源码做 base64 编码注入 data-diagram-source，避免 HTML 注入与转义混淆。
 *
 * 设计目标：覆盖 90% 的 LLM 输出场景，体积小、零依赖、安全。
 */

/** 支持自动渲染为图表的代码块语言（小写） */
export const DIAGRAM_LANGS = ['mermaid', 'plantuml', 'puml', 'dot', 'graphviz', 'flow', 'flowchart', 'infographic'] as const;
export type DiagramLang = (typeof DIAGRAM_LANGS)[number];

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * 把字符串安全地编码为 base64（兼容 Unicode）。
 * 直接 btoa 会在含中文等非 Latin-1 字符时抛 InvalidCharacterError。
 */
function encodeSourceToBase64(source: string): string {
  // encodeURIComponent → unescape → btoa 是经典的 Unicode-safe 方案
  // 这里改用 TextEncoder 路径，避免 unescape 已被废弃
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** 把 base64 还原为原始字符串（DiagramBlock 组件用） */
export function decodeSourceFromBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 归一化代码块语言到 DiagramLang，未命中返回 null */
function normalizeDiagramLang(lang: string): DiagramLang | null {
  const lower = lang.toLowerCase();
  if (lower === 'puml') return 'plantuml';
  if (lower === 'graphviz') return 'dot';
  if (lower === 'flowchart') return 'flow';
  return (DIAGRAM_LANGS as readonly string[]).includes(lower) ? (lower as DiagramLang) : null;
}

/**
 * 将 Markdown 文本渲染为安全的 HTML 字符串。
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  // 1. 先把围栏代码块抠出来，用占位符替换，避免后续处理破坏代码内容
  //    若语言命中 DIAGRAM_LANGS，则输出图表占位 div；否则照常 <pre><code>
  const codeBlocks: string[] = [];
  let text = markdown.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const rawLang = String(lang || 'text');
    const rawCode = String(code).replace(/\n$/, '');
    const diagramLang = normalizeDiagramLang(rawLang);
    let html: string;
    if (diagramLang) {
      // 图表占位 div：由 DiagramBlock 组件接管渲染
      // 源码 base64 编码注入 data-diagram-source，避免 HTML 注入与转义混淆
      const encoded = encodeSourceToBase64(rawCode);
      html =
        `<div class="diagram-placeholder" ` +
        `data-diagram-lang="${diagramLang}" ` +
        `data-diagram-source="${encoded}"></div>`;
    } else {
      const safeLang = escapeHtml(rawLang);
      const safeCode = escapeHtml(rawCode);
      html =
        `<pre class="md-pre"><div class="md-code-header">${safeLang}</div>` +
        `<code class="md-code language-${safeLang}">${safeCode}</code></pre>`;
    }
    codeBlocks.push(html);
    return `\u0000CODEBLOCK_${codeBlocks.length - 1}\u0000`;
  });

  // 2. 抠出行内代码
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    inlineCodes.push(`<code class="md-inline-code">${escapeHtml(String(code))}</code>`);
    return `\u0000INLINECODE_${inlineCodes.length - 1}\u0000`;
  });

  // 3. 转义剩余文本中的 HTML
  text = escapeHtml(text);

  // 4. 标题
  text = text.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // 5. 水平线
  text = text.replace(/^---+$/gm, '<hr class="md-hr"/>');

  // 6. 引用
  text = text.replace(/^&gt;\s?(.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

  // 7. 加粗 / 斜体
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // 8. 链接 [text](url)
  text = text.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g,
    '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 9. 列表
  text = text.replace(/^(\s*)[-*]\s+(.+)$/gm, '$1<li class="md-li">$2</li>');
  text = text.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li class="md-li md-li-ordered">$2</li>');
  // 把连续的 li 包裹起来
  text = text.replace(/(<li class="md-li(?: md-li-ordered)?">[\s\S]*?<\/li>)(?=\n|$)/g, (m) => {
    if (m.includes('md-li-ordered')) {
      return `<ol class="md-ol">${m}</ol>`;
    }
    return `<ul class="md-ul">${m}</ul>`;
  });
  // 合并相邻的同类列表
  text = text.replace(/<\/ul>\s*<ul class="md-ul">/g, '');
  text = text.replace(/<\/ol>\s*<ol class="md-ol">/g, '');

  // 10. 段落（双换行分隔）
  const paragraphs = text.split(/\n{2,}/);
  text = paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      // 已经是块级元素的不再包 <p>
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|li)/i.test(trimmed)) {
        return trimmed;
      }
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  // 11. 还原行内代码
  text = text.replace(/\u0000INLINECODE_(\d+)\u0000/g, (_, idx) => inlineCodes[Number(idx)] ?? '');

  // 12. 还原代码块
  text = text.replace(/\u0000CODEBLOCK_(\d+)\u0000/g, (_, idx) => codeBlocks[Number(idx)] ?? '');

  return text;
}

/**
 * 流式渲染辅助：在仍在接收的内容末尾追加打字机光标。
 */
export function renderMarkdownStreaming(markdown: string): string {
  return renderMarkdown(markdown) + '<span class="md-cursor">▍</span>';
}
