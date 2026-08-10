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
  console.log(chalk.redBright('[ERROR]'), reason);
});
process.on('uncaughtException', (err, origin) => {
  console.log(chalk.redBright('[ERROR]'), err.message, `(${origin})`);
});

const settings = require(path.join(ROOT, 'settings.json')).booster;

const TOKENS_FILE = path.join(DATA_DIR, 'tokens.txt');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.txt');
const JOINED_FILE = path.join(DATA_DIR, 'booster-joined.txt');
const FAILED_FILE = path.join(DATA_DIR, 'booster-failed.txt');

function appendLine(file, line) {
  try { fs.appendFileSync(file, line.trim() + '\n', 'utf8'); } catch (_) {}
}

function parseInvite(raw) {
  return (raw || '')
    .replace(/https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, '')
    .replace(/\//g, '')
    .trim();
}

async function tryBoost(client, cfg) {
  if (!cfg || !cfg.enabled) return;

  if (!cfg.serverId || String(cfg.serverId).toUpperCase().includes('SUNUCU_ID')) {
    console.log(chalk.yellow('[WARNING] booster.boost.serverId is not configured. Skipping boost.'));
    return;
  }

  await new Promise(r => setTimeout(r, Math.max(500, cfg.delay || 1000)));

  try {
    const allBoosts = await client.billing.fetchGuildBoosts();

    const boostList = [...allBoosts.values()];
    for (const boost of boostList) {
      try { await boost.unsubscribe(); } catch (_) {}
      await new Promise(r => setTimeout(r, 500));
      try {
        await boost.subscribe(cfg.serverId);
        console.log(chalk.greenBright('[BOOST APPLIED]') + ' ' + gradient.cristal(client.user.tag));
      } catch (e) {
        console.log(chalk.yellow('[BOOST ERROR]') + ' ' + e.message);
      }
    }
  } catch (e) {
    console.log(chalk.yellow('[BOOST UNAVAILABLE]') + ' ' + e.message);
  }
}

async function processToken(token, inviteCode, proxies, idx, total, stats) {
  token = token.replace(/^Bot\s+/i, '').trim();
  if (!token) return;

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
    try {
      const agent = HttpsProxyAgent(proxy);
      opts.http = { agent };
      if (settings.captcha_api_key) { opts.captchaWithProxy = true; opts.proxy = proxy; }
    } catch (_) {}
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
      console.log(chalk.green('[TOKEN ACTIVE]') + ' ' + gradient.cristal(client.user.tag) + ` (${idx + 1}/${total})`);

      try {
        const invite = await client.fetchInvite(inviteCode);
        await invite.acceptInvite(true);
        console.log(chalk.greenBright('[JOINED SERVER]') + ' ' + gradient.passion(client.user.tag));
        stats.ok++;
        appendLine(JOINED_FILE, token);
        process.title = `Successful: ${stats.ok} | Failed: ${stats.fail}`;

        await tryBoost(client, settings.boost);

      } catch (err) {
        stats.fail++;
        appendLine(FAILED_FILE, token);
        console.log(chalk.redBright('[ERROR]') + ` ${client.user.tag} could not join the server: ${err.message || err}`);
        process.title = `Successful: ${stats.ok} | Failed: ${stats.fail}`;
      }

      safeResolve();
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
  console.log(gradient.rainbow('\n  arviis. — Token Joiner & Boost Generator\n'));

  if (!fs.existsSync(TOKENS_FILE)) {
    console.log(chalk.red('[ERROR] data/tokens.txt was not found.')); process.exit(1);
  }

  const inviteCode = parseInvite(settings.inviteCode);
  if (!inviteCode) {
    console.log(chalk.red('[ERROR] settings.json → booster.inviteCode is empty.')); process.exit(1);
  }

  if (inviteCode.toUpperCase().includes('DAVET_KODU')) {
    console.log(chalk.red('[ERROR] settings.json → booster.inviteCode still contains a placeholder value.'));
    process.exit(1);
  }

  const rawTokens = fs.readFileSync(TOKENS_FILE, 'utf8').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  const tokens = [...new Set(rawTokens)];

  if (tokens.length === 0) {
    console.log(chalk.red('[ERROR] data/tokens.txt is empty.')); process.exit(1);
  }

  let proxies = [];
  if (fs.existsSync(PROXIES_FILE)) {
    proxies = fs.readFileSync(PROXIES_FILE, 'utf8').split(/\r?\n/).map(p => p.trim()).filter(Boolean);
  }

  if (settings.useProxies && proxies.length === 0) {
    console.log(chalk.yellow('[WARNING] useProxies is true, but data/proxies.txt is empty. Proxies will not be used.'));
  }

  const stats = { ok: 0, fail: 0 };
  const delay = Math.max(1000, Number(settings.joinDelay) || 1000);

  console.log(chalk.magentaBright('[INFO]') + ` Total: ${tokens.length} tokens | Server: discord.gg/${inviteCode}`);
  if (settings.boost && settings.boost.enabled) {
    console.log(chalk.magentaBright('[INFO]') + ` Boost: ACTIVE → Server ID: ${settings.boost.serverId}`);
  }
  console.log();

  for (let i = 0; i < tokens.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, delay));
    await processToken(tokens[i], inviteCode, proxies, i, tokens.length, stats);
  }

  console.log(chalk.magentaBright('\n[COMPLETE]') + ` Successful: ${stats.ok} | Failed: ${stats.fail}`);
})();