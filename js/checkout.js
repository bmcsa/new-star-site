/* Checkout demo. Totals stay in the browser. Nothing is charged or sent. */
(function ($) {
  var SHIPPING_HOME = 45;
  var promo = null;

  var PROMOS = {
    STAR10: { type: "percent", amount: 10, labelKey: "checkout.promoStar10" },
    NEWSTAR50: { type: "flat", amount: 50, labelKey: "checkout.promoNewstar50" }
  };
  var lastOrder = null;

  function cartLines() {
    return NewStar.readCart()
      .map(function (item) {
        var product = NewStar.getProduct(item.id);
        if (!product) return null;
        return { id: item.id, qty: item.qty, product: product, line: product.price * item.qty };
      })
      .filter(Boolean);
  }

  function deliveryMethod() {
    return $("input[name='delivery']:checked").val() || "home";
  }

  function shippingFee(subtotal) {
    if (!subtotal) return 0;
    return deliveryMethod() === "home" ? SHIPPING_HOME : 0;
  }

  function discountAmount(subtotal) {
    if (!promo || subtotal <= 0) return 0;
    if (promo.type === "percent") return Math.round(subtotal * (promo.amount / 100));
    return Math.min(promo.amount, subtotal);
  }

  function totals() {
    var lines = cartLines();
    var subtotal = lines.reduce(function (sum, line) {
      return sum + line.line;
    }, 0);
    var discount = discountAmount(subtotal);
    var shipping = shippingFee(subtotal);
    return {
      lines: lines,
      subtotal: subtotal,
      discount: discount,
      shipping: shipping,
      total: Math.max(0, subtotal - discount) + shipping
    };
  }

  function setQty(id, qty) {
    var next = Math.floor(Number(qty));
    if (!Number.isFinite(next)) next = 1;
    var cart = NewStar.readCart().filter(function (item) {
      return !(item.id === String(id) && next < 1);
    });
    cart.forEach(function (item) {
      if (item.id === String(id)) item.qty = Math.min(99, Math.max(1, next));
    });
    NewStar.writeCart(cart);
    renderSummary();
  }

  function renderSummary() {
    var data = totals();
    var $empty = $("#cart-empty");
    var $layout = $("#checkout-layout");
    if (!data.lines.length) {
      $empty.prop("hidden", false);
      $layout.prop("hidden", true);
      return;
    }
    $empty.prop("hidden", true);
    $layout.prop("hidden", false);

    $("#cart-body").html(
      data.lines
        .map(function (line) {
          var product = line.product;
          return (
            "<tr>" +
            "<td><div class=\"d-flex align-items-center gap-2\">" +
            '<img class="cart-thumb" src="' +
            NewStar.escapeHtml(product.image) +
            '" alt="" width="64" height="48">' +
            "<div><div class=\"fw-bold\">" +
            NewStar.mixedHtml(window.NewStarI18n.productText(product, "title")) +
            "</div><div class=\"text-secondary small\">" +
            NewStar.mixedHtml(window.NewStarI18n.catalog("level", product.level)) +
            " · " +
            NewStar.mixedHtml(window.NewStarI18n.catalog("subject", product.subject)) +
            "</div></div></div></td>" +
            "<td><span class=\"money\" dir=\"ltr\">" +
            NewStar.escapeHtml(NewStar.formatPrice(product.price)) +
            "</span></td>" +
            "<td><div class=\"qty-control\">" +
            '<button type="button" class="js-qty" data-id="' +
            NewStar.escapeHtml(product.id) +
            '" data-dir="-1" aria-label="' +
            NewStar.escapeHtml(window.NewStarI18n.t("a11y.decreaseQty", { title: window.NewStarI18n.productText(product, "title") })) +
            '">−</button>' +
            '<input class="js-qty-input" type="number" min="1" max="99" value="' +
            line.qty +
            '" data-id="' +
            NewStar.escapeHtml(product.id) +
            '" aria-label="' +
            NewStar.escapeHtml(window.NewStarI18n.t("a11y.quantityFor", { title: window.NewStarI18n.productText(product, "title") })) +
            '">' +
            '<button type="button" class="js-qty" data-id="' +
            NewStar.escapeHtml(product.id) +
            '" data-dir="1" aria-label="' +
            NewStar.escapeHtml(window.NewStarI18n.t("a11y.increaseQty", { title: window.NewStarI18n.productText(product, "title") })) +
            '">+</button></div></td>' +
            "<td><span class=\"money\" dir=\"ltr\">" +
            NewStar.escapeHtml(NewStar.formatPrice(line.line)) +
            "</span></td>" +
            "<td><button type=\"button\" class=\"btn btn-outline-primary btn-sm js-remove-line\" data-id=\"" +
            NewStar.escapeHtml(product.id) +
            '" aria-label="' +
            NewStar.escapeHtml(window.NewStarI18n.t("a11y.removeFromCart", { title: window.NewStarI18n.productText(product, "title") })) +
            '">' + NewStar.escapeHtml(window.NewStarI18n.t("actions.remove")) + "</button></td></tr>"
          );
        })
        .join("")
    );

    $("#sum-subtotal").text(NewStar.formatPrice(data.subtotal));
    $("#sum-discount").text(data.discount ? window.NewStarI18n.t("checkout.minus", { amount: NewStar.formatPrice(data.discount) }) : NewStar.formatPrice(0));
    $("#discount-row").prop("hidden", data.discount === 0);
    $("#sum-shipping").text(data.shipping ? NewStar.formatPrice(data.shipping) : window.NewStarI18n.t("checkout.free"));
    $("#sum-total").text(NewStar.formatPrice(data.total));
  }

  function showPaymentPanel() {
    var method = $("input[name='payment']:checked").val();
    $(".pay-panel").prop("hidden", true);
    $("#panel-" + method).prop("hidden", false);
  }

  function clearField($field) {
    $field.removeClass("is-invalid").removeAttr("aria-invalid");
  }

  function setField($field, message) {
    $field.addClass("is-invalid").attr("aria-invalid", "true");
    $("#" + $field.attr("id") + "-error").text(message);
  }

  function luhn(number) {
    var digits = number.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    var sum = 0;
    var alt = false;
    for (var i = digits.length - 1; i >= 0; i -= 1) {
      var n = parseInt(digits.charAt(i), 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function expiryValid(value) {
    var match = /^(\d{2})\/(\d{2})$/.exec(value);
    if (!match) return false;
    var month = Number(match[1]);
    var year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return false;
    var now = new Date();
    var current = now.getFullYear() * 12 + now.getMonth();
    return year * 12 + (month - 1) >= current;
  }

  function validate() {
    var valid = true;
    var $name = $("#cust-name");
    var $phone = $("#cust-phone");
    var $email = $("#cust-email");
    var $gov = $("#cust-gov");
    var $address = $("#cust-address");
    [$name, $phone, $email, $gov, $address, $("#card-number"), $("#card-expiry"), $("#card-cvv"), $("#wallet-phone")].forEach(
      clearField
    );
    $("#payment-error").text("").prop("hidden", true);

    if ($name.val().trim().length < 3) {
      setField($name, window.NewStarI18n.t("errors.fullName"));
      valid = false;
    }
    if (!NewStar.isPhone($phone.val())) {
      setField($phone, window.NewStarI18n.t("errors.phoneDigits"));
      valid = false;
    }
    if (!NewStar.isEmail($email.val())) {
      setField($email, window.NewStarI18n.t("errors.email"));
      valid = false;
    }
    if (!$gov.val()) {
      setField($gov, window.NewStarI18n.t("errors.governorate"));
      valid = false;
    }
    if (deliveryMethod() !== "digital" && $address.val().trim().length < 6) {
      setField($address, window.NewStarI18n.t("errors.address"));
      valid = false;
    }

    var method = $("input[name='payment']:checked").val();
    if (method === "card") {
      var number = $("#card-number").val();
      var expiry = $("#card-expiry").val();
      var cvv = $("#card-cvv").val();
      if (!luhn(number)) {
        setField($("#card-number"), window.NewStarI18n.t("errors.card"));
        valid = false;
      }
      if (!expiryValid(expiry)) {
        setField($("#card-expiry"), window.NewStarI18n.t("errors.expiry"));
        valid = false;
      }
      if (!/^\d{3,4}$/.test(cvv)) {
        setField($("#card-cvv"), window.NewStarI18n.t("errors.cvv"));
        valid = false;
      }
    }
    if (method === "wallet" && !NewStar.isPhone($("#wallet-phone").val())) {
      setField($("#wallet-phone"), window.NewStarI18n.t("errors.walletPhone"));
      valid = false;
    }
    return valid;
  }

  function orderNumber() {
    return "NS-" + String(Math.floor(100000 + Math.random() * 900000));
  }

  function placeOrder() {
    if (!cartLines().length) return;
    if (!validate()) {
      var $invalid = $(".is-invalid").first();
      if ($invalid.length) $invalid.trigger("focus");
      return;
    }
    lastOrder = { name: $("#cust-name").val().trim(), number: orderNumber() };
    renderConfirmation();
    NewStar.writeCart([]);
    renderSummary();
    var modalEl = document.getElementById("orderModal");
    if (modalEl && window.bootstrap) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  function renderConfirmation() {
    if (!lastOrder) return;
    $("#order-modal-title").html(window.NewStarI18n.tHtml("checkout.thanks", { name: lastOrder.name }));
    $("#order-modal-body").html(window.NewStarI18n.tHtml("checkout.confirm", { number: lastOrder.number }));
  }

  function paintPromo() {
    if (!promo) return;
    $("#promo-applied").prop("hidden", false).text(
      window.NewStarI18n.t("checkout.promoApplied", { label: window.NewStarI18n.t(promo.labelKey) })
    );
  }

  $(function () {
    if (!$("#checkout-form").length || !window.NewStar || !window.NewStarI18n) return;
    window.NewStarI18n.ready.then(function () {
      renderSummary();
      showPaymentPanel();
    });
    $(document).on("newstar:lang", function () {
      if (!$("#checkout-form").length) return;
      renderSummary();
      paintPromo();
      renderConfirmation();
    });

    $(document).on("click", ".js-qty", function () {
      var id = $(this).attr("data-id");
      var dir = Number($(this).attr("data-dir"));
      var line = cartLines().filter(function (item) {
        return item.id === id;
      })[0];
      if (!line) return;
      setQty(id, line.qty + dir);
    });

    $(document).on("change", ".js-qty-input", function () {
      setQty($(this).attr("data-id"), $(this).val());
    });

    $(document).on("click", ".js-remove-line", function () {
      setQty($(this).attr("data-id"), 0);
    });

    $("input[name='delivery']").on("change", renderSummary);
    $("input[name='payment']").on("change", showPaymentPanel);

    $("#card-number").on("input", function () {
      var digits = this.value.replace(/\D/g, "").slice(0, 16);
      this.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    });

    $("#card-expiry").on("input", function () {
      var digits = this.value.replace(/\D/g, "").slice(0, 4);
      this.value = digits.length >= 3 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
    });

    $("#card-cvv").on("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 4);
    });

    $("#promo-form").on("submit", function (event) {
      event.preventDefault();
      var code = $("#promo-code").val().trim().toUpperCase();
      var $feedback = $("#promo-feedback");
      if (!code) {
        $feedback.text(window.NewStarI18n.t("errors.promoEmpty")).prop("hidden", false);
        return;
      }
      if (!PROMOS[code]) {
        promo = null;
        $feedback.text(window.NewStarI18n.t("errors.promoUnknown")).prop("hidden", false);
        $("#promo-applied").prop("hidden", true).text("");
        renderSummary();
        return;
      }
      promo = PROMOS[code];
      $feedback.prop("hidden", true).text("");
      paintPromo();
      renderSummary();
    });

    $("#promo-clear").on("click", function () {
      promo = null;
      $("#promo-code").val("");
      $("#promo-applied").prop("hidden", true).text("");
      $("#promo-feedback").prop("hidden", true).text("");
      renderSummary();
    });

    $("#checkout-form").on("submit", function (event) {
      event.preventDefault();
      placeOrder();
    });

    $(document).on("newstar:cart", renderSummary);
  });
})(jQuery);
