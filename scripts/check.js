const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildChatResult } = require('../api/_lib/chat');

const root = path.join(__dirname, '..');
const files = [
  'server.js',
  'api/health.js',
  'api/login.js',
  'api/search.js',
  'api/session.js',
  'api/_lib/chat.js',
  'api/_lib/config.js',
  'api/_lib/googleSheets.js',
  'api/_lib/http.js',
  'api/_lib/phone.js',
  'api/_lib/session.js',
  'public/app.js',
];

files.forEach((file) => {
  const filePath = path.join(root, file);
  const source = fs.readFileSync(filePath, 'utf8');
  new vm.Script(source, { filename: filePath });
});

const sample = [
  ['phone_digits', 'phone_local', 'wa_name', 'direction', 'message', 'ai_reply', 'timestamp', 'LeadScore', 'LeadCategory', 'LeadReason', 'message_es', 'client_lang'],
  ['34638771742', '638771742', 'Pablo terol', 'assistant', '', 'Hello from Valtiera', '2026-06-29T12:58:58.892+02:00', '10', 'To be qualified', '', '', ''],
  ['34638771742', '638771742', 'VALTIER RE', 'user', 'Si', 'Perfecto', '2026-06-29T13:02:49.247+02:00', '80', 'WARM', '', '', ''],
];
const result = buildChatResult(sample, '+34 638 771 742');

if (!result.client || result.messages.length !== 3) {
  throw new Error('Chat result smoke test failed.');
}

console.log('Checks passed.');
