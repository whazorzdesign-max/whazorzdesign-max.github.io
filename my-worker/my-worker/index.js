export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase() || 'eu';

      if (!name || !realm) {
        return new Response(JSON.stringify({ error: "Missing Name or Realm" }), { 
          status: 400, headers: corsHeaders 
        });
      }

      // 1. Blizzard Auth
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch(`https://${region}.oauth.battle.net/token`, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: 'grant_type=client_credentials'
      });
      
      const { access_token } = await tokenRes.json();

      // 2. Fetch Character Media
      const mediaRes = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });
      
      if (!mediaRes.ok) throw new Error("Character not found or API down");
      
      const media = await mediaRes.json();
      
      // FALLBACK LOGIC: Try 'main-raw', then 'main', then 'avatar', then just the first asset found.
      const asset = media.assets.find(a => a.key === "main-raw") || 
                    media.assets.find(a => a.key === "main") || 
                    media.assets.find(a => a.key === "avatar") || 
                    media.assets[0];

      if (!asset) throw new Error("No assets found for this character");

      // 3. Convert to Base64 (Speed optimization)
      const imageFetch = await fetch(asset.value);
      const buffer = await imageFetch.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      
      return new Response(JSON.stringify({ 
        image: `data:image/png;base64,${base64}`,
        assetKey: asset.key
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: corsHeaders 
      });
    }
  }
};