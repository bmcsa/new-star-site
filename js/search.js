/* Search page: live suggestions, keyword highlight, and ?q= on load. */
(function ($) {
  var activeIndex = -1;
  var currentItems = [];

  function queryFromInput() {
    return ($("#search-input").val() || "").trim();
  }

  function fieldHit(product, query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var blob = window.NewStarI18n.haystack(product);
    return terms.every(function (term) {
      return blob.indexOf(term) !== -1;
    });
  }

  function includesTerm(values, query) {
    for (var i = 0; i < values.length; i += 1) {
      if (values[i].indexOf(query) !== -1) return true;
    }
    return false;
  }

  function score(product, query) {
    var q = query.toLowerCase();
    var titles = [product.title.toLowerCase(), window.NewStarI18n.productText(product, "title").toLowerCase()];
    var i;
    for (i = 0; i < titles.length; i += 1) {
      if (titles[i].indexOf(q) === 0) return 0;
    }
    if (includesTerm(titles, q)) return 1;
    if (includesTerm([product.subject.toLowerCase(), window.NewStarI18n.catalog("subject", product.subject).toLowerCase()], q)) return 2;
    if (includesTerm([product.teacher.toLowerCase(), window.NewStarI18n.catalog("teacher", product.teacher).toLowerCase()], q)) return 3;
    return 4;
  }

  function findMatches(query) {
    return (window.PRODUCTS || [])
      .filter(function (product) {
        return fieldHit(product, query);
      })
      .sort(function (a, b) {
        return score(a, query) - score(b, query) || a.title.localeCompare(b.title);
      });
  }

  function setActive(index) {
    var buttons = $("#suggestions .suggestion");
    buttons.removeClass("is-active").removeAttr("aria-selected");
    if (index < 0 || index >= buttons.length) {
      activeIndex = -1;
      $("#search-input").removeAttr("aria-activedescendant");
      return;
    }
    activeIndex = index;
    var $btn = buttons.eq(index);
    $btn.addClass("is-active").attr("aria-selected", "true");
    $("#search-input").attr("aria-activedescendant", $btn.attr("id"));
    var node = $btn.get(0);
    if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
  }

  function hideSuggestions() {
    activeIndex = -1;
    currentItems = [];
    $("#suggestions").attr("hidden", true).empty();
    $("#search-input").attr("aria-expanded", "false").removeAttr("aria-activedescendant");
  }

  function renderSuggestions(query) {
    if (query.length < 1) {
      hideSuggestions();
      return;
    }
    currentItems = findMatches(query).slice(0, 8);
    if (!currentItems.length) {
      hideSuggestions();
      return;
    }
    var html = currentItems
      .map(function (product, index) {
        return (
          '<li role="presentation">' +
          '<button type="button" class="suggestion" role="option" id="sug-' +
          index +
          '" data-id="' +
          NewStar.escapeHtml(product.id) +
          '">' +
          '<span class="suggestion-title">' +
          NewStar.highlightText(window.NewStarI18n.productText(product, "title"), query) +
          "</span>" +
          '<span class="suggestion-meta">' +
          NewStar.mixedHtml(window.NewStarI18n.catalog("level", product.level)) +
          " · " +
          NewStar.mixedHtml(window.NewStarI18n.catalog("subject", product.subject)) +
          " · " +
          NewStar.mixedHtml(window.NewStarI18n.catalog("teacher", product.teacher)) +
          " · " +
          NewStar.mixedHtml(window.NewStarI18n.catalog("category", product.category)) +
          "</span></button></li>"
        );
      })
      .join("");
    $("#suggestions").html(html).removeAttr("hidden");
    $("#search-input").attr("aria-expanded", "true");
    activeIndex = -1;
  }

  function renderResults(query) {
    var term = query.trim();
    $("#search-prompt").prop("hidden", term.length > 0);
    if (!term) {
      $("#search-results").empty().prop("hidden", true);
      $("#search-empty").prop("hidden", true);
      $("#search-count").text("");
      return;
    }
    var matches = findMatches(term);
    var noun = window.NewStarI18n.noun(matches.length, "result");
    $("#search-count").html(window.NewStarI18n.tHtml("search.count", { count: matches.length, noun: noun, query: term }));
    if (!matches.length) {
      $("#search-results").empty().prop("hidden", true);
      $("#search-empty").prop("hidden", false);
      $("#search-empty-title").html(window.NewStarI18n.tHtml("search.nothing", { query: term }));
      return;
    }
    $("#search-empty").prop("hidden", true);
    $("#search-results").prop("hidden", false);
    NewStar.renderProducts(matches, $("#search-results"), { highlight: term });
  }

  function commitSearch(value, push) {
    $("#search-input").val(value);
    hideSuggestions();
    renderResults(value);
    if (push && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", searchUrl(value));
    }
  }

  function searchUrl(value) {
    var params = new URLSearchParams(window.location.search);
    if (value) params.set("q", value);
    else params.delete("q");
    var query = params.toString();
    return "search.html" + (query ? "?" + query : "");
  }

  function chooseSuggestion(id) {
    var product = NewStar.getProduct(id);
    if (!product) return;
    commitSearch(window.NewStarI18n.productText(product, "title"), true);
  }

  function readInitialQuery() {
    var params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  }

  $(function () {
    if (!$("#search-form").length || !window.NewStar || !window.NewStarI18n) return;

    window.NewStarI18n.ready.then(function () {
      var initial = readInitialQuery();
      if (initial) {
        $("#search-input").val(initial);
        renderResults(initial);
      }
    });

    $(document).on("newstar:lang", function () {
      if (!$("#search-form").length) return;
      var value = queryFromInput();
      renderSuggestions(value);
      renderResults(value);
    });

    $("#search-input").on("input", function () {
      var value = queryFromInput();
      renderSuggestions(value);
      renderResults(value);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", searchUrl(value));
      }
    });

    $("#search-form").on("submit", function (event) {
      event.preventDefault();
      if (activeIndex >= 0 && currentItems[activeIndex]) {
        chooseSuggestion(currentItems[activeIndex].id);
        return;
      }
      commitSearch(queryFromInput(), true);
    });

    $("#search-input").on("keydown", function (event) {
      var open = !$("#suggestions").attr("hidden") && currentItems.length;
      if (event.key === "ArrowDown" && open) {
        event.preventDefault();
        setActive(activeIndex + 1 >= currentItems.length ? 0 : activeIndex + 1);
      } else if (event.key === "ArrowUp" && open) {
        event.preventDefault();
        setActive(activeIndex <= 0 ? currentItems.length - 1 : activeIndex - 1);
      } else if (event.key === "Escape") {
        hideSuggestions();
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        chooseSuggestion(currentItems[activeIndex].id);
      }
    });

    $(document).on("click", "#suggestions .suggestion", function () {
      chooseSuggestion($(this).attr("data-id"));
    });

    $(document).on("click", function (event) {
      if (!$(event.target).closest(".search-shell").length) hideSuggestions();
    });
  });
})(jQuery);
