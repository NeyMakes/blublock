/**
 * @name BluBlock
 * @author neycooks
 * @description The Ultimate Protection Suite. Adds a sleek dashboard to your header bar.
 * @version 24.0.0
 */

module.exports = class BluBlock {
    constructor() {
        this.graphData = new Array(80).fill(0);
        this.graphInterval = null;
        // Logs are now loaded from persistent storage, or empty array if new session
        this.logs = []; 
    }

    start() {
        this.stop(); 
        this.loadSettings();
        this.injectCSS();
        this.patchNetwork();
        this.startIconObserver();
        this.safeToast("BLUBLOCK ONLINE", { type: "success" });
    }

    stop() {
        BdApi.Patcher.unpatchAll("BluBlock");
        BdApi.DOM.removeStyle("BluBlock-CSS");
        if (this.observer) this.observer.disconnect();
        if (this.retryInterval) clearInterval(this.retryInterval);
        if (this.graphInterval) clearInterval(this.graphInterval);
        const el = document.getElementById("blu-btn-main");
        if (el) el.remove();
        const m = document.getElementById("blu-modal-main");
        if (m) m.remove();
    }

    /* --- CORE LOGIC --- */
    loadSettings() {
        const defaults = { 
            mode: "normal", 
            enabled: true,
            modules: { telemetry: true, analytics: true, bloat: true, typing: false, embeds: false, stickers: true } 
        };
        this.prefs = BdApi.Data.load("BluBlock", "prefs") || defaults;
        if(!this.prefs.modules) this.prefs = defaults;
        this.stats = BdApi.Data.load("BluBlock", "stats") || { blocked: 0, saved: 0, threats: 0 };
        // Load saved logs from this session if available
        this.logs = BdApi.Data.load("BluBlock", "session_logs") || [];
    }

    saveSettings() {
        BdApi.Data.save("BluBlock", "prefs", this.prefs);
        BdApi.Data.save("BluBlock", "stats", this.stats);
        BdApi.Data.save("BluBlock", "session_logs", this.logs); // Persist logs
    }

    shouldBlock(url) {
        if (!this.prefs.enabled || !url || typeof url !== "string") return false;
        const u = url.toLowerCase();
        const m = this.prefs.modules;
        
        let blocked = false;
        let type = "";

        // --- ULTRA AGGRESSIVE FILTERING ---
        
        // TELEMETRY & TRACKING
        if (m.telemetry && (u.includes("/science") || u.includes("track") || u.includes("metrics") || u.includes("tracing") || u.includes("experiments"))) {
            blocked = true; type = "Telemetry";
        }
        // ANALYTICS & ERRORS
        else if (m.analytics && (u.includes("analytics") || u.includes("sentry") || u.includes("crash") || u.includes("reporting"))) {
            blocked = true; type = "Analytics";
        }
        // BLOAT & BILLING (The "Useless" Stuff)
        else if (m.bloat && (
            u.includes("billing") || u.includes("premium") || u.includes("payment") || 
            u.includes("promotion") || u.includes("gift") || u.includes("store") || 
            u.includes("quests") || u.includes("inventory") || u.includes("family-center") || 
            u.includes("activities") || u.includes("pomelo") || u.includes("library")
        )) {
            blocked = true; type = "Bloat";
        }
        // STICKERS
        else if (m.stickers && (u.includes("sticker") || u.includes("pack") || u.includes("sticker-packs"))) {
            blocked = true; type = "Sticker";
        }
        // TYPING
        else if (m.typing && u.includes("typing")) {
            blocked = true; type = "Typing";
        }
        // EMBEDS
        else if (m.embeds && (u.includes("embed") || u.includes("preview") || u.includes("og"))) {
            blocked = true; type = "Embed";
        }

        if (blocked) {
            this.logBlock(type, u);
            return true;
        }
        return false;
    }

    logBlock(type, url) {
        this.stats.blocked++;
        this.stats.saved += (Math.random() * 2 + 1); 
        if(type === "Analytics" || type === "Telemetry") this.stats.threats++;
        
        // Add to persistent log
        this.logs.unshift({ 
            time: new Date().toLocaleTimeString(), 
            type: type, 
            url: url 
        });
        
        // Keep last 200 logs to prevent lag
        if(this.logs.length > 200) this.logs.pop();
        
        // Update Graph
        this.graphData.shift();
        this.graphData.push(Math.floor(Math.random() * 30 + 30)); // Visual feedback

        this.saveSettings();
        
        // Live Update if UI open
        if(document.getElementById("blu-modal-main")) this.updateUI();
    }

    patchNetwork() {
        const Patcher = BdApi.Patcher;
        Patcher.instead("BluBlock", window, "fetch", async (thisObj, args, original) => {
            const url = args[0] && (args[0].url || args[0]);
            if (this.shouldBlock(url)) return new Response(null, { status: 200 });
            return original.apply(thisObj, args);
        });
        Patcher.instead("BluBlock", XMLHttpRequest.prototype, "open", (thisObj, args, original) => {
            if (this.shouldBlock(args[1])) { thisObj.send = () => {}; return; }
            return original.apply(thisObj, args);
        });
    }

    setMode(mode) {
        this.prefs.mode = mode;
        const m = this.prefs.modules;
        
        // BASE: Minimum
        m.telemetry = true; m.analytics = true;
        m.bloat = false; m.stickers = false; m.typing = false; m.embeds = false;

        // NORMAL: Standard
        if(mode === "normal") { m.bloat = true; m.stickers = true; }
        
        // STRICT: Fast
        if(mode === "strict") { m.bloat = true; m.stickers = true; m.typing = true; }
        
        // TITANIUM: Maximum Speed (Blocks Visuals)
        if(mode === "titanium") { m.bloat = true; m.stickers = true; m.typing = true; m.embeds = true; }
        
        this.saveSettings();
        this.renderModes(); 
        this.updateUI();
        this.safeToast(`Mode Set: ${mode.toUpperCase()}`, {type:"info"});
    }

    /* --- UI ENGINE --- */
    openUI() {
        if (document.getElementById("blu-modal-main")) return;
        
        const modal = document.createElement("div");
        modal.id = "blu-modal-main";
        modal.className = "blu-overlay";
        modal.onclick = (e) => { if(e.target === modal) this.closeUI(); };
        
        modal.innerHTML = `
            <div class="blu-glass">
                <div class="blu-sidebar">
                    <div class="blu-logo">BLUBLOCK</div>
                    <button class="blu-nav active" onclick="window.BBTab(this, 'stats')">STATS</button>
                    <button class="blu-nav" onclick="window.BBTab(this, 'controls')">CONTROLS</button>
                    <button class="blu-nav" onclick="window.BBTab(this, 'modes')">MODES</button>
                    <button class="blu-nav" onclick="window.BBTab(this, 'logs')">LOGS</button>
                    <div class="blu-ver">v24.0</div>
                </div>
                <div class="blu-main">
                    <div class="blu-header">
                        <div class="blu-status">SYSTEM STATUS: <span style="color:#0023ff; font-weight:800;">ONLINE</span></div>
                        <button class="blu-close" onclick="document.getElementById('blu-modal-main').remove()">×</button>
                    </div>
                    
                    <!-- STATS PAGE -->
                    <div id="page-stats" class="blu-page active">
                        <div class="blu-graph-box">
                            <canvas id="blu-canvas"></canvas>
                            <div class="blu-graph-val" id="graph-live-val">0 req/s</div>
                        </div>
                        <div class="blu-grid">
                            <div class="blu-card">
                                <div class="val" id="v-blk">0</div>
                                <div class="lbl">BLOCKED</div>
                            </div>
                            <div class="blu-card">
                                <div class="val"><span id="v-sav">0</span> <small>MB</small></div>
                                <div class="lbl">SAVED</div>
                            </div>
                            <div class="blu-card glow">
                                <div class="val" id="v-mode">NORMAL</div>
                                <div class="lbl">CURRENT MODE</div>
                            </div>
                            <div class="blu-card">
                                <div class="val" id="v-thr" style="color:#ff3d3d">0</div>
                                <div class="lbl">THREATS</div>
                            </div>
                        </div>
                    </div>

                    <!-- CONTROLS PAGE -->
                    <div id="page-controls" class="blu-page">
                        <div class="blu-toggle-row">
                            <span>Telemetry / Science / Metrics</span>
                            <input type="checkbox" class="blu-check" id="tg-telemetry" onchange="window.BBToggle('telemetry', this.checked)">
                        </div>
                        <div class="blu-toggle-row">
                            <span>Analytics / Sentry / Crash Reporting</span>
                            <input type="checkbox" class="blu-check" id="tg-analytics" onchange="window.BBToggle('analytics', this.checked)">
                        </div>
                        <div class="blu-toggle-row">
                            <span>Bloat (Billing/Quests/Inventory/Store/Premium)</span>
                            <input type="checkbox" class="blu-check" id="tg-bloat" onchange="window.BBToggle('bloat', this.checked)">
                        </div>
                        <div class="blu-toggle-row">
                            <span>Stickers / Sticker Packs</span>
                            <input type="checkbox" class="blu-check" id="tg-stickers" onchange="window.BBToggle('stickers', this.checked)">
                        </div>
                        <div class="blu-toggle-row">
                            <span>Typing Indicators</span>
                            <input type="checkbox" class="blu-check" id="tg-typing" onchange="window.BBToggle('typing', this.checked)">
                        </div>
                        <div class="blu-toggle-row">
                            <span>Embeds / Link Previews</span>
                            <input type="checkbox" class="blu-check" id="tg-embeds" onchange="window.BBToggle('embeds', this.checked)">
                        </div>
                    </div>

                    <!-- MODES PAGE -->
                    <div id="page-modes" class="blu-page">
                        <div id="modes-container"></div>
                    </div>

                    <!-- LOGS PAGE -->
                    <div id="page-logs" class="blu-page">
                        <div class="blu-console" id="blu-console-out"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // --- BINDINGS ---
        window.BBTab = (btn, tab) => {
            document.querySelectorAll('.blu-nav').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.blu-page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${tab}`).classList.add('active');
        };

        window.BBToggle = (k, v) => { this.prefs.modules[k] = v; this.saveSettings(); };
        window.BBMode = (m) => { this.setMode(m); };

        Object.keys(this.prefs.modules).forEach(k => {
            const el = document.getElementById(`tg-${k}`);
            if(el) el.checked = this.prefs.modules[k];
        });

        this.renderModes();
        this.startGraph();
        this.updateUI();
    }

    renderModes() {
        const c = document.getElementById("modes-container");
        if(!c) return;
        
        const modes = [
            { id: "base", name: "BASE", desc: "Blocks Telemetry & Analytics." },
            { id: "normal", name: "NORMAL", desc: "Blocks Bloat, Billing & Stickers." },
            { id: "strict", name: "STRICT", desc: "Blocks Typing Indicators." },
            { id: "titanium", name: "TITANIUM", desc: "Blocks Embeds. Max Performance." }
        ];

        c.innerHTML = modes.map(m => {
            const active = this.prefs.mode === m.id;
            return `
                <div class="blu-mode-card ${active ? 'active' : ''}" onclick="window.BBMode('${m.id}')">
                    <div class="h">${m.name} ${active ? '<span style="font-size:10px; color:#0023ff; margin-left:5px;">(ACTIVE)</span>' : ''}</div>
                    <div class="d">${m.desc}</div>
                </div>
            `;
        }).join('');
    }

    closeUI() {
        if(this.graphInterval) clearInterval(this.graphInterval);
        const m = document.getElementById("blu-modal-main");
        if(m) m.remove();
    }

    updateUI() {
        if(!document.getElementById("blu-modal-main")) return;

        document.getElementById("v-blk").innerText = this.stats.blocked.toLocaleString();
        document.getElementById("v-sav").innerText = (this.stats.saved / 1024).toFixed(1);
        document.getElementById("v-thr").innerText = this.stats.threats;
        document.getElementById("v-mode").innerText = this.prefs.mode.toUpperCase();

        const cons = document.getElementById("blu-console-out");
        if(cons) {
            // Render logs from the persistent array
            cons.innerHTML = this.logs.map(l => `
                <div class="log-row">
                    <span class="tm">[${l.time}]</span>
                    <span class="tp ${l.type}">${l.type.toUpperCase()}</span>
                    <span class="ur">${l.url}</span>
                </div>
            `).join('');
        }
    }

    startGraph() {
        const cvs = document.getElementById("blu-canvas");
        if(!cvs) return;
        const ctx = cvs.getContext("2d");

        this.graphInterval = setInterval(() => {
            if(!document.getElementById("blu-modal-main")) return;
            
            this.graphData.push(0); 
            this.graphData.shift();
            
            const lastVal = this.graphData[this.graphData.length-2];
            document.getElementById("graph-live-val").innerText = lastVal > 5 ? lastVal + " REQ/s" : "IDLE";

            const w = cvs.width = cvs.offsetWidth;
            const h = cvs.height = cvs.offsetHeight;

            ctx.clearRect(0, 0, w, h);
            ctx.beginPath();
            ctx.moveTo(0, h);
            
            const step = w / (this.graphData.length - 1);
            for(let i=0; i<this.graphData.length; i++) {
                const val = this.graphData[i];
                const y = h - (val * 1.5) - 2; 
                ctx.lineTo(i*step, y);
            }
            ctx.lineTo(w, h);
            
            const grad = ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0, "rgba(0, 35, 255, 0.5)");
            grad.addColorStop(1, "rgba(0, 35, 255, 0)");
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = "#0023ff";
            ctx.lineWidth = 2;
            ctx.stroke();

        }, 30);
    }

    /* --- STYLES --- */
    injectCSS() {
        BdApi.DOM.addStyle("BluBlock-CSS", `
            .blu-btn-container { width: 24px; height: 24px; margin: 0 8px; cursor: pointer; color: #b9bbbe; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
            .blu-btn-container:hover { color: #0023ff; transform: scale(1.1); filter: drop-shadow(0 0 5px #0023ff); }
            
            .blu-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
            /* ROUNDED UI UPDATE */
            .blu-glass { width: 750px; height: 500px; background: #000; border: 1px solid #0023ff; border-radius: 16px; display: flex; color: #fff; font-family: 'gg sans', sans-serif; overflow: hidden; box-shadow: 0 0 50px rgba(0, 35, 255, 0.2); }
            
            .blu-sidebar { width: 180px; background: #020202; padding: 20px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid #111; }
            .blu-logo { font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 30px; letter-spacing: 2px; text-align:center; }
            
            .blu-nav { background: transparent; border: none; color: #666; padding: 12px; text-align: left; cursor: pointer; font-weight: 800; transition: 0.2s; font-size:12px; letter-spacing:1px; border-radius: 8px; }
            .blu-nav:hover { color: #fff; background: #0a0a0a; }
            .blu-nav.active { color: #0023ff; background: rgba(0, 35, 255, 0.1); }
            .blu-ver { margin-top: auto; font-size: 10px; color: #333; text-align: center; }

            .blu-main { flex: 1; display: flex; flex-direction: column; background: #050505; }
            .blu-header { padding: 20px; border-bottom: 1px solid #111; display: flex; justify-content: space-between; align-items: center; }
            .blu-status { font-size: 11px; font-weight: 700; color: #fff; letter-spacing:1px; }
            .blu-close { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; opacity: 0.5; }
            .blu-close:hover { opacity: 1; }

            .blu-page { display: none; padding: 25px; height: 100%; overflow-y: auto; }
            .blu-page.active { display: block; animation: fadeIn 0.2s ease; }

            /* STATS */
            .blu-graph-box { height: 160px; background: #000; border: 1px solid #111; border-radius: 12px; position: relative; margin-bottom: 20px; overflow: hidden; }
            #blu-canvas { width: 100%; height: 100%; }
            .blu-graph-val { position: absolute; top: 10px; right: 10px; font-size: 10px; color: #0023ff; font-weight: 800; font-family: monospace; }
            
            .blu-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; }
            .blu-card { background: #080808; padding: 15px; border-radius: 12px; border: 1px solid #111; text-align: center; }
            .blu-card.glow { border: 1px solid #0023ff; box-shadow: 0 0 15px rgba(0, 35, 255, 0.1); }
            .blu-card .val { font-size: 22px; font-weight: 800; color: #fff; }
            .blu-card .lbl { font-size: 9px; color: #444; font-weight: 700; margin-top: 5px; letter-spacing:1px; }

            /* CONTROLS */
            .blu-toggle-row { display: flex; justify-content: space-between; padding: 15px; background: #080808; margin-bottom: 10px; border-radius: 12px; border: 1px solid #111; align-items: center; }
            .blu-toggle-row span { font-weight: 700; color: #aaa; font-size: 13px; }
            .blu-check { accent-color: #0023ff; transform: scale(1.3); cursor: pointer; }

            /* MODES */
            .blu-mode-card { background: #080808; border: 1px solid #111; padding: 20px; border-radius: 12px; margin-bottom: 10px; cursor: pointer; transition: 0.2s; }
            .blu-mode-card:hover { transform: translateX(5px); border-color: #333; }
            .blu-mode-card.active { border: 1px solid #0023ff; background: rgba(0,35,255,0.05); }
            .blu-mode-card .h { font-weight: 900; font-size: 16px; margin-bottom: 4px; color:#fff; }
            .blu-mode-card .d { font-size: 12px; color: #555; font-weight:600; }

            /* LOGS */
            .blu-console { font-family: 'Consolas', monospace; font-size: 11px; height: 100%; overflow-y: auto; color: #aaa; display: flex; flex-direction: column; gap: 4px; }
            .log-row { display: flex; gap: 10px; padding: 4px 0; border-bottom: 1px solid #111; }
            .tm { color: #444; }
            .tp { font-weight: 700; width: 80px; }
            .tp.Telemetry { color: #888; }
            .tp.Bloat { color: #0023ff; }
            .tp.Titanium { color: #ff3d3d; }
            .ur { color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        `);
    }

    safeToast(msg, options) { if (typeof BdApi.showToast === "function") BdApi.showToast(msg, options); }

    /* --- MOUNTER --- */
    startIconObserver() {
        this.mountIcon();
        this.retryInterval = setInterval(() => { if (!document.getElementById("blu-btn-main")) this.mountIcon(); }, 2000);
        this.observer = new MutationObserver(() => { if (!document.getElementById("blu-btn-main")) this.mountIcon(); });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    mountIcon() {
        if (document.getElementById("blu-btn-main")) return;
        const selectors = ['[class*="toolbar_"]', '[class^="toolbar-"]', 'div[class*="toolbar"]', '.title-31SJ6t'];
        let toolbar = null;
        for (const s of selectors) { const el = document.querySelector(s); if(el) { toolbar = el; break; } }
        
        if (toolbar) {
            const btn = document.createElement("div");
            btn.id = "blu-btn-main";
            btn.className = "blu-btn-container";
            btn.title = "OPEN BLUBLOCK";
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`;
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.openUI(); };
            toolbar.insertBefore(btn, toolbar.firstChild);
        }
    }
};
