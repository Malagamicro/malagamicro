import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Received callback from n8n:', JSON.stringify(payload).substring(0, 500));

    const { articleId, success, workflowId, article, research, images, metrics, optimizations, error: n8nError } = payload;

    if (!articleId) {
      throw new Error('articleId is required');
    }

    if (success) {
      // Artículo generado correctamente
      console.log(`Updating article ${articleId} with success data`);
      
      const updateData: Record<string, unknown> = {
        status: 'completed',
        workflow_id: workflowId,
      };

      if (article) {
        updateData.title = article.title;
        updateData.slug = article.slug;
        updateData.meta_description = article.metaDescription;
        updateData.keywords = article.keywords || [];
        updateData.html_content = article.htmlContent;
        updateData.structured_data = article.structuredData;
        updateData.meta_tags = article.metaTags;
      }

      if (research) {
        updateData.research_summary = research.summary;
      }

      if (metrics) {
        updateData.seo_score = metrics.seoScore;
        updateData.word_count = metrics.wordCount;
        updateData.security_score = metrics.securityScore;
      }

      if (images) {
        updateData.images = images.urls || images;
        updateData.images_success_count = images.successful || (Array.isArray(images.urls) ? images.urls.length : 0);
        updateData.images_failed_count = images.failed || 0;
      }

      if (optimizations) {
        updateData.optimizations = optimizations.applied || [];
        updateData.suggested_links = optimizations.suggestedLinks || [];
      }

      const { error: updateError } = await supabase
        .from('seo_articles')
        .update(updateData)
        .eq('id', articleId);

      if (updateError) {
        console.error('Error updating article:', updateError);
        throw new Error('Failed to update article');
      }

      console.log(`Article ${articleId} updated successfully`);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Article updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Error en la generación
      console.log(`Updating article ${articleId} with error status`);
      
      await supabase
        .from('seo_articles')
        .update({
          status: 'error',
          error_message: n8nError?.message || n8nError?.userMessage || 'Error generating article',
          error_details: n8nError || payload
        })
        .eq('id', articleId);

      return new Response(
        JSON.stringify({ success: false, message: 'Error recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
