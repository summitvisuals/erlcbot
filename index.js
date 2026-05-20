const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder
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

// ================= FILES =================

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
    .setName('configure')
    .setDescription('Configure bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option.setName('staffrole').setDescription('Staff role')
    )
    .addRoleOption(option =>
      option.setName('ownerrole').setDescription('Owner role')
    )
    .addRoleOption(option =>
      option.setName('ticketrole').setDescription('Ticket role')
    )
    .addChannelOption(option =>
      option.setName('logchannel').setDescription('Ticket log channel')
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

  new SlashCommandBuilder()
    .setName('promotion')
    .setDescription('Promote staff member')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('rank')
        .setDescription('New rank')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('infraction')
    .setDescription('Issue staff infraction')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('punishment')
        .setDescription('Punishment')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason')
        .setRequired(true)
    ),

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
    .setName('lockdown')
    .setDescription('Lock all channels'),

  new SlashCommandBuilder()
    .setName('unlockdown')
    .setDescription('Unlock all channels'),

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
    .setName('close')
    .setDescription('Close ticket'),

  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim ticket'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add user to ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove user from ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )

];

// ================= REGISTER =================

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {

  try {

    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
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

// ================= PING RESPONSE =================

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  if (message.content.toLowerCase() === 'ping') {
    message.reply('Pong!');
  }

});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

  if (!interaction.guild) return;

  const guildId = interaction.guild.id;

  if (!config[guildId]) {
    config[guildId] = {};
  }

  try {

    // ================= SELECT MENU =================

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

        const ticketChannel = await interaction.guild.channels.create({
          name: `${type}-${interaction.user.username}`,
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

Please explain your issue and staff will assist you shortly.
`)
          .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Claim Ticket')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
          content: config[guildId].ticketRole
            ? `<@&${config[guildId].ticketRole}>`
            : '@here',
          embeds: [embed],
          components: [buttons],
          allowedMentions: {
            parse: ['roles']
          }
        });

        return interaction.reply({
          content: `✅ Ticket created: ${ticketChannel}`,
          ephemeral: true
        });
      }
    }

    // ================= BUTTONS =================

    if (interaction.isButton()) {

      // CLAIM BUTTON

      if (interaction.customId === 'claim_ticket') {

        return interaction.reply({
          content: `📌 Ticket claimed by ${interaction.user}`
        });

      }

      // CLOSE BUTTON

      if (interaction.customId === 'close_ticket') {

        await interaction.reply({
          content: '🔒 Closing ticket in 5 seconds...'
        });

        const messages = await interaction.channel.messages.fetch({
          limit: 100
        });

        const transcript = messages
          .reverse()
          .map(m => `${m.author.tag}: ${m.content}`)
          .join('\n');

        const fileName = `transcript-${interaction.channel.id}.txt`;

        fs.writeFileSync(fileName, transcript);

        if (config[guildId]?.logChannel) {

          const logChannel =
            interaction.guild.channels.cache.get(
              config[guildId].logChannel
            );

          if (logChannel) {

            const logEmbed = new EmbedBuilder()
              .setColor('#3b82f6')
              .setTitle('🎫 Ticket Closed')
              .addFields(
                {
                  name: 'Ticket',
                  value: interaction.channel.name
                },
                {
                  name: 'Closed By',
                  value: interaction.user.tag
                }
              )
              .setTimestamp();

            await logChannel.send({
              embeds: [logEmbed],
              files: [new AttachmentBuilder(fileName)]
            });
          }
        }

        await interaction.channel.send({
          content: '⭐ Please rate your support experience from 1-5.'
        });

        setTimeout(async () => {

          await interaction.channel.delete().catch(() => {});

          if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
          }

        }, 5000);
      }
    }

    // ================= CHAT COMMANDS =================

    if (!interaction.isChatInputCommand()) return;

    // ================= CONFIGURE =================

    if (interaction.commandName === 'configure') {

      const staffRole = interaction.options.getRole('staffrole');
      const ownerRole = interaction.options.getRole('ownerrole');
      const ticketRole = interaction.options.getRole('ticketrole');
      const logChannel = interaction.options.getChannel('logchannel');

      if (staffRole) config[guildId].staffRole = staffRole.id;
      if (ownerRole) config[guildId].ownerRole = ownerRole.id;
      if (ticketRole) config[guildId].ticketRole = ticketRole.id;
      if (logChannel) config[guildId].logChannel = logChannel.id;

      saveAll();

      return interaction.reply({
        content: '✅ Configuration saved.',
        ephemeral: true
      });
    }

    // ================= PANEL =================

    if (interaction.commandName === 'panel') {

      const embed = new EmbedBuilder()
        .setColor('#3b82f6')
        .setTitle('🎫 Sydney City Roleplay Support')
        .setDescription(`
Choose a department below to open a support ticket.
`)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_select')
          .setPlaceholder('Select support team')
          .addOptions([
            {
              label: 'General Support',
              value: 'general'
            },
            {
              label: 'Internal Affairs',
              value: 'internal-affairs'
            },
            {
              label: 'Management Support',
              value: 'management'
            },
            {
              label: 'Owner Support',
              value: 'owner'
            }
          ])
      );

      return interaction.reply({
        embeds: [embed],
        components: [row]
      });
    }

    // ================= STAFF CHECK =================

    if (!isStaff(interaction.member, guildId)) {

      return interaction.reply({
        content: '❌ Not staff.',
        ephemeral: true
      });

    }

    // ================= SAY =================

    if (interaction.commandName === 'say') {

      const msg = interaction.options.getString('message');

      await interaction.channel.send({
        content: msg
      });

      return interaction.reply({
        content: '✅ Message sent.',
        ephemeral: true
      });
    }

    // ================= SESSION =================

    if (interaction.commandName === 'session') {

      const sub = interaction.options.getSubcommand();

      if (sub === 'start') {

        const code = interaction.options.getString('code');

        activeSession = {
          host: interaction.user.username,
          code
        };

        const embed = new EmbedBuilder()
          .setColor('#3b82f6')
          .setTitle('🚓 Sydney City Roleplay Session')
          .setDescription(`Hosted by ${interaction.user}`)
          .addFields({
            name: 'Join Code',
            value: `\`${code}\``
          });

        return interaction.reply({
          content: '@everyone',
          embeds: [embed],
          allowedMentions: {
            parse: ['everyone']
          }
        });
      }

      if (sub === 'end') {

        activeSession = null;

        return interaction.reply({
          content: '🔴 Session ended.'
        });
      }
    }

    // ================= BAN =================

    if (interaction.commandName === 'ban') {

      const user = interaction.options.getUser('user');
      const reason =
        interaction.options.getString('reason') || 'No reason';

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.ban({ reason });

      return interaction.reply({
        content: `🔨 Banned ${user.tag}`
      });
    }

    // ================= KICK =================

    if (interaction.commandName === 'kick') {

      const user = interaction.options.getUser('user');
      const reason =
        interaction.options.getString('reason') || 'No reason';

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.kick(reason);

      return interaction.reply({
        content: `👢 Kicked ${user.tag}`
      });
    }

    // ================= TIMEOUT =================

    if (interaction.commandName === 'timeout') {

      const user = interaction.options.getUser('user');
      const minutes =
        interaction.options.getInteger('minutes');

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.timeout(minutes * 60000);

      return interaction.reply({
        content: `⏰ Timed out ${user.tag}`
      });
    }

    // ================= WARN =================

    if (interaction.commandName === 'warn') {

      const user = interaction.options.getUser('user');
      const reason =
        interaction.options.getString('reason') || 'No reason';

      if (!db.warnings[user.id]) {
        db.warnings[user.id] = [];
      }

      db.warnings[user.id].push(reason);

      saveAll();

      return interaction.reply({
        content: `⚠️ Warned ${user.tag}`
      });
    }

    // ================= PROMOTION =================

    if (interaction.commandName === 'promotion') {

      const user = interaction.options.getUser('user');
      const rank = interaction.options.getString('rank');

      const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle('📈 Staff Promotion')
        .setDescription(`${user} has been promoted.`)
        .addFields(
          {
            name: 'New Rank',
            value: rank
          },
          {
            name: 'Promoted By',
            value: interaction.user.tag
          }
        );

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: `✅ Promotion logged.`,
        ephemeral: true
      });
    }

    // ================= INFRACTION =================

    if (interaction.commandName === 'infraction') {

      const user = interaction.options.getUser('user');
      const punishment =
        interaction.options.getString('punishment');
      const reason =
        interaction.options.getString('reason');

      const infractionID =
        Math.random().toString(36).substring(2, 12).toUpperCase();

      const embed = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('Staff Consequences & Discipline')
        .addFields(
          {
            name: 'Username',
            value: user.tag
          },
          {
            name: 'Punishment',
            value: punishment
          },
          {
            name: 'Reason',
            value: reason
          },
          {
            name: 'Infraction ID',
            value: infractionID
          }
        );

      await interaction.channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content: `✅ Infraction issued.`,
        ephemeral: true
      });
    }

    // ================= CLEAR =================

    if (interaction.commandName === 'clear') {

      const amount =
        interaction.options.getInteger('amount');

      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({
        content: `🧹 Deleted ${amount} messages`
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

      return interaction.reply({
        content: '🔒 Channel locked'
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

      return interaction.reply({
        content: '🔓 Channel unlocked'
      });
    }

    // ================= LOCKDOWN =================

    if (interaction.commandName === 'lockdown') {

      interaction.guild.channels.cache.forEach(async channel => {

        if (channel.type === ChannelType.GuildText) {

          await channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
              SendMessages: false
            }
          ).catch(() => {});
        }
      });

      return interaction.reply({
        content: '🚨 Lockdown enabled.'
      });
    }

    // ================= UNLOCKDOWN =================

    if (interaction.commandName === 'unlockdown') {

      interaction.guild.channels.cache.forEach(async channel => {

        if (channel.type === ChannelType.GuildText) {

          await channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
              SendMessages: true
            }
          ).catch(() => {});
        }
      });

      return interaction.reply({
        content: '✅ Lockdown removed.'
      });
    }

    // ================= SLOWMODE =================

    if (interaction.commandName === 'slowmode') {

      const seconds =
        interaction.options.getInteger('seconds');

      await interaction.channel.setRateLimitPerUser(seconds);

      return interaction.reply({
        content: `🐢 Slowmode set to ${seconds}s`
      });
    }

    // ================= CLAIM =================

    if (interaction.commandName === 'claim') {

      return interaction.reply({
        content: `📌 ${interaction.user} claimed this ticket.`
      });
    }

    // ================= ADD =================

    if (interaction.commandName === 'add') {

      const user = interaction.options.getUser('user');

      await interaction.channel.permissionOverwrites.edit(
        user.id,
        {
          ViewChannel: true,
          SendMessages: true
        }
      );

      return interaction.reply({
        content: `✅ Added ${user.tag} to the ticket.`
      });
    }

    // ================= REMOVE =================

    if (interaction.commandName === 'remove') {

      const user = interaction.options.getUser('user');

      await interaction.channel.permissionOverwrites.delete(user.id);

      return interaction.reply({
        content: `❌ Removed ${user.tag} from the ticket.`
      });
    }

    // ================= CLOSE =================

    if (interaction.commandName === 'close') {

      await interaction.reply({
        content: '🔒 Closing ticket in 5 seconds...'
      });

      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 5000);
    }

  } catch (err) {

    console.error(err);

    if (!interaction.replied) {

      interaction.reply({
        content: '❌ Error occurred.',
        ephemeral: true
      });

    }

  }

});

// ================= LOGIN =================

client.login(process.env.TOKEN);
