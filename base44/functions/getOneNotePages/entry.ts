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
      const res2 = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${body.pageId}/content`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res2.ok) throw new Error(`Graph API error: ${res2.status}`);
      const html = await res2.text();
      const items = [];
      let match;

      // Extract checklist items: <p data-tag="to-do..."> or <p data-tag="to-do">
      const checklistRegex = /<p[^>]*data-tag="to-do[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
      while ((match = checklistRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) items.push(text);
      }

      // Also extract <li> bullet items
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      while ((match = liRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) items.push(text);
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