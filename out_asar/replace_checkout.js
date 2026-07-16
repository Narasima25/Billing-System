const fs = require('fs');
const path = 'd:/Billing-POS/src/main.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /ipcMain\.handle\('billing:checkout', async \(_e, \{[\s\S]*?\}\) => \{\r?\n[\s\S]*?\r?\n\}\);\r?\n/m;
const match = content.match(regex);
if (!match) {
    console.log("Could not find billing:checkout in main.js");
    process.exit(1);
}

const replacement = `ipcMain.handle('billing:checkout', async (_e, { cartItems, paymentMode, discountPaise, userId, customerName, customerGstin, isB2B, isInterState, customerStateCode, customerPhone, customerAddress, appliedCouponPaise, invoiceDate, sendWhatsappReceipt: shouldSendWhatsappReceipt }) => {
  try {
    const checkoutTransaction = db.transaction((items) => {
      // 1. Initial Stock Validation
      for (const item of items) {
        const freeQuantity = parseInt(item.freeQuantity) || 0;
        const totalQuantityToDeduct = item.quantity + freeQuantity;
        const product = db.prepare("SELECT p.stock_quantity, p.barcode, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? AND p.is_active = 1").get(item.productId);
        if (!product) throw new Error(\`Product \${item.productName} not found\`);
        const isService = (product.category_name || '').toLowerCase().includes('service') || (product.barcode || '').startsWith('SRV-');
        item._isService = isService;
        if (!isService && product.stock_quantity < totalQuantityToDeduct) {
          throw new Error(\`Insufficient stock for \${item.productName} (available: \${product.stock_quantity})\`);
        }
      }

      // 2. Global Totals (to calculate Loyalty)
      let globalSubtotal = 0;
      let globalCgst = 0;
      let globalSgst = 0;
      let globalIgst = 0;
      let globalItemTotal = 0;
      
      for (const item of items) {
        const itemDiscount = parseInt(item.discountPaise) || 0;
        const lineTotal = Math.max(0, (item.unitPricePaise * item.quantity) - itemDiscount);
        globalItemTotal += (item.unitPricePaise * item.quantity);

        if (item.gstPercent > 0) {
          const taxableValue = Math.round((lineTotal * 100) / (100 + item.gstPercent));
          const gstAmount = lineTotal - taxableValue;
          globalSubtotal += taxableValue;
          if (isInterState) {
            globalIgst += gstAmount;
          } else {
            const halfGst = Math.round(gstAmount / 2);
            globalCgst += halfGst;
            globalSgst += (gstAmount - halfGst);
          }
        } else {
          globalSubtotal += lineTotal;
        }
      }

      const globalDiscount = discountPaise || 0;
      let globalGrandTotal = globalSubtotal + globalCgst + globalSgst + globalIgst - globalDiscount;

      // 3. Loyalty Logic on Global Grand Total
      let customerId = null;
      let rewardEarnedPaise = 0;
      let newCouponBalancePaise = 0;
      let actualAppliedCoupon = 0;
      const isB2CSmall = !isB2B && (globalGrandTotal <= 25000000);

      if (customerPhone && isB2CSmall) {
        let cust = db.prepare("SELECT * FROM customers WHERE phone_number = ?").get(customerPhone);
        if (!cust) {
          const res = db.prepare("INSERT INTO customers (phone_number, name, created_at, updated_at) VALUES (?, ?, datetime('now','localtime'), datetime('now','localtime'))").run(customerPhone, customerName || '');
          customerId = res.lastInsertRowid;
          cust = { id: customerId, coupon_balance_paise: 0, total_lifetime_spent_paise: 0 };
        } else {
          customerId = cust.id;
          if (customerName && cust.name === '') {
            db.prepare("UPDATE customers SET name = ? WHERE id = ?").run(customerName, customerId);
          }
        }
        if (appliedCouponPaise > 0) {
          actualAppliedCoupon = Math.min(appliedCouponPaise, cust.coupon_balance_paise, globalGrandTotal);
          globalGrandTotal -= actualAppliedCoupon;
        }
        if (globalGrandTotal >= 100000) { // 1000 rupees
          rewardEarnedPaise = Math.floor(globalGrandTotal * 0.01);
        }
        db.prepare(
          "UPDATE customers SET coupon_balance_paise = MAX(0, coupon_balance_paise - ? + ?), total_lifetime_spent_paise = total_lifetime_spent_paise + ?, updated_at = datetime('now','localtime') WHERE id = ?"
        ).run(actualAppliedCoupon, rewardEarnedPaise, globalGrandTotal, customerId);
        newCouponBalancePaise = cust.coupon_balance_paise - actualAppliedCoupon + rewardEarnedPaise;
      } else {
        if (appliedCouponPaise > 0) {
           actualAppliedCoupon = Math.min(appliedCouponPaise, globalGrandTotal);
           globalGrandTotal -= actualAppliedCoupon;
        }
      }

      // 4. Split Carts
      const productCart = items.filter(i => !i._isService);
      const serviceCart = items.filter(i => i._isService);
      
      const cartsToProcess = [];
      if (productCart.length > 0) {
        let pTotal = 0;
        productCart.forEach(item => { pTotal += (item.unitPricePaise * item.quantity); });
        const pDiscount = Math.round((pTotal / globalItemTotal) * globalDiscount) || 0;
        const pCoupon = Math.round((pTotal / globalItemTotal) * actualAppliedCoupon) || 0;
        cartsToProcess.push({ items: productCart, discount: pDiscount, coupon: pCoupon, customReceiptNumber: null, isServiceCart: false });
      }

      if (serviceCart.length > 0) {
        let sTotal = 0;
        serviceCart.forEach(item => { sTotal += (item.unitPricePaise * item.quantity); });
        let finalSDiscount = Math.round((sTotal / globalItemTotal) * globalDiscount) || 0;
        let finalSCoupon = Math.round((sTotal / globalItemTotal) * actualAppliedCoupon) || 0;
        
        if (productCart.length > 0) {
           finalSDiscount = globalDiscount - cartsToProcess[0].discount;
           finalSCoupon = actualAppliedCoupon - cartsToProcess[0].coupon;
        }
        cartsToProcess.push({ items: serviceCart, discount: finalSDiscount, coupon: finalSCoupon, customReceiptNumber: \`SRV-\${Date.now()}\`, isServiceCart: true });
      }

      // 5. Process Each Cart
      const results = [];
      let createdAtStr = null;
      if (invoiceDate) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        createdAtStr = \`\${invoiceDate} \${hh}:\${min}:\${sec}\`;
      } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        createdAtStr = \`\${yyyy}-\${mm}-\${dd} \${hh}:\${min}:\${sec}\`;
      }

      for (const cart of cartsToProcess) {
        let subtotalPaise = 0;
        let totalCgstPaise = 0;
        let totalSgstPaise = 0;
        let totalIgstPaise = 0;

        for (const item of cart.items) {
          const itemDiscount = parseInt(item.discountPaise) || 0;
          const lineTotal = Math.max(0, (item.unitPricePaise * item.quantity) - itemDiscount);

          if (item.gstPercent > 0) {
            const taxableValue = Math.round((lineTotal * 100) / (100 + item.gstPercent));
            const gstAmount = lineTotal - taxableValue;
            subtotalPaise += taxableValue;
            if (isInterState) {
              totalIgstPaise += gstAmount;
            } else {
              const halfGst = Math.round(gstAmount / 2);
              totalCgstPaise += halfGst;
              totalSgstPaise += (gstAmount - halfGst);
            }
          } else {
            subtotalPaise += lineTotal;
          }
        }

        const grandTotalPaise = subtotalPaise + totalCgstPaise + totalSgstPaise + totalIgstPaise - cart.discount - cart.coupon;
        const receiptNumber = cart.customReceiptNumber || generateReceiptNumber(db, invoiceDate);
        
        // Only report the reward earned on the primary cart (e.g. the first one) to not duplicate on UI
        const isFirstCart = results.length === 0;
        const reportedReward = isFirstCart ? rewardEarnedPaise : 0;
        const reportedNewBalance = isFirstCart ? newCouponBalancePaise : 0;

        const { lastInsertRowid: saleId } = db.prepare(
          \`INSERT INTO sales (receipt_number, user_id, customer_name, customer_gstin, is_b2b, subtotal_paise, discount_paise,
            cgst_paise, sgst_paise, igst_paise, is_inter_state, customer_state_code, grand_total_paise, payment_mode, customer_phone, customer_address, applied_coupon_paise, reward_earned_paise, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
        ).run(
          receiptNumber, userId || null, customerName || '', customerGstin || '', isB2B ? 1 : 0, subtotalPaise, cart.discount,
          totalCgstPaise, totalSgstPaise, totalIgstPaise, isInterState ? 1 : 0, customerStateCode || '', grandTotalPaise, paymentMode || 'cash',
          customerPhone || '', customerAddress || '', cart.coupon, reportedReward, createdAtStr
        );

        for (const item of cart.items) {
          const freeQuantity = parseInt(item.freeQuantity) || 0;
          const totalQuantityToDeduct = item.quantity + freeQuantity;

          if (!item._isService) {
            db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").run(
              totalQuantityToDeduct, item.productId
            );
            db.prepare(
              "INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, user_id) VALUES (?, 'sale', ?, ?, ?)"
            ).run(
              item.productId, totalQuantityToDeduct, \`Sale \${receiptNumber}\`, userId || null
            );
          }

          let remainingQuantityToDeduct = totalQuantityToDeduct;
          const batches = db.prepare(\`
            SELECT * FROM product_batches 
            WHERE product_id = ? AND quantity > 0 
            ORDER BY 
              CASE WHEN expiry_date != '' THEN expiry_date ELSE '9999-12-31' END ASC, 
              created_at ASC
          \`).all(item.productId);

          let batchIndex = 0;
          while (remainingQuantityToDeduct > 0) {
            let batchId = null;
            let batchPurchasePrice = 0;
            let qtyToDeductFromBatch = remainingQuantityToDeduct;

            if (batchIndex < batches.length) {
              const batch = batches[batchIndex];
              batchId = batch.id;
              batchPurchasePrice = batch.purchase_price_paise;

              if (batch.quantity >= remainingQuantityToDeduct) {
                db.prepare("UPDATE product_batches SET quantity = quantity - ? WHERE id = ?").run(remainingQuantityToDeduct, batch.id);
                qtyToDeductFromBatch = remainingQuantityToDeduct;
                remainingQuantityToDeduct = 0;
              } else {
                qtyToDeductFromBatch = batch.quantity;
                db.prepare("UPDATE product_batches SET quantity = 0 WHERE id = ?").run(batch.id);
                remainingQuantityToDeduct -= qtyToDeductFromBatch;
                batchIndex++;
              }
            } else {
              const prod = db.prepare("SELECT purchase_price_paise FROM products WHERE id = ?").get(item.productId);
              batchPurchasePrice = prod ? prod.purchase_price_paise : 0;
              qtyToDeductFromBatch = remainingQuantityToDeduct;
              remainingQuantityToDeduct = 0;
            }

            const discount = parseInt(item.discountPaise) || 0;
            const isFirstBatch = (qtyToDeductFromBatch === totalQuantityToDeduct) || (remainingQuantityToDeduct === (totalQuantityToDeduct - qtyToDeductFromBatch));
            const appliedDiscount = isFirstBatch ? discount : 0;
            const appliedFreeQty = isFirstBatch ? freeQuantity : 0;

            const billedQtyForBatch = Math.max(0, qtyToDeductFromBatch - appliedFreeQty);
            const lineTotalPart = billedQtyForBatch * item.unitPricePaise;

            db.prepare(
              \`INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity, free_quantity, unit_price_paise, purchase_price_paise, discount_paise, gst_percent, hsn_code, line_total_paise, batch_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
            ).run(
              saleId, item.productId, item.productName, item.barcode, billedQtyForBatch, appliedFreeQty,
              item.unitPricePaise, batchPurchasePrice, appliedDiscount, item.gstPercent || 0, item.hsnCode || '', lineTotalPart - appliedDiscount, batchId
            );
          }
        }
        
        results.push({
          receiptNumber,
          saleId,
          subtotalPaise,
          cgstPaise: totalCgstPaise,
          sgstPaise: totalSgstPaise,
          igstPaise: totalIgstPaise,
          discountPaise: cart.discount,
          appliedCouponPaise: cart.coupon,
          rewardEarnedPaise: reportedReward,
          newCouponBalancePaise: reportedNewBalance,
          grandTotalPaise,
          customerName,
          customerGstin,
          customerPhone: customerPhone || '',
          isB2B,
          isInterState,
          createdAt: createdAtStr,
          cartItems: cart.items
        });
      }

      return { success: true, results };
    });

    const result = checkoutTransaction(cartItems);

    if (result.success && customerPhone && shouldSendWhatsappReceipt) {
      for (const res of result.results) {
         sendWhatsAppReceipt(customerPhone, customerName, res.grandTotalPaise, res.receiptNumber).catch(e => console.error("WhatsApp Async Error:", e));
      }
    }

    return result;
  } catch (err) {
    console.error('[IPC] billing:checkout error:', err);
    return { success: false, error: err.message };
  }
});
`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log("Replaced successfully");
