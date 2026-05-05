import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pageId } = await req.json();
    if (!pageId) return Response.json({ error: 'Missing pageId' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${pageId}/content?includeIDs=true`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Graph API error: ${res.status}`);
    const html = await res.text();

    // Parse checklist items with their element IDs and completion state
    const items = [];
    const checklistRegex = /<p[^>]*data-tag="(to-do[^"]*)"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = checklistRegex.exec(html)) !== null) {
      const tag = match[1];
      const elementId = match[2];
      const text = match[3].replace(/<[^>]+>/g, '').trim();
      if (text) {
        items.push({
          elementId,
          text,
          completed: tag.includes('completed'),
        });
      }
    }

    return Response.json({ items });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});