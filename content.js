/**
 * Subtitle to Gemini – Content Script
 * Extracts subtitles from YouTube / Bilibili and copies to clipboard,
 * then opens Google Gemini.
 */

(function () {
    'use strict';

    // Avoid double-injection
    if (document.getElementById('stg-fab-container')) return;

    // ========== Platform Detection ==========
    const PLATFORM = (() => {
        const host = location.hostname;
        if (host.includes('youtube.com')) return 'youtube';
        if (host.includes('bilibili.com')) return 'bilibili';
        return null;
    })();

    if (!PLATFORM) return;

    // ========== Inject MAIN World Script (Firefox/Cross-browser Compatible) ==========
    if (PLATFORM === 'bilibili') {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('bili-inject.js');
            script.onload = function () {
                this.remove();
            };
            (document.head || document.documentElement).appendChild(script);
            console.log('[Subtitle-to-Gemini] 已通过 script 标签注入 bili-inject.js 到主世界');
        } catch (e) {
            console.error('[Subtitle-to-Gemini] 注入主世界脚本失败:', e);
        }
    }

    // ========== UI: Create FAB ==========
    const container = document.createElement('div');
    container.id = 'stg-fab-container';

    // Subtitle icon SVG
    const btn = document.createElement('button');
    btn.id = 'stg-fab-btn';
    btn.title = '复制字幕 → Gemini';
    btn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z"/>
    </svg>`;

    const toast = document.createElement('div');
    toast.id = 'stg-toast';

    container.appendChild(toast);
    container.appendChild(btn);
    document.body.appendChild(container);

    // ========== Toast Helper ==========
    let toastTimer = null;
    function showToast(msg, type = 'info', duration = 3000) {
        toast.textContent = msg;
        toast.className = `stg-show stg-${type}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.className = '';
        }, duration);
    }

    // ========== YouTube Subtitle Extraction ==========
    // Access page-context variables via Firefox's wrappedJSObject (AMO-safe)
    function getPageVariable(varName) {
        try {
            const val = window.wrappedJSObject[varName];
            if (!val) return null;
            // cloneInto creates a safe structured clone from page context to content script
            return cloneInto(JSON.parse(JSON.stringify(val)), window);
        } catch (_) {
            return null;
        }
    }

    async function getYouTubeSubtitle() {
        // Try to find caption tracks from player response embedded in page
        let playerResponse = null;

        // Method 1: wrappedJSObject access to ytInitialPlayerResponse
        playerResponse = getPageVariable('ytInitialPlayerResponse');

        // Method 2: scan scripts for ytInitialPlayerResponse
        if (!playerResponse) {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const text = s.textContent;
                if (text && text.includes('ytInitialPlayerResponse')) {
                    const match = text.match(
                        /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s
                    );
                    if (match) {
                        try {
                            playerResponse = JSON.parse(match[1]);
                        } catch (_) { }
                    }
                }
            }
        }

        // Method 3: use ytplayer.config.args.raw_player_response (SPA navigations)
        if (!playerResponse) {
            try {
                const ytcfg = document.querySelector('script#www-player-config');
                if (ytcfg) {
                    playerResponse = JSON.parse(ytcfg.textContent);
                }
            } catch (_) { }
        }

        // Method 4: try to extract from the page's embedded JSON (for SPA)
        if (!playerResponse) {
            try {
                const ytpEl = document.querySelector('ytd-watch-flexy');
                if (ytpEl && ytpEl.wrappedJSObject?.__data) {
                    const data = ytpEl.wrappedJSObject.__data;
                    const raw = data?.playerData?.playerResponse ||
                        data?.response?.playerResponse;
                    if (raw) {
                        playerResponse = JSON.parse(JSON.stringify(raw));
                    }
                }
            } catch (_) { }
        }

        // Last resort: fetch the page HTML and parse
        if (!playerResponse) {
            try {
                const resp = await fetch(location.href);
                const html = await resp.text();
                const match = html.match(
                    /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s
                );
                if (match) {
                    playerResponse = JSON.parse(match[1]);
                }
            } catch (_) { }
        }

        if (!playerResponse) {
            throw new Error('无法获取视频播放器数据');
        }

        const captions =
            playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captions || captions.length === 0) {
            throw new Error('该视频没有可用字幕');
        }

        // Prefer manual captions, then auto-generated; prefer Chinese then English
        let track = captions.find(
            (t) => t.languageCode === 'zh' && t.kind !== 'asr'
        );
        if (!track)
            track = captions.find(
                (t) => t.languageCode === 'zh-Hans' && t.kind !== 'asr'
            );
        if (!track)
            track = captions.find(
                (t) => t.languageCode === 'zh-Hant' && t.kind !== 'asr'
            );
        if (!track)
            track = captions.find(
                (t) => t.languageCode === 'en' && t.kind !== 'asr'
            );
        if (!track)
            track = captions.find((t) => t.kind !== 'asr');
        if (!track) track = captions[0];

        const lang = track.name?.simpleText || track.languageCode || '未知';

        // Fetch the subtitle content as JSON3
        let subtitleUrl = track.baseUrl;
        if (!subtitleUrl.includes('fmt=')) {
            subtitleUrl += '&fmt=json3';
        } else {
            subtitleUrl = subtitleUrl.replace(/fmt=\w+/, 'fmt=json3');
        }

        const resp = await fetch(subtitleUrl, { cache: 'no-store' });
        const json = await resp.json();

        const events = json.events || [];
        const lines = [];
        for (const ev of events) {
            if (!ev.segs) continue;
            const text = ev.segs
                .map((s) => s.utf8 || '')
                .join('')
                .trim();
            if (text && text !== '\n') lines.push(text);
        }

        if (lines.length === 0) {
            throw new Error('字幕内容为空');
        }

        return { text: lines.join('\n'), lang };
    }

    // Helper: safely fetch JSON with validation
    async function safeFetchJSON(url, options = {}, retryCount = 0) {
        // 仅用 cache: 'no-store' 防缓存（不修改URL，避免与BiliPlus等插件冲突）
        const finalOptions = { ...options, cache: 'no-store' };

        const resp = await fetch(url, finalOptions);
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const text = await resp.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            // 如果返回了HTML（如B站页面），可能是页面还没加载完或插件拦截出错
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                console.warn('[Subtitle-to-Gemini] API 返回了 HTML 而非 JSON，可能页面未就绪', url);
                if (retryCount < 2) {
                    // 等待后重试
                    await new Promise(r => setTimeout(r, 1000));
                    console.log('[Subtitle-to-Gemini] 重试第', retryCount + 1, '次:', url);
                    return safeFetchJSON(url, options, retryCount + 1);
                }
            }
            console.error('[Subtitle-to-Gemini] JSON parse failed for', url, 'response:', text.slice(0, 200));
            const preview = text.trim() ? text.slice(0, 50).replace(/\n|\r/g, ' ') : '<空响应>';
            throw new Error(`返回内容不是有效 JSON (响应预览: ${preview}...)`);
        }
    }

    // Helper: pick best subtitle from a list
    function pickSubtitle(subtitles) {
        return (
            subtitles.find((s) => s.lan === 'zh-CN') ||
            subtitles.find((s) => s.lan === 'zh-Hans') ||
            subtitles.find((s) => s.lan && s.lan.startsWith('zh')) ||
            subtitles[0]
        );
    }

    // Helper: download and parse Bilibili subtitle content
    async function downloadBiliSubtitle(sub) {
        let url = sub.subtitle_url;
        if (url.startsWith('//')) url = 'https:' + url;

        console.log('[Subtitle-to-Gemini] Fetching subtitle from:', url);
        const subJson = await safeFetchJSON(url);
        const sentences = (subJson.body || []).map((item) => item.content);
        if (sentences.length === 0) throw new Error('字幕内容为空');
        return { text: sentences.join('\n'), lang: sub.lan_doc || sub.lan || '未知' };
    }

    // Helper: 从 <script> 标签文本中解析 B 站 __INITIAL_STATE__（CSP 安全，无需执行脚本）
    function parseBiliInitialState() {
        const scripts = document.querySelectorAll('script:not([src])');
        for (const s of scripts) {
            const text = s.textContent;
            const marker = 'window.__INITIAL_STATE__=';
            const idx = text.indexOf(marker);
            if (idx === -1) continue;

            const jsonStart = idx + marker.length;
            let depth = 0;
            let jsonEnd = jsonStart;
            for (let i = jsonStart; i < text.length; i++) {
                if (text[i] === '{') depth++;
                else if (text[i] === '}') {
                    depth--;
                    if (depth === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
            }

            try {
                return JSON.parse(text.slice(jsonStart, jsonEnd));
            } catch (_) {
                console.warn('[Subtitle-to-Gemini] __INITIAL_STATE__ JSON 解析失败');
            }
        }
        return null;
    }

    // Helper: 通过 CustomEvent 向主世界 (bili-inject.js) 发送请求
    function requestFromMainWorld(eventName, responseEventName, detail, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).slice(2);
            const handler = (e) => {
                if (e.detail.requestId !== requestId) return;
                document.removeEventListener(responseEventName, handler);
                clearTimeout(timer);
                if (e.detail.success) {
                    resolve(e.detail.data);
                } else {
                    reject(new Error(e.detail.error || '主世界请求失败'));
                }
            };
            document.addEventListener(responseEventName, handler);
            document.dispatchEvent(new CustomEvent(eventName, {
                detail: { ...detail, requestId }
            }));
            const timer = setTimeout(() => {
                document.removeEventListener(responseEventName, handler);
                reject(new Error('主世界请求超时'));
            }, timeoutMs);
        });
    }

    // ========== Bilibili Subtitle Extraction ==========
    async function getBilibiliSubtitle() {
        const bvidMatch = location.pathname.match(/\/video\/(BV[\w]+)/i);
        if (!bvidMatch) {
            throw new Error('无法从当前页面 URL 提取 BV 号');
        }
        const bvid = bvidMatch[1];
        console.log('[Subtitle-to-Gemini] URL BV号:', bvid);

        let cid = null;
        let title = '视频';

        // --- 方法 1: 从 DOM 解析 __INITIAL_STATE__（零网络请求，CSP 安全）---
        const initState = parseBiliInitialState();
        if (initState && initState.bvid === bvid && initState.videoData) {
            title = initState.videoData.title || title;
            cid = initState.videoData.cid;
            const pages = initState.videoData.pages;
            if (pages && pages.length > 0) {
                const p = initState.p || parseInt(new URLSearchParams(location.search).get('p')) || 1;
                const pageInfo = pages.find(page => page.page === p);
                if (pageInfo) cid = pageInfo.cid;
            }
            console.log(`[Subtitle-to-Gemini] DOM 解析成功: 「${title}」(cid: ${cid})`);
        }

        // --- 方法 2: 通过 MAIN world 脚本请求 API（SPA 导航时 DOM 数据过期）---
        if (!cid) {
            console.log('[Subtitle-to-Gemini] DOM 未命中，通过主世界请求 API...');
            try {
                const info = await requestFromMainWorld(
                    'stg-request-video-info', 'stg-video-info-result',
                    { bvid }
                );
                cid = info.cid;
                title = info.title;
                const pages = info.pages;
                if (pages && pages.length > 0) {
                    const p = parseInt(new URLSearchParams(location.search).get('p')) || 1;
                    const pageInfo = pages.find(page => page.page === p);
                    if (pageInfo) cid = pageInfo.cid;
                }
                console.log(`[Subtitle-to-Gemini] 主世界 API 成功: 「${title}」(cid: ${cid})`);
            } catch (err) {
                // Fallback: 如果主世界不可用（如 Firefox 不支持 world: MAIN），直接 fetch
                console.warn('[Subtitle-to-Gemini] 主世界请求失败，降级为直接 fetch:', err.message);
                const infoJson = await safeFetchJSON(
                    `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
                    { credentials: 'include' }
                );
                if (infoJson.code !== 0) {
                    throw new Error(`获取视频信息失败: ${infoJson.message}`);
                }
                cid = infoJson.data.cid;
                title = infoJson.data.title;
            }
        }

        // --- 获取字幕列表（优先主世界）---
        let subtitles;
        try {
            subtitles = await requestFromMainWorld(
                'stg-request-subtitle-list', 'stg-subtitle-list-result',
                { bvid, cid }
            );
        } catch (err) {
            console.warn('[Subtitle-to-Gemini] 主世界字幕列表请求失败，降级:', err.message);
            const playerJson = await safeFetchJSON(
                `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`,
                { credentials: 'include' }
            );
            subtitles = playerJson?.data?.subtitle?.subtitles || [];
        }

        console.log('[Subtitle-to-Gemini] 可用字幕:', subtitles.map(s => s.lan_doc || s.lan));

        if (!subtitles || subtitles.length === 0) {
            throw new Error('该视频没有可用字幕（可能需要登录B站账号）');
        }

        const sub = pickSubtitle(subtitles);
        const result = await downloadBiliSubtitle(sub);
        result.title = title;
        return result;
    }

    // ========== Main Action ==========
    async function handleClick() {
        if (btn.classList.contains('stg-loading')) return;
        btn.classList.add('stg-loading');

        // Pause the video FIRST, before any async operations
        try {
            const video = document.querySelector('video');
            if (video && !video.paused) {
                video.pause();
                console.log('[Subtitle-to-Gemini] 视频已暂停');
            }
        } catch (_) { }

        try {
            let prompt;
            if (PLATFORM === 'youtube') {
                showToast('🔍 正在获取字幕…', 'info');
                try {
                    const result = await getYouTubeSubtitle();
                    prompt = result.text + '\n\n总结视频内容';
                } catch (err) {
                    console.warn('[Subtitle-to-Gemini] YouTube字幕获取失败，降级为纯链接:', err);
                    prompt = location.href + '\n\n总结视频内容';
                }
            } else {
                showToast('🔍 正在获取字幕…', 'info');
                const result = await getBilibiliSubtitle();
                prompt = result.text + '\n\n总结视频内容';
                // 在 toast 中显示视频标题，方便用户确认是否正确
                showToast(`✅ 「${result.title || ''}」字幕已获取`, 'success', 2000);
            }

            // Write to clipboard DIRECTLY (most robust cross-browser way)
            await navigator.clipboard.writeText(prompt);

            showToast('✅ 正在打开 Gemini…', 'success');

            setTimeout(() => {
                window.open('https://gemini.google.com/app#stg-auto', '_blank');
            }, 400);
        } catch (err) {
            console.error('[Subtitle-to-Gemini]', err);
            showToast(`❌ ${err.message}`, 'error', 5000);
        } finally {
            btn.classList.remove('stg-loading');
        }
    }

    btn.addEventListener('click', handleClick);

    // ========== SPA Navigation Handling ==========
    if (PLATFORM === 'youtube') {
        document.addEventListener('yt-navigate-finish', () => {
            container.style.display = location.pathname.startsWith('/watch')
                ? 'flex'
                : 'none';
        });
        container.style.display = location.pathname.startsWith('/watch')
            ? 'flex'
            : 'none';
    }

    console.log('[Subtitle-to-Gemini] Loaded on', PLATFORM);
})();

// ================================================================
// Gemini Auto-Paste Module
// Runs when content script is injected on gemini.google.com
// ================================================================
(function () {
    'use strict';

    if (!location.hostname.includes('gemini.google.com')) return;
    if (!location.hash.includes('stg-auto')) return;

    console.log('[Subtitle-to-Gemini] Gemini 自动粘贴模式激活');

    // Clean up the hash so refresh won't re-trigger
    history.replaceState(null, '', location.pathname + location.search);

    // Wait for Gemini's .ql-editor input to appear
    const MAX_WAIT = 15000;
    const POLL_INTERVAL = 500;
    let elapsed = 0;

    const poller = setInterval(async () => {
        elapsed += POLL_INTERVAL;
        if (elapsed > MAX_WAIT) {
            clearInterval(poller);
            console.warn('[Subtitle-to-Gemini] 等待 Gemini 输入框超时');
            return;
        }

        const inputEl = document.querySelector('.ql-editor[contenteditable="true"]');
        if (!inputEl) return;

        clearInterval(poller);
        console.log('[Subtitle-to-Gemini] 找到 Gemini 输入框 (.ql-editor)');

        // Focus and try to read from clipboard
        inputEl.focus();

        try {
            // Modern browsers restrict clipboard read without user interaction.
            // If it throws, we catch it immediately.
            const promptText = await navigator.clipboard.readText();
            if (!promptText) throw new Error('Clipboard empty');

            // Method 1: execCommand insertText (works best with contenteditable)
            const inserted = document.execCommand('insertText', false, promptText);

            if (!inserted || !inputEl.textContent.trim()) {
                // Method 2: set textContent and dispatch input event
                console.log('[Subtitle-to-Gemini] execCommand 失败，使用 textContent 回退');
                inputEl.textContent = promptText;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            console.log('[Subtitle-to-Gemini] ✅ 已粘贴内容到 Gemini 输入框');

            // Press Enter to submit after a short delay
            setTimeout(() => {
                inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13,
                    which: 13, bubbles: true, cancelable: true
                }));
                console.log('[Subtitle-to-Gemini] ✅ 已按 Enter 提交');
            }, 600);

        } catch (err) {
            console.warn('[Subtitle-to-Gemini] 自动读取剪贴板失败 (权限被拒绝或为空):', err);

            // Show a visual helper so the user knows what to do
            const helper = document.createElement('div');
            helper.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4285f4;color:white;padding:12px 24px;border-radius:8px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:sans-serif;font-weight:bold;animation:stg-fadein 0.3s;';
            helper.innerHTML = '✨ 字幕已在剪贴板中！<br><span style="font-size:12px;opacity:0.9;">（系统限制无法自动粘贴，请在下方输入框按 <kbd style="background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;">Ctrl/Cmd + V</kbd> 然后回车）</span>';

            document.body.appendChild(helper);
            setTimeout(() => { helper.style.opacity = '0'; helper.style.transition = 'opacity 0.5s'; }, 5000);
            setTimeout(() => helper.remove(), 5500);
        }
    }, POLL_INTERVAL);
})();
