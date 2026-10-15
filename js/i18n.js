/* New Star language switch.
   Static site: strings live in i18n/en.json and i18n/ar.json.
   Choice is stored in localStorage (newstar_lang). A ?lang= link wins
   over the saved choice so a shared URL opens in that language.
   First visit with neither uses the browser language.

   Add a language: copy i18n/en.json to i18n/<code>.json and i18n/en.js to
   i18n/<code>.js, add the code to SUPPORTED, add <script src="i18n/<code>.js">
   before this file, and add a button[data-set-lang="<code>"] in each header.
   The .js copies exist so the dictionaries still load when the page is opened
   as a file. Browsers block fetch() of local JSON in that case. */
(function () {
  var STORAGE_KEY = "newstar_lang";
  var SUPPORTED = { en: true, ar: true };
  var BOOTSTRAP = {
    en: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
    ar: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css"
  };

  var lang = window.__NS_LANG || document.documentElement.lang || "en";
  if (!SUPPORTED[lang]) lang = "en";

  var dict = {};
  var enDict = {};
  var warned = {};

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dig(obj, path) {
    var node = obj;
    for (var i = 0; i < path.length; i += 1) {
      if (!node || typeof node !== "object") return undefined;
      node = node[path[i]];
    }
    return node;
  }

  function warn(key) {
    if (warned[key]) return;
    warned[key] = true;
    console.warn("Missing translation:", key);
  }

  function lookup(path) {
    var value = dig(dict, path);
    if (typeof value === "string") return value;
    var fallback = dig(enDict, path);
    if (typeof fallback === "string") {
      warn(path.join("."));
      return fallback;
    }
    return null;
  }

  function fill(template, vars, escapeValues) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, function (_, name) {
      var value = vars[name] == null ? "" : String(vars[name]);
      return escapeValues ? escapeHtml(value) : value;
    });
  }

  function t(key, vars) {
    var value = lookup(String(key).split("."));
    if (value == null) {
      warn(key);
      value = key;
    }
    return fill(value, vars, false);
  }

  function tHtml(key, vars) {
    var value = lookup(String(key).split("."));
    if (value == null) {
      warn(key);
      value = key;
    }
    return fill(value, vars, true);
  }

  function catalog(group, value) {
    var found = lookup(["catalog", group, value]);
    if (found == null) {
      warn("catalog." + group + "." + value);
      return value;
    }
    return found;
  }

  function productText(product, field) {
    if (!product) return "";
    var found = lookup(["products", product.id, field]);
    if (found == null) {
      warn("products." + product.id + "." + field);
      return product[field] || "";
    }
    return found;
  }

  /* Arabic plural buckets: 1, 2, 3–10, 11+. English uses one/many only. */
  function noun(count, group) {
    var n = Math.abs(Math.floor(Number(count) || 0));
    var form = "many";
    if (document.documentElement.lang === "ar") {
      if (n === 1) form = "one";
      else if (n === 2) form = "two";
      else if (n >= 3 && n <= 10) form = "few";
    } else if (n === 1) {
      form = "one";
    }
    return t("nouns." + group + "." + form);
  }

  function haystack(product) {
    var parts = [
      product.title,
      product.subject,
      product.teacher,
      product.level,
      product.category,
      product.curriculum,
      product.variant,
      product.description,
      productText(product, "title"),
      productText(product, "description")
    ];
    ["level", "subject", "curriculum", "category", "teacher", "variant"].forEach(function (group) {
      parts.push(catalog(group, product[group]));
    });
    return parts.join(" ").toLowerCase();
  }

  function load(code) {
    var preloaded = window.__NS_DICTS && window.__NS_DICTS[code];
    var remote = location.protocol === "http:" || location.protocol === "https:";
    /* file:// cannot fetch JSON. The i18n/<code>.js scripts already defined the dictionaries. */
    if (!remote) {
      return preloaded ? Promise.resolve(preloaded) : Promise.reject(new Error("Cannot load i18n/" + code + ".json"));
    }
    var url = new URL("i18n/" + code + ".json", document.baseURI);
    return fetch(url.href, { cache: "no-cache" }).then(function (response) {
      if (!response.ok) throw new Error("Cannot load i18n/" + code + ".json");
      return response.json();
    }).catch(function (error) {
      if (preloaded) return preloaded;
      throw error;
    });
  }

  function swapBootstrap(code) {
    var link = document.getElementById("bootstrap-css");
    if (!link) return;
    var next = BOOTSTRAP[code] || BOOTSTRAP.en;
    if (link.getAttribute("href") !== next) link.setAttribute("href", next);
  }

  function pageUrl(langValue) {
    var url = new URL(window.location.href);
    url.hash = "";
    if (langValue) url.searchParams.set("lang", langValue);
    else url.searchParams.delete("lang");
    return url.href;
  }

  function applyMeta() {
    var titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) document.title = t(titleEl.getAttribute("data-i18n"));
    var canonical = document.getElementById("canonical-link");
    var altEn = document.getElementById("hreflang-en");
    var altAr = document.getElementById("hreflang-ar");
    var altDefault = document.getElementById("hreflang-default");
    if (canonical) canonical.setAttribute("href", pageUrl(null));
    if (altEn) altEn.setAttribute("href", pageUrl("en"));
    if (altAr) altAr.setAttribute("href", pageUrl("ar"));
    if (altDefault) altDefault.setAttribute("href", pageUrl(null));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }

  function applyDom(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split("|").forEach(function (pair) {
        var splitAt = pair.indexOf(":");
        if (splitAt < 1) return;
        el.setAttribute(pair.slice(0, splitAt), t(pair.slice(splitAt + 1)));
      });
    });
    scope.querySelectorAll("[data-i18n-catalog]").forEach(function (el) {
      var bits = el.getAttribute("data-i18n-catalog").split("|");
      el.textContent = catalog(bits[0], bits.slice(1).join("|"));
    });
    /* Starter searches should query the label the visitor is reading. */
    scope.querySelectorAll("[data-i18n-search]").forEach(function (el) {
      var bits = el.getAttribute("data-i18n-search").split("|");
      var label = catalog(bits[0], bits.slice(1).join("|"));
      el.textContent = label;
      el.setAttribute("href", "search.html?q=" + encodeURIComponent(label));
    });
    scope.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      var on = btn.getAttribute("data-set-lang") === lang;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.classList.toggle("is-active", on);
    });
  }

  function applyAll() {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      /* Private mode can block storage; the ?lang= URL still works. */
    }
    swapBootstrap(lang);
    applyMeta();
    applyDom(document);
    /* Unhide after the page scripts re-render cards, so Arabic does not flash empty grids. */
    setTimeout(function () {
      document.documentElement.classList.remove("i18n-pending");
    }, 0);
  }

  function emit() {
    if (window.jQuery) window.jQuery(document).trigger("newstar:lang");
    document.dispatchEvent(new CustomEvent("newstar:lang"));
  }

  function setLang(next) {
    if (!SUPPORTED[next] || next === lang) return Promise.resolve(lang);
    lang = next;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.add("i18n-pending");
    var url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    return load(next)
      .then(function (data) {
        dict = data;
        applyAll();
        emit();
        return lang;
      })
      .catch(function (error) {
        console.error(error);
        document.documentElement.classList.remove("i18n-pending");
      });
  }

  document.addEventListener("click", function (event) {
    var btn = event.target.closest ? event.target.closest("[data-set-lang]") : null;
    if (!btn) return;
    event.preventDefault();
    setLang(btn.getAttribute("data-set-lang"));
  });

  var domReady =
    document.readyState === "loading"
      ? new Promise(function (resolve) {
          document.addEventListener("DOMContentLoaded", resolve);
        })
      : Promise.resolve();

  var ready = Promise.all([domReady, load("en"), lang === "en" ? null : load(lang)])
    .then(function (results) {
      enDict = results[1] || {};
      dict = lang === "en" ? enDict : results[2] || enDict;
      applyAll();
      return lang;
    })
    .catch(function (error) {
      console.error(error);
      document.documentElement.classList.remove("i18n-pending");
    });

  window.NewStarI18n = {
    ready: ready,
    t: t,
    tHtml: tHtml,
    catalog: catalog,
    productText: productText,
    noun: noun,
    haystack: haystack,
    setLang: setLang,
    getLang: function () {
      return lang;
    }
  };
})();
