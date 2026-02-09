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
      // Actualizar estado a processing
      await supabase
        .from('seo_articles')
        .update({ status: 'processing' })
        .eq('id', recordId);
    }

    // Llamar al webhook de n8n
    console.log('Calling n8n webhook...');
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        imageCount,
        articleId: recordId,
        userId: user.id,
        supabaseUrl,
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n error:', errorText);
      
      // Actualizar estado a error
      await supabase
        .from('seo_articles')
        .update({
          status: 'error',
          error_message: `n8n error: ${n8nResponse.status}`,
          error_details: { response: errorText }
        })
        .eq('id', recordId);

      throw new Error(`n8n webhook failed: ${n8nResponse.status}`);
    }

    const n8nData = await n8nResponse.json();
    console.log('n8n response received:', JSON.stringify(n8nData).substring(0, 500));

    // Procesar respuesta exitosa
    if (n8nData.success) {
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

      return new Response(
        JSON.stringify({
          success: true,
          articleId: recordId,
          data: n8nData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Error en n8n pero respuesta válida
      const errorInfo = n8nData.error || n8nData;
      
      await supabase
        .from('seo_articles')
        .update({
          status: 'error',
          error_message: errorInfo.message || 'Unknown error from n8n',
          error_details: n8nData
        })
        .eq('id', recordId);

      return new Response(
        JSON.stringify({
          success: false,
          articleId: recordId,
          error: errorInfo.message || 'Article generation failed'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
