const fs = require('fs');
const chalk = require('chalk');
const gradient = require('gradient-string');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const HttpsProxyAgent = require('https-proxy-agent');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

process.on('unhandledRejection', (reason) => {
  console.log(chalk.redBright('[ERROR]'), 'Reason:', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.log(chalk.redBright('[ERROR]'), err.message, `(${origin})`);
});

const settings = require(path.join(ROOT, 'settings.json')).joiner;

const TOKENS_FILE = path.join(DATA_DIR, 'tokens.txt');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.txt');
const JOINED_FILE = path.join(DATA_DIR, 'joined-tokens.txt');
const FAILED_FILE = path.join(DATA_DIR, 'failed-tokens.txt');

function appendLine(file, line) {
  try { fs.appendFileSync(file, line.trim() + '\n', 'utf8'); } catch (_) {}
}

function cleanToken(t) {
  return t ? t.replace(/^Bot\s+/i, '').trim() : t;
}

function parseInvite(raw) {
  return (raw || '')
    .replace(/https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, '')
    .replace(/\//g, '')
    .trim();
}

async function waitSpin(ms, label) {
  return new Promise(resolve => {
    const frames = ['|', '/', '-', '\\'];
    const start = Date.now();
    let i = 0;
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / ms) * 100));
      const rem = Math.max(0, Math.ceil((ms - elapsed) / 1000));
      process.stdout.write(`\r  ${frames[i++ % 4]} ${label} — ${pct}% (${rem}s remaining)   `);
      if (elapsed >= ms) {
        clearInterval(iv);
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        resolve();
      }
    }, 250);
  });
}

async function processToken(token, inviteCode, proxies, idx, total, joinedSet, stats) {
  token = cleanToken(token);
  if (!token) return;

  if (joinedSet.has(token)) {
    console.log(chalk.cyan('[SKIP]') + ` Already joined (${idx + 1}/${total})`);
    return;
  }

  const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;

  const opts = {
    checkUpdate: false,
    restRequestTimeout: 60_000,
    interactionTimeout: 60_000,
    restWsBridgeTimeout: 5_000,
  };

  if (settings.captcha_api_key) {
    opts.captchaService = (settings.captcha_service || 'capmonster').toLowerCase();
    opts.captchaKey = settings.captcha_api_key;
  }

  if (settings.useProxies && proxy) {
    try { opts.http = { agent: HttpsProxyAgent(proxy) }; } catch (_) {}
  }

  const client = new Client(opts);

  client.on('update', () => {});

  await new Promise((resolve) => {
    let settled = false;

    const safeResolve = () => {
      if (settled) return;
      settled = true;
      try { client.destroy(); } catch (_) {}
      resolve();
    };

    const globalTimeout = setTimeout(() => {
      stats.fail++;
      appendLine(FAILED_FILE, token);
      console.log(chalk.redBright('[TIMEOUT]') + ` Token ${idx + 1}/${total} — no response within 30s.`);
      safeResolve();
    }, 30_000);

    client.once('ready', async () => {
      clearTimeout(globalTimeout);
      try {
        console.log(chalk.green('[TOKEN ACTIVE]') + ' ' + gradient.cristal(client.user.tag) + ` (${idx + 1}/${total})`);
        await client.rest.post(`/invites/${inviteCode}`);
        console.log(chalk.greenBright('[JOINED SERVER]') + ' ' + gradient.passion(client.user.tag));
        stats.ok++;
        appendLine(JOINED_FILE, token);
        joinedSet.add(token);
      } catch (err) {
        stats.fail++;
        appendLine(FAILED_FILE, token);
        console.log(chalk.redBright('[ERROR]') + ` ${client.user.tag} could not join the server: ${err.message}`);
      } finally {
        process.title = `Successful: ${stats.ok} | Failed: ${stats.fail}`;
        safeResolve();
      }
    });

    client.login(token).catch(err => {
      clearTimeout(globalTimeout);
      stats.fail++;
      appendLine(FAILED_FILE, token);
      console.log(chalk.redBright('[ERROR]') + ' Login failed: ' + (err.message || err));
      safeResolve();
    });
  });
}

(async () => {
  console.log(gradient.rainbow('\n  arviis. — Token Joiner\n'));

  if (!fs.existsSync(TOKENS_FILE)) {
    console.log(chalk.red('[ERROR] data/tokens.txt was not found.')); process.exit(1);
  }

  const inviteCode = parseInvite(settings.inviteCode);
  if (!inviteCode) {
    console.log(chalk.red('[ERROR] settings.json → joiner.inviteCode is empty.')); process.exit(1);
  }

  if (inviteCode.toUpperCase().includes('DAVET_KODU')) {
    console.log(chalk.red('[ERROR] settings.json → joiner.inviteCode still contains a placeholder value.'));
    console.log(chalk.yellow('[INFO] Enter a valid Discord invite code.'));
    process.exit(1);
  }

  const rawTokens = fs.readFileSync(TOKENS_FILE, 'utf8').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  const tokens = [...new Set(rawTokens)];

  if (tokens.length === 0) {
    console.log(chalk.red('[ERROR] data/tokens.txt is empty. No tokens are available.'));
    process.exit(1);
  }

  let proxies = [];
  if (fs.existsSync(PROXIES_FILE)) {
    proxies = fs.readFileSync(PROXIES_FILE, 'utf8').split(/\r?\n/).map(p => p.trim()).filter(Boolean);
  }

  if (settings.useProxies && proxies.length === 0) {
    console.log(chalk.yellow('[WARNING] useProxies is true, but data/proxies.txt is empty. Proxies will not be used.'));
  }

  const joinedSet = new Set();
  if (fs.existsSync(JOINED_FILE)) {
    fs.readFileSync(JOINED_FILE, 'utf8').split(/\r?\n/).filter(Boolean).forEach(t => joinedSet.add(t.trim()));
  }

  const stats = { ok: 0, fail: 0 };
  const delayMs = Math.max(1000, Number(settings.joinDelay) || 3000);

  console.log(chalk.magentaBright('[INFO]') + ` Total tokens: ${tokens.length} | Server: discord.gg/${inviteCode}\n`);

  for (let i = 0; i < tokens.length; i++) {
    if (i > 0) await waitSpin(delayMs, `Waiting for token ${i + 1}/${tokens.length}`);
    await processToken(tokens[i], inviteCode, proxies, i, tokens.length, joinedSet, stats);
  }

  console.log(chalk.magentaBright('\n[COMPLETE]') + ` Successful: ${stats.ok} | Failed: ${stats.fail}`);
})();