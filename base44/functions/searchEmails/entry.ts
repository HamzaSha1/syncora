import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    await base44.auth.me();
  } catch (_) {}

  const { query, skip = 0 } = await req.json();

  if (!query) {
    return Response.json({ error: 'query is required' }, { status: 400 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');

  // Fetch 100 emails starting at skip offset
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$top=100&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,webLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const emails = data.value || [];

  if (emails.length === 0) {
    return Response.json({ results: [], exhausted: true });
  }

  // Build summaries for AI
  const summaries = emails.map((e, i) => ({
    index: i,
    subject: e.subject || '(no subject)',
    from: e.from?.emailAddress?.name || e.from?.emailAddress?.address || 'Unknown',
    receivedDateTime: e.receivedDateTime,
    bodyPreview: (e.bodyPreview || '').slice(0, 300),
  }));

  const prompt = `You are an email search assistant. The user is searching for: "${query}"

Here are ${summaries.length} emails (most recent first). Each has an "index" field.

Emails:
${JSON.stringify(summaries, null, 2)}

Semantically match emails that are relevant to the user's query — understand the meaning and intent, not just keywords.

Return a JSON object with:
- "results": array of matched email objects, each with:
  - "index": the index of the matched email
  - "relevance": a short 1-sentence explanation of why it's relevant (max 15 words)
- If no emails are relevant, return { "results": [] }

Only return genuinely relevant emails. Do not force matches.`;

  const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              relevance: { type: 'string' },
            },
          },
        },
      },
    },
  });

  // Enrich with full email data
  const enriched = (aiResult.results || []).map((r) => {
    const email = emails[r.index];
    return {
      subject: email.subject || '(no subject)',
      from: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
      fromEmail: email.from?.emailAddress?.address || '',
      receivedDateTime: email.receivedDateTime,
      bodyPreview: (email.bodyPreview || '').slice(0, 200),
      webLink: email.webLink || null,
      relevance: r.relevance,
    };
  });

  return Response.json({ results: enriched, exhausted: emails.length < 100 });
});