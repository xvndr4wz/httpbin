// functions/api/loader/[[path]].js - Dengan KV Binding ndraawz-storage

const SETTINGS = {
    TOTAL_LAYERS: 5,
    RATE_LIMIT_MS: 10000,
    RATE_LIMIT_MAX: 3,
    SESSION_TTL: 10000,
    PLAIN_TEXT_URL: "https://pastefy.app/cMzbfLvJ/raw",
    REAL_SCRIPT_URL: "https://pastefy.app/Uy6DD9Dy/raw",
    LOGGER_SCRIPT_URL: "https://raw.githubusercontent.com/xvndr4wz/loader-api/refs/heads/main/api/logger/logscript.lua"
};

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

async function sendSecurityLogToLogJs(message, ip, type) {
    const data = JSON.stringify({
        type: "security",
        securityType: type,
        message: message,
        ip: ip
    });

    try {
        await fetch('https://api-ndraawz.vercel.app/api/logger/loggeraja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data
        });
        return true;
    } catch (e) {
        return false;
    }
}

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

// === FUNGSI DENGAN KV (Gunakan ndraawz-storage) ===

async function saveSessionToKV(env, sessionId, sessionData) {
    try {
        await env['ndraawz-storage'].put(`session:${sessionId}`, JSON.stringify(sessionData), {
            expirationTtl: 30
        });
        return true;
    } catch (e) {
        return false;
    }
}

async function getSessionFromKV(env, sessionId) {
    try {
        const data = await env['ndraawz-storage'].get(`session:${sessionId}`);
        if (!data) return null;
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

async function deleteSessionFromKV(env, sessionId) {
    try {
        await env['ndraawz-storage'].delete(`session:${sessionId}`);
        return true;
    } catch (e) {
        return false;
    }
}

async function saveRateLimitToKV(env, ip, data) {
    try {
        await env['ndraawz-storage'].put(`ratelimit:${ip}`, JSON.stringify(data), {
            expirationTtl: 15
        });
        return true;
    } catch (e) {
        return false;
    }
}

async function getRateLimitFromKV(env, ip) {
    try {
        const data = await env['ndraawz-storage'].get(`ratelimit:${ip}`);
        if (!data) return null;
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

async function makeSession(env, ownerIp, stepSequence, currentIndex) {
    const now = Date.now();
    const ipPart = ownerIp.split('.').pop() || "0";
    const seed = parseInt(ipPart) + Math.floor(Math.random() * 10000);
    const newSessionID = seed.toString(36).substring(0, 4).padEnd(4, 'x');
    const nextKey = Math.random().toString(36).substring(2, 8);

    const sessionData = {
        ownerIP: ownerIp,
        stepSequence: stepSequence,
        currentIndex: currentIndex,
        nextKey: nextKey,
        lastTime: now,
        used: false
    };

    await saveSessionToKV(env, newSessionID, sessionData);
    return { newSessionID, nextKey };
}

async function expireSession(env, id) {
    const session = await getSessionFromKV(env, id);
    if (session) {
        session.used = true;
        await saveSessionToKV(env, id, session);
        setTimeout(async () => {
            await deleteSessionFromKV(env, id);
        }, SETTINGS.SESSION_TTL);
    }
}

// ========== HANDLER CLOUDFLARE PAGES ==========
export async function onRequest(context) {
    const { request, env } = context;

    const headers = {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405, headers });
    }

    const now = Date.now();

    const clientIp = request.headers.get('cf-connecting-ip') ||
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    "unknown";
    const cleanIp = clientIp.replace('::ffff:', '').trim();

    const agent = request.headers.get('user-agent') || "";

    const isRoblox = agent.includes("Roblox") ||
                     agent.includes("RobloxApp") ||
                     request.headers.get('roblox-id') !== null ||
                     request.headers.get('x-roblox-place-id') !== null;

    const isDiscord = agent.includes("Discordbot");

    if (!isRoblox || isDiscord) {
        const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
        return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
            status: getRandomError(),
            headers
        });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const search = url.search;

    const params = search ? search.replace('?', '').split('.') : [];
    const step = params[0] || '0';
    const id = params[1] || '';
    const key = params[2] || '';

    const currentStep = parseInt(step) || 0;
    const host = request.headers.get('host') || 'your-domain.pages.dev';

    try {
        if (currentStep === 0) {
            let rateData = await getRateLimitFromKV(env, cleanIp);

            if (!rateData) {
                rateData = { count: 1, firstRequestAt: now };
                await saveRateLimitToKV(env, cleanIp, rateData);
            } else {
                const elapsed = now - rateData.firstRequestAt;

                if (elapsed < SETTINGS.RATE_LIMIT_MS) {
                    rateData.count++;
                    await saveRateLimitToKV(env, cleanIp, rateData);

                    if (rateData.count > SETTINGS.RATE_LIMIT_MAX) {
                        const sisaCooldown = Math.ceil((SETTINGS.RATE_LIMIT_MS - elapsed) / 1000);
                        await sendSecurityLogToLogJs(
                            `🚨 SPAM DETECTED\nIP: ${cleanIp}\nLoad ke: ${rateData.count}x\nSisa cooldown: ${sisaCooldown} detik`,
                            cleanIp,
                            "spam_detect"
                        );
                        const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
                        return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
                            status: getRandomError(),
                            headers
                        });
                    }
                } else {
                    rateData = { count: 1, firstRequestAt: now };
                    await saveRateLimitToKV(env, cleanIp, rateData);
                }
            }

            let sequence = [];
            while (sequence.length < SETTINGS.TOTAL_LAYERS) {
                let r = Math.floor(Math.random() * 300) + 1;
                if (!sequence.includes(r)) sequence.push(r);
            }

            const { newSessionID, nextKey } = await makeSession(env, cleanIp, sequence, 0);
            const nextUrl = `https://${host}${pathname}?${sequence[0]}.${newSessionID}.${nextKey}`;

            return new Response(obfuscateUrl(nextUrl), {
                status: 200,
                headers
            });
        }

        const session = await getSessionFromKV(env, id);

        if (!session || session.ownerIP !== cleanIp) {
            const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
            return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers
            });
        }

        if (currentStep !== session.stepSequence[session.currentIndex]) {
            await expireSession(env, id);
            return new Response("SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers
            });
        }

        if (session.used === true) {
            await sendSecurityLogToLogJs(
                `REPLAY ATTACK DETECTED\nIP: ${cleanIp}\nKey: ${key}\nSession ID: ${id}`,
                cleanIp,
                "replay_attack"
            );
            return new Response("SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers
            });
        }

        if (session.nextKey !== key) {
            await sendSecurityLogToLogJs(
                `INVALID KEY DETECTED\nIP: ${cleanIp}\nKey dikirim: ${key}`,
                cleanIp,
                "invalid_key"
            );
            await expireSession(env, id);
            return new Response("SECURITY : BANNED ACCESS!", {
                status: getRandomError(),
                headers
            });
        }

        const idx = session.currentIndex;

        if (idx === SETTINGS.TOTAL_LAYERS - 1) {
            const mainScript = await fetchRaw(SETTINGS.REAL_SCRIPT_URL);
            await expireSession(env, id);
            return new Response(mainScript || '', {
                status: 200,
                headers
            });
        }

        if (idx === SETTINGS.TOTAL_LAYERS - 2) {
            const nextIdx = SETTINGS.TOTAL_LAYERS - 1;
            const nextStepNumber = session.stepSequence[nextIdx];
            const { newSessionID, nextKey } = await makeSession(env, session.ownerIP, session.stepSequence, nextIdx);
            await expireSession(env, id);

            const loggerScript = await fetchRaw(SETTINGS.LOGGER_SCRIPT_URL);
            const nextUrl = `https://${host}${pathname}?${nextStepNumber}.${newSessionID}.${nextKey}`;

            const luaScript = obfuscateUrl(nextUrl) + "\n" + (loggerScript || '');
            return new Response(luaScript, {
                status: 200,
                headers
            });
        }

        const nextIdx = idx + 1;
        const nextStepNumber = session.stepSequence[nextIdx];
        const { newSessionID, nextKey } = await makeSession(env, session.ownerIP, session.stepSequence, nextIdx);
        await expireSession(env, id);

        const nextUrl = `https://${host}${pathname}?${nextStepNumber}.${newSessionID}.${nextKey}`;
        return new Response(obfuscateUrl(nextUrl), {
            status: 200,
            headers
        });

    } catch (err) {
        console.error(`[LOADER] Error: ${err.message}`);
        const plainResp = await fetchRaw(SETTINGS.PLAIN_TEXT_URL);
        return new Response(plainResp || "SECURITY : BANNED ACCESS!", {
            status: getRandomError(),
            headers
        });
    }
                     }
