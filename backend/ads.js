const AUTH = "https://auth.mcbcode.com";

async function shouldShowAds() {
    try {
        const res = await fetch(`${AUTH}/me`, { credentials: "include" });
        return !res.ok; // not logged in → show ads
    } catch {
        return true; // if auth fails, assume not logged in
    }
}

function loadAdsense() {
    const script = document.createElement("script");
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2825557346768110";
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
}

function injectAd(containerId, slotId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
        <ins class="adsbygoogle"
            style="display:block"
            data-ad-client="ca-pub-2825557346768110"
            data-ad-slot="${slotId}"
            data-ad-format="auto"
            data-full-width-responsive="true"></ins>
    `;

    (adsbygoogle = window.adsbygoogle || []).push({});
}

(async () => {
    const showAds = await shouldShowAds();
    if (!showAds) return;

    loadAdsense();

    window.addEventListener("load", () => {
        const path = window.location.pathname;

        if (path.includes("editor")) {
            injectAd("ad-editor-bottom", "EDITOR_SLOT_ID");
        }

        if (path.includes("dashboard")) {
            injectAd("ad-dashboard-side", "DASHBOARD_SLOT_ID");
        }
    });
})();
