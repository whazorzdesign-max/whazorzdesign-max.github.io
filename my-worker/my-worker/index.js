export default {
  async fetch(request, env) {
    // 1. Definējam galvenes, kas atļauj visu nepieciešamo
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Proxy-Target", // Būtiski: Šeit jābūt X-Proxy-Target
      "Access-Control-Max-Age": "86400", // Kešatmiņa OPTIONS pieprasījumam
    };

    // 2. Apstrādājam Preflight (OPTIONS) pieprasījumu - bez šī būs CORS kļūda
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const proxyTarget = request.headers.get("X-Proxy-Target");

    // 3. Attēlu Proxy loģika
    if (proxyTarget) {
      try {
        const imageRes = await fetch(proxyTarget);
        if (!imageRes.ok) throw new Error("Blizzard noraidīja attēlu");
        
        const contentType = imageRes.headers.get("Content-Type");
        return new Response(await imageRes.arrayBuffer(), {
          headers: { ...corsHeaders, "Content-Type": contentType || "image/png" }
        });
      } catch (e) {
        return new Response(e.message, { status: 400, headers: corsHeaders });
      }
    }

    // 4. API loģika tēla datu iegūšanai
    try {
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase() || 'eu';

      if (!name || !realm) throw new Error("Trūkst vārds vai realm");

      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tRes = await fetch(`https://${region}.oauth.battle.net/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      
      const { access_token } = await tRes.json();

      const [pRes, mRes] = await Promise.all([
        fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}?namespace=profile-${region}&locale=en_US`, { headers: { Authorization: `Bearer ${access_token}` }}),
        fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`, { headers: { Authorization: `Bearer ${access_token}` }})
      ]);

      return new Response(JSON.stringify({ profile: await pRes.json(), media: await mRes.json() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};