(function() {
    const engines = ['https://cn.bing.com?q=', 'https://baidu.com/s?wd='];
    const search = window.location.search;
    const args = search.replace('?', '').split('&');
    const kw = args.map(arg => arg.split('=')).find(pair => pair[0] === 'kw');
    const input = $$(".search-form input");
    if (kw) {
        doSearch(kw[1]);
        input.value = decodeURI(kw[1]);
    }
    if (!input.value) {
        engines.forEach((url, index) => $$(`iframe:nth-of-type(${index + 1})`).src = url);
    }
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.target.value) {
            window.location.search = `?kw=${e.target.value}`;
        }
    });

    function doSearch(keyword) {
        if (!keyword) {
            return;
        }
        engines.map(engine => engine + keyword)
            .forEach((url, index) => $$(`iframe:nth-of-type(${index + 1})`).src = url);
    }

    function $$(selector) {
        return document.querySelector(selector);
    }
})();
