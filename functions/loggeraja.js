// functions/api/[[path]].js - Untuk Cloudflare Pages Functions

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1452653310443257970/SkdnTLTdZUq5hJUf7POXHYcILxlYIVTS7TVc-NYKruBSlotTJtA2BzHY9bEACJxrlnd5";

const BOT_USERNAME = "Ndraawz Hub Logger";
const BOT_AVATAR_URL = "https://cdn.discordapp.com/attachments/1464912658108125278/1472698650848395451/icon.png";
const FOOTER_ICON_URL = "https://cdn.discordapp.com/attachments/1464912658108125278/1472698650848395451/icon.png";
const EMBED_COLOR = 0x00e5ff;

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

// Format untuk Cloudflare Pages Functions
export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Handle GET - untuk test/display
    if (request.method === 'GET') {
        return new Response(JSON.stringify({
            status: 'online',
            message: '🚀 Ndraawz Logger System is running!',
            endpoints: {
                POST: '/ - Send JSON with type: "player" or "security"'
            },
            example: {
                player: {
                    type: "player",
                    fields: [
                        { name: "👤 Player", value: "YourName", inline: false }
                    ]
                },
                security: {
                    type: "security",
                    message: "Security alert message"
                }
            }
        }, null, 2), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
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

    // Get client IP dan Geolocation dari Cloudflare
    const clientIp = request.headers.get('cf-connecting-ip') || 
                    request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    "unknown";
    const cleanIp = clientIp.replace('::ffff:', '').trim();

    // Get geolocation from Cloudflare (built-in)
    const cf = request.cf || {};
    const geoData = {
        country: cf.country || "N/A",
        region: cf.region || "N/A",
        city: cf.city || "N/A",
        isp: cf.isp || "N/A",
        asn: cf.asn || "N/A",
        timezone: cf.timezone || "N/A",
        latitude: cf.latitude || "N/A",
        longitude: cf.longitude || "N/A"
    };

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
                footer: { 
                    text: `Ndraawz Logger System | IP: ${cleanIp}`, 
                    icon_url: FOOTER_ICON_URL 
                },
                timestamp: new Date().toISOString(),
                fields: [
                    { name: "📡 IP Address", value: cleanIp, inline: false },
                    { name: "🌍 Location", value: `${geoData.city}, ${geoData.region}, ${geoData.country}`, inline: false }
                ]
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
            const allFields = [
                ...data.fields,
                { name: "━━━━━━━━━━━━━━ 🌐 IP INFORMATION ━━━━━━━━━━━━━━", value: "ㅤ", inline: false },
                { name: "📡 IP Address", value: cleanIp || "N/A", inline: false },
                { name: "🚩 Country", value: geoData.country, inline: false },
                { name: "📍 Region", value: geoData.region, inline: false },
                { name: "🏙️ City", value: geoData.city, inline: false },
                { name: "🏢 ISP", value: geoData.isp, inline: false },
                { name: "🔢 ASN", value: geoData.asn, inline: false },
                { name: "🕐 Timezone", value: geoData.timezone, inline: false },
                { name: "📌 Coordinates", value: `${geoData.latitude}, ${geoData.longitude}`, inline: false }
            ];

            const embed = {
                title: "🚀 Ndraawz Logger System",
                color: EMBED_COLOR,
                fields: allFields,
                footer: { 
                    text: `Ndraawz Logger System | ${new Date().toLocaleString()}`, 
                    icon_url: FOOTER_ICON_URL 
                },
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
        return new Response(JSON.stringify({ error: 'Invalid JSON', detail: err.message }), {
            status: 400,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}
