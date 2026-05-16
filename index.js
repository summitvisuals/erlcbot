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
  StringSelectMenuBuilder,
  PermissionsBitField,
  ChannelType
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

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Send support panel'),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Bot says message')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('configure')
    .setDescription('Configure bot')
    .addRoleOption(option =>
      option
        .setName('staffrole')
        .setDescription('Staff role')
    )
    .addRoleOption(option =>
      option
        .setName('ownerrole')
        .setDescription('Owner role')
    )
    .addRoleOption(option =>
      option
        .setName('ticketrole')
        .setDescription('Ticket support role')
    )
];

// ================= REGISTER =================

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {

  try {

    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands('1505056547766534165'),
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

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

  if (!interaction.guild) return;

  const guildId = interaction.guild.id;

  if (!config[guildId]) {
    config[guildId] = {};
  }

  // ================= DROPDOWN MENU =================

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === 'ticket_select') {

      const type = interaction.values[0];

      const existing = interaction.guild.channels.cache.find(
        c => c.name === `${type}-${interaction.user.username.toLowerCase()}`
      );

      if (existing) {
        return interaction.reply({
          content: `❌ You already have a ticket: ${existing}`,
          ephemeral: true
        });
      }

      let ticketName = type;

      if (type === 'internal-affairs') {
        ticketName = 'ia-ticket';
      }

      if (type === 'management') {
        ticketName = 'management-ticket';
      }

      if (type === 'owner') {
        ticketName = 'owner-ticket';
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `${ticketName}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          },
          {
            id: config[guildId].ticketRole || interaction.guild.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor('#3b82f6')
        .setTitle('🎫 Sydney City Roleplay Support')
        .setDescription(`
Welcome ${interaction.user}

Your support ticket has been opened.

Please explain your issue and a staff member will assist you shortly.
`)
        .setFooter({
          text: 'Sydney City Roleplay'
        })
        .setTimestamp();

      await ticketChannel.send({
        content: config[guildId].ticketRole
          ? `<@&${config[guildId].ticketRole}>`
          : '@here',
        embeds: [embed]
      });

      return interaction.reply({
        content: `✅ Ticket created: ${ticketChannel}`,
        ephemeral: true
      });
    }
  }

  // ================= CHAT COMMANDS =================

  if (!interaction.isChatInputCommand()) return;

  // ================= CONFIGURE =================

  if (interaction.commandName === 'configure') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ Admin only.',
        ephemeral: true
      });
    }

    const staffRole = interaction.options.getRole('staffrole');
    const ownerRole = interaction.options.getRole('ownerrole');
    const ticketRole = interaction.options.getRole('ticketrole');

    if (staffRole) config[guildId].staffRole = staffRole.id;
    if (ownerRole) config[guildId].ownerRole = ownerRole.id;
    if (ticketRole) config[guildId].ticketRole = ticketRole.id;

    saveAll();

    return interaction.reply({
      content: '✅ Configuration saved.',
      ephemeral: true
    });
  }

  // ================= PANEL =================

  if (interaction.commandName === 'panel') {

    if (
      !config[guildId]?.ownerRole ||
      !interaction.member.roles.cache.has(config[guildId].ownerRole)
    ) {
      return interaction.reply({
        content: '❌ Owner role only.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle('🎫 Sydney City Roleplay Support')
      .setDescription(`
G'day! do you need support? Well, look no more, here it is.

**General Support**  
General Inquiries, Questions & Reporting Members

-----------------------------------------------------------------------------------

**Internal Affairs Support**  
Reporting Staff & Inquiries

-----------------------------------------------------------------------------------

**Management Support**  
Management Inquiries, HR reports, Partnerships & Claiming store items.

-----------------------------------------------------------------------------------

⚠️ If you make a fake or troll ticket you will face moderation.

Our bot for tickets is TicketsV2. If you come across a problem with the ticket system, ping @O | CosmicDrifter.

-----------------------------------------------------------------------------------
`)
      .setFooter({
        text: 'Sydney City Roleplay'
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Select a support department')
        .addOptions([
          {
            label: 'General Support',
            description: 'General help and questions',
            value: 'general'
          },
          {
            label: 'Internal Affairs',
            description: 'Report staff or IA inquiries',
            value: 'internal-affairs'
          },
          {
            label: 'Management Support',
            description: 'Management and HR support',
            value: 'management'
          },
          {
            label: 'Owner Support',
            description: 'Direct owner assistance',
            value: 'owner'
          }
        ])
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  // ================= SAY =================

  if (interaction.commandName === 'say') {

    if (!isStaff(interaction.member, guildId)) {
      return interaction.reply({
        content: '❌ Not staff.',
        ephemeral: true
      });
    }

    const msg = interaction.options.getString('message');

    await interaction.channel.send({
      content: msg
    });

    return interaction.reply({
      content: '✅ Message sent.',
      ephemeral: true
    });
  }

});

// ================= LOGIN =================

client.login(process.env.TOKEN);
