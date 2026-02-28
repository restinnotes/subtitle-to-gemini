/**
 * bili-inject.js — 运行在页面主世界 (MAIN world) 的 B 站视频信息提取器
 * 
 * 为什么需要这个文件？
 * - Content Script 运行在隔离世界，其 fetch 请求会被 BiliPlus 等插件的代理层拦截
 * - 内联 <script> 注入会被 B 站的 CSP 策略拦截
 * - 本文件通过 manifest.json 的 world: "MAIN" 声明，直接在页面上下文中执行
 * - 与 content.js 通过 CustomEvent 通信
 */
(function () {
    'use strict';

    const TAG = '[STG-Inject]';

    // 监听 content script 的请求
    document.addEventListener('stg-request-video-info', async (e) => {
        const { requestId, bvid } = e.detail;
        console.log(TAG, '收到请求:', bvid, '(requestId:', requestId, ')');

        try {
            // Step 1: 获取视频信息（cid + 标题）
            const infoResp = await fetch(
                `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
                { credentials: 'include' }
            );
            const infoJson = await infoResp.json();

            if (infoJson.code !== 0) {
                throw new Error(`API 错误: ${infoJson.message}`);
            }

            const data = infoJson.data;
            const result = {
                aid: data.aid,
                cid: data.cid,
                title: data.title,
                pages: data.pages || [],
            };

            console.log(TAG, '视频信息获取成功:', result.title);

            document.dispatchEvent(new CustomEvent('stg-video-info-result', {
                detail: { requestId, success: true, data: result }
            }));
        } catch (err) {
            console.error(TAG, '获取视频信息失败:', err);
            document.dispatchEvent(new CustomEvent('stg-video-info-result', {
                detail: { requestId, success: false, error: err.message }
            }));
        }
    });

    // 监听 content script 的字幕列表请求
    document.addEventListener('stg-request-subtitle-list', async (e) => {
        const { requestId, bvid, cid } = e.detail;
        console.log(TAG, '请求字幕列表:', bvid, cid);

        try {
            const resp = await fetch(
                `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`,
                { credentials: 'include' }
            );
            const json = await resp.json();

            const subtitles = json?.data?.subtitle?.subtitles || [];
            console.log(TAG, '字幕列表:', subtitles.map(s => s.lan_doc || s.lan));

            document.dispatchEvent(new CustomEvent('stg-subtitle-list-result', {
                detail: { requestId, success: true, data: subtitles }
            }));
        } catch (err) {
            console.error(TAG, '获取字幕列表失败:', err);
            document.dispatchEvent(new CustomEvent('stg-subtitle-list-result', {
                detail: { requestId, success: false, error: err.message }
            }));
        }
    });

    console.log(TAG, 'MAIN world 注入脚本已加载');
})();
