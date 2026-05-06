const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let activeSession = null;

// 📁 LOAD CONFIG
let config = {};
if (fs.existsSync('./config.json')) {
  config = JSON.parse(fs.readFileSync('./config.json'));
}

// 💾 SAVE CONFIG
function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

// 🔐 STAFF CHECK
function isStaff(member, guildId) {
  return config[guildId]?.staffRole && member.roles.cache.has(config[guildId].staffRole);
}

// 🧠 COMMANDS (FIXED)
const commands = [
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage ERLC sessions')
    .addSubcommand(s =>
      s.setName('start')
        .setDescription('Start a session')
        .addStringOption(o =>
          o.setName('code')
            .setDescription('Server code')
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName('end')
        .setDescription('End the session')
    ),

  new SlashCommandBuilder()
    .setName('configure')
    .setDescription('Configure the bot')
    .addRoleOption(o =>
      o.setName('staffrole')
        .setDescription('Set the staff role')
    )
    .addChannelOption(o =>
      o.setName('logchannel')
        .setDescription('Set the log channel')
    ),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User to ban')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason for ban')
    ),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User to kick')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason for kick')
    ),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User to timeout')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('minutes')
        .setDescription('Time in minutes')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('User to warn')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason for warning')
    )
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands('1497762509380255865'), // 🔥 REPLACE THIS
    { body: commands }
  );
})();

// ✅ READY
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 📊 LOG FUNCTION
async function sendLog(guild, embed) {
  const channelId = config[guild.id]?.logChannel;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (channel) channel.send({ embeds: [embed] });
}

// 🎮 HANDLER
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  const guildId = interaction.guild.id;

  if (!config[guildId]) config[guildId] = {};

  // 🔘 BUTTONS
  if (interaction.isButton()) {
    if (!activeSession) {
      return interaction.reply({ content: 'No active session.', ephemeral: true });
    }

    if (interaction.customId === 'copy_code') {
      return interaction.reply({
        content: `📋 Code: **${activeSession.code}**`,
        ephemeral: true
      });
    }

    if (interaction.customId === 'end_session') {
      if (!isStaff(interaction.member, guildId)) {
        return interaction.reply({ content: '❌ Not staff.', ephemeral: true });
      }

      const duration = Math.floor((Date.now() - activeSession.startTime) / 60000);

      const embed = new EmbedBuilder()
        .setTitle('🔴 Session Ended')
        .addFields(
          { name: 'Host', value: activeSession.host, inline: true },
          { name: 'Duration', value: `${duration} min`, inline: true }
        )
        .setColor('Red');

      activeSession = null;

      return interaction.update({ embeds: [embed], components: [] });
    }
  }

  // ⚙️ CONFIGURE
  if (interaction.commandName === 'configure') {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    }

    const role = interaction.options.getRole('staffrole');
    const channel = interaction.options.getChannel('logchannel');

    if (role) config[guildId].staffRole = role.id;
    if (channel) config[guildId].logChannel = channel.id;

    saveConfig();

    return interaction.reply({ content: '✅ Configuration saved.', ephemeral: true });
  }

  // 🟢 SESSION
  if (interaction.commandName === 'session') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!isStaff(interaction.member, guildId)) {
        return interaction.reply({ content: '❌ Not staff.', ephemeral: true });
      }

      if (activeSession) {
        return interaction.reply({ content: '⚠️ Session already active.', ephemeral: true });
      }

      const code = interaction.options.getString('code');

      activeSession = {
        host: interaction.user.username,
        code,
        startTime: Date.now()
      };

      const embed = new EmbedBuilder()
        .setTitle('🚨 SESSION STARTED')
        .setDescription('Join now!')
        .addFields(
          { name: 'Host', value: activeSession.host, inline: true },
          { name: 'Code', value: code, inline: true }
        )
        .setImage('https://cdn.discordapp.com/attachments/1478916407474258010/1501437526655766610/file_00000000cf0871f691f5783b432912e2.webp')
        .setColor(0x00BFFF);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('copy_code').setLabel('Copy Code').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('end_session').setLabel('End Session').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: '@everyone',
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: ['everyone'] }
      });
    }

    if (sub === 'end') {
      if (!isStaff(interaction.member, guildId)) return;

      if (!activeSession) {
        return interaction.reply({ content: '⚠️ No active session.', ephemeral: true });
      }

      const duration = Math.floor((Date.now() - activeSession.startTime) / 60000);

      const embed = new EmbedBuilder()
        .setTitle('🔴 Session Ended')
        .addFields(
          { name: 'Host', value: activeSession.host, inline: true },
          { name: 'Duration', value: `${duration} min`, inline: true }
        )
        .setColor('Red');

      activeSession = null;

      return interaction.reply({ embeds: [embed] });
    }
  }

  // 🔨 MOD COMMANDS
  if (!isStaff(interaction.member, guildId)) {
    return interaction.reply({ content: '❌ Not staff.', ephemeral: true });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason';

  if (interaction.commandName === 'ban') {
    const member = await interaction.guild.members.fetch(user.id);
    await member.ban({ reason });

    sendLog(interaction.guild,
      new EmbedBuilder()
        .setTitle('User Banned')
        .setDescription(`${user.tag}\nReason: ${reason}`)
        .setColor('Red')
    );

    return interaction.reply(`🔨 Banned ${user.tag}`);
  }

  if (interaction.commandName === 'kick') {
    const member = await interaction.guild.members.fetch(user.id);
    await member.kick(reason);

    sendLog(interaction.guild,
      new EmbedBuilder()
        .setTitle('User Kicked')
        .setDescription(`${user.tag}\nReason: ${reason}`)
        .setColor('Orange')
    );

    return interaction.reply(`🦶 Kicked ${user.tag}`);
  }

  if (interaction.commandName === 'timeout') {
    const minutes = interaction.options.getInteger('minutes');
    const member = await interaction.guild.members.fetch(user.id);

    await member.timeout(minutes * 60000);

    sendLog(interaction.guild,
      new EmbedBuilder()
        .setTitle('User Timed Out')
        .setDescription(`${user.tag} for ${minutes} minutes`)
        .setColor('Yellow')
    );

    return interaction.reply(`🔇 Timed out ${user.tag}`);
  }

  if (interaction.commandName === 'warn') {
    sendLog(interaction.guild,
      new EmbedBuilder()
        .setTitle('User Warned')
        .setDescription(`${user.tag}\nReason: ${reason}`)
        .setColor('Blue')
    );

    return interaction.reply(`⚠️ Warned ${user.tag}`);
  }
});

client.login(process.env.TOKEN);
