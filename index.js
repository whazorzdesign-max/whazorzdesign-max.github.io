export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Proxy-Target",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // PĀRBAUDE: Vai tiek pieprasīts attēla proxy caur Headeri
    const proxyTarget = request.headers.get("X-Proxy-Target");
    if (proxyTarget) {
      try {
        const imageRes = await fetch(proxyTarget);
        return new Response(await imageRes.arrayBuffer(), {
          headers: { ...corsHeaders, "Content-Type": imageRes.headers.get("Content-Type") || "image/png" }
        });
      } catch (e) {
        return new Response("Image Proxy Error", { status: 400, headers: corsHeaders });
      }
    }

    // STANDARTA API LOGIKA
    try {
      const url = new URL(request.url);
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase() || 'eu';

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