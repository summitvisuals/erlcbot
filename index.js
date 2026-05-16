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

// ================= CHAT COMMANDS =================

if (!interaction.isChatInputCommand()) return;

try {

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

------------------------------------------------

**Internal Affairs Support**  
Reporting Staff & Inquiries

------------------------------------------------

**Management Support**  
Management Inquiries, HR reports, Partnerships & Claiming store items.

------------------------------------------------

⚠️ If you make a fake or troll ticket you will face moderation.
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

    await interaction.channel.send(msg);

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
        .addFields(
          {
            name: '🔑 Join Code',
            value: `\`${code}\``
          }
        )
        .setFooter({
          text: 'Sydney City Roleplay'
        })
        .setTimestamp();

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
      )
      .setFooter({
        text: 'Sydney City Roleplay'
      })
      .setTimestamp();

    await interaction.channel.send({
      embeds: [embed]
    });

    return interaction.reply({
      content: `✅ Promotion logged for ${user.tag}`,
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
      .setDescription(`
The high-ranking team at Sydney City Roleplay is sad to announce the infraction of ${user}.

Below you can find some more relevant information on this infraction.
`)
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
      )
      .setFooter({
        text: 'Sydney City Roleplay'
      })
      .setTimestamp();

    await interaction.channel.send({
      embeds: [embed]
    });

    return interaction.reply({
      content: `✅ Infraction issued to ${user.tag}`,
      ephemeral: true
    });
  }

  // ================= CLEAR =================

  if (interaction.commandName === 'clear') {

    const amount =
      interaction.options.getInteger('amount');

    await interaction.channel.bulkDelete(amount, true);

    return interaction.reply({
      content: `🧹 Deleted ${amount} messages`,
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
      content: '🚨 Server lockdown enabled.'
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
      content: '✅ Server lockdown removed.'
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

  // ================= CLOSE =================

  if (interaction.commandName === 'close') {

    await interaction.reply({
      content: '🔒 Closing ticket...'
    });

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);
  }

} catch (err) {

  console.error(err);

  if (!interaction.replied) {

    interaction.reply({
      content: '❌ An error occurred.',
      ephemeral: true
    });
  }
}
// ================= LOGIN =================

client.login(process.env.TOKEN);
