import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = "https://n8n.srv1304274.hstgr.cloud/webhook/generate-seo-article";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verificar usuario
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { topic, imageCount = 3, articleId } = await req.json();

    if (!topic) {
      throw new Error('Topic is required');
    }

    console.log(`Generating SEO article for topic: "${topic}" with ${imageCount} images`);

    // Crear o actualizar registro en la base de datos
    let recordId = articleId;
    
    if (!recordId) {
      const { data: newRecord, error: insertError } = await supabase
        .from('seo_articles')
        .insert({
          user_id: user.id,
          topic,
          image_count: imageCount,
          status: 'processing'
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating record:', insertError);
        throw new Error('Failed to create article record');
      }
      recordId = newRecord.id;
    } else {
      await supabase
        .from('seo_articles')
        .update({ status: 'processing' })
        .eq('id', recordId);
    }

    // Construir callback URL para que n8n llame cuando termine
    const callbackUrl = `${supabaseUrl}/functions/v1/seo-article-callback`;

    // Llamar al webhook de n8n de forma asíncrona (fire-and-forget con timeout corto)
    console.log('Calling n8n webhook asynchronously...');
    
    // Usamos EdgeRuntime.waitUntil pattern o simplemente iniciamos sin esperar
    const n8nPayload = {
      topic,
      imageCount,
      articleId: recordId,
      userId: user.id,
      callbackUrl,
    };

    // Iniciar la llamada sin esperar la respuesta completa
    fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    }).then(async (response) => {
      if (response.ok) {
        console.log('n8n webhook accepted the request');
        // Intentar parsear la respuesta si viene rápido
        try {
          const text = await response.text();
          if (text && text.trim()) {
            const data = JSON.parse(text);
            console.log('n8n returned immediate response:', JSON.stringify(data).substring(0, 200));
            // Si n8n devuelve respuesta inmediata, actualizamos
            if (data.success && data.article) {
              await processN8nResponse(supabase, recordId, data);
            }
          }
        } catch (e) {
          console.log('n8n did not return immediate JSON response (async processing)');
        }
      } else {
        console.error('n8n webhook error:', response.status);
        await supabase
          .from('seo_articles')
          .update({
            status: 'error',
            error_message: `n8n error: ${response.status}`
          })
          .eq('id', recordId);
      }
    }).catch((error) => {
      console.error('n8n webhook call failed:', error.message);
      supabase
        .from('seo_articles')
        .update({
          status: 'error',
          error_message: `Failed to call n8n: ${error.message}`
        })
        .eq('id', recordId);
    });

    // Responder inmediatamente al cliente
    return new Response(
      JSON.stringify({
        success: true,
        articleId: recordId,
        status: 'processing',
        message: 'El artículo se está generando. Verás la actualización en tiempo real cuando esté listo.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Función para procesar respuesta de n8n
async function processN8nResponse(supabase: any, recordId: string, n8nData: any) {
  const article = n8nData.article || {};
  const research = n8nData.research || {};
  const images = n8nData.images || {};
  const metrics = n8nData.metrics || {};
  const optimizations = n8nData.optimizations || {};

  await supabase
    .from('seo_articles')
    .update({
      status: 'completed',
      workflow_id: n8nData.workflowId,
      title: article.title,
      slug: article.slug,
      meta_description: article.metaDescription,
      keywords: article.keywords || [],
      html_content: article.htmlContent,
      structured_data: article.structuredData,
      meta_tags: article.metaTags,
      research_summary: research.summary,
      seo_score: metrics.seoScore,
      word_count: metrics.wordCount,
      security_score: metrics.securityScore,
      images: images.urls || [],
      images_success_count: images.successful || 0,
      images_failed_count: images.failed || 0,
      optimizations: optimizations.applied || [],
      suggested_links: optimizations.suggestedLinks || [],
    })
    .eq('id', recordId);
}
