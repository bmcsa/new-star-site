/* Store filters: AND across groups, OR inside a group, applied instantly. */
(function ($) {
  var PAGE_SIZE = 8;
  var visibleCount = PAGE_SIZE;
  var filtered = [];
  var priceFloor = 0;
  var priceCeil = 0;

  function checkedValues(name) {
    return $("#filter-form input[name='" + name + "']:checked")
      .map(function () {
        return this.value;
      })
      .get();
  }

  function slug(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function uniqueSorted(key) {
    var seen = {};
    (window.PRODUCTS || []).forEach(function (product) {
      seen[product[key]] = true;
    });
    return Object.keys(seen).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function buildDynamicFilters() {
    var groups = [
      { key: "teacher", name: "teacher", title: window.NewStarI18n.t("store.teacher") },
      { key: "variant", name: "variant", title: window.NewStarI18n.t("store.variant") }
    ];
    groups.forEach(function (group) {
      var values = uniqueSorted(group.key);
      var html =
        "<h3>" +
        group.title +
        "</h3>" +
        values
          .map(function (value) {
            var id = group.name + "-" + slug(value);
            return (
              '<div class="form-check">' +
              '<input class="form-check-input" type="checkbox" name="' +
              group.name +
              '" id="' +
              id +
              '" value="' +
              NewStar.escapeHtml(value) +
              '">' +
              '<label class="form-check-label" for="' +
              id +
              '">' +
              NewStar.escapeHtml(window.NewStarI18n.catalog(group.key, value)) +
              "</label></div>"
            );
          })
          .join("");
      $("#" + group.name + "-filters").html(html);
    });
  }

  function initPrice() {
    var prices = (window.PRODUCTS || []).map(function (product) {
      return product.price;
    });
    priceFloor = Math.min.apply(null, prices);
    priceCeil = Math.max.apply(null, prices);
    $("#price-min, #price-max").attr({ min: priceFloor, max: priceCeil });
    $("#price-min").val(priceFloor);
    $("#price-max").val(priceCeil);
    paintPrice();
  }

  function paintPrice() {
    var range = currentPrice();
    $("#price-min-label").text(NewStar.formatPrice(range.lo));
    $("#price-max-label").text(NewStar.formatPrice(range.hi));
  }

  function currentPrice() {
    var min = Number($("#price-min").val());
    var max = Number($("#price-max").val());
    return { lo: Math.min(min, max), hi: Math.max(min, max) };
  }

  function priceIsNarrowed() {
    var range = currentPrice();
    return range.lo !== priceFloor || range.hi !== priceCeil;
  }

  function matchesQuery(product, query) {
    if (!query) return true;
    var hay = window.NewStarI18n.haystack(product);
    return query.split(/\s+/).every(function (term) {
      return term && hay.indexOf(term) !== -1;
    });
  }

  function sortList(list) {
    var mode = $("#sort-select").val();
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (mode === "price-asc") {
        return a.price - b.price || a.title.localeCompare(b.title);
      }
      if (mode === "price-desc") {
        return b.price - a.price || a.title.localeCompare(b.title);
      }
      return new Date(b.createdAt) - new Date(a.createdAt) || a.title.localeCompare(b.title);
    });
    return copy;
  }

  function applyFilters() {
    var levels = checkedValues("level");
    var subjects = checkedValues("subject");
    var curricula = checkedValues("curriculum");
    var categories = checkedValues("category");
    var teachers = checkedValues("teacher");
    var variants = checkedValues("variant");
    var range = currentPrice();
    var query = ($("#store-query").val() || "").trim().toLowerCase();

    var list = (window.PRODUCTS || []).filter(function (product) {
      if (levels.length && levels.indexOf(product.level) === -1) return false;
      if (subjects.length && subjects.indexOf(product.subject) === -1) return false;
      if (curricula.length && curricula.indexOf(product.curriculum) === -1) return false;
      if (categories.length && categories.indexOf(product.category) === -1) return false;
      if (teachers.length && teachers.indexOf(product.teacher) === -1) return false;
      if (variants.length && variants.indexOf(product.variant) === -1) return false;
      if (product.price < range.lo || product.price > range.hi) return false;
      if (!matchesQuery(product, query)) return false;
      return true;
    });

    filtered = sortList(list);
    renderVisible();
    renderBadges();
  }

  function renderVisible() {
    var slice = filtered.slice(0, visibleCount);
    var query = ($("#store-query").val() || "").trim();
    NewStar.renderProducts(slice, $("#product-grid"), {
      highlight: query,
      columns: "col-12 col-md-6"
    });
    var noun = window.NewStarI18n.noun(filtered.length, "book");
    var shown = Math.min(visibleCount, filtered.length);
    var message = filtered.length
      ? window.NewStarI18n.t("store.showing", { shown: shown, total: filtered.length, noun: noun })
      : window.NewStarI18n.t("store.noMatch");
    $("#results-count").text(message);
    $("#load-more").prop("hidden", visibleCount >= filtered.length || !filtered.length);
    $("#store-empty").prop("hidden", filtered.length !== 0);
    $("#product-grid").prop("hidden", filtered.length === 0);
  }

  function badge(type, value, label) {
    return (
      '<span class="filter-badge">' +
      NewStar.escapeHtml(label) +
      '<button type="button" class="js-remove-filter" data-type="' +
      NewStar.escapeHtml(type) +
      '" data-value="' +
      NewStar.escapeHtml(value) +
      '" aria-label="Remove filter ' +
      NewStar.escapeHtml(label) +
      '"><i class="bi bi-x-lg" aria-hidden="true"></i></button></span>'
    );
  }

  function renderBadges() {
    var html = "";
    ["level", "subject", "curriculum", "category", "teacher", "variant"].forEach(function (name) {
      checkedValues(name).forEach(function (value) {
        html += badge(name, value, window.NewStarI18n.catalog(name, value));
      });
    });
    if (priceIsNarrowed()) {
      var range = currentPrice();
      html += badge("price", "price", NewStar.formatPrice(range.lo) + " – " + NewStar.formatPrice(range.hi));
    }
    var query = ($("#store-query").val() || "").trim();
    if (query) html += badge("q", query, window.NewStarI18n.t("store.searchBadge", { query: query }));
    if (html) {
      html +=
        '<button type="button" class="btn btn-link btn-sm p-0 js-clear-filters">' +
        NewStar.escapeHtml(window.NewStarI18n.t("store.clearAll")) +
        "</button>";
    }
    $("#active-filters").html(html);
  }

  function resetPrice() {
    $("#price-min").val(priceFloor);
    $("#price-max").val(priceCeil);
    paintPrice();
  }

  function clearAll() {
    $("#filter-form input[type='checkbox']").prop("checked", false);
    $("#store-query").val("");
    resetPrice();
    visibleCount = PAGE_SIZE;
    applyFilters();
  }

  function applyQueryString() {
    var params = new URLSearchParams(window.location.search);
    ["level", "subject", "curriculum", "category", "teacher"].forEach(function (key) {
      var value = params.get(key);
      if (!value) return;
      $("#filter-form input[name='" + key + "']").each(function () {
        if (this.value === value) this.checked = true;
      });
    });
    var query = params.get("q");
    if (query) $("#store-query").val(query);
  }

  function bindEvents() {
    $("#filter-form").on("change", "input[type='checkbox']", function () {
      visibleCount = PAGE_SIZE;
      applyFilters();
    });

    $("#price-min, #price-max").on("input", function () {
      var min = Number($("#price-min").val());
      var max = Number($("#price-max").val());
      if (min > max) {
        if (this.id === "price-min") $("#price-max").val(min);
        else $("#price-min").val(max);
      }
      paintPrice();
      visibleCount = PAGE_SIZE;
      applyFilters();
    });

    $("#sort-select").on("change", applyFilters);

    $("#store-query").on("input", function () {
      visibleCount = PAGE_SIZE;
      applyFilters();
    });

    $("#load-more").on("click", function () {
      visibleCount += PAGE_SIZE;
      renderVisible();
    });

    $(document).on("click", ".js-clear-filters", function () {
      clearAll();
    });

    $(document).on("click", ".js-remove-filter", function () {
      var type = $(this).attr("data-type");
      var value = $(this).attr("data-value");
      if (type === "price") {
        resetPrice();
      } else if (type === "q") {
        $("#store-query").val("");
      } else {
        $("#filter-form input[name='" + type + "']").each(function () {
          if (this.value === value) this.checked = false;
        });
      }
      visibleCount = PAGE_SIZE;
      applyFilters();
    });
  }

  window.applyFilters = function () {
    applyFilters();
  };

  function restoreDynamicChecks(name, values) {
    values.forEach(function (value) {
      $("#filter-form input[name='" + name + "']").each(function () {
        if (this.value === value) this.checked = true;
      });
    });
  }

  function refreshLanguage() {
    var teachers = checkedValues("teacher");
    var variants = checkedValues("variant");
    buildDynamicFilters();
    restoreDynamicChecks("teacher", teachers);
    restoreDynamicChecks("variant", variants);
    applyFilters();
  }

  $(function () {
    if (!$("#filter-form").length || !window.NewStar || !window.NewStarI18n) return;
    window.NewStarI18n.ready.then(function () {
      buildDynamicFilters();
      initPrice();
      applyQueryString();
      bindEvents();
      window.NewStar.applyFilters = applyFilters;
      applyFilters();
    });
    $(document).on("newstar:lang", function () {
      if (!$("#filter-form").length) return;
      refreshLanguage();
    });
  });
})(jQuery);
