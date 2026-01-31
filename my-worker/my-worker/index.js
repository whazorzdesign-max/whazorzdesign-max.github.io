export default {

  async fetch(request, env) {

    const corsHeaders = {

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods": "GET, OPTIONS",

      "Access-Control-Allow-Headers": "Content-Type",

    };



    if (request.method === "OPTIONS") {

      return new Response(null, { headers: corsHeaders });

    }



    try {

      const url = new URL(request.url);

      const name = url.searchParams.get('name')?.toLowerCase().trim();

      const realm = url.searchParams.get('realm')?.toLowerCase().trim().replace(/\s+/g, '-');

      const region = url.searchParams.get('region')?.toLowerCase() || 'eu';



      if (!name || !realm) {

        return new Response(JSON.stringify({ error: "Missing Name or Realm" }), { 

          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 

        });

      }



      // 1. Get Blizzard Auth Token

      const auth = btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`);

      const tokenRes = await fetch(`https://${region}.oauth.battle.net/token`, {

        method: 'POST',

        headers: { 

          'Authorization': `Basic ${auth}`, 

          'Content-Type': 'application/x-www-form-urlencoded' 

        },

        body: 'grant_type=client_credentials'

      });



      if (!tokenRes.ok) throw new Error("Blizzard Auth Failed");

      const { access_token } = await tokenRes.json();



      // 2. Fetch Character Media

      const mediaUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`;

      

      const mediaRes = await fetch(mediaUrl, {

        headers: { 'Authorization': `Bearer ${access_token}` }

      });



      if (!mediaRes.ok) throw new Error("Character Media Not Found");

      const media = await mediaRes.json();



      return new Response(JSON.stringify({ media }), {

        headers: { ...corsHeaders, "Content-Type": "application/json" }

      });



    } catch (err) {

      return new Response(JSON.stringify({ error: err.message }), { 

        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 

      });

    }

  }

};