import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pageId, elementId, completed } = await req.json();
    if (!pageId || !elementId) return Response.json({ error: 'Missing pageId or elementId' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    // PATCH the specific paragraph element's data-tag to checked or unchecked
    const newTag = completed ? 'to-do:completed' : 'to-do';
    const patchBody = JSON.stringify([
      {
        target: elementId,
        action: 'replace',
        content: `<p data-tag="${newTag}" id="${elementId}"></p>`,
      }
    ]);

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/pages/${pageId}/content`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: patchBody,
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Graph API error: ${res.status}`, details: text }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});