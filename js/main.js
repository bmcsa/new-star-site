/* Shared New Star behaviour: storage, cards, counters, wishlist, quick view. */
(function ($) {
  var CART_KEY = "newstar_cart";
  var WISH_KEY = "newstar_wishlist";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getProduct(id) {
    var products = window.PRODUCTS || [];
    var key = String(id);
    for (var i = 0; i < products.length; i += 1) {
      if (String(products[i].id) === key) return products[i];
    }
    return null;
  }

  function formatPrice(amount) {
    var value = Math.max(0, Math.round(Number(amount) || 0));
    return "EGP " + value.toLocaleString("en-US");
  }

  /* ---------- Cart and wishlist storage ---------- */

  function readCart() {
    var raw = [];
    try {
      raw = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (error) {
      raw = [];
    }
    if (!Array.isArray(raw)) raw = [];
    var clean = [];
    raw.forEach(function (item) {
      if (!item || !getProduct(item.id)) return;
      var qty = Math.floor(Number(item.qty));
      if (!qty || qty < 1) return;
      clean.push({ id: String(item.id), qty: Math.min(99, qty) });
    });
    if (JSON.stringify(clean) !== JSON.stringify(raw)) {
      localStorage.setItem(CART_KEY, JSON.stringify(clean));
    }
    return clean;
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCounters();
    $(document).trigger("newstar:cart");
  }

  function readWishlist() {
    var raw = [];
    try {
      raw = JSON.parse(localStorage.getItem(WISH_KEY)) || [];
    } catch (error) {
      raw = [];
    }
    if (!Array.isArray(raw)) raw = [];
    var clean = [];
    raw.forEach(function (id) {
      var key = String(id);
      if (getProduct(key) && clean.indexOf(key) === -1) clean.push(key);
    });
    if (JSON.stringify(clean) !== JSON.stringify(raw)) {
      localStorage.setItem(WISH_KEY, JSON.stringify(clean));
    }
    return clean;
  }

  function writeWishlist(ids) {
    localStorage.setItem(WISH_KEY, JSON.stringify(ids));
    updateCounters();
    syncWishlistButtons();
    renderWishlist();
    $(document).trigger("newstar:wishlist");
  }

  function addToCart(id, qty) {
    var product = getProduct(id);
    if (!product) return;
    var amount = Math.max(1, Math.floor(Number(qty) || 1));
    var cart = readCart();
    var found = false;
    cart.forEach(function (item) {
      if (item.id === String(product.id)) {
        item.qty = Math.min(99, item.qty + amount);
        found = true;
      }
    });
    if (!found) cart.push({ id: String(product.id), qty: amount });
    writeCart(cart);
    showToast(product.title + " added to your cart.");
  }

  function toggleWishlist(id) {
    var product = getProduct(id);
    if (!product) return false;
    var key = String(product.id);
    var list = readWishlist();
    var index = list.indexOf(key);
    var active;
    if (index === -1) {
      list.push(key);
      active = true;
      showToast(product.title + " saved to your wishlist.");
    } else {
      list.splice(index, 1);
      active = false;
      showToast(product.title + " removed from your wishlist.");
    }
    writeWishlist(list);
    return active;
  }

  function updateCounters() {
    var cartQty = readCart().reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);
    var wishQty = readWishlist().length;
    $("#cart-count").text(cartQty);
    $("#wishlist-count").text(wishQty);
  }

  function syncWishlistButtons() {
    var ids = readWishlist();
    $(".js-wishlist").each(function () {
      var id = $(this).attr("data-id");
      var on = ids.indexOf(String(id)) !== -1;
      var product = getProduct(id);
      var title = product ? product.title : "this book";
      $(this).attr("aria-pressed", on ? "true" : "false");
      $(this).attr("aria-label", (on ? "Remove " : "Add ") + title + (on ? " from wishlist" : " to wishlist"));
      $(this).find("i").attr("class", on ? "bi bi-heart-fill" : "bi bi-heart");
    });
  }

  /* ---------- Cards, stars, wishlist panel ---------- */

  function starsMarkup(rating) {
    var value = Number(rating) || 0;
    var rounded = Math.round(value * 2) / 2;
    var html = "";
    for (var i = 1; i <= 5; i += 1) {
      var icon = "bi-star";
      if (rounded >= i) icon = "bi-star-fill";
      else if (rounded >= i - 0.5) icon = "bi-star-half";
      html += '<i class="bi ' + icon + '" aria-hidden="true"></i>';
    }
    return (
      '<span class="rating" aria-label="Rated ' +
      value.toFixed(1) +
      ' out of 5">' +
      html +
      '<span class="rating-value">' +
      value.toFixed(1) +
      "</span></span>"
    );
  }

  function highlightText(text, query) {
    var source = String(text || "");
    var terms = String(query || "")
      .trim()
      .split(/\s+/)
      .filter(function (term) {
        return term.length >= 2;
      })
      .sort(function (a, b) {
        return b.length - a.length;
      });
    if (!terms.length) return escapeHtml(source);
    var pattern = terms
      .map(function (term) {
        return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("|");
    var re = new RegExp(pattern, "gi");
    var html = "";
    var last = 0;
    source.replace(re, function (match, offset) {
      html += escapeHtml(source.slice(last, offset));
      html += "<mark>" + escapeHtml(match) + "</mark>";
      last = offset + match.length;
      return match;
    });
    html += escapeHtml(source.slice(last));
    return html;
  }

  function renderProducts(products, container, options) {
    var settings = options || {};
    var $box = container instanceof $ ? container : $(container);
    var wished = readWishlist();
    if (!products.length) {
      $box.empty();
      return;
    }
    var colClass = settings.columns || "col-12 col-sm-6 col-lg-4";
    var html = products
      .map(function (product) {
        var on = wished.indexOf(String(product.id)) !== -1;
        var sale = typeof product.oldPrice === "number" && product.oldPrice > product.price;
        var query = settings.highlight || "";
        return (
          '<div class="' + colClass + '">' +
          '<article class="product-card" data-id="' +
          escapeHtml(product.id) +
          '">' +
          '<div class="product-card__media">' +
          '<img src="' +
          escapeHtml(product.image) +
          '" alt="' +
          escapeHtml(product.title) +
          '" width="640" height="480" loading="lazy">' +
          '<span class="badge product-card__badge">' +
          escapeHtml(product.category) +
          "</span>" +
          '<button type="button" class="wishlist-btn js-wishlist" data-id="' +
          escapeHtml(product.id) +
          '" aria-pressed="' +
          (on ? "true" : "false") +
          '" aria-label="' +
          (on ? "Remove " : "Add ") +
          escapeHtml(product.title) +
          (on ? " from wishlist" : " to wishlist") +
          '"><i class="bi ' +
          (on ? "bi-heart-fill" : "bi-heart") +
          '" aria-hidden="true"></i></button>' +
          "</div>" +
          '<div class="card-body">' +
          '<p class="product-meta">' +
          escapeHtml(product.level) +
          " · " +
          highlightText(product.subject, query) +
          "</p>" +
          '<h3 class="product-title"><button type="button" class="product-title-btn js-quick-view" data-id="' +
          escapeHtml(product.id) +
          '">' +
          highlightText(product.title, query) +
          "</button></h3>" +
          '<p class="product-sub">' +
          highlightText(product.teacher, query) +
          " · " +
          escapeHtml(product.variant) +
          " · " +
          escapeHtml(product.curriculum) +
          "</p>" +
          starsMarkup(product.rating) +
          '<div class="product-price"><span class="price">' +
          formatPrice(product.price) +
          "</span>" +
          (sale ? '<span class="old-price">' + formatPrice(product.oldPrice) + "</span>" : "") +
          "</div>" +
          '<div class="product-actions">' +
          '<button type="button" class="btn btn-primary js-add-cart" data-id="' +
          escapeHtml(product.id) +
          '">Add to Cart</button>' +
          '<button type="button" class="btn btn-outline-primary js-quick-view" data-id="' +
          escapeHtml(product.id) +
          '" aria-label="Quick view: ' +
          escapeHtml(product.title) +
          '">Quick view</button>' +
          "</div></div></article></div>"
        );
      })
      .join("");
    $box.html(html);
  }

  function renderWishlist() {
    var $list = $("#wishlist-list");
    if (!$list.length) return;
    var ids = readWishlist();
    if (!ids.length) {
      $list.empty();
      $("#wishlist-empty").prop("hidden", false);
      return;
    }
    $("#wishlist-empty").prop("hidden", true);
    $list.html(
      ids
        .map(function (id) {
          var product = getProduct(id);
          if (!product) return "";
          return (
            '<article class="wish-row">' +
            '<img src="' +
            escapeHtml(product.image) +
            '" alt="" width="72" height="54">' +
            "<div><h3 class=\"h6 mb-1\">" +
            escapeHtml(product.title) +
            "</h3><p class=\"price\">" +
            formatPrice(product.price) +
            "</p>" +
            '<div class="wish-actions">' +
            '<button type="button" class="btn btn-primary btn-sm js-wish-to-cart" data-id="' +
            escapeHtml(product.id) +
            '">Move to cart</button>' +
            '<button type="button" class="btn btn-outline-primary btn-sm js-wish-remove" data-id="' +
            escapeHtml(product.id) +
            '" aria-label="Remove ' +
            escapeHtml(product.title) +
            ' from wishlist">Remove</button>' +
            "</div></div></article>"
          );
        })
        .join("")
    );
  }

  /* ---------- Quick view and toasts ---------- */

  function openQuickView(id) {
    var product = getProduct(id);
    var modalEl = document.getElementById("quickViewModal");
    if (!product || !modalEl || !window.bootstrap) return;
    var wished = readWishlist().indexOf(String(product.id)) !== -1;
    var sale = typeof product.oldPrice === "number" && product.oldPrice > product.price;
    $("#quick-view-img").attr({ src: product.image, alt: product.title });
    $("#quick-view-kicker").text(product.level + " · " + product.subject + " · " + product.curriculum);
    $("#quick-view-title").text(product.title);
    $("#quick-view-meta").text(product.teacher + " · " + product.variant + " · " + product.category);
    $("#quick-view-rating").html(starsMarkup(product.rating));
    $("#quick-view-desc").text(product.description);
    $("#quick-view-price").text(formatPrice(product.price));
    $("#quick-view-old").text(sale ? formatPrice(product.oldPrice) : "").prop("hidden", !sale);
    $("#quick-view-cart")
      .attr("data-id", product.id)
      .text("Add to Cart");
    $("#quick-view-wish")
      .attr("data-id", product.id)
      .attr("aria-pressed", wished ? "true" : "false")
      .attr("aria-label", (wished ? "Remove " : "Add ") + product.title + (wished ? " from wishlist" : " to wishlist"))
      .find("i")
      .attr("class", wished ? "bi bi-heart-fill" : "bi bi-heart");
    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function showToast(message) {
    var toastEl = document.getElementById("site-toast");
    if (!toastEl || !window.bootstrap) return;
    $("#site-toast-body").text(message);
    window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3200 }).show();
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function isPhone(value) {
    var digits = String(value).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }

  function setInvalid($field, message) {
    $field.addClass("is-invalid").attr("aria-invalid", "true");
    var described = $field.attr("id") + "-error";
    $field.attr("aria-describedby", described);
    $("#" + described).text(message);
  }

  function clearInvalid($field) {
    $field.removeClass("is-invalid").removeAttr("aria-invalid");
  }

  /* ---------- Page enhancements ---------- */

  function initHome() {
    if (!$("#featured-grid").length || !window.PRODUCTS) return;
    $("#stat-titles").text(window.PRODUCTS.length);
    var teachers = {};
    window.PRODUCTS.forEach(function (product) {
      teachers[product.teacher] = true;
    });
    $("#stat-teachers").text(Object.keys(teachers).length);
    renderProducts(
      window.PRODUCTS.filter(function (product) {
        return product.featured;
      }),
      $("#featured-grid")
    );
    var latest = window.PRODUCTS
      .filter(function (product) {
        return !product.featured && (product.category === "Notes" || product.category === "Past Papers");
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 4);
    renderProducts(latest, $("#latest-grid"));
  }

  function initNewsletter() {
    $("#newsletter-form").on("submit", function (event) {
      event.preventDefault();
      var $name = $("#newsletter-name");
      var $email = $("#newsletter-email");
      var valid = true;
      clearInvalid($name);
      clearInvalid($email);
      if ($name.val().trim().length < 2) {
        setInvalid($name, "Please enter your name.");
        valid = false;
      }
      if (!isEmail($email.val())) {
        setInvalid($email, "Enter a valid email address.");
        valid = false;
      }
      if (!valid) return;
      showToast("Thanks, " + $name.val().trim() + ". You are on the New Star list.");
      this.reset();
    });
  }

  function initContact() {
    var $form = $("#contact-form");
    if (!$form.length) return;
    $form.on("submit", function (event) {
      event.preventDefault();
      var fields = [
        ["#contact-name", function ($field) {
          return $field.val().trim().length >= 2 ? "" : "Please enter your name.";
        }],
        ["#contact-email", function ($field) {
          return isEmail($field.val()) ? "" : "Enter a valid email address.";
        }],
        ["#contact-phone", function ($field) {
          return isPhone($field.val()) ? "" : "Enter a phone or WhatsApp number (8–15 digits).";
        }],
        ["#contact-subject", function ($field) {
          return $field.val().trim().length >= 3 ? "" : "Add a short subject.";
        }],
        ["#contact-message", function ($field) {
          return $field.val().trim().length >= 10 ? "" : "Write at least 10 characters so we know how to help.";
        }]
      ];
      var valid = true;
      fields.forEach(function (pair) {
        var $field = $(pair[0]);
        clearInvalid($field);
        var message = pair[1]($field);
        if (message) {
          setInvalid($field, message);
          valid = false;
        }
      });
      if (!valid) return;
      var name = $("#contact-name").val().trim();
      showToast("Thanks, " + name + ". New Star received your message. This demo does not send it anywhere.");
      $form[0].reset();
    });
  }

  function initActions() {
    $(document).on("click", ".js-add-cart", function () {
      addToCart($(this).attr("data-id"), 1);
    });

    $(document).on("click", ".js-wishlist", function () {
      toggleWishlist($(this).attr("data-id"));
    });

    $(document).on("click", ".js-quick-view", function () {
      openQuickView($(this).attr("data-id"));
    });

    $(document).on("click", ".js-wish-remove", function () {
      var id = $(this).attr("data-id");
      writeWishlist(
        readWishlist().filter(function (item) {
          return item !== String(id);
        })
      );
      var product = getProduct(id);
      if (product) showToast(product.title + " removed from your wishlist.");
    });

    $(document).on("click", ".js-wish-to-cart", function () {
      var id = $(this).attr("data-id");
      addToCart(id, 1);
      writeWishlist(
        readWishlist().filter(function (item) {
          return item !== String(id);
        })
      );
    });

    window.addEventListener("storage", function () {
      updateCounters();
      syncWishlistButtons();
      renderWishlist();
    });
  }

  var api = {
    escapeHtml: escapeHtml,
    getProduct: getProduct,
    formatPrice: formatPrice,
    readCart: readCart,
    writeCart: writeCart,
    readWishlist: readWishlist,
    writeWishlist: writeWishlist,
    addToCart: addToCart,
    toggleWishlist: toggleWishlist,
    updateCounters: updateCounters,
    renderProducts: renderProducts,
    renderWishlist: renderWishlist,
    showToast: showToast,
    isEmail: isEmail,
    isPhone: isPhone,
    highlightText: highlightText,
    starsMarkup: starsMarkup
  };

  window.NewStar = api;
  window.renderProducts = renderProducts;
  window.toggleWishlist = toggleWishlist;
  window.addToCart = addToCart;
  window.updateCounters = updateCounters;
  window.readCart = readCart;
  window.writeCart = writeCart;
  window.readWishlist = readWishlist;
  window.writeWishlist = writeWishlist;

  $(function () {
    updateCounters();
    renderWishlist();
    syncWishlistButtons();
    initActions();
    initHome();
    initNewsletter();
    initContact();
  });
})(jQuery);
