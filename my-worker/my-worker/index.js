export default {
  async fetch(request, env) {
    // 1. Unified CORS headers for ALL responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Allows any site to call it (Fixes the GitHub error)
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Browser Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');

      if (!name || !realm) {
        return new Response(JSON.stringify({ error: "Missing Name/Realm" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // Check if secrets exist
      if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Worker secrets not set. Run 'wrangler secret put' commands." }), { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 2. Auth call
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      const { access_token } = await tokenRes.json();

      // 3. Fetch Character Data + Media
      const [profileRes, mediaRes] = await Promise.all([
        fetch(`https://eu.api.blizzard.com/profile/wow/character/${realm}/${name}?namespace=profile-eu&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        }),
        fetch(`https://eu.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-eu&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        })
      ]);

      const profile = await profileRes.json();
      const media = await mediaRes.json();

      return new Response(JSON.stringify({ profile, media }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      // FORCED CORS on error
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};