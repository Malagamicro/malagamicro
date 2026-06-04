import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audio, mimeType } = await req.json();
    if (!audio) {
      return new Response(JSON.stringify({ error: "No audio provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format detection (supports wav, mp3, m4a, webm, ogg, etc.)
    let audioFormat = "mp3";
    if (mimeType) {
      if (mimeType.includes("wav")) audioFormat = "wav";
      else if (mimeType.includes("mp3")) audioFormat = "mp3";
      else if (mimeType.includes("m4a")) audioFormat = "m4a";
      else if (mimeType.includes("webm")) audioFormat = "webm";
      else if (mimeType.includes("ogg")) audioFormat = "ogg";
    }

    console.log(`Sending transcription request with format: ${audioFormat} to openai/gpt-4o-mini-transcribe`);

    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-transcribe",
        input_audio: {
          data: audio,
          format: audioFormat,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter transcription error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Transcription failed: ${response.status} - ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const transcription = data.text || "";

    console.log("Transcription result:", transcription);

    return new Response(JSON.stringify({ transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
