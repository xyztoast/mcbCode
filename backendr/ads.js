function loadAdsense() {
    const script = document.createElement("script");
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2825557346768110";
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
}

loadAdsense();
