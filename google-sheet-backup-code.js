const SHEETS = {
    PRODUCTS: "Products",
    VARIATIONS: "Variations",
    ORDERS: "Orders"
};

function doGet(e) {
    const action = e?.parameter?.action || "products";

    try {
        if (action === "products") {
            return jsonResponse(getProducts());
        }

        return jsonResponse({
            success: false,
            message: "Unknown action"
        });

    } catch (error) {
        return jsonResponse({
            success: false,
            message: error.message
        });
    }
}

function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return jsonResponse({
                success: false,
                message: "No POST data received."
            });
        }

        const data = JSON.parse(e.postData.contents);

        if (data.action === "placeOrder") {
            return jsonResponse(placeOrder(data));
        }

        return jsonResponse({
            success: false,
            message: "Unknown action: " + data.action
        });

    } catch (error) {

        console.error(error);

        return jsonResponse({
            success: false,
            message: error.message || String(error)
        });
    }
}

function getProducts() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const productSheet = ss.getSheetByName(SHEETS.PRODUCTS);
    const variationSheet = ss.getSheetByName(SHEETS.VARIATIONS);

    if (!productSheet || !variationSheet) {
        throw new Error("Products or Variations sheet not found.");
    }

    const products = sheetToObjects(productSheet);
    const variations = sheetToObjects(variationSheet);

    const activeProducts = products.filter(
        product =>
            String(product.Active).toUpperCase() === "TRUE"
    );

    return activeProducts.map(product => {

        const productVariations = variations.filter(
            variation =>
                String(variation.ProductID) === String(product.ProductID) &&
                Number(variation.Stock) > 0
        );

        return {
            productId: product.ProductID,
            name: product.ProductName,
            category: product.Category,
            price: Number(product.Price),
            image: product.ImageURL || "",

            // Stock for products WITHOUT variations
            stock: Number(product.Stock || 0),

            variations: productVariations.map(v => ({
                variationId: v.VariationID,
                size: v.Size,
                color: v.Color,
                stock: Number(v.Stock)
            }))
        };
    });
}

function placeOrder(data) {
    if (!data.productId) {
        throw new Error("Product is required.");
    }

    const quantity = Number(data.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Invalid quantity.");
    }

    if (!data.customerName) {
        throw new Error("Customer name is required.");
    }

    if (!data.phone) {
        throw new Error("Phone number is required.");
    }

    if (!data.district) {
        throw new Error("District is required.");
    }

    if (!data.address) {
        throw new Error("Address is required.");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        const productSheet =
            ss.getSheetByName(SHEETS.PRODUCTS);

        const variationSheet =
            ss.getSheetByName(SHEETS.VARIATIONS);

        const orderSheet =
            ss.getSheetByName(SHEETS.ORDERS);

        const products =
            sheetToObjects(productSheet);

        const variations =
            sheetToObjects(variationSheet);

        const product =
            products.find(
                p =>
                    String(p.ProductID) ===
                    String(data.productId)
            );

        if (!product) {
            throw new Error("Product not found.");
        }

        const unitPrice =
            Number(product.Price);

        const total =
            unitPrice * quantity;

        let variation = null;

        /*
         * =====================================================
         * PRODUCT WITH VARIATION
         * =====================================================
         */

        if (data.variationId) {

            const variationIndex =
                variations.findIndex(
                    v =>
                        String(v.VariationID) ===
                        String(data.variationId)
                );

            if (variationIndex === -1) {
                throw new Error(
                    "Product variation not found."
                );
            }

            variation =
                variations[variationIndex];

            if (
                String(variation.ProductID) !==
                String(product.ProductID)
            ) {
                throw new Error(
                    "Invalid product variation."
                );
            }

            const currentStock =
                Number(variation.Stock);

            if (currentStock < quantity) {
                throw new Error(
                    "Sorry, only " +
                    currentStock +
                    " item(s) are available."
                );
            }

            // Decrease variation stock
            const variationRow =
                variationIndex + 2;

            const stockColumn =
                getColumnNumber(
                    variationSheet,
                    "Stock"
                );

            variationSheet
                .getRange(
                    variationRow,
                    stockColumn
                )
                .setValue(
                    currentStock - quantity
                );

        }

        /*
         * =====================================================
         * PRODUCT WITHOUT VARIATION
         * =====================================================
         */

        else {

            const currentStock =
                Number(product.Stock);

            if (!Number.isFinite(currentStock)) {
                throw new Error(
                    "Product stock is not configured."
                );
            }

            if (currentStock < quantity) {
                throw new Error(
                    "Sorry, only " +
                    currentStock +
                    " item(s) are available."
                );
            }

            // Decrease product stock
            const productRow =
                products.findIndex(
                    p =>
                        String(p.ProductID) ===
                        String(product.ProductID)
                ) + 2;

            const stockColumn =
                getColumnNumber(
                    productSheet,
                    "Stock"
                );

            productSheet
                .getRange(
                    productRow,
                    stockColumn
                )
                .setValue(
                    currentStock - quantity
                );
        }

        /*
         * =====================================================
         * CREATE ORDER
         * =====================================================
         */

        const orderId =
            generateOrderId(orderSheet);

        orderSheet.appendRow([
            orderId,
            new Date(),
            product.ProductID,

            // Variation ID
            variation
                ? variation.VariationID
                : "",

            product.ProductName,

            // Size
            variation
                ? variation.Size
                : "",

            // Color
            variation
                ? variation.Color
                : "",

            quantity,
            unitPrice,
            total,
            data.customerName,
            data.phone,
            data.district,
            data.address,
            "New"
        ]);

        return {
            success: true,
            orderId: orderId,
            total: total,
            message: "Order placed successfully."
        };

    } finally {
        lock.releaseLock();
    }
}

function generateOrderId(orderSheet) {
    const lastRow = orderSheet.getLastRow();

    if (lastRow < 2) {
        return "ORD-00001";
    }

    const lastOrderId =
        orderSheet.getRange(lastRow, 1).getValue();

    const number =
        parseInt(
            String(lastOrderId).replace("ORD-", ""),
            10
        ) || 0;

    return (
        "ORD-" +
        String(number + 1).padStart(5, "0")
    );
}

function sheetToObjects(sheet) {
    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
        return [];
    }

    const headers = values[0];

    return values
        .slice(1)
        .filter(row => row.some(cell => cell !== ""))
        .map(row => {
            const obj = {};

            headers.forEach((header, index) => {
                obj[header] = row[index];
            });

            return obj;
        });
}

function getColumnNumber(sheet, headerName) {
    const headers = sheet
        .getRange(
            1,
            1,
            1,
            sheet.getLastColumn()
        )
        .getValues()[0];

    const index = headers.indexOf(headerName);

    if (index === -1) {
        throw new Error(
            "Column not found: " + headerName
        );
    }

    return index + 1;
}

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
