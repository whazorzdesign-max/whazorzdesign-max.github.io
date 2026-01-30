export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Allows your GitHub page to connect
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase().trim() || 'eu';

      if (!name || !realm) {
        return new Response(JSON.stringify({ error: "Missing name or realm" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 1. Get Token
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch(`https://${region}.oauth.battle.net/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      
      if (!tokenRes.ok) throw new Error("Blizzard Auth Failed");
      const { access_token } = await tokenRes.json();

      // 2. Fetch Profile
      const profileRes = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}?namespace=profile-${region}&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      // If character/realm is spelled wrong (404), return a clean JSON error with CORS
      if (!profileRes.ok) {
        return new Response(JSON.stringify({ error: "Character or Realm not found" }), { 
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const profile = await profileRes.json();

      // 3. Fetch Media
      const mediaRes = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const media = await mediaRes.json();

      // 4. Return Data
      return new Response(JSON.stringify({ profile, media }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      // Critical Catch: Always returns CORS headers even on a major crash
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};