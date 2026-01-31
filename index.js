export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const name = url.searchParams.get("name")?.toLowerCase();
    const realm = url.searchParams.get("realm")?.toLowerCase();
    const region = url.searchParams.get("region")?.toLowerCase() || 'us';
    const proxyUrl = url.searchParams.get("proxy");

    // NEW: Proxy functionality to bypass CORS
    if (proxyUrl) {
      const imageResponse = await fetch(proxyUrl);
      const newHeaders = new Headers(imageResponse.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(imageResponse.body, {
        status: imageResponse.status,
        headers: newHeaders,
      });
    }

    // Existing Character Logic
    if (!name || !realm) return new Response("Missing params", { status: 400 });

    const apiUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/character-media?namespace=profile-${region}&locale=en_US`;
    
    // Note: You need your Blizzard Token logic here (shortened for brevity)
    const res = await fetch(apiUrl, {
      headers: { "Authorization": `Bearer ${env.BLIZZARD_TOKEN}` } 
    });
    const data = await res.json();

    // Add CORS to the JSON response
    return new Response(JSON.stringify(data), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  }
}