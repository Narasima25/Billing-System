const fs = require('fs');
const path = 'd:/Billing-POS/src/UI/products.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /      tbody\.innerHTML = result\.products\.map\(p => \{[\s\S]*?      \}\)\.join\(''\);/m;
const match = content.match(regex);
if (!match) {
    console.log("Could not find table rendering block");
    process.exit(1);
}

const replacement = `      const renderRow = (p) => {
        const isService = (p.category_name || '').toLowerCase().includes('service') || (p.barcode || '').startsWith('SRV-');
        
        let stockClass = 'ok';
        if (p.stock_quantity === 0) stockClass = 'critical';
        else if (p.stock_quantity <= p.minimum_stock_level) stockClass = 'low';

        return \`<tr>
          <td>
            <div class="fw-700">\${p.product_name}</div>
            \${p.brand ? \`<div class="text-sm text-muted">\${p.brand}</div>\` : ''}
          </td>
          <td><span class="font-mono text-sm">\${p.barcode}</span></td>
          <td>\${p.category_name ? \`<span class="badge badge-teal">\${p.category_name}</span>\` : '<span class="text-muted">—</span>'}</td>
          <td><span class="font-mono text-sm">\${p.hsn_code || '—'}</span></td>
          <td>\${formatRupees(p.base_price_paise)}</td>
          <td class="fw-700">\${formatRupees(p.selling_price_paise)}</td>
          <td>\${p.gst_percent || 0}%</td>
          <td>\${isService ? '<span class="text-muted">—</span>' : \`<span class="stock-badge \${stockClass}">\${p.stock_quantity}</span>\`}</td>
          <td>
            <div class="btn-group" style="gap:4px;">
              <button class="btn btn-ghost btn-sm" data-action="edit" data-id="\${p.id}" title="Edit">??</button>
              \${isService ? '' : \`<button class="btn btn-ghost btn-sm" data-action="adjust" data-id="\${p.id}" data-name="\${p.product_name}" data-barcode="\${p.barcode}" title="Adjust Stock">??</button>\`}
              <button class="btn btn-ghost btn-sm" data-action="delete" data-id="\${p.id}" title="Delete">???</button>
            </div>
          </td>
        </tr>\`;
      };

      if (result.products.length <= 100) {
        tbody.innerHTML = result.products.map(renderRow).join('');
      } else {
        tbody.innerHTML = '';
        let idx = 0;
        const chunkSize = 100;
        const processChunk = () => {
          const chunk = result.products.slice(idx, idx + chunkSize);
          if (chunk.length === 0) return;
          tbody.insertAdjacentHTML('beforeend', chunk.map(renderRow).join(''));
          idx += chunkSize;
          if (idx < result.products.length) {
            requestAnimationFrame(processChunk);
          }
        };
        requestAnimationFrame(processChunk);
      }`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log("Replaced successfully");
