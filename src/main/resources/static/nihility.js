// ==UserScript==
// @name         裁之刃-无
// @namespace    com.littelearphone.nihility
// @version      0.0.1
// @description  群体攻击技能
// @author       littelearphone
// @include      *
// @grant        GM.setValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    function $(selector) {
        return document.querySelector(selector);
    }

    function doClick(obj) {
        if (!obj) {
            return;
        }
        if (obj.click) {
            obj.click();
        } else {
            var evt = document.createEvent('Event');
            evt.initEvent('click', true, true);
            obj.dispatchEvent(evt);
        }
    }

    function taskExecutor() {
        taskQueue = taskQueue.filter(task => {
            task.retry = (task.retry || 0);
            if (task.retry >= task.maxRetry) {
                return false;
            }
            if (typeof task.initial !== "function" || task.initial()) {
                task.retry += 1;
                return true;
            }
            if (typeof task.finish !== "function" || task.finish()) {
                return false;
            }
            typeof task.recursive === "function" && task.recursive();
            task.retry += 1;
            return true;
        });
    }

    let taskQueue = [];

    const pureAction = {};
    pureAction["http.?://www[.]jb51[.]net/.*[.]html"] = function () {
        const styleElement = document.createElement("style");
        styleElement.rel = "stylesheet";
        styleElement.innerHTML = `
            #container .pt10.clearfix, #topbar, #header, #nav, #right-share, #footer,
            .xgcomm.clearfix, .main-right, .lbd.clearfix, .normal_li ~ *, #con_all,
            #container .tonglan, #container #param-content ~ *, #container .softsfwtl,
            #download .address-wrap ~ *, #xgw1, #down4, #gaosu, .gs, #container .tip ~ * {
                display: none !important;
            }
            #container {
                width: calc(100% - 160px) !important;
            }
            #main .main-left, #content pre, #content code, li.address-wrap, #download, #param {
                width: 100% !important;
            }
            li.address-wrap {
                height: auto !important;
            }
            .search {
                margin: 5px auto !important;
            }
        `;
        $("head").appendChild(styleElement);
        console.log("[Initial jb51 lite script]");
    };
    pureAction["http.?://www[.]7down[.]com/soft/.*[.]html"] = function () {
        const styleElement = document.createElement("style");
        styleElement.rel = "stylesheet";
        styleElement.innerHTML = `
            .top, .header div p, .nav, .subnav, #btndowns, .down_right, .soft-left,
            #downloads, #specialbox, .game02, .game04, #downlist > *, #downloadbox,
            .tit04, .soft-body .head, a.xza {
                display: none !important;
            }
            #downlist > .off ~ dd {
                display: block !important;
            }
            .soft-body {
                width: auto !important;
            }
            .down_left {
                float: right !important;
            }
            .down-info {
                height: auto !important;
            }
            .downlist {
                position: absolute;
                top: 200px;
                left: 100px;
            }
            .downbox {
                width: 0 !important;
                height: 0 !important;
            }
            #downloadbox {
                left: auto !important;
                right: 0 !important;
                bottom: auto !important;
                top: 20px !important;
            }
        `;
        $("head").appendChild(styleElement);
        console.log("[Initial 7down lite script]");
    };
    pureAction["http.?://www[.]pc6[.]com/softview/SoftView_.*[.]html"] = function () {
        const styleElement = document.createElement("style");
        styleElement.rel = "stylesheet";
        styleElement.innerHTML = `
            #topNavC, .bdcs-hot, #header dd, #bdfx, #sidebar, #xzbtn .downnow, #mtab,
            .ad-download, .address-wrap h2, .address-wrap h3, .address-wrap #gaosuxiazai,
            #xgd, #xgw, #reci, #xgk, .sendErr-wrap {
                display: none !important;
            }
            #content {
                width: auto !important;
            }
            .address-wrap, #param-box, #param {
                height: auto !important;
            }
            #autotab {
                top: 100px;
                right: 40px;
                left: auto;
                background: white;
                border: 1px solid #390;
                padding: 10px;
            }
            #cmtMsg, #main, #param-box {
                width: 100% !important;
            }
            ##param-content {
                float: right !important;
            }
        `;
        $("head").appendChild(styleElement);
        console.log("[Initial pc6 lite script]");
    };
    pureAction["http.?://www[.]douyu[.]com/.+"] = function () {

        function doFullWebScreen() {
            const fullScreenSelector = '[title="网页全屏"]';
            taskQueue.push({
                initial: () => !$(fullScreenSelector),
                finish: () => $('.is-fullScreenPage'),
                recursive: () => doClick($(fullScreenSelector))
            });
            const allScreenSelector = 'body.is-fullScreenPage .layout-Player-asidetoggleButton';
            taskQueue.push({
                initial: () => !$(allScreenSelector),
                finish: () => $('.is-fullScreenAll'),
                recursive: () => doClick($(allScreenSelector))
            });
        }

        const styleElement = document.createElement("style");
        styleElement.rel = "stylesheet";
        styleElement.innerHTML = `
            .PrivilegeGiftModalDialog, #js-room-activity, #js-aside, .layout-Player-aside,
            #js-bottom, [class*='recommendAD'], [class*='recommendApp'], .Title-anchorInfo,
            .Title-impress, .Title-roomOtherBottom, .layout-Banner, .layout-Module.Recommend-wrapper,
            .ScrollTabFrame-wrapper:after {
                display: none !important;
            }
            .Title {
                height: 64px !important;
                padding-left: 70px !important;
            }
            .Title-anchorPic {
                width: 64px !important;
                height: 64px !important;
            }
            #js-player-title {
                min-height: auto !important;
            }
            .layout-Player-main {
                margin: 0 !important;
            }
            [class*='controlbar-'] {
                width: 100% !important;
            }
            .PlayerToolbar {
                padding: 5px !important;
            }
            .layout-Container {
                padding: 0 !important;
            }
            .layout-Main {
                padding-top: 0 !important;
                margin-left: 0 !important;
            }
            .layout-Module {
                margin-top: 100px !important;
            }
            #js-follow {
                margin-left: 0 !important;
            }
            body:not(.is-fullScreenPage) {
                min-height: auto !important;
                overflow: auto !important;
            }
            body:not(.is-fullScreenPage) .layout-Container {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
            }
            body:not(.is-fullScreenPage) .layout-Player-video {
                padding-top: calc(100% - 550px) !important;
            }
            .layout-Module-head {
                left: 0 !important;
            }
        `;
        if (window.location.href.indexOf("/directory") < 0) {
            styleElement.innerHTML += `
                #js-header {
                    display: none !important;
                }
            `;
        }
        $("head").appendChild(styleElement);
        doFullWebScreen();
        setInterval(taskExecutor, 500);
        console.log("[Initial douyu lite script]");
    };
    pureAction["http.?://www[.]bilibili[.]com/video/av.*"] = function () {

        function doSpeedUp() {
            const selector = '.bilibili-player-video video';
            taskQueue.push({
                initial: () => !$(selector),
                finish: () => $(selector).playbackRate === 1.25,
                recursive: () => ($(selector).playbackRate = 1.25)
            });
        }

        function doFullWebScreen() {
            const selector = 'button.bilibili-player-iconfont-web-fullscreen-off';
            taskQueue.push({
                initial: () => !$(selector),
                finish: () => $(".webfullscreen"),
                recursive: () => doClick($(selector))
            });
        }

        function doAutoStartPlay() {
            taskQueue.push({
                initial: () => {
                    const selectors = ".bilibili-player-video video,.bilibili-player-video-btn-start";
                    return document.querySelectorAll(selectors).length < 2;
                },
                finish: () => !$(".bilibili-player-video video").paused,
                recursive: () => doClick($('.bilibili-player-video-btn-start'))
            });
        }

        function doAutoStartPlayJump() {
            const selector = ".bilibili-player-video-toast-item-text";
            taskQueue.push({
                maxRetry: 10,
                initial: () => !$(selector),
                finish: () => !$(selector),
                recursive: function () {
                    let countTime = 0;
                    const series = [1, 60, 60 * 60];
                    const lastTime = $(selector).lastChild.textContent;
                    lastTime.split(":")
                        .reverse()
                        .forEach((part, index) => (countTime += series[index] * part));
                    $(".bilibili-player-video video").currentTime = countTime;
                    $(".bilibili-player-video-toast-bottom").innerHTML = "";
                }
            });
        }

        function doStart() {
            const control = $(".video-control-show");
            if (!control) {
                setTimeout(doStart, 500);
                return;
            }
            doSpeedUp();
            doFullWebScreen();
            doAutoStartPlay();
            doAutoStartPlayJump();
            console.log("[Initial bilibili lite script]");
        }

        doStart();
        setInterval(taskExecutor, 500);
    };

    for (let reg in pureAction) {
        new RegExp(reg).test(window.location.href) && pureAction[reg].call(this);
    }

})();