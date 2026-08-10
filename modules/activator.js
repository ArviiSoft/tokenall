const chalk = require('chalk');
const gradient = require('gradient-string');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');

let joinVoiceChannel;
try {
  ({ joinVoiceChannel } = require('@discordjs/voice'));
} catch {
  console.log(chalk.yellow('[WARNING] @discordjs/voice is not installed. Voice channel support is disabled.'));
  joinVoiceChannel = null;
}

const ROOT = path.join(__dirname, '..');

process.on('unhandledRejection', (reason) => {
  console.log(chalk.redBright('[ERROR]'), 'Reason:', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.log(chalk.redBright('[ERROR]'), err.message, `(${origin})`);
});

(async () => {
  console.log(gradient.rainbow('\n  arviis. — Token Activator\n'));

  const settings = require(path.join(ROOT, 'settings.json')).activator;

  const tokens = (settings.HesapTOKEN || []).filter(Boolean);
  const channels = (settings.SesKanallari || []);

  if (tokens.length === 0) {
    console.log(chalk.red('[ERROR] The activator token list in settings.json is empty.'));
    process.exit(1);
  }

  const allPlaceholder = channels.every(c => String(c).toUpperCase().includes('SES_KANALI_ID'));
  if (channels.length > 0 && allPlaceholder) {
    console.log(chalk.yellow('[WARNING] The activator voice channel list does not contain valid channel IDs. Voice connection will be skipped.'));
  }

  console.log(chalk.magentaBright('[INFO]') + ` Starting activation for ${tokens.length} tokens...\n`);

  const clients = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    const channelId = channels[i] ? String(channels[i]).trim() : null;
    const effectiveChannelId = (channelId && !channelId.toUpperCase().includes('SES_KANALI_ID'))
      ? channelId : null;

    const client = new Client({ checkUpdate: false });
    clients.push(client);

    client.on('update', () => {});

    client.on('ready', async () => {
      console.log(chalk.green('[TOKEN ACTIVE]') + ' ' + gradient.cristal(client.user.tag));

      if (joinVoiceChannel && effectiveChannelId) {
        try {
          let voiceCh = client.channels.cache.get(effectiveChannelId);
          if (!voiceCh) {
            try { voiceCh = await client.channels.fetch(effectiveChannelId); } catch (_) {}
          }

          if (voiceCh) {
            joinVoiceChannel({
              channelId: voiceCh.id,
              guildId: voiceCh.guild.id,
              adapterCreator: voiceCh.guild.voiceAdapterCreator,
              selfDeaf: true,
              selfMute: true,
            });
            console.log(chalk.cyan('[VOICE CHANNEL]') + ` ${client.user.tag} → ${voiceCh.name}`);
          } else {
            console.log(chalk.yellow('[WARNING]') + ` Channel not found: ${effectiveChannelId}`);
          }
        } catch (err) {
          console.log(chalk.red('[VOICE ERROR]') + ' ' + err.message);
        }
      }

      try { await client.user.setStatus('online'); } catch (_) {}
    });

    client.login(token).catch(err => {
      console.log(chalk.redBright('[ERROR]') + ` Token ${i + 1} login failed: ${err.message}`);
      try { client.destroy(); } catch (_) {}
    });

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(chalk.magentaBright('\n[INFO]') + ' All tokens started. Press Ctrl+C to exit.\n');

  await new Promise(() => {});
})();