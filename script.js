const API_URL =
    "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

let products = [];
let currentProduct = null;
let currentQuantity = 1;
let currentVariation = null;

async function loadProducts() {
    const container = document.getElementById("products");

    try {
        const response = await fetch(API_URL + "?action=products");
        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid product data.");
        }

        products = data;
        displayProducts(products);

    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Unable to load products.</p>";
    }
}

function displayProducts(list) {
    const container = document.getElementById("products");

    if (!list.length) {
        container.innerHTML = "<p>No products available.</p>";
        return;
    }

    container.innerHTML = list.map(product => {
        const image =
            product.image ||
            "https://via.placeholder.com/500x500?text=Kumor+Shop";

        return `
      <div class="product-card">
        <img class="product-image"
             src="${image}"
             alt="${escapeHtml(product.name)}">

        <div class="product-info">
          <div class="product-name">
            ${escapeHtml(product.name)}
          </div>

          <div>${escapeHtml(product.category)}</div>

          <div class="product-price">
            ৳${product.price}
          </div>

          <button class="buy-button"
                  onclick="openProduct('${product.productId}')">
            BUY NOW
          </button>
        </div>
      </div>
    `;
    }).join("");
}

function openProduct(productId) {
    currentProduct =
        products.find(
            product => product.productId === productId
        );

    if (!currentProduct) return;

    currentQuantity = 1;
    currentVariation = null;

    document.getElementById("modalName").textContent =
        currentProduct.name;

    document.getElementById("modalPrice").textContent =
        "৳" + currentProduct.price;

    document.getElementById("modalImage").src =
        currentProduct.image;

    document.getElementById("quantity").textContent = "1";

    loadSizes();
    loadColors();

    document.getElementById("productModal").style.display =
        "block";

    updateTotal();
}

function loadSizes() {
    const select =
        document.getElementById("sizeSelect");

    const sizes = [
        ...new Set(
            currentProduct.variations
                .filter(v => Number(v.stock) > 0)
                .map(v => v.size)
        )
    ];

    select.innerHTML =
        '<option value="">Select size</option>';

    sizes.forEach(size => {
        select.innerHTML +=
            `<option value="${escapeHtml(size)}">
        ${escapeHtml(size)}
      </option>`;
    });

    document.getElementById("colorSelect").innerHTML =
        '<option value="">Select color</option>';
}

function loadColors() {
    const select =
        document.getElementById("colorSelect");

    const size =
        document.getElementById("sizeSelect").value;

    let variations =
        currentProduct.variations
            .filter(v => Number(v.stock) > 0);

    if (size) {
        variations =
            variations.filter(
                v => String(v.size) === String(size)
            );
    }

    const colors = [
        ...new Set(
            variations.map(v => v.color)
        )
    ];

    select.innerHTML =
        '<option value="">Select color</option>';

    colors.forEach(color => {
        select.innerHTML +=
            `<option value="${escapeHtml(color)}">
        ${escapeHtml(color)}
      </option>`;
    });
}

function findSelectedVariation() {
    const size =
        document.getElementById("sizeSelect").value;

    const color =
        document.getElementById("colorSelect").value;

    if (!size || !color) {
        currentVariation = null;
        return null;
    }

    currentVariation =
        currentProduct.variations.find(
            variation =>
                String(variation.size) === String(size) &&
                String(variation.color) === String(color)
        );

    return currentVariation;
}

function changeQuantity(change) {
    const variation = findSelectedVariation();

    const maxStock =
        variation ? Number(variation.stock) : 99;

    currentQuantity += change;

    if (currentQuantity < 1) {
        currentQuantity = 1;
    }

    if (currentQuantity > maxStock) {
        currentQuantity = maxStock;
    }

    document.getElementById("quantity").textContent =
        currentQuantity;

    updateTotal();
}

function updateTotal() {
    if (!currentProduct) return;

    const total =
        Number(currentProduct.price) *
        currentQuantity;

    document.getElementById("totalPrice").textContent =
        "৳" + total;
}

function openCheckout() {
    const variation =
        findSelectedVariation();

    if (!variation) {
        alert("Please select size and color.");
        return;
    }

    if (Number(variation.stock) < currentQuantity) {
        alert("Not enough stock.");
        return;
    }

    document.getElementById("checkoutProduct").textContent =
        currentProduct.name +
        " / Size: " + variation.size +
        " / Color: " + variation.color +
        " / Qty: " + currentQuantity +
        " / Total: ৳" +
        (currentProduct.price * currentQuantity);

    document.getElementById("productModal").style.display =
        "none";

    document.getElementById("checkoutModal").style.display =
        "block";
}

async function placeOrder() {
    const name =
        document.getElementById("customerName")
            .value.trim();

    const phone =
        document.getElementById("phone")
            .value.trim();

    const district =
        document.getElementById("district")
            .value.trim();

    const address =
        document.getElementById("address")
            .value.trim();

    const message =
        document.getElementById("orderMessage");

    const button =
        document.getElementById("placeOrderButton");

    if (!name || !phone || !district || !address) {
        alert("Please complete all information.");
        return;
    }

    const variation =
        findSelectedVariation();

    if (!variation) {
        alert("Please select size and color.");
        return;
    }

    button.disabled = true;
    button.textContent = "PLACING ORDER...";

    try {
        const response =
            await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    action: "placeOrder",
                    productId:
                        currentProduct.productId,
                    variationId:
                        variation.variationId,
                    quantity:
                        currentQuantity,
                    customerName:
                        name,
                    phone:
                        phone,
                    district:
                        district,
                    address:
                        address
                })
            });

        const result =
            await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        message.innerHTML =
            `✅ Order placed successfully!
       <br><br>
       Order ID:
       <strong>${result.orderId}</strong>
       <br>
       Total:
       <strong>৳${result.total}</strong>`;

        button.style.display = "none";

    } catch (error) {
        console.error(error);

        message.textContent =
            "❌ " + error.message;

        button.disabled = false;
        button.textContent = "PLACE ORDER";
    }
}

function closeProduct() {
    document.getElementById("productModal").style.display =
        "none";
}

function closeCheckout() {
    document.getElementById("checkoutModal").style.display =
        "none";
}

document
    .getElementById("sizeSelect")
    .addEventListener("change", function () {
        loadColors();
        currentVariation = null;
        currentQuantity = 1;

        document.getElementById("quantity").textContent = "1";

        updateTotal();
    });

document
    .getElementById("colorSelect")
    .addEventListener("change", function () {
        findSelectedVariation();
        currentQuantity = 1;

        document.getElementById("quantity").textContent = "1";

        updateTotal();
    });

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

loadProducts();