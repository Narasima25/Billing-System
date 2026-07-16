const fs = require('fs');
let content = fs.readFileSync('d:/Billing-POS/src/UI/billing.js', 'utf8');

// The literal question mark, let's just do a regex replace
content = content.replace(/<div style="font-size:48px;margin-bottom:12px;">\?<\/div>/g, '<div style="font-size:48px;margin-bottom:12px;">&#x2705;</div>');

// Let's also catch the case where it might be a weird fallback character by just replacing the innerHTML of that specific div
content = content.replace(/<div style="font-size:48px;margin-bottom:12px;">.*?<\/div>/g, '<div style="font-size:48px;margin-bottom:12px;">&#x2705;</div>');

fs.writeFileSync('d:/Billing-POS/src/UI/billing.js', content, 'utf8');
console.log("Replaced!");
