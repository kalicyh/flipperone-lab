(function() {
    'use strict';

    var SOURCE = 'flipperone-lab-api';
    var HOOK_STORAGE_KEY = 'flipperone.lab.apiHooks.v2';
    var MAX_LOGS = 300;
    var isTopWindow = window.top === window;

    var NativeFetch = window.fetch ? window.fetch.bind(window) : null;
    var NativeOpen = XMLHttpRequest.prototype.open;
    var NativeSend = XMLHttpRequest.prototype.send;
    var NativeSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    var NativeAbort = XMLHttpRequest.prototype.abort;

    var logs = [];
    var hooks = [];
    var selectedLogId = null;
    var selectedHookId = null;
    var logSeq = 1;
    var systemLog = { text: '', file: '', error: '' };
    var systemLogTimer = null;
    var activeAudio = null;
    var currentVolume = 0.7;

    var panel = {
        root: null,
        networkTab: null,
        hooksTab: null,
        logList: null,
        logDetail: null,
        hookList: null,
        hookForm: null,
        activeTab: 'logs'
    };

    var defaultHooks = [
        {
            id: 'power',
            label: 'Power status',
            method: 'GET',
            path: '/api/power',
            enabled: true,
            status: 200,
            body: {
                available: true,
                status: 'Charging',
                capacity: 87,
                voltage: 7.724,
                current: 1.12,
                power: 8.65,
                chargeNow: 3.28,
                chargeFull: 4.1,
                timeToEmpty: null,
                timeToFull: 1800,
                temp: 312
            }
        },
        {
            id: 'battery-temp',
            label: 'Battery temperature',
            method: 'GET',
            path: '/api/battery/temp',
            enabled: true,
            status: 200,
            body: { zone: 'thermal_zone1', type: 'bq28z610-0', tempC: 31.2 }
        },
        {
            id: 'power-usage',
            label: 'Power usage',
            method: 'GET',
            path: '/api/power/usage',
            enabled: true,
            status: 200,
            body: { watts: 8.65 }
        },
        {
            id: 'wifi',
            label: 'Wi-Fi status',
            method: 'GET',
            path: '/api/wifi',
            enabled: true,
            status: 200,
            body: {
                connected: true,
                quality: 82,
                ssid: 'Lab Wi-Fi',
                iface: 'wlan0',
                ip4: ['192.168.1.42/24'],
                ip6: []
            }
        },
        {
            id: 'wifi-scan',
            label: 'Wi-Fi scan',
            method: 'GET',
            path: '/api/wifi/scan',
            enabled: true,
            status: 200,
            body: {
                ready: true,
                networks: [
                    { ssid: 'Lab Wi-Fi', signal: 82, security: 'WPA2' },
                    { ssid: 'Coffee Shop', signal: 57, security: 'WPA2' },
                    { ssid: 'Open Lab', signal: 41, security: '' }
                ]
            }
        },
        {
            id: 'wifi-power',
            label: 'Wi-Fi power',
            method: 'GET',
            path: '/api/wifi/power',
            enabled: true,
            status: 200,
            body: { enabled: true }
        },
        {
            id: 'wifi-power-post',
            label: 'Set Wi-Fi power',
            method: 'POST',
            path: '/api/wifi/power',
            enabled: true,
            status: 200,
            body: { ok: true, enabled: true }
        },
        {
            id: 'wifi-connect',
            label: 'Wi-Fi connect',
            method: 'POST',
            path: '/api/wifi/connect',
            enabled: true,
            status: 200,
            body: { ok: true, output: 'connected (lab hook)' }
        },
        {
            id: 'wifi-saved',
            label: 'Saved Wi-Fi',
            method: 'GET',
            path: '/api/wifi/saved',
            enabled: true,
            status: 200,
            body: {
                networks: [
                    {
                        name: 'Lab Wi-Fi',
                        ssid: 'Lab Wi-Fi',
                        security: 'wpa-psk',
                        autoconnect: true,
                        lastConnected: 1780000000
                    }
                ]
            }
        }
    ];

    function pretty(value) {
        return JSON.stringify(value, null, 2);
    }

    function cloneHook(hook) {
        return {
            id: hook.id,
            label: hook.label || hook.path,
            method: String(hook.method || 'GET').toUpperCase(),
            path: hook.path || '/',
            enabled: !!hook.enabled,
            status: Number(hook.status) || 200,
            body: typeof hook.body === 'string' ? hook.body : pretty(hook.body || {})
        };
    }

    function loadHooks() {
        var base = defaultHooks.map(cloneHook);
        var byId = {};
        base.forEach(function(hook) { byId[hook.id] = hook; });

        try {
            var saved = JSON.parse(localStorage.getItem(HOOK_STORAGE_KEY) || '[]');
            if (Array.isArray(saved)) {
                saved.forEach(function(hook) {
                    if (!hook || !hook.id) return;
                    byId[hook.id] = Object.assign(byId[hook.id] || {}, cloneHook(hook));
                });
            }
        } catch (error) {}

        return Object.keys(byId).map(function(id) { return byId[id]; });
    }

    function saveHooks() {
        try {
            localStorage.setItem(HOOK_STORAGE_KEY, JSON.stringify(hooks));
        } catch (error) {}
    }

    function requestUrl(input) {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        return String(input || '');
    }

    function urlParts(url) {
        try {
            var parsed = new URL(url, window.location.href);
            return {
                path: parsed.pathname,
                key: parsed.pathname + parsed.search,
                href: parsed.href
            };
        } catch (error) {
            var text = String(url || '');
            return {
                path: text.split('?')[0],
                key: text,
                href: text
            };
        }
    }

    function findHook(method, url) {
        var parts = urlParts(url);
        var upperMethod = String(method || 'GET').toUpperCase();
        for (var i = hooks.length - 1; i >= 0; i--) {
            var hook = hooks[i];
            if (!hook.enabled) continue;
            if (String(hook.method || 'GET').toUpperCase() !== upperMethod) continue;
            var hookPath = String(hook.path || '');
            if (hookPath.indexOf('?') >= 0 ? hookPath === parts.key : hookPath === parts.path) {
                return hook;
            }
        }
        return null;
    }

    function hookPayload(hook) {
        return {
            status: Number(hook.status) || 200,
            bodyText: String(hook.body || '{}'),
            source: 'hook',
            hookId: hook.id
        };
    }

    function isLabEndpoint(method, url) {
        var path = urlParts(url).path;
        if (method === 'GET') {
            return path === '/api/sound/devices' ||
                path === '/api/sound/outputs' ||
                path === '/api/sound/volume';
        }
        if (method !== 'POST') return false;
        return path === '/api/sound/play' ||
            path === '/api/sound/stop' ||
            path === '/api/sound/device' ||
            path === '/api/sound/output' ||
            path === '/api/sound/volume' ||
            path === '/api/sound/restart-driver' ||
            path === '/api/walkie/play' ||
            path === '/api/walkie/stop';
    }

    function hasSyntheticResponse(method, url) {
        return !!findHook(method, url) || isLabEndpoint(method, url);
    }

    function sendToTop(type, payload) {
        var message = { source: SOURCE, type: type, payload: payload };
        if (isTopWindow) {
            receiveMessage({ data: message });
            return;
        }
        try {
            window.top.postMessage(message, '*');
        } catch (error) {}
    }

    function broadcastHooks() {
        if (!isTopWindow) return;
        var message = { source: SOURCE, type: 'hooks', payload: hooks };
        for (var i = 0; i < window.frames.length; i++) {
            try {
                window.frames[i].postMessage(message, '*');
            } catch (error) {}
        }
    }

    function trimText(text, max) {
        text = String(text == null ? '' : text);
        if (text.length <= max) return text;
        return text.slice(0, max) + '\n... truncated ...';
    }

    function appendLog(entry) {
        entry.id = entry.id || String(Date.now()) + '-' + (logSeq++);
        entry.time = entry.time || new Date().toLocaleTimeString();
        logs.unshift(entry);
        if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
        if (!selectedLogId) selectedLogId = entry.id;
        renderNetwork();
    }

    function logRequest(entry) {
        if (isTopWindow) {
            appendLog(entry);
        } else {
            sendToTop('log', entry);
        }
    }

    function buildLog(startedAt, source, method, url, requestBody, status, responseText, error) {
        var parts = urlParts(url);
        return {
            source: source,
            method: String(method || 'GET').toUpperCase(),
            url: parts.key || parts.path,
            status: Number(status) || 0,
            durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
            request: trimText(requestBody || '', 6000),
            response: trimText(responseText || '', 12000),
            error: error ? String(error) : ''
        };
    }

    function getAudioUrl(filename) {
        return '/lab-audio/' + encodeURIComponent(filename);
    }

    function stopAudio() {
        if (!activeAudio) return;
        try {
            activeAudio.pause();
            activeAudio.currentTime = 0;
        } catch (error) {}
        activeAudio = null;
    }

    function playAudio(filename, loop) {
        stopAudio();
        var audio = new Audio(getAudioUrl(filename));
        audio.loop = !!loop;
        audio.volume = currentVolume;
        activeAudio = audio;
        return audio.play().then(function() {
            return { success: true, file: filename, labAudio: true };
        }, function(error) {
            if (activeAudio === audio) activeAudio = null;
            return {
                success: false,
                file: filename,
                labAudio: true,
                error: String(error && error.message || error)
            };
        });
    }

    function applyVolume(pct) {
        currentVolume = Math.max(0, Math.min(100, pct)) / 100;
        if (activeAudio) activeAudio.volume = currentVolume;
    }

    function parseBody(body) {
        if (!body) return {};
        try {
            return JSON.parse(body);
        } catch (error) {
            return {};
        }
    }

    function labResponse(method, url, body) {
        var hook = findHook(method, url);
        if (hook) return Promise.resolve(hookPayload(hook));

        var path = urlParts(url).path;
        var data = parseBody(body);

        if (method === 'GET' && path === '/api/sound/devices') {
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({
                    defaultDevice: 'browser',
                    devices: [{
                        name: 'browser',
                        cardName: 'Host browser',
                        description: 'Browser audio on the Mac host',
                        device: '0',
                        detail: 'flipperone-lab'
                    }]
                })
            });
        }

        if (method === 'GET' && path === '/api/sound/outputs') {
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({
                    current: 'speaker',
                    outputs: [
                        { id: 'speaker', label: 'Browser', device: 'browser' },
                        { id: 'headphone', label: 'Browser HP', device: 'browser' }
                    ]
                })
            });
        }

        if (method === 'GET' && path === '/api/sound/volume') {
            var volumePct = Math.round(currentVolume * 100);
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({
                    speaker: volumePct,
                    headphone: volumePct,
                    speakerMuted: volumePct === 0,
                    headphoneMuted: volumePct === 0
                })
            });
        }

        if (method === 'POST' && path === '/api/sound/play') {
            return playAudio(data.file || '', false).then(function(result) {
                return { status: result.success ? 200 : 409, source: 'lab', bodyText: pretty(result) };
            });
        }

        if (method === 'POST' && path === '/api/walkie/play') {
            return playAudio('415_audio.wav', true).then(function(result) {
                return { status: result.success ? 200 : 409, source: 'lab', bodyText: pretty(result) };
            });
        }

        if (method === 'POST' && (path === '/api/sound/stop' || path === '/api/walkie/stop')) {
            stopAudio();
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({ success: true, labAudio: true })
            });
        }

        if (method === 'POST' && path === '/api/sound/volume') {
            applyVolume(parseInt(data.volume, 10) || 0);
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({
                    success: true,
                    volume: Math.round(currentVolume * 100),
                    muted: currentVolume === 0
                })
            });
        }

        if (method === 'POST' && path === '/api/sound/restart-driver') {
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({
                    success: false,
                    output: 'Audio driver restart is not available in the lab container.'
                })
            });
        }

        if (method === 'POST' && (path === '/api/sound/device' || path === '/api/sound/output')) {
            return Promise.resolve({
                status: 200,
                source: 'lab',
                bodyText: pretty({ success: true, labAudio: true })
            });
        }

        return null;
    }

    function setXhrValue(xhr, key, value) {
        Object.defineProperty(xhr, key, {
            configurable: true,
            get: function() { return value; }
        });
    }

    function fire(xhr, eventName) {
        var event;
        try {
            event = new Event(eventName);
        } catch (error) {
            event = document.createEvent('Event');
            event.initEvent(eventName, false, false);
        }
        xhr.dispatchEvent(event);
    }

    function respondXhr(xhr, status, text) {
        setXhrValue(xhr, 'readyState', 4);
        setXhrValue(xhr, 'status', status);
        setXhrValue(xhr, 'statusText', status >= 200 && status < 300 ? 'OK' : 'Error');
        setXhrValue(xhr, 'responseText', text);
        setXhrValue(xhr, 'response', text);
        window.setTimeout(function() {
            fire(xhr, 'readystatechange');
            fire(xhr, status >= 200 && status < 400 ? 'load' : 'error');
            fire(xhr, 'loadend');
        }, 0);
    }

    XMLHttpRequest.prototype.open = function(method, url) {
        var upperMethod = String(method || 'GET').toUpperCase();
        var synthetic = hasSyntheticResponse(upperMethod, url);
        this.__flipperLabMeta = {
            method: upperMethod,
            url: url,
            requestHeaders: {},
            synthetic: synthetic
        };

        if (synthetic) {
            setXhrValue(this, 'readyState', 1);
            return;
        }

        return NativeOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (this.__flipperLabMeta) {
            this.__flipperLabMeta.requestHeaders[name] = value;
            if (this.__flipperLabMeta.synthetic) return;
        }
        return NativeSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        var meta = this.__flipperLabMeta;
        var startedAt = performance.now();

        if (meta && meta.synthetic) {
            labResponse(meta.method, meta.url, body || '').then(function(result) {
                respondXhr(xhr, result.status, result.bodyText);
                logRequest(buildLog(startedAt, result.source, meta.method, meta.url,
                    body, result.status, result.bodyText, ''));
            });
            return;
        }

        if (meta) {
            this.addEventListener('loadend', function() {
                var responseText = '';
                try {
                    responseText = xhr.responseText;
                } catch (error) {
                    responseText = String(xhr.response || '');
                }
                logRequest(buildLog(startedAt, 'xhr', meta.method, meta.url,
                    body, xhr.status, responseText, ''));
            });
            this.addEventListener('error', function() {
                logRequest(buildLog(startedAt, 'xhr', meta.method, meta.url,
                    body, 0, '', 'Network error'));
            });
            this.addEventListener('timeout', function() {
                logRequest(buildLog(startedAt, 'xhr', meta.method, meta.url,
                    body, 0, '', 'Timeout'));
            });
        }

        return NativeSend.apply(this, arguments);
    };

    XMLHttpRequest.prototype.abort = function() {
        if (this.__flipperLabMeta && this.__flipperLabMeta.synthetic) {
            fire(this, 'abort');
            fire(this, 'loadend');
            return;
        }
        return NativeAbort.apply(this, arguments);
    };

    if (NativeFetch) {
        window.fetch = function(input, init) {
            var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            var url = requestUrl(input);
            var body = init && init.body ? String(init.body) : '';
            var startedAt = performance.now();
            var synthetic = labResponse(method, url, body);

            if (synthetic) {
                return synthetic.then(function(result) {
                    logRequest(buildLog(startedAt, result.source, method, url,
                        body, result.status, result.bodyText, ''));
                    return new Response(result.bodyText, {
                        status: result.status,
                        headers: { 'Content-Type': 'application/json' }
                    });
                });
            }

            return NativeFetch(input, init).then(function(response) {
                var copy = response.clone();
                copy.text().then(function(text) {
                    logRequest(buildLog(startedAt, 'fetch', method, url,
                        body, response.status, text, ''));
                }, function(error) {
                    logRequest(buildLog(startedAt, 'fetch', method, url,
                        body, response.status, '', error));
                });
                return response;
            }, function(error) {
                logRequest(buildLog(startedAt, 'fetch', method, url, body, 0, '', error));
                throw error;
            });
        };
    }

    function injectStyles() {
        if (document.getElementById('flab-api-style')) return;
        var style = document.createElement('style');
        style.id = 'flab-api-style';
        style.textContent = [
            '.flab-api-toggle{position:fixed;right:16px;bottom:16px;z-index:2147483647;border:1px solid #4a515c;background:#1d232c;color:#f2f5f8;border-radius:6px;padding:8px 10px;font:600 12px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);cursor:pointer}',
            '.flab-api-toggle[data-open="1"]{bottom:calc(38vh + 16px);background:#2c3642}',
            '.flab-api-panel{position:fixed;left:0;right:0;bottom:0;height:38vh;z-index:2147483646;background:#101418;color:#dce3ea;border-top:1px solid #323943;display:none;flex-direction:column;font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 -12px 32px rgba(0,0,0,.45)}',
            '.flab-api-panel[data-open="1"]{display:flex}',
            '.flab-api-bar{height:36px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid #282f38;background:#151a20}',
            '.flab-api-title{font:600 12px system-ui,sans-serif;margin-right:8px;color:#f5f7fa}',
            '.flab-api-tab,.flab-api-action{border:1px solid #38414c;background:#1b222b;color:#dce3ea;border-radius:5px;padding:5px 9px;font:12px system-ui,sans-serif;cursor:pointer}',
            '.flab-api-tab[aria-selected="true"]{background:#2c5f93;border-color:#3b78b5;color:white}',
            '.flab-api-spacer{flex:1}',
            '.flab-api-body{min-height:0;flex:1;display:none}',
            '.flab-api-body[data-active="1"]{display:flex}',
            '.flab-api-list{width:58%;min-width:420px;border-right:1px solid #282f38;overflow:auto}',
            '.flab-api-detail{flex:1;min-width:0;overflow:auto;padding:10px;background:#0c1014}',
            '.flab-api-system-log{flex:1;width:100%;margin:0;overflow:auto;padding:10px;background:#0c1014;color:#dce3ea;white-space:pre-wrap;word-break:break-word;font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
            '.flab-api-row{width:100%;display:grid;grid-template-columns:68px 54px 1fr 62px 58px;gap:8px;align-items:center;border:0;border-bottom:1px solid #20262d;background:transparent;color:#dce3ea;text-align:left;padding:7px 10px;font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;cursor:pointer}',
            '.flab-api-row:hover,.flab-api-row[data-selected="1"]{background:#18202a}',
            '.flab-api-method{color:#8cc8ff}.flab-api-status-ok{color:#9ce29c}.flab-api-status-warn{color:#ffd37a}.flab-api-status-bad{color:#ff8d8d}.flab-api-source{color:#96a2af}',
            '.flab-api-pre{white-space:pre-wrap;word-break:break-word;margin:0 0 10px;color:#dce3ea}',
            '.flab-api-muted{color:#8b97a5}',
            '.flab-api-hooks{min-width:0;width:100%}',
            '.flab-api-hook-list{width:300px;border-right:1px solid #282f38;overflow:auto}',
            '.flab-api-hook-tools{position:sticky;top:0;z-index:1;display:flex;gap:8px;padding:8px;border-bottom:1px solid #282f38;background:#151a20}',
            '.flab-api-hook-tools .flab-api-action{flex:1;padding:6px 7px}',
            '.flab-api-hook-button{width:100%;border:0;border-bottom:1px solid #20262d;background:transparent;color:#dce3ea;text-align:left;padding:9px 10px;cursor:pointer;font:12px system-ui,sans-serif}',
            '.flab-api-hook-button[data-selected="1"]{background:#18202a}',
            '.flab-api-hook-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#56616f;margin-right:7px}.flab-api-hook-dot[data-on="1"]{background:#75d783}',
            '.flab-api-form{flex:1;min-width:0;overflow:auto;padding:12px;display:grid;grid-template-columns:110px 1fr 110px 1fr;gap:9px 10px;align-content:start}',
            '.flab-api-form label{color:#9aa6b2;font:12px system-ui,sans-serif;align-self:center}',
            '.flab-api-form input,.flab-api-form select,.flab-api-form textarea{background:#0b0f13;color:#eef3f7;border:1px solid #38414c;border-radius:5px;padding:7px;font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
            '.flab-api-form textarea{grid-column:2/5;min-height:150px;resize:vertical}',
            '.flab-api-form .flab-api-form-actions{grid-column:2/5;display:flex;gap:8px;align-items:center}',
            '.flab-api-error{color:#ff8d8d;font:12px system-ui,sans-serif}'
        ].join('');
        document.head.appendChild(style);
    }

    function setPanelOpen(open) {
        if (!panel.root) return;
        panel.root.dataset.open = open ? '1' : '0';
        var toggle = document.getElementById('flab-api-toggle');
        if (toggle) toggle.dataset.open = open ? '1' : '0';
    }

    function setActiveTab(tab) {
        panel.activeTab = tab;
        if (panel.networkTab) panel.networkTab.dataset.active = tab === 'logs' ? '1' : '0';
        if (panel.hooksTab) panel.hooksTab.dataset.active = tab === 'hooks' ? '1' : '0';
        Array.prototype.forEach.call(document.querySelectorAll('.flab-api-tab'), function(node) {
            node.setAttribute('aria-selected', node.dataset.tab === tab ? 'true' : 'false');
        });
    }

    function createButton(text, className, onClick) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = className || 'flab-api-action';
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function setAllHooksEnabled(enabled) {
        hooks.forEach(function(hook) {
            hook.enabled = !!enabled;
        });
        saveHooks();
        broadcastHooks();
        renderHooks();
    }

    function refreshSystemLogs() {
        if (!isTopWindow || !NativeFetch) return;
        NativeFetch('/lab-system/logs', { cache: 'no-store' }).then(function(response) {
            return response.json();
        }).then(function(data) {
            systemLog = data || { text: '', file: '', error: '' };
            renderNetwork();
        }, function(error) {
            systemLog = {
                text: '',
                file: '',
                error: String(error && error.message || error)
            };
            renderNetwork();
        });
    }

    function startSystemLogPolling() {
        if (!isTopWindow || systemLogTimer) return;
        refreshSystemLogs();
        systemLogTimer = window.setInterval(refreshSystemLogs, 2000);
    }

    function createPanel() {
        if (!isTopWindow || document.getElementById('flab-api-panel')) return;
        injectStyles();

        var toggle = createButton('API', 'flab-api-toggle', function() {
            setPanelOpen(panel.root.dataset.open !== '1');
        });
        toggle.id = 'flab-api-toggle';
        toggle.title = 'Open API monitor';
        document.body.appendChild(toggle);

        var root = document.createElement('section');
        root.id = 'flab-api-panel';
        root.className = 'flab-api-panel';
        root.dataset.open = '0';
        panel.root = root;

        var bar = document.createElement('div');
        bar.className = 'flab-api-bar';
        var title = document.createElement('div');
        title.className = 'flab-api-title';
        title.textContent = 'Lab API';
        bar.appendChild(title);

        ['logs', 'hooks'].forEach(function(tab) {
            bar.appendChild(createButton(tab === 'logs' ? 'Logs' : 'Hooks', 'flab-api-tab', function() {
                setActiveTab(tab);
            }));
            bar.lastChild.dataset.tab = tab;
        });

        var spacer = document.createElement('div');
        spacer.className = 'flab-api-spacer';
        bar.appendChild(spacer);
        bar.appendChild(createButton('Refresh', 'flab-api-action', function() {
            refreshSystemLogs();
        }));
        bar.appendChild(createButton('Close', 'flab-api-action', function() {
            setPanelOpen(false);
        }));
        root.appendChild(bar);

        var logsBody = document.createElement('div');
        logsBody.className = 'flab-api-body';
        panel.networkTab = logsBody;
        var systemLogOutput = document.createElement('pre');
        systemLogOutput.className = 'flab-api-system-log';
        panel.logDetail = systemLogOutput;
        logsBody.appendChild(systemLogOutput);
        root.appendChild(logsBody);

        var hooksBody = document.createElement('div');
        hooksBody.className = 'flab-api-body flab-api-hooks';
        panel.hooksTab = hooksBody;
        panel.hookList = document.createElement('div');
        panel.hookList.className = 'flab-api-hook-list';
        panel.hookForm = document.createElement('form');
        panel.hookForm.className = 'flab-api-form';
        hooksBody.appendChild(panel.hookList);
        hooksBody.appendChild(panel.hookForm);
        root.appendChild(hooksBody);

        document.body.appendChild(root);
        setActiveTab('logs');
        renderNetwork();
        renderHooks();
        startSystemLogPolling();
    }

    function statusClass(status) {
        if (status >= 200 && status < 300) return 'flab-api-status-ok';
        if (status >= 300 && status < 400) return 'flab-api-status-warn';
        return 'flab-api-status-bad';
    }

    function renderNetwork() {
        if (!panel.logDetail) return;
        var lines = [];
        if (systemLog.file) lines.push('file: ' + systemLog.file);
        if (systemLog.truncated) lines.push('showing tail only');
        if (systemLog.error) lines.push('error: ' + systemLog.error);
        if (lines.length) lines.push('');
        lines.push(systemLog.text || 'No system logs yet.');
        panel.logDetail.textContent = lines.join('\n');
    }

    function renderHooks() {
        if (!panel.hookList || !panel.hookForm) return;
        panel.hookList.textContent = '';
        if (!selectedHookId && hooks.length) selectedHookId = hooks[0].id;

        var tools = document.createElement('div');
        tools.className = 'flab-api-hook-tools';
        tools.appendChild(createButton('Hook All', 'flab-api-action', function() {
            setAllHooksEnabled(true);
        }));
        tools.appendChild(createButton('Unhook All', 'flab-api-action', function() {
            setAllHooksEnabled(false);
        }));
        panel.hookList.appendChild(tools);

        hooks.forEach(function(hook) {
            var row = document.createElement('button');
            row.type = 'button';
            row.className = 'flab-api-hook-button';
            row.dataset.selected = hook.id === selectedHookId ? '1' : '0';
            var dot = document.createElement('span');
            dot.className = 'flab-api-hook-dot';
            dot.dataset.on = hook.enabled ? '1' : '0';
            row.appendChild(dot);
            row.appendChild(document.createTextNode(hook.label || hook.path));
            var meta = document.createElement('div');
            meta.className = 'flab-api-muted';
            meta.textContent = hook.method + ' ' + hook.path;
            row.appendChild(meta);
            row.addEventListener('click', function() {
                selectedHookId = hook.id;
                renderHooks();
            });
            panel.hookList.appendChild(row);
        });

        renderHookForm();
    }

    function field(name, labelText, value, type) {
        var label = document.createElement('label');
        label.textContent = labelText;
        label.setAttribute('for', 'flab-hook-' + name);
        var input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        input.id = 'flab-hook-' + name;
        input.name = name;
        if (type !== 'textarea') input.type = type || 'text';
        if (type === 'checkbox') input.checked = !!value;
        else input.value = value == null ? '' : String(value);
        panel.hookForm.appendChild(label);
        panel.hookForm.appendChild(input);
        return input;
    }

    function renderHookForm() {
        panel.hookForm.textContent = '';
        var hook = hooks.filter(function(item) { return item.id === selectedHookId; })[0];
        if (!hook) return;

        field('enabled', 'Enabled', hook.enabled, 'checkbox');
        field('label', 'Label', hook.label || '', 'text');
        field('method', 'Method', hook.method || 'GET', 'text');
        field('path', 'Path', hook.path || '/', 'text');
        field('status', 'Status', hook.status || 200, 'number');
        var body = field('body', 'Body JSON', hook.body || '{}', 'textarea');

        var actions = document.createElement('div');
        actions.className = 'flab-api-form-actions';
        var error = document.createElement('span');
        error.className = 'flab-api-error';

        actions.appendChild(createButton('Save', 'flab-api-action', function(event) {
            event.preventDefault();
            try {
                JSON.parse(body.value || '{}');
            } catch (parseError) {
                error.textContent = 'Invalid JSON: ' + parseError.message;
                return;
            }
            hook.enabled = panel.hookForm.elements.enabled.checked;
            hook.label = panel.hookForm.elements.label.value || hook.path;
            hook.method = panel.hookForm.elements.method.value.toUpperCase() || 'GET';
            hook.path = panel.hookForm.elements.path.value || '/';
            hook.status = parseInt(panel.hookForm.elements.status.value, 10) || 200;
            hook.body = body.value || '{}';
            saveHooks();
            broadcastHooks();
            error.textContent = '';
            renderHooks();
        }));

        actions.appendChild(createButton('New', 'flab-api-action', function(event) {
            event.preventDefault();
            var id = 'custom-' + Date.now();
            hooks.push({
                id: id,
                label: 'Custom hook',
                method: 'GET',
                path: '/api/example',
                enabled: false,
                status: 200,
                body: '{\n  \"ok\": true\n}'
            });
            selectedHookId = id;
            saveHooks();
            broadcastHooks();
            renderHooks();
        }));

        actions.appendChild(createButton('Reset', 'flab-api-action', function(event) {
            event.preventDefault();
            var def = defaultHooks.filter(function(item) { return item.id === hook.id; })[0];
            if (!def) return;
            Object.assign(hook, cloneHook(def));
            saveHooks();
            broadcastHooks();
            renderHooks();
        }));

        actions.appendChild(error);
        panel.hookForm.appendChild(actions);
    }

    function createHookFromLog(entry) {
        var id = 'from-log-' + Date.now();
        hooks.push({
            id: id,
            label: entry.method + ' ' + entry.url,
            method: entry.method,
            path: entry.url.split('?')[0],
            enabled: true,
            status: entry.status || 200,
            body: entry.response || '{}'
        });
        selectedHookId = id;
        saveHooks();
        broadcastHooks();
        setActiveTab('hooks');
        renderHooks();
    }

    function receiveMessage(event) {
        var message = event && event.data;
        if (!message || message.source !== SOURCE) return;

        if (message.type === 'log' && isTopWindow) {
            appendLog(message.payload);
            return;
        }

        if (message.type === 'hooks') {
            hooks = (message.payload || []).map(cloneHook);
            if (isTopWindow) {
                saveHooks();
                renderHooks();
            }
        }

        if (message.type === 'ready' && isTopWindow) {
            broadcastHooks();
        }
    }

    function init() {
        hooks = loadHooks();
        window.addEventListener('message', receiveMessage);

        if (isTopWindow) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createPanel);
            } else {
                createPanel();
            }
        } else {
            sendToTop('ready', {});
        }

        window.FLIPPER_LAB_API = {
            logs: logs,
            hooks: hooks,
            clearLogs: function() {
                logs = [];
                selectedLogId = null;
                renderNetwork();
            },
            setHooks: function(nextHooks) {
                hooks = (nextHooks || []).map(cloneHook);
                saveHooks();
                broadcastHooks();
                renderHooks();
            }
        };
        window.FLIPPER_LAB_AUDIO = {
            stop: stopAudio,
            setVolume: applyVolume
        };
    }

    init();
})();
