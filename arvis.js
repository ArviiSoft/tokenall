const chalk = require('chalk');
const gradient = require('gradient-string');
const readline = require('readline');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ACCENT = gradient(['#8b5cf6', '#22d3ee']);
const INNER_WIDTH = 66;
const MENU_ITEMS = [
  {
    key: '1',
    title: 'Token Generator & Checker',
    tag: 'GENERATOR',
    description: 'Generate, validate, and save valid tokens',
    file: 'generator.js',
  },
  {
    key: '2',
    title: 'Token Joiner',
    tag: 'SERVER',
    description: 'Join accounts to a server with an invite link',
    file: 'joiner.js',
  },
  {
    key: '3',
    title: 'Token Activator',
    tag: 'VOICE',
    description: 'Keep accounts active in configured voice channels',
    file: 'activator.js',
  },
  {
    key: '4',
    title: 'Joiner & Boost Generator',
    tag: 'BOOST',
    description: 'Manage server joining and boost operations',
    file: 'booster.js',
  },
  {
    key: '5',
    title: 'ID → Token Converter',
    tag: 'TOOL',
    description: 'Convert a Discord user ID into token format',
    file: 'idtotoken.js',
  },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stripAnsi = value => value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '');

function clear() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

function showCursor() {
  process.stdout.write('\x1b[?25h');
}

function fill(content = '', width = INNER_WIDTH) {
  return content + ' '.repeat(Math.max(0, width - stripAnsi(content).length));
}

function border(left, middle, right) {
  return `  ${chalk.hex('#475569')(left)}${ACCENT(middle)}${chalk.hex('#475569')(right)}`;
}

function row(content = '') {
  return `  ${chalk.hex('#475569')('│')}${fill(content)}${chalk.hex('#475569')('│')}`;
}

function formatClock() {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

function countLines(file) {
  try {
    return fs.readFileSync(path.join(__dirname, file), 'utf8')
      .split(/\r?\n/)
      .filter(line => line.trim()).length;
  } catch (_) {
    return 0;
  }
}

function renderMenu(selectedIndex, pulse = true) {
  clear();
  const tokenCount = countLines(path.join('data', 'tokens.txt'));
  const proxyCount = countLines(path.join('data', 'proxies.txt'));
  const online = pulse ? chalk.hex('#34d399')('●') : chalk.hex('#10b981')('●');
  const status = `${online} ${chalk.hex('#a7f3d0')('SYSTEM READY')}`;

  console.log(border('╭', '─'.repeat(INNER_WIDTH), '╮'));
  console.log(row(`  ${chalk.hex('#94a3b8')('arviis.')} ${chalk.hex('#475569')('•')} ${chalk.hex('#c4b5fd')('v1.0')}                                 ${status}`));
  console.log(row());
  console.log(row(`  ${chalk.hex('#94a3b8')('TOKEN')}${chalk.bold.white(` ${tokenCount}`)}    ${chalk.hex('#334155')('│')}    ${chalk.hex('#94a3b8')('PROXY')}${chalk.bold.white(` ${proxyCount}`)}    ${chalk.hex('#334155')('│')}    ${chalk.hex('#94a3b8')('MODULE')}${chalk.bold.white(` ${MENU_ITEMS.length}`)}       ${chalk.hex('#94a3b8')(formatClock())}`));
  console.log(border('├', '─'.repeat(INNER_WIDTH), '┤'));
  console.log(row(`  ${chalk.bold.hex('#e2e8f0')('SYSTEMS')}  ${chalk.hex('#64748b')('Choose a module to launch')}`));
  console.log(row());

  MENU_ITEMS.forEach((item, index) => {
    const selected = index === selectedIndex;
    const marker = selected ? '›' : ' ';
    const number = item.key.padStart(2, '0');
    const left = `${marker}  ${number}  ${item.title}`;
    const gap = Math.max(2, 58 - left.length - item.tag.length);

    if (selected) {
      const content = `  ${left}${' '.repeat(gap)}${item.tag}  `;
      console.log(row(chalk.bgHex('#6d28d9').white.bold(fill(content))));
      console.log(row(`       ${chalk.hex('#a5f3fc')('└─')} ${chalk.hex('#cbd5e1')(item.description)}`));
    } else {
      const content = `  ${chalk.hex('#475569')(marker)}  ${chalk.hex('#64748b')(number)}  ${chalk.hex('#cbd5e1')(item.title)}${' '.repeat(gap)}${chalk.hex('#64748b')(item.tag)}  `;
      console.log(row(content));
    }
  });

  console.log(row());
  console.log(border('├', '─'.repeat(INNER_WIDTH), '┤'));
  console.log(row(`  ${chalk.bgHex('#164e63').hex('#cffafe')(' ↑↓ ')} ${chalk.hex('#94a3b8')('Navigate')}   ${chalk.bgHex('#164e63').hex('#cffafe')(' ENTER ')} ${chalk.hex('#94a3b8')('Launch')}   ${chalk.bgHex('#3f1d2e').hex('#fecdd3')(' Q ')} ${chalk.hex('#94a3b8')('Exit')}`));
  console.log(border('╰', '─'.repeat(INNER_WIDTH), '╯'));
  console.log(chalk.hex('#475569')('    Tip: Press 1–5 for quick selection.'));
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function selectFallback() {
  renderMenu(0);
  return prompt(chalk.hex('#fbbf24')('\n  Select an option [0–5]: '));
}

function selectModule(startIndex = 0) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return selectFallback();
  }

  return new Promise(resolve => {
    let selectedIndex = startIndex;
    let pulse = true;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    hideCursor();
    renderMenu(selectedIndex, pulse);

    const timer = setInterval(() => {
      pulse = !pulse;
      renderMenu(selectedIndex, pulse);
    }, 1000);

    const redraw = () => renderMenu(selectedIndex, pulse);
    const cleanup = () => {
      clearInterval(timer);
      process.stdout.removeListener('resize', redraw);
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      showCursor();
    };
    const finish = choice => {
      cleanup();
      resolve(choice);
    };
    const onKeypress = (value, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
      if (/^[1-5]$/.test(value)) {
        finish(value);
      } else if (value === '0' || key.name === 'q' || key.name === 'escape') {
        finish('0');
      } else if (key.name === 'up' || key.name === 'w') {
        selectedIndex = (selectedIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        renderMenu(selectedIndex, pulse);
      } else if (key.name === 'down' || key.name === 's') {
        selectedIndex = (selectedIndex + 1) % MENU_ITEMS.length;
        renderMenu(selectedIndex, pulse);
      } else if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
        finish(MENU_ITEMS[selectedIndex].key);
      }
    };

    process.stdout.on('resize', redraw);
    process.stdin.on('keypress', onKeypress);
  });
}

async function launchScreen(item) {
  hideCursor();
  for (const stage of ['■■□□□□', '■■■■□□', '■■■■■■']) {
    clear();
    console.log('\n');
    console.log(border('╭', '─'.repeat(INNER_WIDTH), '╮'));
    console.log(row());
    console.log(row(`  ${chalk.hex('#64748b')('LAUNCHING MODULE')}  ${chalk.hex('#475569')('/')}  ${chalk.hex('#22d3ee')(`0${item.key}`)}`));
    console.log(row(`  ${chalk.bold.white(item.title)}`));
    console.log(row(`  ${chalk.hex('#94a3b8')(item.description)}`));
    console.log(row());
    console.log(row(`  ${chalk.hex('#8b5cf6')(stage)}  ${chalk.hex('#a5f3fc')('Preparing...')}`));
    console.log(row());
    console.log(border('╰', '─'.repeat(INNER_WIDTH), '╯'));
    await sleep(110);
  }
  showCursor();
  console.log();
}

function runModule(file) {
  return spawnSync(process.execPath, [path.join(__dirname, 'modules', file)], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env,
  });
}

async function main() {
  let selectedIndex = 0;

  while (true) {
    const choice = await selectModule(selectedIndex);
    if (choice === '0') {
      clear();
      console.log(`\n  ${chalk.hex('#a78bfa')('◆')} ${chalk.bold.white('TokenAll closed.')} ${chalk.hex('#64748b')('See you next time!')}\n`);
      return;
    }

    const item = MENU_ITEMS.find(entry => entry.key === choice);
    if (!item) {
      console.log(chalk.red('\n  ⚠ Invalid selection. Please enter a value from 0 to 5.'));
      await sleep(1200);
      continue;
    }

    selectedIndex = MENU_ITEMS.indexOf(item);
    await launchScreen(item);
    const result = runModule(item.file);

    if (result.error) {
      console.log(chalk.redBright(`\n  Failed to launch module: ${result.error.message}`));
    } else if (typeof result.status === 'number' && result.status !== 0) {
      console.log(chalk.yellow(`\n  Module exited with status code ${result.status}.`));
    }

    console.log();
    const back = await prompt(
      `  ${chalk.hex('#22d3ee')('↵')} ${chalk.whiteBright('Press Enter for main menu')}  ${chalk.hex('#475569')('│')}  ${chalk.hex('#fda4af')('N to exit: ')}`,
    );
    if (back.toLowerCase() === 'n') {
      clear();
      console.log(`\n  ${chalk.hex('#a78bfa')('◆')} ${chalk.bold.white('TokenAll closed.')}\n`);
      return;
    }
  }
}

process.on('exit', showCursor);

main().catch(error => {
  showCursor();
  console.error(chalk.redBright('[FATAL ERROR]'), error.message || error);
  process.exit(1);
});