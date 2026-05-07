import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function graphRequest(accessToken, path) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    let body = {};
    try { body = await req.json(); } catch (_) {}

    // If pageId provided, return the page content (bulleted items)
    if (body.pageId) {
      const res2 = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${body.pageId}/content?includeIDs=true`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res2.ok) throw new Error(`Graph API error: ${res2.status}`);
      const html = await res2.text();
      const items = [];
      let match;

      // Extract checklist items — attributes can be in any order
      const pTagRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
      while ((match = pTagRegex.exec(html)) !== null) {
        const attrs = match[1];
        const inner = match[2];
        const dataTagMatch = attrs.match(/data-tag="([^"]*)"/i);
        if (!dataTagMatch) continue;
        const tag = dataTagMatch[1];
        if (!tag.includes('to-do')) continue;
        const idMatch = attrs.match(/\bid="([^"]+)"/i);
        const elementId = idMatch ? idMatch[1] : null;
        const text = inner.replace(/<[^>]+>/g, '').trim();
        if (text) items.push({ text, elementId, completed: tag.includes('completed') });
      }

      // Also extract <li> bullet items (no element ID)
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      while ((match = liRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) items.push({ text, elementId: null, completed: false });
      }

      return Response.json({ items });
    }

    // Otherwise return notebooks and pages list
    const notebooks = await graphRequest(accessToken, '/me/onenote/notebooks?$select=id,displayName');
    const pages = await graphRequest(accessToken, '/me/onenote/pages?$select=id,title,parentNotebook,parentSection&$top=100&$orderby=lastModifiedDateTime desc');

    return Response.json({
      notebooks: notebooks?.value || [],
      pages: pages?.value || [],
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});