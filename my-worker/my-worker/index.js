Since your GitHub Pages URL is whazorz.design-max.github.io, we should tighten the security in your Worker so that only your site can use the proxy. This prevents other people from "stealing" your Blizzard API quota.

Here is the updated index.js for your Worker and the setup for your GitHub site.

1. Updated index.js (Worker)
I have updated the Access-Control-Allow-Origin to specifically match your GitHub Pages URL.

JavaScript
export default {
  async fetch(request, env) {
    const corsHeaders = {
      // Specifically allowing your GitHub Pages URL
      "Access-Control-Allow-Origin": "https://whazorz.design-max.github.io",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle browser preflight check
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const realm = url.searchParams.get('realm');

    if (!name || !realm) {
      return new Response(JSON.stringify({ error: 'Missing name or realm' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    try {
      // 1. Get Blizzard OAuth Token
      const tokenRes = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      const { access_token } = await tokenRes.json();

      // 2. Fetch Character Data
      // Note: .toLowerCase() and .replace() help with realms like "Argent Dawn" -> "argent-dawn"
      const formattedRealm = realm.toLowerCase().trim().replace(/\s+/g, '-');
      const formattedName = name.toLowerCase().trim();

      const apiRes = await fetch(
        `https://eu.api.blizzard.com/profile/wow/character/${formattedRealm}/${formattedName}?namespace=profile-eu&locale=en_US`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const data = await apiRes.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Blizzard API Error" }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};