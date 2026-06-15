'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const originalCreateServer = http.createServer;

const AUDIO_DIR = process.env.FLIPPER_SOUND_DIR || '/flipperone-testing/sound/audio_files';
const WALKIE_AUDIO = process.env.FLIPPER_WALKIE_AUDIO ||
    path.join(process.cwd(), 'assets/apps/walkie_talkie/415_audio.wav');
const LOG_FILE = process.env.FLIPPER_LAB_LOG_FILE || '/tmp/fake-flipctl.log';

const audioState = {
    output: 'speaker',
    speaker: 70,
    headphone: 70,
};

function writeJson(res, status, payload) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(payload));
}

function readJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        if (!body) {
            callback(null, {});
            return;
        }
        try {
            callback(null, JSON.parse(body));
        } catch (error) {
            callback(error, null);
        }
    });
}

function safeFilename(rawName) {
    let name;
    try {
        name = decodeURIComponent(String(rawName || ''));
    } catch (error) {
        return null;
    }
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
        return null;
    }
    return name;
}

function audioMime(filePath) {
    switch (path.extname(filePath).toLowerCase()) {
        case '.wav': return 'audio/wav';
        case '.ogg': return 'audio/ogg';
        case '.mp3': return 'audio/mpeg';
        case '.flac': return 'audio/flac';
        default: return 'application/octet-stream';
    }
}

function resolveAudioFile(name) {
    if (name === '415_audio.wav' && fs.existsSync(WALKIE_AUDIO)) {
        return WALKIE_AUDIO;
    }
    return path.join(AUDIO_DIR, name);
}

function serveAudio(req, res, name) {
    const fileName = safeFilename(name);
    if (!fileName) {
        res.writeHead(400);
        res.end('Bad audio filename');
        return;
    }

    const filePath = resolveAudioFile(fileName);
    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Audio not found');
        return;
    }

    const stat = fs.statSync(filePath);
    const headers = {
        'Content-Type': audioMime(filePath),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
    };

    const range = req.headers.range;
    if (range) {
        const match = range.match(/^bytes=(\d*)-(\d*)$/);
        if (match) {
            const start = match[1] ? parseInt(match[1], 10) : 0;
            const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
            if (start <= end && start >= 0 && end < stat.size) {
                res.writeHead(206, Object.assign({}, headers, {
                    'Content-Length': String(end - start + 1),
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                }));
                fs.createReadStream(filePath, { start, end }).pipe(res);
                return;
            }
        }
    }

    res.writeHead(200, Object.assign({}, headers, {
        'Content-Length': String(stat.size),
    }));
    fs.createReadStream(filePath).pipe(res);
}

function readLogTail(maxBytes) {
    const byteLimit = Math.max(4096, Math.min(1024 * 1024, maxBytes || 128 * 1024));
    const fd = fs.openSync(LOG_FILE, 'r');
    try {
        const stat = fs.fstatSync(fd);
        const start = Math.max(0, stat.size - byteLimit);
        const length = stat.size - start;
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, start);
        return {
            file: LOG_FILE,
            size: stat.size,
            truncated: start > 0,
            text: buffer.toString('utf8'),
        };
    } finally {
        fs.closeSync(fd);
    }
}

function handleLabEndpoint(req, res) {
    const urlPath = String(req.url || '').split('?')[0];

    if (req.method === 'GET' && urlPath.startsWith('/lab-audio/')) {
        serveAudio(req, res, urlPath.slice('/lab-audio/'.length));
        return true;
    }

    if (req.method === 'GET' && urlPath === '/lab-system/logs') {
        try {
            writeJson(res, 200, readLogTail(128 * 1024));
        } catch (error) {
            writeJson(res, 200, {
                file: LOG_FILE,
                size: 0,
                truncated: false,
                text: '',
                error: String(error && error.message || error),
            });
        }
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/system/reboot') {
        writeJson(res, 409, {
            success: false,
            error: 'Reboot is disabled in flipperone-lab containers.',
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/switch/flipctl') {
        writeJson(res, 409, {
            success: false,
            error: 'FlipCTL variant switching is disabled in flipperone-lab containers.',
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/update/apply') {
        writeJson(res, 409, {
            success: false,
            error: 'Self-update is disabled in flipperone-lab containers; rebuild the image instead.',
        });
        return true;
    }

    if (req.method === 'GET' && urlPath === '/api/sound/devices') {
        writeJson(res, 200, {
            defaultDevice: 'browser',
            devices: [{
                name: 'browser',
                cardName: 'Host browser',
                description: 'Browser audio on the Mac host',
                device: '0',
                detail: 'flipperone-lab',
            }],
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/sound/device') {
        readJsonBody(req, () => {
            writeJson(res, 200, { success: true, device: 'browser' });
        });
        return true;
    }

    if (req.method === 'GET' && urlPath === '/api/sound/outputs') {
        writeJson(res, 200, {
            current: audioState.output,
            outputs: [
                { id: 'speaker', label: 'Browser', device: 'browser' },
                { id: 'headphone', label: 'Browser HP', device: 'browser' },
            ],
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/sound/output') {
        readJsonBody(req, (error, data) => {
            const id = data && data.id === 'headphone' ? 'headphone' : 'speaker';
            audioState.output = id;
            writeJson(res, 200, { success: true, id, device: 'browser' });
        });
        return true;
    }

    if (req.method === 'GET' && urlPath === '/api/sound/volume') {
        writeJson(res, 200, {
            speaker: audioState.speaker,
            headphone: audioState.headphone,
            speakerMuted: audioState.speaker === 0,
            headphoneMuted: audioState.headphone === 0,
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/sound/volume') {
        readJsonBody(req, (error, data) => {
            if (error || !data || data.volume === undefined) {
                writeJson(res, 400, { success: false, error: 'Invalid request' });
                return;
            }
            const volume = Math.max(0, Math.min(100, parseInt(data.volume, 10) || 0));
            if (data.control === 'Headphone') {
                audioState.headphone = volume;
            } else {
                audioState.speaker = volume;
            }
            writeJson(res, 200, { success: true, volume, muted: volume === 0 });
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/sound/restart-driver') {
        writeJson(res, 200, {
            success: false,
            output: 'Audio driver restart is not available in the lab container.',
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/sound/play') {
        readJsonBody(req, (error, data) => {
            writeJson(res, error ? 400 : 200, error
                ? { success: false, error: 'Invalid request' }
                : { success: true, file: data && data.file, labAudio: true });
        });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/sound/stop') {
        writeJson(res, 200, { success: true, labAudio: true });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/walkie/play') {
        writeJson(res, 200, { success: true, labAudio: true });
        return true;
    }

    if (req.method === 'POST' && urlPath === '/api/walkie/stop') {
        writeJson(res, 200, { success: true, labAudio: true });
        return true;
    }

    return false;
}

http.createServer = function createLabAwareServer(options, listener) {
    let requestListener = listener;
    let serverOptions = options;

    if (typeof options === 'function') {
        requestListener = options;
        serverOptions = undefined;
    }

    if (typeof requestListener !== 'function') {
        return originalCreateServer.apply(this, arguments);
    }

    const wrappedListener = function wrappedLabListener(req, res) {
        if (handleLabEndpoint(req, res)) {
            return;
        }
        requestListener(req, res);
    };

    if (serverOptions === undefined) {
        return originalCreateServer.call(this, wrappedListener);
    }
    return originalCreateServer.call(this, serverOptions, wrappedListener);
};

console.log('[flipper-lab] runtime preload active');
