const fs = require('fs');
const axios = require('axios');
const chalk = require('chalk');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const CONTROL_FILE = path.join(DATA_DIR, 'control-tokens.txt');
const VERIFIED_FILE = path.join(DATA_DIR, 'verified-tokens.txt');
const INVALID_FILE = path.join(DATA_DIR, 'generator-invalid.txt');

function randomChar(chars) {
  return chars.charAt(Math.floor(Math.random() * chars.length));
}

function generateSimilarToken(sample) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === '.') {
      result += '.';
    } else {
      result += randomChar(chars);
    }
  }
  return result;
}

function isPlaceholderToken(token) {
  const placeholders = ['BURAYA_ÖRNEK_TOKEN_GİR', 'BU_ŞEKİLDE_EKLE', 'ÜÇÜNCÜ_ÖRNEK'];
  return placeholders.some(p => token.includes(p));
}

async function checkToken(token) {
  try {
    const res = await axios.get('https://discord.com/api/v9/users/@me', {
      headers: { Authorization: token },
      timeout: 10000,
      validateStatus: null,
    });
    if (res.status === 200) {
      const { username, discriminator, id } = res.data;
      return { valid: true, info: `${username}#${discriminator} (${id})` };
    }
    if (res.status === 429) {
      const retryAfter = res.headers['retry-after'] || 1;
      return { valid: false, rateLimit: true, retryAfter: Number(retryAfter) };
    }
    return { valid: false };
  } catch (err) {
    return { valid: false, networkError: true };
  }
}

function getLineCount(file) {
  try {
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content) return 0;
    return content.split('\n').filter(Boolean).length;
  } catch { return 0; }
}

function appendLine(file, line) {
  fs.appendFileSync(file, line.trim() + '\n', 'utf8');
}

async function run(sampleTokens) {
  while (true) {
    let token;

    if (fs.existsSync(CONTROL_FILE)) {
      const lines = fs.readFileSync(CONTROL_FILE, 'utf8').split('\n').filter(Boolean);
      if (lines.length > 0) {
        token = lines[0].trim();
        fs.writeFileSync(CONTROL_FILE, lines.slice(1).join('\n') + (lines.length > 1 ? '\n' : ''), 'utf8');
      }
    }

    if (!token) {
      const idx = Math.floor(Math.random() * sampleTokens.length);
      token = generateSimilarToken(sampleTokens[idx]);
    }

    if (!token) {
      console.log(chalk.red('[ERROR] No sample token is available. Check settings.json → generator.sampleTokens.'));
      break;
    }

    const result = await checkToken(token);

    if (result.rateLimit) {
      const wait = (result.retryAfter || 1) * 1000 + 500;
      console.log(chalk.yellow(`[RATE LIMIT] Waiting ${result.retryAfter}s...`));
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (result.valid) {
      appendLine(VERIFIED_FILE, token);
      console.log(
        chalk.greenBright('[VALID TOKEN]'),
        chalk.white(token),
        chalk.gray('→'),
        chalk.green(result.info)
      );
    } else {
      appendLine(INVALID_FILE, token);
      console.log(chalk.red('[INVALID]'), chalk.gray(token));
    }

    console.log(
      chalk.cyan('[ACTIVE TOKEN COUNT]'),
      chalk.greenBright(`( ${getLineCount(VERIFIED_FILE)} )\n`)
    );

    await new Promise(r => setTimeout(r, 1000));
  }
}

(async () => {
  const settings = require(path.join(ROOT, 'settings.json'));
  const cfg = settings.generator;

  if (!cfg || !Array.isArray(cfg.sampleTokens) || cfg.sampleTokens.length === 0) {
    console.log(chalk.red('[ERROR] settings.json → generator.sampleTokens is missing or empty.'));
    process.exit(1);
  }

  const validSamples = cfg.sampleTokens.filter(t => !isPlaceholderToken(t) && t.trim());
  if (validSamples.length === 0) {
    console.log(chalk.red('[ERROR] settings.json → generator.sampleTokens contains only placeholder values.'));
    console.log(chalk.yellow('[INFO] Add real Discord token samples.'));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n  ┌─ TOKEN GENERATOR & CHECKER ──────────────┐'));
  console.log(chalk.cyan('  │') + chalk.white('  Generating... Press Ctrl+C to stop.       ') + chalk.cyan('│'));
  console.log(chalk.cyan('  │') + chalk.white(`  Sample token count: ${validSamples.length}`) + chalk.cyan(' '.repeat(22 - String(validSamples.length).length) + '│'));
  console.log(chalk.bold.cyan('  └───────────────────────────────────────────┘\n'));

  await run(validSamples);
})();