const fs = require('fs');
const glob = require('glob');

const regexes = [
  {
    file: 'd:/Billing-POS/src/main.js',
    replacements: [
      {
        find: /const isService = \(product\.category_name \|\| ''\)\.toLowerCase\(\)\.includes\('service'\) \|\| \(product\.barcode \|\| ''\)\.startsWith\('SRV-'\);/g,
        replace: "const isService = (product.category_name || '').toLowerCase().includes('service') || (product.category_name || '').toLowerCase().includes('grooming') || (product.barcode || '').startsWith('SRV-');"
      },
      {
        find: /const isService = product && \(\(product\.category_name \|\| ''\)\.toLowerCase\(\)\.includes\('service'\) \|\| \(item\.barcode \|\| ''\)\.startsWith\('SRV-'\)\);/g,
        replace: "const isService = product && ((product.category_name || '').toLowerCase().includes('service') || (product.category_name || '').toLowerCase().includes('grooming') || (item.barcode || '').startsWith('SRV-'));"
      },
      {
        find: /const isService = product && \(\(product\.category_name \|\| ''\)\.toLowerCase\(\)\.includes\('service'\) \|\| \(originalItem\.barcode \|\| ''\)\.startsWith\('SRV-'\)\);/g,
        replace: "const isService = product && ((product.category_name || '').toLowerCase().includes('service') || (product.category_name || '').toLowerCase().includes('grooming') || (originalItem.barcode || '').startsWith('SRV-'));"
      }
    ]
  },
  {
    file: 'd:/Billing-POS/src/UI/products.js',
    replacements: [
      {
        find: /const isService = catName\.includes\('service'\);/g,
        replace: "const isService = catName.includes('service') || catName.includes('grooming');"
      },
      {
        find: /const isService = \(p\.category_name \|\| ''\)\.toLowerCase\(\)\.includes\('service'\) \|\| \(p\.barcode \|\| ''\)\.startsWith\('SRV-'\);/g,
        replace: "const isService = (p.category_name || '').toLowerCase().includes('service') || (p.category_name || '').toLowerCase().includes('grooming') || (p.barcode || '').startsWith('SRV-');"
      }
    ]
  },
  {
    file: 'd:/Billing-POS/src/UI/billing.js',
    replacements: [
      {
        find: /const isService = \(p\.category_name \|\| ''\)\.toLowerCase\(\)\.includes\('service'\) \|\| \(p\.barcode \|\| ''\)\.startsWith\('SRV-'\);/g,
        replace: "const isService = (p.category_name || '').toLowerCase().includes('service') || (p.category_name || '').toLowerCase().includes('grooming') || (p.barcode || '').startsWith('SRV-');"
      },
      {
        find: /const isService = \(product\.category_name \|\| ''\)\.toLowerCase\(\)\.includes\('service'\) \|\| \(product\.barcode \|\| ''\)\.startsWith\('SRV-'\);/g,
        replace: "const isService = (product.category_name || '').toLowerCase().includes('service') || (product.category_name || '').toLowerCase().includes('grooming') || (product.barcode || '').startsWith('SRV-');"
      }
    ]
  }
];

for (const task of regexes) {
  let content = fs.readFileSync(task.file, 'utf8');
  let changed = false;
  for (const r of task.replacements) {
    if (content.match(r.find)) {
       content = content.replace(r.find, r.replace);
       changed = true;
    } else {
       console.log("Could not find match in " + task.file + " for " + r.find);
    }
  }
  if (changed) {
    fs.writeFileSync(task.file, content, 'utf8');
    console.log("Updated " + task.file);
  }
}

