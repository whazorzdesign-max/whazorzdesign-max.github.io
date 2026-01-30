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
      // Default to 'eu' if region is not provided
      const region = url.searchParams.get('region')?.toLowerCase().trim() || 'eu';

      if (!name || !realm) throw new Error("Missing params");

      // 1. Get Auth Token (Blizzard uses different oauth URLs per region)
      const authUrl = region === 'cn' ? 'https://oauth.battlenet.com.cn/token' : `https://${region}.oauth.battle.net/token`;
      
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      const { access_token } = await tokenRes.json();

      // 2. Base API URL (e.g., us.api.blizzard.com)
      const apiBase = `https://${region}.api.blizzard.com`;
      const namespace = `profile-${region}`;

      // 3. Fetch Character Profile
      const profileRes = await fetch(`${apiBase}/profile/wow/character/${realm}/${name}?namespace=${namespace}&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const profile = await profileRes.json();

      // 4. Fetch Media and Guild Roster
      let media = {};
      let roster = [];
      
      const mediaRes = await fetch(`${apiBase}/profile/wow/character/${realm}/${name}/character-media?namespace=${namespace}&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      media = await mediaRes.json();

      if (profile.guild) {
        const guildSlug = profile.guild.name.toLowerCase().replace(/\s+/g, '-');
        const rosterRes = await fetch(`${apiBase}/data/wow/guild/${realm}/${guildSlug}/roster?namespace=${namespace}&locale=en_US`, {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        const rosterData = await rosterRes.json();
        roster = rosterData.members || [];
      }

      return new Response(JSON.stringify({ profile, media, roster, region }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};