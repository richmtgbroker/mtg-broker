"""
Migrate Pipeline Webflow embeds to Cloudflare Worker handler functions.
Reads the 3 embed files, escapes for JS template literals, generates handler code.
"""
import os

EMBED_DIR = "J:/My Drive/MtgBroker App/Claude Downloads/Pages_App_Pipeline"
OUT_DIR = "C:/Users/rich2/projects/mtg-broker/.claude/worktrees/frosty-colden/workers"

def escape_for_template_literal(content):
    """Three-step escaping: backslash first, then backtick, then ${"""
    content = content.replace('\\', '\\\\')
    content = content.replace('`', '\\`')
    content = content.replace('${', '\\${')
    return content


def process_css():
    """Read CSS embed, strip <style> tags, generate handler."""
    with open(os.path.join(EMBED_DIR, "Pipeline_Page_Embed_CSS_v12_4.css"), "r", encoding="utf-8") as f:
        raw = f.read()

    # Strip <style> wrapper
    content = raw.strip()
    if content.startswith("<style>"):
        content = content[7:]
    if content.endswith("</style>"):
        content = content[:-8]
    content = content.strip()

    escaped = escape_for_template_literal(content)

    handler = []
    handler.append("// PIPELINE CSS (migrated from Webflow embed Pipeline_Page_Embed_CSS_v12_4.css)")
    handler.append("// Served as: GET /static/pipeline.css")
    handler.append("")
    handler.append("async function getPipelineCSS(request) {")
    handler.append("  const cssContent = `" + escaped + "`;")
    handler.append("  return new Response(cssContent, {")
    handler.append("    status: 200,")
    handler.append("    headers: {")
    handler.append('      "Content-Type": "text/css; charset=utf-8",')
    handler.append('      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",')
    handler.append("      ...getCorsHeaders(request)")
    handler.append("    }")
    handler.append("  });")
    handler.append("}")

    out_path = os.path.join(OUT_DIR, "pipeline-css-handler.tmp")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(handler))

    print(f"CSS handler: {len(escaped):,} chars -> {out_path}")
    return len(escaped)


def process_html():
    """Read HTML embed, generate handler."""
    with open(os.path.join(EMBED_DIR, "Pipeline_Page_Embed_HTML_v12_0.html"), "r", encoding="utf-8") as f:
        raw = f.read()

    escaped = escape_for_template_literal(raw.strip())

    handler = []
    handler.append("// PIPELINE HTML TEMPLATE (migrated from Webflow embed Pipeline_Page_Embed_HTML_v12_0.html)")
    handler.append("// Served as: GET /static/pipeline-template.html")
    handler.append("")
    handler.append("async function getPipelineTemplateHTML(request) {")
    handler.append("  const htmlContent = `" + escaped + "`;")
    handler.append("  return new Response(htmlContent, {")
    handler.append("    status: 200,")
    handler.append("    headers: {")
    handler.append('      "Content-Type": "text/html; charset=utf-8",')
    handler.append('      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",')
    handler.append("      ...getCorsHeaders(request)")
    handler.append("    }")
    handler.append("  });")
    handler.append("}")

    out_path = os.path.join(OUT_DIR, "pipeline-html-handler.tmp")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(handler))

    print(f"HTML handler: {len(escaped):,} chars -> {out_path}")
    return len(escaped)


def process_js():
    """Read JS embed, generate handler.
    NOTE: The JS embed contains <script> tags with inline JS.
    We serve it as-is (including script tags) since the thin loader
    will inject it as HTML into the page."""
    with open(os.path.join(EMBED_DIR, "Pipeline_Page_Embed_JS_v13_8.html"), "r", encoding="utf-8") as f:
        raw = f.read()

    escaped = escape_for_template_literal(raw.strip())

    handler = []
    handler.append("// PIPELINE LOADER JS (migrated from Webflow embed Pipeline_Page_Embed_JS_v13_8.html)")
    handler.append("// Served as: GET /static/pipeline-bootstrap.html")
    handler.append("// Contains: Google Maps loader, address autocomplete, showSection hooks, module loaders")
    handler.append("// NOTE: This is served as HTML (contains <script> tags) and injected via innerHTML")
    handler.append("")
    handler.append("async function getPipelineBootstrapHTML(request) {")
    handler.append("  const htmlContent = `" + escaped + "`;")
    handler.append("  return new Response(htmlContent, {")
    handler.append("    status: 200,")
    handler.append("    headers: {")
    handler.append('      "Content-Type": "text/html; charset=utf-8",')
    handler.append('      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",')
    handler.append("      ...getCorsHeaders(request)")
    handler.append("    }")
    handler.append("  });")
    handler.append("}")

    out_path = os.path.join(OUT_DIR, "pipeline-bootstrap-handler.tmp")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(handler))

    print(f"JS/Bootstrap handler: {len(escaped):,} chars -> {out_path}")
    return len(escaped)


if __name__ == "__main__":
    css_size = process_css()
    html_size = process_html()
    js_size = process_js()
    total = css_size + html_size + js_size
    print(f"\nTotal content: {total:,} chars across 3 handlers")
    print("Next: insert these handlers into mtg-broker-pipeline.js and wire up routes")
