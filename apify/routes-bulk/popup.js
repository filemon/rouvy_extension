window.VT = window.VT || {}, VT.initPopupBanner = function () {
    var e = $(".popupBanner"), n = e.attr("id"), t = VT.readCookie(n), o = e.attr("data-banner-d"),
        i = e.attr("data-banner-t");
    if (!t && 0 < e.length && (VT.setCookie(n, !0, 60 * i * 60), this.submitTimeout = setTimeout(function () {
        e.show()
    }, 1e3 * o)), 0 < e.length) {
        var r = new Image;
        r.src = e.find("img").attr("src"), r.onload = function () {
            VT.centerOverlay(e)
        }
    }
}, VT.setCookie = function (e, n, t) {
    var o = "";
    if (t) {
        var i = new Date;
        i.setTime(i.getTime() + 1e3 * t), o = "; expires=" + i.toUTCString()
    }
    document.cookie = e + "=" + (n || "") + o + "; path=/; domain=." + rootDomain
}, VT.readCookie = function (e) {
    for (var n = e + "=", t = document.cookie.split(";"), o = 0; o < t.length; o++) {
        for (var i = t[o]; " " === i.charAt(0);) i = i.substring(1, i.length);
        if (0 === i.indexOf(n)) return i.substring(n.length, i.length)
    }
    return null
}, VT.eraseCookie = function (e) {
    document.cookie = e + "=; Max-Age=-99999999;"
}, jQuery(document).ready(VT.initPopupBanner);
//# sourceMappingURL=popupBanner.min.js.map
