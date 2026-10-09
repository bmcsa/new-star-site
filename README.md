# New Star

New Star is a static storefront for school books and teachers' study notes. The tagline is “Your trusted source for school books & teachers' notes.” Prices are in Egyptian pounds (EGP). Checkout and payment are a front-end demo only: nothing is charged, and no order, card number, or message leaves the browser.

## Pages

| File | What it does |
| --- | --- |
| `index.html` | Home: hero search, browse by level and subject, featured books, latest notes and past papers, why New Star, newsletter |
| `store.html` | Filterable catalog, sort, load more, quick view, wishlist hearts |
| `search.html` | Search with live suggestions. Opens `search.html?q=physics` from the navbar or hero |
| `contact.html` | Validated contact form, sample Cairo desk details, map, FAQ |
| `checkout.html` | Cart totals, Egyptian governorates, delivery, promo codes, simulated payment |

Shared files:

- `css/style.css` — the only custom stylesheet
- `js/products.js` — the catalog (`window.PRODUCTS`)
- `js/main.js` — navbar counters, wishlist offcanvas, cart helpers, home and contact behaviour
- `js/store.js` — filters
- `js/search.js` — search and suggestions
- `js/checkout.js` — totals and place-order demo

The wishlist and cart live in `localStorage` under `newstar_wishlist` and `newstar_cart`.

## Open the site

There is no build step and no install.

Double-click `index.html`, or serve the folder so the cart is shared across pages:

```bash
python3 -m http.server 43123
```

Then open [http://127.0.0.1:43123](http://127.0.0.1:43123).

A local server is the reliable way to keep the wishlist and cart when you move between pages. Some browsers isolate storage for `file://` pages.

## Demo checkout

On the checkout page, **STAR10** takes 10% off the book subtotal and **NEWSTAR50** takes 50 EGP off. Home delivery adds 45 EGP. Pickup and digital PDF are free. Card fields accept a test number such as `4242 4242 4242 4242`. Placing an order shows a confirmation like `NS-######`, thanks the customer by name, and clears the cart. No payment is processed.
