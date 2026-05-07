import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { eventId, action, subject, start, end, location, body } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

    if (action === 'delete') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 204) {
        const err = await res.text();
        return Response.json({ error: err }, { status: res.status });
      }
      return Response.json({ success: true });
    }

    // Patch (update)
    const patch = {};
    if (subject !== undefined) patch.subject = subject;
    if (start !== undefined) patch.start = start;
    if (end !== undefined) patch.end = end;
    if (location !== undefined) patch.location = { displayName: location };
    if (body !== undefined) patch.body = { contentType: 'text', content: body };

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const updated = await res.json();
    return Response.json({ event: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});