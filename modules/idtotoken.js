const chalk = require('chalk');
const gradient = require('gradient-string');
const readline = require('readline');

const BANNER = chalk.red(`
  ╦╔╦╗  ╔╦╗╔═╗  ╔╦╗╔═╗╦╔═╔═╗╔╗╔
  ║ ║║   ║ ║ ║   ║ ║ ║╠╩╗║╣ ║║║
  ╩═╩╝   ╩ ╚═╝   ╩ ╚═╝╩ ╩╚═╝╝╚╝
                              by arviis.
`);

function idToTokenPart(userId) {
  return Buffer.from(String(userId)).toString('base64').replace(/=/g, '');
}

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(q, ans => { rl.close(); resolve(ans.trim()); });
  });
}

(async () => {
  console.log(BANNER);

  while (true) {
    const userId = await prompt(chalk.whiteBright('  [ID] Enter a user ID (0 to exit): '));

    if (userId === '0' || userId === '') break;

    if (!/^\d{17,20}$/.test(userId)) {
      console.log(chalk.red('  ⚠  Invalid ID format. Enter a 17–20 digit number.\n'));
      continue;
    }

    const part = idToTokenPart(userId);

    console.log();
    console.log(chalk.bold.whiteBright('  ┌──────────────────────────────────────────────┐'));
    console.log(chalk.bold.whiteBright('  │  ') + 'User ID: ' + chalk.yellow(userId));
    console.log(chalk.bold.whiteBright('  │  ') + 'Token (part 1):');
    console.log(chalk.bold.whiteBright('  │  ') + gradient.cristal(part));
    console.log(chalk.bold.whiteBright('  └──────────────────────────────────────────────┘'));
    console.log(chalk.gray('  (Full token structure: ') + chalk.cyan(part) + chalk.gray('.[signature1].[signature2])'));
    console.log();
  }

  console.log(chalk.gray('  Exiting module...\n'));
})();