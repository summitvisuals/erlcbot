const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');

const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let activeSession = null;

// ================= LOAD FILES =================

let config = fs.existsSync('./config.json')
  ? JSON.parse(fs.readFileSync('./config.json'))
  : {};

let db = fs.existsSync('./database.json')
  ? JSON.parse(fs.readFileSync('./database.json'))
  : { warnings: {} };

function saveAll() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

function isStaff(member, guildId) {
  return (
    config[guildId]?.staffRole &&
    member.roles.cache.has(config[guildId].staffRole)
  );
}

// ================= COMMANDS =================

const commands = [

  // SESSION
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage sessions')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start session')
        .addStringOption(option =>
          option
            .setName('code')
            .setDescription('Server code')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End session')
    ),

  // API KEY
  new SlashCommandBuilder()
    .setName('setapikey')
    .setDescription('Set ERLC API key')
    .addStringOption(option =>
      option
        .setName('key')
        .setDescription('ERLC API key')
        .setRequired(true)
    ),

  // CONFIG
  new SlashCommandBuilder()
    .setName('configure')
    .setDescription('Configure bot')
    .addRoleOption(option =>
      option
        .setName('staffrole')
        .setDescription('Staff role')
    )
    .addChannelOption(option =>
      option
        .setName('logchannel')
        .setDescription('Log channel')
    ),

  // MODERATION
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason')
    ),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason')
    ),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Minutes')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason')
    ),

  // UTILITY
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear messages')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock channel'),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock channel'),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode')
    .addIntegerOption(option =>
      option
        .setName('seconds')
        .setDescription('Seconds')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Bot says message')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message')
        .setRequired(true)
    ),

  // TICKETS
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create ticket'),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close ticket')

];

// ================= REGISTER =================

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands('1497762509380255865'),
      { body: commands.map(c => c.toJSON()) }
    );

    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

// ================= READY =================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ================= AUTO MOD =================

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  // LINK BLOCKER
  if (message.content.includes('http')) {
    await message.delete().catch(() => {});
    return message.channel.send('🚫 Links are not allowed.');
  }

  // SPAM FILTER
  if (!message.member.spam) {
    message.member.spam = 0;
  }

  message.member.spam++;

  setTimeout(() => {
    message.member.spam--;
  }, 5000);

  if (message.member.spam > 5) {
    await message.member.timeout(60000).catch(() => {});
    return message.channel.send('🚫 Stop spamming.');
  }
});

// ================= JOIN / LEAVE =================

client.on('guildMemberAdd', member => {

  const ch = config[member.guild.id]?.logChannel;

  if (!ch) return;

  member.guild.channels.cache
    .get(ch)
    ?.send(`👋 Welcome ${member.user.tag}`);
});

client.on('guildMemberRemove', member => {

  const ch = config[member.guild.id]?.logChannel;

  if (!ch) return;

  member.guild.channels.cache
    .get(ch)
    ?.send(`👋 ${member.user.tag} left`);
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  const guildId = interaction.guild.id;

  if (!config[guildId]) {
    config[guildId] = {};
  }

  // ================= BUTTONS =================

  if (interaction.isButton()) {

    if (!activeSession) {
      return interaction.reply({
        content: '❌ No active session.',
        ephemeral: true
      });
    }

    // COPY CODE
    if (interaction.customId === 'copy_code') {

      return interaction.reply({
        content: `📋 Join Code: ${activeSession.code}`,
        ephemeral: true
      });
    }

    // SESSION PING
    if (interaction.customId === 'session_ping') {

      return interaction.reply({
        content: '@everyone 🚨 A new session is active!',
        allowedMentions: {
          parse: ['everyone']
        }
      });
    }

    // REFRESH
    if (interaction.customId === 'refresh_status') {

      return interaction.reply({
        content: '🔄 Server stats refreshed.',
        ephemeral: true
      });
    }

    // END SESSION
    if (interaction.customId === 'end_session') {

      if (!isStaff(interaction.member, guildId)) {
        return interaction.reply({
          content: '❌ Not staff.',
          ephemeral: true
        });
      }

      activeSession = null;

      return interaction.update({
        content: '🔴 Session Ended',
        embeds: [],
        components: []
      });
    }
  }

  // ================= SET API KEY =================

  if (interaction.commandName === 'setapikey') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ Admin only.',
        ephemeral: true
      });
    }

    const key = interaction.options.getString('key');

    config[guildId].erlcApiKey = key;

    saveAll();

    return interaction.reply({
      content: '✅ ERLC API key saved.',
      ephemeral: true
    });
  }

  // ================= CONFIG =================

  if (interaction.commandName === 'configure') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ Admin only.',
        ephemeral: true
      });
    }

    const role = interaction.options.getRole('staffrole');
    const channel = interaction.options.getChannel('logchannel');

    if (role) {
      config[guildId].staffRole = role.id;
    }

    if (channel) {
      config[guildId].logChannel = channel.id;
    }

    saveAll();

    return interaction.reply({
      content: '✅ Config saved.',
      ephemeral: true
    });
  }

  // ================= SESSION =================

  if (interaction.commandName === 'session') {

    const sub = interaction.options.getSubcommand();

    // START SESSION
    if (sub === 'start') {

      if (!isStaff(interaction.member, guildId)) {
        return interaction.reply({
          content: '❌ Not staff.',
          ephemeral: true
        });
      }

      const code = interaction.options.getString('code');

      activeSession = {
        host: interaction.user.username,
        code,
        startTime: Date.now()
      };

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🌐 Server Status')
        .setDescription(
          'Welcome to **TEST Roleplay!** We strive to host fun, realistic and most importantly engaging sessions.\nSessions may be limited based on staff availability.\nJoin us for an immersive roleplaying experience that you will never forget!'
        )
        .setImage('https://cdn.discordapp.com/attachments/1478916407474258010/1501437526655766610/file_00000000cf0871f691f5783b432912e2.webp')
        .addFields(
          {
            name: '👥 Players',
            value: '```0/40```',
            inline: false
          },
          {
            name: '📥 Queue',
            value: '```0```',
            inline: false
          },
          {
            name: '🛡️ Staff',
            value: '```1```',
            inline: false
          },
          {
            name: '📍 Server',
            value: 'TEST Roleplay | New | Fun',
            inline: false
          },
          {
            name: '🔑 Join Code',
            value: code,
            inline: true
          },
          {
            name: '✅ Verification',
            value: 'Disabled',
            inline: true
          }
        )
        .setFooter({
          text: `Updated at ${new Date().toLocaleTimeString()}`
        });

      const row = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
          .setCustomId('refresh_status')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('session_ping')
          .setLabel('Session Pings')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId('copy_code')
          .setLabel('Copy Code')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId('end_session')
          .setLabel('End')
          .setStyle(ButtonStyle.Danger)

      );

      return interaction.reply({
        content: '@everyone',
        embeds: [embed],
        components: [row],
        allowedMentions: {
          parse: ['everyone']
        }
      });
    }

    // END SESSION
    if (sub === 'end') {

      if (!isStaff(interaction.member, guildId)) {
        return interaction.reply({
          content: '❌ Not staff.',
          ephemeral: true
        });
      }

      activeSession = null;

      return interaction.reply({
        content: '🔴 Session ended.'
      });
    }
  }

  // ================= STAFF CHECK =================

  if (!isStaff(interaction.member, guildId)) {
    return interaction.reply({
      content: '❌ Not staff.',
      ephemeral: true
    });
  }

  // ================= COMMANDS =================

  try {

    await interaction.deferReply({
      ephemeral: true
    });

    const user = interaction.options.getUser('user');
    const reason =
      interaction.options.getString('reason') || 'No reason';

    // BAN
    if (interaction.commandName === 'ban') {

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.ban({ reason });

      return interaction.editReply(
        `🔨 Banned ${user.tag}`
      );
    }

    // KICK
    if (interaction.commandName === 'kick') {

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.kick(reason);

      return interaction.editReply(
        `👢 Kicked ${user.tag}`
      );
    }

    // TIMEOUT
    if (interaction.commandName === 'timeout') {

      const minutes =
        interaction.options.getInteger('minutes');

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.timeout(minutes * 60000);

      return interaction.editReply(
        `⏰ Timed out ${user.tag}`
      );
    }

    // WARN
    if (interaction.commandName === 'warn') {

      if (!db.warnings[user.id]) {
        db.warnings[user.id] = [];
      }

      db.warnings[user.id].push(reason);

      saveAll();

      return interaction.editReply(
        `⚠️ Warned ${user.tag}`
      );
    }

    // CLEAR
    if (interaction.commandName === 'clear') {

      const amount =
        interaction.options.getInteger('amount');

      await interaction.channel.bulkDelete(amount, true);

      return interaction.editReply(
        `🧹 Deleted ${amount} messages`
      );
    }

    // LOCK
    if (interaction.commandName === 'lock') {

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      return interaction.editReply('🔒 Channel locked');
    }

    // UNLOCK
    if (interaction.commandName === 'unlock') {

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: true
        }
      );

      return interaction.editReply('🔓 Channel unlocked');
    }

    // SLOWMODE
    if (interaction.commandName === 'slowmode') {

      const seconds =
        interaction.options.getInteger('seconds');

      await interaction.channel.setRateLimitPerUser(seconds);

      return interaction.editReply(
        `🐢 Slowmode set to ${seconds}s`
      );
    }

    // SAY
    if (interaction.commandName === 'say') {

      const msg =
        interaction.options.getString('message');

      await interaction.channel.send(msg);

      return interaction.editReply('✅ Sent');
    }

    // TICKET
    if (interaction.commandName === 'ticket') {

      const ch = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel']
          },
          {
            id: interaction.user.id,
            allow: ['ViewChannel', 'SendMessages']
          }
        ]
      });

      return interaction.editReply(
        `🎟️ Ticket created: ${ch}`
      );
    }

    // CLOSE
    if (interaction.commandName === 'close') {

      await interaction.channel.delete();
    }

  } catch (err) {

    console.error(err);

    if (interaction.deferred) {

      interaction.editReply(
        '❌ Error. Check bot permissions.'
      );
    }
  }
});

client.login(process.env.TOKEN);
