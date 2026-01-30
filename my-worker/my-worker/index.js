export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Open for testing, can restrict to your github url later
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const name = url.searchParams.get('name')?.toLowerCase().trim();
    const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');

    if (!name || !realm) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });
    }

    try {
      // 1. Get Auth Token
      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);
      const tokenRes = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      const { access_token } = await tokenRes.json();

      // 2. Fetch Profile Data
      const profileRes = await fetch(`https://eu.api.blizzard.com/profile/wow/character/${realm}/${name}?namespace=profile-eu&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const profileData = await profileRes.json();

      // 3. Fetch Media (The 3D Renders/Avatars)
      const mediaRes = await fetch(`https://eu.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-eu&locale=en_US`, {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const mediaData = await mediaRes.json();

      // Combine and Return
      return new Response(JSON.stringify({ profile: profileData, media: mediaData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};