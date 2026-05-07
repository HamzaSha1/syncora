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

    console.log('HTML snippet:', html.substring(0, 2000));

    const items = [];

    // Match any <p> tag that has a data-tag containing "to-do" — attributes can be in any order
    const pTagRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pTagRegex.exec(html)) !== null) {
      const attrs = match[1];
      const inner = match[2];

      // Check for to-do data-tag (any attribute order)
      const dataTagMatch = attrs.match(/data-tag="([^"]*)"/i);
      if (!dataTagMatch) continue;
      const tag = dataTagMatch[1];
      if (!tag.includes('to-do')) continue;

      // Extract element ID
      const idMatch = attrs.match(/\bid="([^"]+)"/i);
      const elementId = idMatch ? idMatch[1] : null;

      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (!text) continue;

      items.push({
        elementId,
        text,
        completed: tag.includes('completed'),
      });
    }

    console.log('Parsed items:', items.length);

    return Response.json({ items });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});