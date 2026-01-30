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
      const region = url.searchParams.get('region')?.toLowerCase().trim() || 'eu';

      if (!name || !realm) throw new Error("Missing name or realm");

      // 1. Get Auth Token
      const authUrl = region === 'cn' ? 'https://oauth.battlenet.com.cn/token' : `https://${region}.oauth.battle.net/token`;
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      
      const tokenRes = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });

      if (!tokenRes.ok) throw new Error("Blizzard Auth Failed. Check your Secrets!");
      const { access_token } = await tokenRes.json();

      const apiBase = `https://${region}.api.blizzard.com`;
      const namespace = `profile-${region}`;

      // 2. Fetch Profile
      const profileRes = await fetch(`${apiBase}/profile/wow/character/${realm}/${name}?namespace=${namespace}&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      // CRITICAL: If character isn't found, stop here and return a clean error
      if (profileRes.status === 404) {
        return new Response(JSON.stringify({ error: "Character Not Found" }), { 
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const profile = await profileRes.json();

      // 3. Fetch Media and Guild (Parallel)
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

      return new Response(JSON.stringify({ 
        profile, 
        media, 
        roster: rosterData.members || [], 
        region 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      // This catches any other crash and still returns CORS headers
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }