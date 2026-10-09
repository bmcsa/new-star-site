/* Checkout demo. Totals stay in the browser. Nothing is charged or sent. */
(function ($) {
  var SHIPPING_HOME = 45;
  var promo = null;

  var PROMOS = {
    STAR10: { type: "percent", amount: 10, label: "STAR10 · 10% off" },
    NEWSTAR50: { type: "flat", amount: 50, label: "NEWSTAR50 · EGP 50 off" }
  };

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
            NewStar.escapeHtml(product.title) +
            "</div><div class=\"text-secondary small\">" +
            NewStar.escapeHtml(product.level) +
            " · " +
            NewStar.escapeHtml(product.subject) +
            "</div></div></div></td>" +
            "<td>" +
            NewStar.formatPrice(product.price) +
            "</td>" +
            "<td><div class=\"qty-control\">" +
            '<button type="button" class="js-qty" data-id="' +
            NewStar.escapeHtml(product.id) +
            '" data-dir="-1" aria-label="Decrease quantity for ' +
            NewStar.escapeHtml(product.title) +
            '">−</button>' +
            '<input class="js-qty-input" type="number" min="1" max="99" value="' +
            line.qty +
            '" data-id="' +
            NewStar.escapeHtml(product.id) +
            '" aria-label="Quantity for ' +
            NewStar.escapeHtml(product.title) +
            '">' +
            '<button type="button" class="js-qty" data-id="' +
            NewStar.escapeHtml(product.id) +
            '" data-dir="1" aria-label="Increase quantity for ' +
            NewStar.escapeHtml(product.title) +
            '">+</button></div></td>' +
            "<td>" +
            NewStar.formatPrice(line.line) +
            "</td>" +
            "<td><button type=\"button\" class=\"btn btn-outline-primary btn-sm js-remove-line\" data-id=\"" +
            NewStar.escapeHtml(product.id) +
            '" aria-label="Remove ' +
            NewStar.escapeHtml(product.title) +
            ' from cart">Remove</button></td></tr>'
          );
        })
        .join("")
    );

    $("#sum-subtotal").text(NewStar.formatPrice(data.subtotal));
    $("#sum-discount").text(data.discount ? "− " + NewStar.formatPrice(data.discount) : NewStar.formatPrice(0));
    $("#discount-row").prop("hidden", data.discount === 0);
    $("#sum-shipping").text(data.shipping ? NewStar.formatPrice(data.shipping) : "Free");
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
      setField($name, "Enter the full name for the order.");
      valid = false;
    }
    if (!NewStar.isPhone($phone.val())) {
      setField($phone, "Enter a phone number with 8–15 digits.");
      valid = false;
    }
    if (!NewStar.isEmail($email.val())) {
      setField($email, "Enter a valid email address.");
      valid = false;
    }
    if (!$gov.val()) {
      setField($gov, "Choose a governorate.");
      valid = false;
    }
    if (deliveryMethod() !== "digital" && $address.val().trim().length < 6) {
      setField($address, "Add a street address for delivery or pickup.");
      valid = false;
    }

    var method = $("input[name='payment']:checked").val();
    if (method === "card") {
      var number = $("#card-number").val();
      var expiry = $("#card-expiry").val();
      var cvv = $("#card-cvv").val();
      if (!luhn(number)) {
        setField($("#card-number"), "Enter a valid card number. The demo accepts test numbers such as 4242 4242 4242 4242.");
        valid = false;
      }
      if (!expiryValid(expiry)) {
        setField($("#card-expiry"), "Use a future expiry in MM/YY format.");
        valid = false;
      }
      if (!/^\d{3,4}$/.test(cvv)) {
        setField($("#card-cvv"), "Enter a 3 or 4 digit CVV.");
        valid = false;
      }
    }
    if (method === "wallet" && !NewStar.isPhone($("#wallet-phone").val())) {
      setField($("#wallet-phone"), "Enter the Vodafone Cash or InstaPay phone number.");
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
    var name = $("#cust-name").val().trim();
    $("#order-name").text(name);
    $("#order-number").text(orderNumber());
    NewStar.writeCart([]);
    renderSummary();
    var modalEl = document.getElementById("orderModal");
    if (modalEl && window.bootstrap) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  $(function () {
    if (!$("#checkout-form").length || !window.NewStar) return;
    renderSummary();
    showPaymentPanel();

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
        $feedback.text("Enter a promo code.").prop("hidden", false);
        return;
      }
      if (!PROMOS[code]) {
        promo = null;
        $feedback.text("That code is not recognised. Try STAR10 or NEWSTAR50.").prop("hidden", false);
        $("#promo-applied").prop("hidden", true).text("");
        renderSummary();
        return;
      }
      promo = PROMOS[code];
      $feedback.prop("hidden", true).text("");
      $("#promo-applied").prop("hidden", false).text(promo.label + " applied.");
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
