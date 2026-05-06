const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let activeSession = null;

const commands = [
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage sessions')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start session')
        .addStringOption(opt =>
          opt.setName('code').setDescription('Server code').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End session')
    )
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands('YOUR_CLIENT_ID'),
    { body: commands }
  );
})();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'session') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (activeSession) {
        return interaction.reply({ content: 'Session already active.', ephemeral: true });
      }

      const code = interaction.options.getString('code');
      activeSession = {
        host: interaction.user.username,
        code,
        startTime: Date.now()
      };

      const embed = new EmbedBuilder()
        .setTitle('🟢 Session Started')
        .setColor('Blue')
        .addFields(
          { name: 'Host', value: activeSession.host, inline: true },
          { name: 'Code', value: code, inline: true }
        );

      await interaction.reply({ content: '@Session Ping', embeds: [embed] });
    }

    if (sub === 'end') {
      if (!activeSession) {
        return interaction.reply({ content: 'No active session.', ephemeral: true });
      }

      const duration = Math.floor((Date.now() - activeSession.startTime) / 60000);

      const embed = new EmbedBuilder()
        .setTitle('🔴 Session Ended')
        .setColor('Red')
        .addFields(
          { name: 'Host', value: activeSession.host, inline: true },
          { name: 'Duration', value: `${duration} min`, inline: true }
        );

      activeSession = null;

      await interaction.reply({ embeds: [embed] });
    }
  }
});

client.login(process.env.TOKEN);
