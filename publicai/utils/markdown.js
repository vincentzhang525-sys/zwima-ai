(function () {
  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderInline(text) {
    let html = text;
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    return html;
  }

  function renderMarkdown(text) {
    const source = String(text || "");
    if (!source) return "";

    const lines = source.split("\n");
    const parts = [];
    let inCode = false;
    let codeLines = [];
    let listItems = [];

    const flushList = () => {
      if (!listItems.length) return;
      parts.push(`<ul>${listItems.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join("")}</ul>`);
      listItems = [];
    };

    const flushCode = () => {
      if (!codeLines.length) return;
      parts.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
    };

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        flushList();
        if (inCode) {
          flushCode();
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (/^[-*] /.test(line)) {
        listItems.push(line.replace(/^[-*] /, ""));
        continue;
      }

      flushList();

      if (/^### /.test(line)) {
        parts.push(`<h4>${renderInline(escapeHtml(line.replace(/^### /, "")))}</h4>`);
        continue;
      }
      if (/^## /.test(line)) {
        parts.push(`<h3>${renderInline(escapeHtml(line.replace(/^## /, "")))}</h3>`);
        continue;
      }
      if (/^# /.test(line)) {
        parts.push(`<h2>${renderInline(escapeHtml(line.replace(/^# /, "")))}</h2>`);
        continue;
      }

      if (!line.trim()) {
        parts.push("<br>");
        continue;
      }

      parts.push(`<p>${renderInline(escapeHtml(line))}</p>`);
    }

    flushList();
    if (inCode) flushCode();

    return parts.join("");
  }

  window.ZwimaMarkdown = {
    render: renderMarkdown,
    escapeHtml,
  };
})();
