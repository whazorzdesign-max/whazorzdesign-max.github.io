export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // --- NEW: Proxy Mode to bypass Blizzard CORS ---
    const proxyUrl = url.searchParams.get('proxy');
    if (proxyUrl) {
      const imageRes = await fetch(proxyUrl);
      const { readable, writable } = new TransformStream();
      imageRes.body.pipeTo(writable);
      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": imageRes.headers.get("Content-Type") || "image/png",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    try {
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase() || 'eu';

      if (!name || !realm) {
        return new Response(JSON.stringify({ error: "Missing Name or Realm" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch(`https://${region}.oauth.battle.net/token`, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: 'grant_type=client_credentials'
      });

      if (!tokenRes.ok) throw new Error("Blizzard Auth Failed");
      const { access_token } = await tokenRes.json();

      const mediaUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`;
      const mediaRes = await fetch(mediaUrl, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });

      if (!mediaRes.ok) throw new Error("Character Media Not Found");
      const media = await mediaRes.json();

      return new Response(JSON.stringify({ media }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};