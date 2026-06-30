// functions/api/loader/[[path]].js - Cloudflare Pages Functions
// LOADER DENGAN MULTI-LAYER PROTECTION

const SETTINGS = {
    TOTAL_LAYERS: 5,
    RATE_LIMIT_MS: 10000,
    RATE_LIMIT_MAX: 3,
    SESSION_TTL: 10000,
    PLAIN_TEXT_URL: "https://pastefy.app/cMzbfLvJ/raw",
    REAL_SCRIPT_URL: "https://pastefy.app/Uy6DD9Dy/raw",
    LOGGER_SCRIPT_URL: "https://raw.githubusercontent.com/xvndr4wz/loader-api/refs/heads/main/api/logger/logscript.lua"
};

// State untuk menyimpan sessions dan rate limits (di global scope)
let sessions = {};
let rateLimits = {};

// Fetch raw content dengan fetch API
async function fetchRaw(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.text();
    } catch (e) {
        return null;
    }
}

function getRandomError() {
    const errorCodes = [400, 401, 403, 404, 500, 502, 503];
    return errorCodes[Math.floor(Math.random() * errorCodes.length)];
}

// Send security log ke endpoint logger
async function sendSecurityLogToLogJs(message, ip, type) {
    const data = JSON.stringify({
        type: "security",
        securityType: type,
        message: message,
        ip: ip
    });

    try {
        const response = await fetch('https://httpbin-ndraawz.pages.dev/api/loggeraja', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: data
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

// Obfuscate URL ke Lua script
function obfuscateUrl(url) {
    const safeUrl = url.trim();
    const parts = [];
    let i = 0;
    while (i < safeUrl.length) {
        const len = Math.floor(Math.random() * 3) + 2;
        parts.push(safeUrl.substring(i, i + len));
        i += len;
    }

    const indices = [...Array(parts.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const shuffledParts = indices.map(i => parts[i]);
    const arrayStr = shuffledParts.map(p => {
        const escaped = p
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\0/g, '\\0');
        return `'${escaped}'`;
    }).join(',');

    const orderMap = new Array(parts.length);
    indices.forEach((originalIdx, shuffledIdx) => {
        orderMap[originalIdx] = shuffledIdx + 1;
    });

    const luaKeywords = ['do', 'if', 'in', 'or', 'and', 'end', 'for', 'nil', 'not', 'repeat', 'then', 'true', 'false', 'local', 'while', 'break', 'else', 'elseif', 'function', 'return', 'until'];
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let varName = '';
    do {
        varName = '';
        const varLen = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < varLen; i++) {
            varName += chars[Math.floor(Math.random() * chars.length)];
        }
    } while (luaKeywords.includes(varName));

    const concatStr = orderMap.map(i => `${varName}[${i}]`).join('..');
    return `local ${varName}={${arrayStr}}loadstring(game:HttpGet(${concatStr}))()`;
}

// Membuat session baru
function makeSession(ownerIp, stepSequence, currentIndex) {
    const now = Date.now();
    const ipPart = ownerIp.split('.').pop() || "0";
    const seed = parseInt(ipPart) + Math.floor(Math.random() * 10000);
    const newSessionID = seed.toString(36).substring(0, 4).padEnd(4, 'x');
    const nextKey = Math.random().toString(36).substring(2, 8);

    sessions[newSessionID] = {
        ownerIP: ownerIp,
        stepSequence: stepSequence,
        currentIndex: currentIndex,
        nextKey: nextKey,
        lastTime: now,
        used: false
    };

    return { newSessionID, nextKey };
}

// Expire session (tandai used dan hapus setelah TTL)
function expireSession(id) {
    if (sessions[id]) {
        sessions[id].used = true;
        setTimeout(() => {
            delete sessions[id];
        }, SETTINGS.SESSION_TTL);
    }
}

// Cleanup session dan rate limit setiap 5 menit
setInterval(() => {
    const now = Date.now();
    for (const id in sessions) {
        if (now - sessions[id].lastTime > 300000) {
            delete sessions[id];
        }
    }
    for (const ip in rateLimits) {
        if (now - rateLimits[ip].firstRequestAt > SETTINGS.RATE_LIMIT_MS) {
            delete rateLimits[ip];
        }
    }
}, 300000);

// ========== EXPORT HANDLER UNTUK CLOUDFLARE PAGES ==========
export async function onRequest(context) {
    const { request } = context;

    // Headers response
    const headers = {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    // Handle OPTIONS
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: headers
        });
    }

    // Hanya allow GET
    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: headers
        });
    }

    const now = Date.now();

    // Get client IP (sama seperti versi logger)
    const clientIp = request.headers.get('cf-connecting-ip') ||
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    "unknown";
    const cleanIp = clientIp.replace('::ffff:', '').trim();

    // Get User-Agent
    const agent = request.headers.get('user-agent') || "";

    // Cek apakah dari Roblox
    const isRoblox = agent.includes("Roblox") ||
                     agent.includes("RobloxApp") ||
                     request.headers.get('roblox-id') !== null ||
                     request.headers.get('x-roblox-place-id') !== null;

    const isDiscord = agent.includes("Discordbot");

    // Jika bukan Roblox atau Discord bot
    if (!isRoblox || isDiscord) {
        const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
        return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
            status: getRandomError(),
            headers: headers
        });
    }

    // Parse URL
    const url = new URL(request.url);
    const pathname = url.pathname;
    const search = url.search;

    // Parse params dari query string (format: step.id.key)
    const params = search ? search.replace('?', '').split('.') : [];
    const step = params[0] || '0';
    const id = params[1] || '';
    const key = params[2] || '';

    const currentStep = parseInt(step) || 0;
    const host = request.headers.get('host') || 'your-domain.pages.dev';

    try {
        // ========== STEP 0: RATE LIMIT + INIT SESSION ==========
        if (currentStep === 0) {
            // Rate limit check
            if (!rateLimits[cleanIp]) {
                rateLimits[cleanIp] = { count: 1, firstRequestAt: now };
            } else {
                const rateData = rateLimits[cleanIp];
                const elapsed = now - rateData.firstRequestAt;

                if (elapsed < SETTINGS.RATE_LIMIT_MS) {
                    rateData.count++;
                    if (rateData.count > SETTINGS.RATE_LIMIT_MAX) {
                        const sisaCooldown = Math.ceil((SETTINGS.RATE_LIMIT_MS - elapsed) / 1000);
                        await sendSecurityLogToLogJs(
                            `🚨 SPAM DETECTED\nIP: ${cleanIp}\nLoad ke: ${rateData.count}x (maks ${SETTINGS.RATE_LIMIT_MAX}x per ${SETTINGS.RATE_LIMIT_MS / 1000} detik)\nSisa cooldown: ${sisaCooldown} detik`,
                            cleanIp,
                            "spam_detect"
                        );
                        const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
                        return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
                            status: getRandomError(),
                            headers: headers
                        });
                    }
                } else {
                    rateLimits[cleanIp] = { count: 1, firstRequestAt: now };
                }
            }

            // Generate sequence angka acak untuk setiap layer
            let sequence = [];
            while (sequence.length < SETTINGS.TOTAL_LAYERS) {
                let r = Math.floor(Math.random() * 300) + 1;
                if (!sequence.includes(r)) sequence.push(r);
            }

            const { newSessionID, nextKey } = makeSession(cleanIp, sequence, 0);
            const nextUrl = `https://${host}${pathname}?${sequence[0]}.${newSessionID}.${nextKey}`;

            return new Response(obfuscateUrl(nextUrl), {
                status: 200,
                headers: headers
            });
        }

        // ========== VALIDASI SESSION ==========
        const session = sessions[id];

        if (!session || session.ownerIP !== cleanIp) {
            const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
            return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers: headers
            });
        }

        // Cek step
        if (currentStep !== session.stepSequence[session.currentIndex]) {
            expireSession(id);
            return new Response("SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers: headers
            });
        }

        // Cek replay attack
        if (session.used === true) {
            await sendSecurityLogToLogJs(
                `REPLAY ATTACK DETECTED\nIP: ${cleanIp}\nKey: ${key}\nSession ID: ${id}`,
                cleanIp,
                "replay_attack"
            );
            return new Response("SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers: headers
            });
        }

        // Cek invalid key
        if (session.nextKey !== key) {
            await sendSecurityLogToLogJs(
                `INVALID KEY DETECTED\nIP: ${cleanIp}\nKey dikirim: ${key}`,
                cleanIp,
                "invalid_key"
            );
            expireSession(id);
            return new Response("SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers: headers
            });
        }

        const idx = session.currentIndex;

        // ========== LAYER TERAKHIR: MAIN SCRIPT ==========
        if (idx === SETTINGS.TOTAL_LAYERS - 1) {
            const mainScript = await fetchRaw(SETTINGS.REAL_SCRIPT_URL);
            expireSession(id);
            return new Response(mainScript || '', {
                status: 200,
                headers: headers
            });
        }

        // ========== LAYER SEBELUM TERAKHIR: LOGGER + LOADSTRING ==========
        if (idx === SETTINGS.TOTAL_LAYERS - 2) {
            const nextIdx = SETTINGS.TOTAL_LAYERS - 1;
            const nextStepNumber = session.stepSequence[nextIdx];
            const { newSessionID, nextKey } = makeSession(session.ownerIP, session.stepSequence, nextIdx);
            expireSession(id);

            const loggerScript = await fetchRaw(SETTINGS.LOGGER_SCRIPT_URL);
            const nextUrl = `https://${host}${pathname}?${nextStepNumber}.${newSessionID}.${nextKey}`;

            const luaScript = obfuscateUrl(nextUrl) + "\n" + (loggerScript || '');
            return new Response(luaScript, {
                status: 200,
                headers: headers
            });
        }

        // ========== LAYER BIASA: REDIRECT KE LAYER BERIKUTNYA ==========
        const nextIdx = idx + 1;
        const nextStepNumber = session.stepSequence[nextIdx];
        const { newSessionID, nextKey } = makeSession(session.ownerIP, session.stepSequence, nextIdx);
        expireSession(id);

        const nextUrl = `https://${host}${pathname}?${nextStepNumber}.${newSessionID}.${nextKey}`;
        return new Response(obfuscateUrl(nextUrl), {
            status: 200,
            headers: headers
        });

    } catch (err) {
        console.error(`[LOADER] Error: ${err.message}`);
        const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
        return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
            status: getRandomError(),
            headers: headers
        });
    }
            }
