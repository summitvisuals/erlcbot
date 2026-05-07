const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
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

// ================= DATABASE =================

let config = fs.existsSync('./config.json')
  ? JSON.parse(fs.readFileSync('./config.json'))
  : {};

function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function isStaff(member, guildId) {
  return (
    config[guildId]?.staffRole &&
    member.roles.cache.has(config[guildId].staffRole)
  );
}

// ================= COMMANDS =================

const commands = [

  // CONFIG
  new SlashCommandBuilder()
    .setName('configure')
    .setDescription('Configure bot')
    .addRoleOption(option =>
      option
        .setName('staffrole')
        .setDescription('Staff role')
        .setRequired(true)
    ),

  // LOCK
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock current channel'),

  // UNLOCK
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock current channel'),

  // LOCKDOWN
  new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock all server channels'),

  // UNLOCKDOWN
  new SlashCommandBuilder()
    .setName('unlockdown')
    .setDescription('Unlock all server channels')

];

// ================= REGISTER COMMANDS =================

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {

  try {

    console.log('Registering commands...');

    await rest.put(
      Routes.applicationCommands('1497762509380255865'),
      {
        body: commands.map(cmd => cmd.toJSON())
      }
    );

    console.log('Commands registered.');

  } catch (err) {

    console.error(err);

  }

})();

// ================= READY =================

client.once('ready', () => {

  console.log(`✅ Logged in as ${client.user.tag}`);

});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild.id;

  if (!config[guildId]) {
    config[guildId] = {};
  }

  // ================= CONFIGURE =================

  if (interaction.commandName === 'configure') {

    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content: '❌ Admin only.',
        ephemeral: true
      });
    }

    const role = interaction.options.getRole('staffrole');

    config[guildId].staffRole = role.id;

    saveConfig();

    return interaction.reply({
      content: '✅ Staff role configured.',
      ephemeral: true
    });
  }

  // ================= STAFF CHECK =================

  if (!isStaff(interaction.member, guildId)) {

    return interaction.reply({
      content: '❌ Not staff.',
      ephemeral: true
    });

  }

  // ================= LOCK =================

  if (interaction.commandName === 'lock') {

    await interaction.channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: false
      }
    );

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🔒 Channel Locked')
      .setDescription(
        `This channel has been locked by ${interaction.user.tag}`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

  // ================= UNLOCK =================

  if (interaction.commandName === 'unlock') {

    await interaction.channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: true
      }
    );

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle('🔓 Channel Unlocked')
      .setDescription(
        `This channel has been unlocked by ${interaction.user.tag}`
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

  // ================= LOCKDOWN =================

  if (interaction.commandName === 'lockdown') {

    await interaction.deferReply();

    let locked = 0;

    for (const channel of interaction.guild.channels.cache.values()) {

      try {

        await channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: false
          }
        );

        locked++;

      } catch (err) {

        console.log(`Failed to lock ${channel.name}`);

      }
    }

    const embed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle('🚨 SERVER LOCKDOWN')
      .setDescription(
        'All server channels have been locked.'
      )
      .addFields(
        {
          name: 'Locked By',
          value: interaction.user.tag,
          inline: true
        },
        {
          name: 'Channels Locked',
          value: `${locked}`,
          inline: true
        }
      )
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed]
    });
  }

  // ================= UNLOCKDOWN =================

  if (interaction.commandName === 'unlockdown') {

    await interaction.deferReply();

    let unlocked = 0;

    for (const channel of interaction.guild.channels.cache.values()) {

      try {

        await channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: true
          }
        );

        unlocked++;

      } catch (err) {

        console.log(`Failed to unlock ${channel.name}`);

      }
    }

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle('✅ SERVER UNLOCKED')
      .setDescription(
        'All server channels have been unlocked.'
      )
      .addFields(
        {
          name: 'Unlocked By',
          value: interaction.user.tag,
          inline: true
        },
        {
          name: 'Channels Unlocked',
          value: `${unlocked}`,
          inline: true
        }
      )
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed]
    });
  }

});

// ================= LOGIN =================

client.login(process.env.TOKEN);
