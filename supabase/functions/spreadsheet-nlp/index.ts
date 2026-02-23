import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

    const { query, headers, sampleRows, mode } = await req.json();
    if (!query) throw new Error('Missing query');

    const isFilter = mode === 'filter' || !mode;
    const isMagicColumn = mode === 'magic_column';

    let systemPrompt = '';
    let userPrompt = '';

    if (isFilter) {
      systemPrompt = `You are a spreadsheet filter assistant. Given column headers and a natural language query, produce a JSON object that describes filters to apply to a spreadsheet.

Output ONLY valid JSON with this structure:
{
  "filters": [
    { "column": "column_name", "operator": "contains|equals|gt|lt|gte|lte|not_equals|starts_with|ends_with", "value": "value" }
  ],
  "sort": { "column": "column_name", "direction": "asc|desc" } | null,
  "visibleColumns": ["col1", "col2"] | null
}

Operators: contains (text search), equals, not_equals, gt (>), lt (<), gte (>=), lte (<=), starts_with, ends_with.
If the user doesn't mention sorting, set sort to null.
If the user doesn't mention hiding columns, set visibleColumns to null.
Use the exact column names from the headers provided.`;

      userPrompt = `Headers: ${JSON.stringify(headers)}
${sampleRows ? `Sample data (first 3 rows): ${JSON.stringify(sampleRows)}` : ''}

User query: "${query}"`;
    } else if (isMagicColumn) {
      systemPrompt = `You are a data extraction/categorization assistant. Given cell values from a spreadsheet row, apply the user's instruction to produce output for a new column.

Rules:
- Return ONLY the extracted/categorized value, nothing else
- Be concise and consistent
- If you can't extract the requested info, return "—"
- For categorization, use short labels (1-3 words)
- For sentiment analysis, use: Positivo, Negativo, Neutro, Urgente
- For data extraction, return just the extracted value`;

      userPrompt = `Row data: ${JSON.stringify(sampleRows)}
Headers: ${JSON.stringify(headers)}

Instruction: "${query}"`;
    }

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://malagamicro.lovable.app',
      },
      body: JSON.stringify({
        model: isMagicColumn ? 'google/gemini-2.5-flash-preview' : 'google/gemini-2.5-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: isMagicColumn ? 200 : 500,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenRouter error: ${errText}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    if (isFilter) {
      // Parse JSON from response, handling markdown code blocks
      let jsonStr = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
      
      try {
        const parsed = JSON.parse(jsonStr);
        return new Response(JSON.stringify({ success: true, result: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ success: false, error: 'Could not parse filter response', raw: content }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ success: true, result: content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('spreadsheet-nlp error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
