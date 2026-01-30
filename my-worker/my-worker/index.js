export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const proxyUrl = url.searchParams.get('proxyUrl');

    // IMAGE PROXY: Fixes the 3D texture CORS error
    if (proxyUrl) {
      const imageRes = await fetch(proxyUrl);
      const contentType = imageRes.headers.get("Content-Type");
      return new Response(await imageRes.arrayBuffer(), {
        headers: { ...corsHeaders, "Content-Type": contentType || "image/png" }
      });
    }

    try {
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase() || 'eu';

      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch(`https://${region}.oauth.battle.net/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      const { access_token } = await tokenRes.json();

      const [profileRes, mediaRes] = await Promise.all([
        fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}?namespace=profile-${region}&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        }),
        fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        })
      ]);

      return new Response(JSON.stringify({ profile: await profileRes.json(), media: await mediaRes.json() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};