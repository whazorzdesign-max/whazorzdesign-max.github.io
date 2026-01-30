export default {
  async fetch(request, env) {
    // 1. Setup CORS Headers (Allows your GitHub page to read the data)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Browser Preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 2. Parse Parameters
      const url = new URL(request.url);
      const name = url.searchParams.get('name')?.toLowerCase().trim();
      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');
      const region = url.searchParams.get('region')?.toLowerCase().trim() || 'eu';

      if (!name || !realm) {
        return new Response(JSON.stringify({ error: "Missing name or realm" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 3. Get Blizzard Auth Token
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch(`https://${region}.oauth.battle.net/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });

      if (!tokenRes.ok) throw new Error("Blizzard Auth Failed. Check your Secrets.");
      const { access_token } = await tokenRes.json();

      const apiBase = `https://${region}.api.blizzard.com`;
      const namespace = `profile-${region}`;

      // 4. Fetch Character Profile
      const profileRes = await fetch(`${apiBase}/profile/wow/character/${realm}/${name}?namespace=${namespace}&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      if (profileRes.status === 404) {
        return new Response(JSON.stringify({ error: "Character not found" }), { 
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const profile = await profileRes.json();

      // 5. Fetch Media (3D Render) and Guild Roster (Parallel)
      const [mediaRes, rosterRes] = await Promise.all([
        fetch(`${apiBase}/profile/wow/character/${realm}/${name}/character-media?namespace=${namespace}&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        }),
        profile.guild ? fetch(`${apiBase}/data/wow/guild/${realm}/${profile.guild.name.toLowerCase().replace(/\s+/g, '-')}/roster?namespace=${namespace}&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        }) : Promise.resolve({ json: () => ({ members: [] }) })
      ]);

      const media = await mediaRes.json();
      const rosterData = await rosterRes.json();

      // 6. Return Combined Data
      return new Response(JSON.stringify({ 
        profile, 
        media, 
        roster: rosterData.members || [], 
        region 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      // Return Error with CORS headers so the browser doesn't block the error message
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};