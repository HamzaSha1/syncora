import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pageId } = await req.json();
    if (!pageId) return Response.json({ error: 'Missing pageId' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${pageId}/content`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Graph API error: ${res.status}`);
    const html = await res.text();

    // Extract all text content from the body, preserving line breaks between blocks
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;

    // Replace block-level tags with newlines, then strip remaining tags
    const text = bodyHtml
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|br)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});