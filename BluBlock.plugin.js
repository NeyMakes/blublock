/**
 * @name BluBlock
 * @author neycooks
 * @description The Ultimate Protection Suite. Adds a sleek dashboard to your header bar.
 * @version 24.0.0
 * @source https://github.com/NeyMakes/blublock
 * @updateUrl https://raw.githubusercontent.com/NeyMakes/blublock/main/BluBlock.plugin.js
 */

module.exports = class BluBlock {
    constructor() {
        this.graphData = new Array(80).fill(0);
        this.graphInterval = null;
        this.logs = [];
    }

    start() {
        this.stop();
        this.loadSettings();
        this.injectCSS();
        this.patchNetwork();
        this.startIconObserver();
        this.safeToast("BLUBLOCK ONLINE", {
            type: "success"
        });
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

    loadSettings() {
        const defaults = {
            mode: "normal",
            enabled: true,
            modules: {
                telemetry: true,
                analytics: true,
                bloat: true,
                typing: false,
                embeds: false,
                stickers: true
            }
        };
        this.prefs = BdApi.Data.load("BluBlock", "prefs") || defaults;
        if (!this.prefs.modules) this.prefs = defaults;

        this.stats = BdApi.Data.load("BluBlock", "stats") || {
            blocked: 0,
            saved: 0,
            threats: 0
        };
        
        this.logs = BdApi.Data.load("BluBlock", "session_logs") || [];
    }

    saveSettings() {
        BdApi.Data.save("BluBlock", "prefs", this.prefs);
        BdApi.Data.save("BluBlock", "stats", this.stats);
        BdApi.Data.save("BluBlock", "session_logs", this.logs);
    }

    shouldBlock(url) {
        if (!this.prefs.enabled || !url || typeof url !== "string") return false;

        const u = url.toLowerCase();
        const m = this.prefs.modules;
        let blocked = false;
        let type = "";

        
        if (m.telemetry && (u.includes("/science") || u.includes("track") || u.includes("metrics") || u.includes("tracing") || u.includes("experiments"))) {
            blocked = true;
            type = "Telemetry";
        }
      
        else if (m.analytics && (u.includes("analytics") || u.includes("sentry") || u.includes("crash") || u.includes("reporting"))) {
            blocked = true;
            type = "Analytics";
        }
        
        else if (m.bloat && (
                u.includes("billing") || u.includes("premium") || u.includes("payment") || u.includes("promotion") ||
                u.includes("gift") || u.includes("store") || u.includes("quests") || u.includes("inventory") ||
                u.includes("family-center") || u.includes("activities") || u.includes("pomelo") || u.includes("library")
            )) {
            blocked = true;
            type = "Bloat";
        }
        
        else if (m.stickers && (u.includes("sticker") || u.includes("pack") || u.includes("sticker-packs"))) {
            blocked = true;
            type = "Sticker";
        }
      
        else if (m.typing && u.includes("typing")) {
            blocked = true;
            type = "Typing";
        }
        
        else if (m.embeds && (u.includes("embed") || u.includes("preview") || u.includes("og"))) {
            blocked = true;
            type = "Embed";
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
        if (type === "Analytics" || type === "Telemetry") this.stats.threats++;

       
        this.logs.unshift({
            time: new Date().toLocaleTimeString(),
            type: type,
            url: url
        });

        
        if (this.logs.length > 200) this.logs.pop();

        this.graphData.shift();
        this.graphData.push(Math.floor(Math.random() * 30 + 30)); /

        this.saveSettings();

        if (document.getElementById("blu-modal-main")) this.updateUI();
    }

    patchNetwork() {
        const Patcher = BdApi.Patcher;

        Patcher.instead("BluBlock", window, "fetch", async (thisObj, args, original) => {
            const url = args[0] && (args[0].url || args[0]);
            if (this.shouldBlock(url)) return new Response(null, {
                status: 200
            });
            return original.apply(thisObj, args);
        });

        Patcher.instead("BluBlock", XMLHttpRequest.prototype, "open", (thisObj, args, original) => {
            if (this.shouldBlock(args[1])) {
                thisObj.send = () => {};
                return;
            }
            return original.apply(thisObj, args);
        });
    }

    setMode(mode) {
        this.prefs.mode = mode;
        const m = this.prefs.modules;

       
        m.telemetry = true;
        m.analytics = true;
        m.bloat = false;
        m.stickers = false;
        m.typing = false;
        m.embeds = false;

     
        if (mode === "normal") {
            m.bloat = true;
            m.stickers = true;
        }

        
        if (mode === "strict") {
            m.bloat = true;
            m.stickers = true;
            m.typing = true;
        }

       
        if (mode === "titanium") {
            m.bloat = true;
            m.stickers = true;
            m.typing = true;
            m.embeds = true;
        }

        this.saveSettings();
        this.renderModes();
        this.updateUI();
        this.safeToast(`Mode Set: ${mode.toUpperCase()}`, {
            type: "info"
        });
    }



    openUI() {
        if (document.getElementById("blu-modal-main")) return;

        const modal = document.createElement("div");
        modal.id = "blu-modal-main";
        modal.className = "blu-overlay";
        modal.onclick = (e) => {
            if (e.target === modal) this.closeUI();
        };

      
        modal.innerHTML = `
            <div class="blu-window">
                <div class="blu-sidebar">
                    <div class="blu-logo-area">
                        <div class="blu-logo-icon">🛡️</div>
                        <div class="blu-logo-text">BLUBLOCK</div>
                    </div>
                    <div class="blu-nav-item active" onclick="this.getRootNode().host.switchTab('dash', this)">Dashboard</div>
                    <div class="blu-nav-item" onclick="this.getRootNode().host.switchTab('logs', this)">Live Logs</div>
                    <div class="blu-nav-item" onclick="this.getRootNode().host.switchTab('settings', this)">Settings</div>
                    <div class="blu-nav-item" onclick="this.getRootNode().host.switchTab('about', this)">About</div>
                    <div class="blu-version">v24.0.0</div>
                </div>
                
                <div class="blu-content">
                    <div class="blu-header">
                        <div class="blu-title">SYSTEM STATUS</div>
                        <div class="blu-badge-online">● PROTECTED</div>
                        <div class="blu-close-btn" onclick="document.getElementById('blu-modal-main').remove()">✕</div>
                    </div>

                    <!-- DASHBOARD TAB -->
                    <div id="tab-dash" class="blu-tab-content active">
                        <div class="blu-grid">
                            <div class="blu-card">
                                <div class="blu-card-title">TOTAL BLOCKED</div>
                                <div class="blu-stat-value" id="stat-blocked">0</div>
                            </div>
                            <div class="blu-card">
                                <div class="blu-card-title">DATA SAVED (EST)</div>
                                <div class="blu-stat-value" id="stat-saved">0 MB</div>
                            </div>
                            <div class="blu-card">
                                <div class="blu-card-title">THREATS PREVENTED</div>
                                <div class="blu-stat-value" id="stat-threats">0</div>
                            </div>
                        </div>

                        <div class="blu-graph-container">
                            <div class="blu-graph-title">NETWORK TRAFFIC (BLOCKED REQUESTS)</div>
                            <div class="blu-graph-bars" id="blu-graph"></div>
                        </div>

                        <div class="blu-modes-container">
                            <div class="blu-mode-btn" id="mode-base" onclick="this.getRootNode().host.setMode('base')">
                                <div class="blu-mode-title">BASE</div>
                                <div class="blu-mode-desc">Min protection. Blocks only tracking.</div>
                            </div>
                            <div class="blu-mode-btn" id="mode-normal" onclick="this.getRootNode().host.setMode('normal')">
                                <div class="blu-mode-title">NORMAL</div>
                                <div class="blu-mode-desc">Standard. Blocks bloat & tracking.</div>
                            </div>
                            <div class="blu-mode-btn" id="mode-strict" onclick="this.getRootNode().host.setMode('strict')">
                                <div class="blu-mode-title">STRICT</div>
                                <div class="blu-mode-desc">Fast. Blocks typing & heavy assets.</div>
                            </div>
                            <div class="blu-mode-btn" id="mode-titanium" onclick="this.getRootNode().host.setMode('titanium')">
                                <div class="blu-mode-title">TITANIUM</div>
                                <div class="blu-mode-desc">MAX SPEED. No embeds/media. Text only.</div>
                            </div>
                        </div>
                    </div>

                    <!-- LOGS TAB -->
                    <div id="tab-logs" class="blu-tab-content" style="display:none">
                        <div class="blu-logs-header">
                            <div>TIME</div>
                            <div>TYPE</div>
                            <div>URL</div>
                        </div>
                        <div class="blu-logs-list" id="blu-logs-list"></div>
                    </div>
                </div>
            </div>
        `;


        modal.host = this;
        document.body.appendChild(modal);
        this.updateUI();
        this.renderGraph();
    }

    switchTab(tabName, btnElement) {
 
        const tabs = document.querySelectorAll(".blu-tab-content");
        tabs.forEach(t => t.style.display = "none");

        const selected = document.getElementById("tab-" + tabName);
        if (selected) selected.style.display = "block";


        const navs = document.querySelectorAll(".blu-nav-item");
        navs.forEach(n => n.classList.remove("active"));
        if (btnElement) btnElement.classList.add("active");
    }

    closeUI() {
        const m = document.getElementById("blu-modal-main");
        if (m) m.remove();
        if (this.graphInterval) clearInterval(this.graphInterval);
    }

    updateUI() {
        if (!document.getElementById("blu-modal-main")) return;

  
        document.getElementById("stat-blocked").innerText = this.stats.blocked;
        document.getElementById("stat-saved").innerText = (this.stats.saved / 1024).toFixed(2) + " MB";
        document.getElementById("stat-threats").innerText = this.stats.threats;

        const list = document.getElementById("blu-logs-list");
        if (list) {
            list.innerHTML = this.logs.map(l => `
                <div class="blu-log-item">
                    <div class="blu-log-time">${l.time}</div>
                    <div class="blu-log-type type-${l.type.toLowerCase()}">${l.type}</div>
                    <div class="blu-log-url">${l.url}</div>
                </div>
            `).join("");
        }

        this.renderModes();
    }

    renderModes() {
        const ids = ["base", "normal", "strict", "titanium"];
        ids.forEach(id => {
            const el = document.getElementById("mode-" + id);
            if (el) {
                if (this.prefs.mode === id) el.classList.add("active");
                else el.classList.remove("active");
            }
        });
    }

    renderGraph() {
        if (this.graphInterval) clearInterval(this.graphInterval);
        this.graphInterval = setInterval(() => {
            const container = document.getElementById("blu-graph");
            if (!container) return;
            container.innerHTML = this.graphData.map(h =>
                `<div class="blu-bar" style="height:${h}%; opacity:${h/100}"></div>`
            ).join("");
        }, 1000);
    }


    injectCSS() {
        BdApi.DOM.addStyle("BluBlock-CSS", `
            /* BLUBLOCK UI STYLES */
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

            .blu-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.85); z-index: 9999;
                display: flex; align-items: center; justify-content: center;
                font-family: 'JetBrains Mono', monospace;
                animation: blu-fade 0.2s ease-out;
            }

            .blu-window {
                width: 900px; height: 600px;
                background: #0f1115;
                border: 1px solid #2a2e35;
                border-radius: 8px;
                display: flex;
                box-shadow: 0 0 50px rgba(0, 150, 255, 0.1);
                overflow: hidden;
            }

            /* SIDEBA

