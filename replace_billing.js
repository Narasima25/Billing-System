const fs = require('fs');
const path = 'd:/Billing-POS/src/UI/billing.js';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf("async function handleCheckout()");
const endIdx = content.indexOf("async function buildReceipt", startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.log("Could not find start or end index");
    process.exit(1);
}

const replacement = `async function handleCheckout() {
    if (cart.length === 0) { showToast('Cart is empty - scan items first', 'warning'); return; }

    const discountPaise = parseRupeesToPaise(document.getElementById('billing-discount').value || '0');
    const appliedCouponPaise = parseRupeesToPaise(document.getElementById('billing-applied-coupon') ? document.getElementById('billing-applied-coupon').value || '0' : '0');

    const cartItems = cart.map(item => ({
      productId: item.productId,
      barcode: item.barcode,
      productName: item.productName,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity || 0,
      unitPricePaise: item.unitPricePaise,
      discountPaise: item.discountPaise || 0,
      gstPercent: item.gstPercent,
      hsnCode: item.hsnCode,
    }));

    try {
      const isB2B = document.getElementById('chk-b2b').checked;
      const isInterState = document.getElementById('chk-inter-state').checked;
      let customerName = document.getElementById('b2b-name').value.trim();
      const customerGstin = document.getElementById('b2b-gstin').value.trim();

      if (isB2B && !customerName) {
        showToast('Please enter Business Name for B2B sale', 'warning');
        return;
      }

      const customerStateCode = document.getElementById('customer-state-code').value;
      const customerPhone = isB2B 
        ? (document.getElementById('b2b-phone') ? document.getElementById('b2b-phone').value.trim() : '')
        : (document.getElementById('billing-customer-phone') ? document.getElementById('billing-customer-phone').value.trim() : '');

      if (!isB2B && document.getElementById('billing-customer-name')) {
        customerName = document.getElementById('billing-customer-name').value.trim() || customerName;
      }

      let approxTotal = 0;
      cartItems.forEach(i => approxTotal += i.unitPricePaise * i.quantity);

      if (!isB2B && approxTotal > 25000000) {
        if (!customerName) {
          showToast('B2C Large (>?2.5L): Customer Name is MANDATORY', 'error');
          return;
        }
        if (!customerStateCode) {
          showToast('B2C Large (>?2.5L): Customer State is MANDATORY', 'error');
          return;
        }
      }

      if (!isB2B && approxTotal >= 100000 && approxTotal <= 25000000 && !customerPhone) {
        const proceed = await new Promise(resolve => {
          document.getElementById('btn-loyalty-cancel').onclick = () => {
            closeModal('modal-loyalty-confirm');
            resolve(false);
          };
          document.getElementById('btn-loyalty-continue').onclick = () => {
            closeModal('modal-loyalty-confirm');
            resolve(true);
          };
          openModal('modal-loyalty-confirm');
        });

        if (!proceed) {
          const phoneInput = document.getElementById('billing-customer-phone');
          if (phoneInput) phoneInput.focus();
          return;
        }
      }

      const checkoutResponse = await window.api.billing.checkout({
        cartItems: cartItems,
        paymentMode: selectedPaymentMode,
        discountPaise,
        userId: currentUser ? currentUser.id : null,
        isB2B,
        isInterState,
        customerName,
        customerGstin,
        customerStateCode,
        customerPhone,
        customerAddress: '',
        appliedCouponPaise,
        invoiceDate: document.getElementById('billing-invoice-date') ? document.getElementById('billing-invoice-date').value : null,
        sendWhatsappReceipt: document.getElementById('billing-send-whatsapp') ? document.getElementById('billing-send-whatsapp').checked : false,
      });
      
      if (!checkoutResponse.success) {
         throw new Error(checkoutResponse.error || 'Checkout failed');
      }
      
      const results = checkoutResponse.results || [];

      // Show confirmation modal
      const confirmDiv = document.getElementById('checkout-confirm-content');

      let rewardHtml = '';
      const totalReward = results.reduce((sum, r) => sum + (r.rewardEarnedPaise || 0), 0);
      if (totalReward > 0) {
        rewardHtml = \`
          <div style="margin-top:16px; padding:12px; background:rgba(32, 201, 151, 0.1); border:1px dashed var(--accent-teal); border-radius:8px;">
            <div style="font-size:24px; margin-bottom:4px;">??</div>
            <div style="color:var(--accent-teal); font-weight:800; font-size:16px;">Reward Earned!</div>
            <div style="font-size:14px;">Tell the customer they won <b>\${formatRupees(totalReward)}</b> for their next visit!</div>
          </div>
        \`;
      }

      const receiptNumbers = results.map(r => r.receiptNumber).join(' <br> ');
      const grandTotals = results.reduce((sum, r) => sum + (r.grandTotalPaise || 0), 0);

      confirmDiv.innerHTML = \`
        <div style="font-size:48px;margin-bottom:12px;">?</div>
        <div style="font-size:20px;font-weight:800;margin-bottom:8px;">Sale Complete!</div>
        <div class="font-mono fw-700" style="font-size:16px;color:var(--accent-teal);margin-bottom:16px;">\${receiptNumbers}</div>
        <div style="font-size:32px;font-weight:900;color:var(--accent-teal);">\${formatRupees(grandTotals)}</div>
        <div class="text-muted text-sm mt-8">Payment: \${selectedPaymentMode.toUpperCase()}</div>
        \${rewardHtml}
      \`;

      // Build receipts for printing
      document.getElementById('receipt-container').innerHTML = '';
      document.getElementById('invoice-container').innerHTML = '';
      for (let i = 0; i < results.length; i++) {
         if (i > 0) {
            document.getElementById('receipt-container').innerHTML += '<div style="margin: 16px 0; border-top: 1px dashed #000;"></div>';
            document.getElementById('invoice-container').innerHTML += '<div style="page-break-after: always; margin: 20px 0; border-top: 1px dashed #000;"></div>';
         }
         await buildReceipt(results[i], results[i].cartItems);
      }

      openModal('modal-checkout-confirm');

      // Reset
        cart = [];
        document.getElementById('billing-discount').value = '0';
        if (document.getElementById('billing-discount-percent')) {
          document.getElementById('billing-discount-percent').value = '0';
        }
        discountMode = 'amount';
        if (document.getElementById('billing-customer-phone')) {
          document.getElementById('billing-customer-phone').value = '';
          const infoDiv = document.getElementById('customer-info');
          if (infoDiv) infoDiv.style.display = 'none';
          const nameInput = document.getElementById('billing-customer-name');
          if (nameInput) {
            nameInput.value = '';
            nameInput.style.display = 'none';
          }
          const couponInput = document.getElementById('billing-applied-coupon');
          if (couponInput) couponInput.value = '';
        }
        document.getElementById('chk-b2b').checked = false;
        document.getElementById('b2b-fields').style.display = 'none';
        document.getElementById('b2b-name').value = '';
        document.getElementById('b2b-gstin').value = '';
        document.getElementById('chk-inter-state').checked = false;
        document.getElementById('inter-state-fields').style.display = 'none';
        document.getElementById('customer-state-code').value = '';
        document.getElementById('row-cgst').style.display = 'flex';
        document.getElementById('row-sgst').style.display = 'flex';
        document.getElementById('row-igst').style.display = 'none';
        if (document.getElementById('billing-send-whatsapp')) {
          document.getElementById('billing-send-whatsapp').checked = true;
        }
        updateCartUI();

      // Fetch new receipt number for the next sale
      if (typeof updateReceiptNumber !== 'undefined') {
        await updateReceiptNumber();
      } else {
        if (invInput) {
          const nextNum = await window.api.billing.getNextReceiptNumber(document.getElementById('billing-invoice-date') ? document.getElementById('billing-invoice-date').value : null);
          invInput.value = nextNum;
          isInvoiceNumberEdited = false;
        }
      }

      const receiptNumbersStr = results.map(r => r.receiptNumber).join(' & ');
      const grandTotalsSum = results.reduce((sum, r) => sum + (r.grandTotalPaise || 0), 0);
      showToast(\`Sale \${receiptNumbersStr} — \${formatRupees(grandTotalsSum)}\`, 'success');
    } catch (err) {
      console.error('[Billing] checkout error:', err);
      showToast('Checkout error: ' + (err.message || 'Unknown error'), 'error');
    }
    scanner.focus();
  }

  `;

content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync(path, content, 'utf8');
console.log("Replaced successfully");
