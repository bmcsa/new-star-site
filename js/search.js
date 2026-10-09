/* Search page: live suggestions, keyword highlight, and ?q= on load. */
(function ($) {
  var activeIndex = -1;
  var currentItems = [];

  function queryFromInput() {
    return ($("#search-input").val() || "").trim();
  }

  function fieldBlob(product) {
    return [product.title, product.subject, product.teacher, product.level, product.category, product.curriculum, product.variant]
      .join(" ")
      .toLowerCase();
  }

  function fieldHit(product, query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var blob = fieldBlob(product);
    return terms.every(function (term) {
      return blob.indexOf(term) !== -1;
    });
  }

  function score(product, query) {
    var q = query.toLowerCase();
    var title = product.title.toLowerCase();
    if (title.indexOf(q) === 0) return 0;
    if (title.indexOf(q) !== -1) return 1;
    if (product.subject.toLowerCase().indexOf(q) !== -1) return 2;
    if (product.teacher.toLowerCase().indexOf(q) !== -1) return 3;
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
          NewStar.highlightText(product.title, query) +
          "</span>" +
          '<span class="suggestion-meta">' +
          NewStar.escapeHtml(product.level) +
          " · " +
          NewStar.escapeHtml(product.subject) +
          " · " +
          NewStar.escapeHtml(product.teacher) +
          " · " +
          NewStar.escapeHtml(product.category) +
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
    var noun = matches.length === 1 ? "result" : "results";
    $("#search-count").text(matches.length + " " + noun + " for “" + term + "”");
    if (!matches.length) {
      $("#search-results").empty().prop("hidden", true);
      $("#search-empty").prop("hidden", false);
      $("#search-empty-query").text(term);
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
    var url = "search.html" + (value ? "?q=" + encodeURIComponent(value) : "");
    if (push && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", url);
    }
  }

  function chooseSuggestion(id) {
    var product = NewStar.getProduct(id);
    if (!product) return;
    commitSearch(product.title, true);
  }

  $(function () {
    if (!$("#search-form").length || !window.NewStar) return;

    var params = new URLSearchParams(window.location.search);
    var initial = params.get("q") || "";
    if (initial) {
      $("#search-input").val(initial);
      renderResults(initial);
    }

    $("#search-input").on("input", function () {
      var value = queryFromInput();
      renderSuggestions(value);
      renderResults(value);
      if (window.history && window.history.replaceState) {
        var url = "search.html" + (value ? "?q=" + encodeURIComponent(value) : "");
        window.history.replaceState(null, "", url);
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
