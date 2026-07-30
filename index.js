const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');
const http = require('http');

// --- ⚠️ CONFIGURATION ⚠️ ---
const GUILD_ID = '1371775026264670228'; // Server ID
const HELPER_ROLE_ID = 'YOUR_HELPER_ROLE_ID'; // Replace with your @Ultra Helper Role ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// --- IN-MEMORY DATA STORES ---
const activeTickets = new Map();
const helperPoints = new Map();
const guildSettings = new Map();

// Helper to parse button style strings
function parseButtonStyle(styleStr) {
  switch ((styleStr || '').toLowerCase()) {
    case 'green': return ButtonStyle.Success;
    case 'red': return ButtonStyle.Danger;
    case 'blue': return ButtonStyle.Primary;
    case 'grey':
    case 'gray': default: return ButtonStyle.Secondary;
  }
}

// Helper to update control panel embed
async function updateTicketEmbed(channel, ticketData) {
  try {
    const pinnedMessages = await channel.messages.fetchPinned();
    const panelMsg = pinnedMessages.first();
    if (!panelMsg || !panelMsg.embeds.length) return;

    const helpersList = ticketData.helpers.length > 0
      ? ticketData.helpers.map(id => `<@${id}>`).join('\n')
      : 'None yet';

    const oldEmbed = panelMsg.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed).setFields(
      { name: 'Requester:', value: `<@${ticketData.requesterId}>`, inline: true },
      { name: 'IGN:', value: `\`${ticketData.ign}\``, inline: true },
      { name: 'Server:', value: `\`${ticketData.server}\``, inline: true },
      { name: 'Bosses', value: ticketData.description },
      { name: 'Description', value: `Map/Room: \`${ticketData.room}\`` },
      { name: `👥 Helpers (${ticketData.helpers.length}/6)`, value: helpersList }
    );

    await panelMsg.edit({ embeds: [newEmbed] });
  } catch (err) {
    console.error('Failed to update ticket embed:', err);
  }
}

// --- SLASH COMMANDS REGISTRATION ---
const commands = [
  new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Post the interactive ticket setup panel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post the panel in').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Embed description (use \\n for line breaks)').setRequired(true))
    .addStringOption(opt => opt.setName('btn1_label').setDescription('Button 1 Label').setRequired(true))
    .addStringOption(opt => opt.setName('btn1_emoji').setDescription('Button 1 Emoji (optional)').setRequired(false))
    .addStringOption(opt => opt.setName('btn1_style').setDescription('Button 1 Style: Green, Red, Blue, Grey').setRequired(false))
    .addStringOption(opt => opt.setName('btn2_label').setDescription('Button 2 Label (optional)').setRequired(false))
    .addStringOption(opt => opt.setName('btn2_emoji').setDescription('Button 2 Emoji (optional)').setRequired(false))
    .addStringOption(opt => opt.setName('btn2_style').setDescription('Button 2 Style (optional)').setRequired(false))
    .addChannelOption(opt => opt.setName('category').setDescription('Category channel to place new tickets in').setRequired(false)),

  new SlashCommandBuilder()
    .setName('helpers-leaderboard')
    .setDescription('View top ticket helpers and points')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log('Registering Guild Slash Commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('Slash Commands registered successfully!');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

// --- BOT READY EVENT ---
client.once(Events.ClientReady, async () => {
  console.log(`LoggedIn as ${client.user.tag}`);
  await registerCommands();
});

// --- INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  // 1. TICKET PANEL BUTTON CLICK -> SHOW MODAL FORM
  if (interaction.isButton() && interaction.customId.startsWith('tselect_')) {
    const categoryName = interaction.customId.replace('tselect_', '').replace(/_/g, ' ');

    const modal = new ModalBuilder()
      .setCustomId(`ticket_form_${interaction.customId.replace('tselect_', '')}`)
      .setTitle(`Setup Ticket: ${categoryName}`);

    const ignInput = new TextInputBuilder()
      .setCustomId('ign')
      .setLabel('AQW IGN')
      .setPlaceholder('Enter your in-game name...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const serverInput = new TextInputBuilder()
      .setCustomId('server')
      .setLabel('Server')
      .setPlaceholder('e.g., Artix, Safiria, Twilly')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const roomInput = new TextInputBuilder()
      .setCustomId('room')
      .setLabel('Map & Room Number')
      .setPlaceholder('e.g., /join ultraezrajal-9999')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Bosses / Help Details')
      .setPlaceholder('List bosses or details on what you need help with...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ignInput),
      new ActionRowBuilder().addComponents(serverInput),
      new ActionRowBuilder().addComponents(roomInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    return await interaction.showModal(modal);
  }

  // 2. MODAL SUBMIT -> CREATE TICKET CHANNEL & ACTION PANEL
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
    await interaction.deferReply({ ephemeral: true });

    const ticketType = interaction.customId.replace('ticket_form_', '').replace(/_/g, ' ');
    const ign = interaction.fields.getTextInputValue('ign');
    const serverName = interaction.fields.getTextInputValue('server');
    const room = interaction.fields.getTextInputValue('room');
    const description = interaction.fields.getTextInputValue('description');

    const cfg = guildSettings.get(interaction.guild.id) || {};
    const chName = `ticket-${ticketType}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

    const ticketChannel = await interaction.guild.channels.create({
      name: chName,
      type: ChannelType.GuildText,
      parent: cfg.ticketCategory || null,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    // Save active ticket session
    activeTickets.set(ticketChannel.id, {
      requesterId: interaction.user.id,
      type: ticketType,
      ign,
      server: serverName,
      room,
      description,
      helpers: []
    });

    const embed = new EmbedBuilder()
      .setTitle(`Ticket - ${ticketType}`)
      .addFields(
        { name: 'Requester:', value: `${interaction.user}`, inline: true },
        { name: 'IGN:', value: `\`${ign}\``, inline: true },
        { name: 'Server:', value: `\`${serverName}\``, inline: true },
        { name: 'Bosses', value: description },
        { name: 'Description', value: `Map/Room: \`${room}\`` },
        { name: '👥 Helpers (0/6)', value: 'None yet' }
      )
      .setColor('#3b82f6')
      .setTimestamp();

    // Control buttons row matching your layout
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_showroom').setLabel('Show Room').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
      new ButtonBuilder().setCustomId('btn_info').setLabel('!').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_claim').setLabel('Claim & Join').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('btn_leave').setLabel('Leave Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
      new ButtonBuilder().setCustomId('btn_pinghelpers').setLabel('Ping Helpers').setStyle(ButtonStyle.Secondary).setEmoji('📢')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
      new ButtonBuilder().setCustomId('btn_complete').setLabel('Complete Ticket').setStyle(ButtonStyle.Primary).setEmoji('✅')
    );

    const helperRolePing = HELPER_ROLE_ID !== 'YOUR_HELPER_ROLE_ID' ? `<@&${HELPER_ROLE_ID}>` : '@Helper';
    const mainMsg = await ticketChannel.send({ content: `${helperRolePing}`, embeds: [embed], components: [row1, row2] });
    await mainMsg.pin().catch(() => {});

    await ticketChannel.send({
      content: `📌 **${interaction.user}** - After this ticket is over, please send a screenshot of helpers or mention their names so they can be rewarded!`
    });

    return interaction.editReply(`Ticket created: ${ticketChannel}`);
  }

  // 3. TICKET ACTION BUTTONS HANDLER
  if (interaction.isButton()) {
    const ticketData = activeTickets.get(interaction.channel.id);
    const customId = interaction.customId;

    if (customId === 'btn_showroom') {
      if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });
      return interaction.reply({
        content: `📍 **Room Details:**\n**Server:** \`${ticketData.server}\`\n**Map/Room:** \`${ticketData.room}\``,
        ephemeral: true
      });
    }

    if (customId === 'btn_info') {
      if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });
      return interaction.reply({
        content: `ℹ️ **IGN:** \`${ticketData.ign}\`\n**Details:** ${ticketData.description}`,
        ephemeral: true
      });
    }

    if (customId === 'btn_claim') {
      if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });

      if (ticketData.helpers.includes(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ You are already listed as a helper!', ephemeral: true });
      }

      if (ticketData.helpers.length >= 6) {
        return interaction.reply({ content: '⚠️ Helper spots are full (6/6)!', ephemeral: true });
      }

      ticketData.helpers.push(interaction.user.id);
      activeTickets.set(interaction.channel.id, ticketData);

      const spotsLeft = 6 - ticketData.helpers.length;
      await interaction.reply({ content: `✅ **${interaction.user}** claimed this ticket! **${spotsLeft}** spot(s) left!` });

      return updateTicketEmbed(interaction.channel, ticketData);
    }

    if (customId === 'btn_leave') {
      if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });

      if (!ticketData.helpers.includes(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ You are not listed as a helper.', ephemeral: true });
      }

      ticketData.helpers = ticketData.helpers.filter(id => id !== interaction.user.id);
      activeTickets.set(interaction.channel.id, ticketData);

      await interaction.reply({ content: `🚪 **${interaction.user}** left the helper list.` });
      return updateTicketEmbed(interaction.channel, ticketData);
    }

    if (customId === 'btn_pinghelpers') {
      const helperRolePing = HELPER_ROLE_ID !== 'YOUR_HELPER_ROLE_ID' ? `<@&${HELPER_ROLE_ID}>` : '@Helper';
      return interaction.reply({ content: `📢 ${helperRolePing} — Assistance requested in this ticket!` });
    }

    if (customId === 'btn_cancel') {
      if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: '❌ Only the requester or staff can cancel this ticket.', ephemeral: true });
      }

      await interaction.reply('❌ Ticket cancelled. Deleting channel in 3 seconds...');
      activeTickets.delete(interaction.channel.id);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      return;
    }

    if (customId === 'btn_complete') {
      await interaction.deferReply();

      // Disable chat permissions for channel
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      if (ticketData) {
        await interaction.channel.permissionOverwrites.edit(ticketData.requesterId, { SendMessages: false });
      }

      // Reward points to active helpers
      let awardedText = '';
      if (ticketData && ticketData.helpers.length > 0) {
        ticketData.helpers.forEach(hId => {
          const cur = helperPoints.get(hId) || 0;
          helperPoints.set(hId, cur + 1);
        });
        const helperMentions = ticketData.helpers.map(id => `<@${id}>`).join(', ');
        awardedText = `\n\n🏆 **+1 Helper Point** awarded to: ${helperMentions}`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Completed')
        .setDescription(`This ticket has been marked as complete! Chat is now disabled.${awardedText}`)
        .setColor('#2ecc71')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      activeTickets.delete(interaction.channel.id);
      return;
    }
  }

  // 4. SLASH COMMAND EXECUTION
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === 'ticket-setup') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const title = options.getString('title');
    const desc = options.getString('description').replace(/\\n/g, '\n');
    const category = options.getChannel('category');

    if (category) {
      const cfg = guildSettings.get(interaction.guild.id) || {};
      cfg.ticketCategory = category.id;
      guildSettings.set(interaction.guild.id, cfg);
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor('#2b2d31')
      .setFooter({ text: 'Fill out the form after clicking a button to open a ticket.' });

    const row = new ActionRowBuilder();

    const b1Label = options.getString('btn1_label');
    const b1Emoji = options.getString('btn1_emoji');
    const b1Style = options.getString('btn1_style');
    const btn1 = new ButtonBuilder()
      .setCustomId(`tselect_${b1Label.toLowerCase().replace(/\s+/g, '_')}`)
      .setLabel(b1Label)
      .setStyle(parseButtonStyle(b1Style));
    if (b1Emoji) btn1.setEmoji(b1Emoji);
    row.addComponents(btn1);

    const b2Label = options.getString('btn2_label');
    if (b2Label) {
      const b2Emoji = options.getString('btn2_emoji');
      const b2Style = options.getString('btn2_style');
      const btn2 = new ButtonBuilder()
        .setCustomId(`tselect_${b2Label.toLowerCase().replace(/\s+/g, '_')}`)
        .setLabel(b2Label)
        .setStyle(parseButtonStyle(b2Style));
      if (b2Emoji) btn2.setEmoji(b2Emoji);
      row.addComponents(btn2);
    }

    await channel.send({ embeds: [embed], components: [row] });
    return interaction.editReply('✅ Ticket panel posted!');
  }

  if (commandName === 'helpers-leaderboard') {
    if (helperPoints.size === 0) {
      return interaction.reply({ content: '📊 No helper points recorded yet!', ephemeral: true });
    }

    const sorted = [...helperPoints.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const leaderboardStr = sorted.map(([id, pts], index) => `**${index + 1}.** <@${id}> — **${pts}** pts`).join('\n');

    const lbEmbed = new EmbedBuilder()
      .setTitle('🏆 Top Ticket Helpers')
      .setDescription(leaderboardStr)
      .setColor('#f1c40f')
      .setTimestamp();

    return interaction.reply({ embeds: [lbEmbed] });
  }
});

// --- LOGIN ---
client.login(process.env.DISCORD_TOKEN);

// --- HTTP SERVER FOR KEEP-ALIVE ---
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
