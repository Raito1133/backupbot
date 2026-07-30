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
  SlashCommandBuilder,
  ChannelType
} = require('discord.js');
const http = require('http');

// --- ⚠️ CONFIGURATION ⚠️ ---
const GUILD_ID = '1371775026264670228'; // Server ID
const HELPER_ROLE_ID = '1529499021884919858'; // Replace with your @Ultra Helper Role ID

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
const roleRewards = new Map(); // Points -> RoleID mapping

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

// Helper to calculate points based on custom value or fallback category/type
function getPointsForTicket(ticketData) {
  if (ticketData.customPoints && ticketData.customPoints > 0) {
    return ticketData.customPoints;
  }
  const normalized = (ticketData.type || '').toLowerCase();
  if (normalized.includes('weekly') || normalized.includes('ultraweekly') || normalized.includes('ultra weeklies')) {
    return 10;
  }
  if (normalized.includes('daily') || normalized.includes('ultradaily') || normalized.includes('ultra dailies')) {
    return 5;
  }
  if (normalized.includes('farm') || normalized.includes('farming')) {
    return 3;
  }
  return 1; // Default
}

// Helper function to check & assign auto-roles when points are updated
async function checkAndAssignHelperRoles(guild, userId, currentPoints) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    for (const [requiredPts, roleId] of roleRewards.entries()) {
      if (currentPoints >= requiredPts) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(console.error);
        }
      }
    }
  } catch (err) {
    console.error('Failed to assign helper auto-role:', err);
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

    const maxLimit = ticketData.maxHelpers || 6;

    const oldEmbed = panelMsg.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed).setFields(
      { name: 'Requester:', value: `<@${ticketData.requesterId}>`, inline: true },
      { name: 'IGN:', value: `\`${ticketData.ign}\``, inline: true },
      { name: 'Server:', value: `\`${ticketData.server}\``, inline: true },
      { name: 'Bosses', value: ticketData.description },
      { name: 'Description', value: `Map/Room: \`${ticketData.room}\`` },
      { name: `👥 Helpers (${ticketData.helpers.length}/${maxLimit})`, value: helpersList }
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
    
    // Button 1 Options
    .addStringOption(opt => opt.setName('btn1_label').setDescription('Button 1 Label').setRequired(true))
    .addStringOption(opt => opt.setName('btn1_emoji').setDescription('Button 1 Emoji (optional)').setRequired(false))
    .addStringOption(opt => opt.setName('btn1_style').setDescription('Button 1 Style: Green, Red, Blue, Grey').setRequired(false))
    .addIntegerOption(opt => opt.setName('btn1_max').setDescription('Button 1 Helper Limit (1-6, Default: 6)').setMinValue(1).setMaxValue(6).setRequired(false))
    .addIntegerOption(opt => opt.setName('btn1_points').setDescription('Points to award for Button 1 (optional)').setMinValue(1).setRequired(false))

    // Button 2 Options
    .addStringOption(opt => opt.setName('btn2_label').setDescription('Button 2 Label (optional)').setRequired(false))
    .addStringOption(opt => opt.setName('btn2_emoji').setDescription('Button 2 Emoji (optional)').setRequired(false))
    .addStringOption(opt => opt.setName('btn2_style').setDescription('Button 2 Style (optional)').setRequired(false))
    .addIntegerOption(opt => opt.setName('btn2_max').setDescription('Button 2 Helper Limit (1-6, Default: 6)').setMinValue(1).setMaxValue(6).setRequired(false))
    .addIntegerOption(opt => opt.setName('btn2_points').setDescription('Points to award for Button 2 (optional)').setMinValue(1).setRequired(false))

    .addChannelOption(opt => opt.setName('category').setDescription('Category channel to place new tickets in').setRequired(false)),

  new SlashCommandBuilder()
    .setName('helpers-leaderboard')
    .setDescription('View top ticket helpers and points'),

  new SlashCommandBuilder()
    .setName('points')
    .setDescription('Manage helper points')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add points to a helper')
        .addUserOption(opt => opt.setName('user').setDescription('Helper to give points').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of points').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove points from a helper')
        .addUserOption(opt => opt.setName('user').setDescription('Helper to remove points from').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of points').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset helper points')
        .addUserOption(opt => opt.setName('user').setDescription('User to reset (leave blank to reset ALL helpers)').setRequired(false))
    ),

  new SlashCommandBuilder()
    .setName('helper-roles')
    .setDescription('Configure automatic role rewards for helper points')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Set a role reward for achieving a point milestone')
        .addIntegerOption(opt => opt.setName('points').setDescription('Points required').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to award').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View active point-to-role rewards')
    )
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

  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'AQW Helper Leaderboard',
      type: 5 // Competing in
    }]
  });

  await registerCommands();
});

// --- INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  try {
    // 1. TICKET PANEL BUTTON CLICK -> MODAL FORM
    if (interaction.isButton() && interaction.customId.startsWith('tselect_')) {
      const parts = interaction.customId.split('_');
      // Format: tselect_[category]_[maxHelpers]_[customPoints]
      const customPoints = parts[parts.length - 1];
      const maxHelpers = parts[parts.length - 2];
      const categoryName = parts.slice(1, -2).join(' ');

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form_${maxHelpers}_${customPoints}_${categoryName.replace(/\s+/g, '_')}`)
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
        .setLabel('Map & Room Number (Optional for random)')
        .setPlaceholder('Leave blank for random room (e.g., /join map-9482)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false); // Made optional for random room generation

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

    // 2. MODAL SUBMIT -> CREATE TICKET CHANNEL
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
      await interaction.deferReply({ ephemeral: true });

      const parts = interaction.customId.replace('ticket_form_', '').split('_');
      const maxHelpers = parseInt(parts[0]) || 6;
      const customPoints = parseInt(parts[1]) || 0;
      const ticketType = parts.slice(2).join(' ');

      const ign = interaction.fields.getTextInputValue('ign');
      const serverName = interaction.fields.getTextInputValue('server');
      let room = interaction.fields.getTextInputValue('room');
      const description = interaction.fields.getTextInputValue('description');

      // Random Room Number generator if user leaves room field empty
      if (!room || room.trim() === '') {
        const random4Digit = Math.floor(1000 + Math.random() * 9000);
        const mapClean = ticketType.toLowerCase().replace(/[^a-z0-9]/g, '') || 'room';
        room = `/join ${mapClean}-${random4Digit}`;
      }

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

      activeTickets.set(ticketChannel.id, {
        requesterId: interaction.user.id,
        type: ticketType,
        ign,
        server: serverName,
        room,
        description,
        maxHelpers,
        customPoints,
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
          { name: `👥 Helpers (0/${maxHelpers})`, value: 'None yet' }
        )
        .setColor('#3b82f6')
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_showroom').setLabel('View Location').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
        new ButtonBuilder().setCustomId('btn_info').setLabel('!').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_claim').setLabel('Accept Request').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId('btn_leave').setLabel('Step Down').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
        new ButtonBuilder().setCustomId('btn_pinghelpers').setLabel('Call Squad').setStyle(ButtonStyle.Secondary).setEmoji('📢')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_cancel').setLabel('Close Request').setStyle(ButtonStyle.Danger).setEmoji('❌'),
        new ButtonBuilder().setCustomId('btn_complete').setLabel('Finish & Pay Out').setStyle(ButtonStyle.Primary).setEmoji('✅')
      );

      const helperRolePing = HELPER_ROLE_ID !== 'YOUR_HELPER_ROLE_ID' ? `<@&${HELPER_ROLE_ID}>` : '@Helper';
      
      const mainMsg = await ticketChannel.send({ 
        content: `Hey ${interaction.user}! ${helperRolePing}`, 
        embeds: [embed], 
        components: [row1, row2] 
      });
      await mainMsg.pin().catch(() => {});

      await ticketChannel.send({
        content: `📌 **${interaction.user}** - Once finished, click **Finish & Pay Out** to resolve this ticket and automatically award helper points!`
      });

      return await interaction.editReply(`Ticket created: ${ticketChannel}`);
    }

    // 3. TICKET ACTION BUTTONS HANDLER
    if (interaction.isButton()) {
      const ticketData = activeTickets.get(interaction.channel.id);
      const customId = interaction.customId;

      if (customId === 'btn_showroom' || customId === 'btn_info') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });

        const isRequester = interaction.user.id === ticketData.requesterId;
        const isHelper = ticketData.helpers.includes(interaction.user.id);
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        if (!isRequester && !isHelper && !isAdmin) {
          return interaction.reply({
            content: '🔒 **Access Denied:** You must click **Accept Request** first to view the room and player details.',
            ephemeral: true
          });
        }

        if (customId === 'btn_showroom') {
          return interaction.reply({
            content: `📍 **Room Details:**\n**Server:** \`${ticketData.server}\`\n**Map/Room:** \`${ticketData.room}\``,
            ephemeral: true
          });
        }

        if (customId === 'btn_info') {
          return interaction.reply({
            content: `ℹ️ **IGN:** \`${ticketData.ign}\`\n**Details:** ${ticketData.description}`,
            ephemeral: true
          });
        }
      }

      if (customId === 'btn_claim') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });

        if (ticketData.helpers.includes(interaction.user.id)) {
          return interaction.reply({ content: '⚠️ You have already accepted this request!', ephemeral: true });
        }

        const maxAllowed = ticketData.maxHelpers || 6;
        if (ticketData.helpers.length >= maxAllowed) {
          return interaction.reply({ content: `⚠️ Helper spots are full (${maxAllowed}/${maxAllowed})!`, ephemeral: true });
        }

        ticketData.helpers.push(interaction.user.id);
        activeTickets.set(interaction.channel.id, ticketData);

        const spotsLeft = maxAllowed - ticketData.helpers.length;
        await interaction.reply({ content: `✅ **${interaction.user}** accepted the request! **${spotsLeft}** spot(s) remaining. You can now use **View Location**!` });

        return updateTicketEmbed(interaction.channel, ticketData);
      }

      if (customId === 'btn_leave') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket details not found.', ephemeral: true });

        if (!ticketData.helpers.includes(interaction.user.id)) {
          return interaction.reply({ content: '⚠️ You are not listed as a helper.', ephemeral: true });
        }

        ticketData.helpers = ticketData.helpers.filter(id => id !== interaction.user.id);
        activeTickets.set(interaction.channel.id, ticketData);

        await interaction.reply({ content: `🚪 **${interaction.user}** stepped down from this ticket.` });
        return updateTicketEmbed(interaction.channel, ticketData);
      }

      if (customId === 'btn_pinghelpers') {
        const helperRolePing = HELPER_ROLE_ID !== 'YOUR_HELPER_ROLE_ID' ? `<@&${HELPER_ROLE_ID}>` : '@Helper';
        return interaction.reply({ content: `📢 ${helperRolePing} — Squad assistance requested in this ticket!` });
      }

      if (customId === 'btn_cancel') {
        if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: '❌ Only the requester or staff can close this request.', ephemeral: true });
        }

        await interaction.reply('❌ Request closed. Deleting channel in 3 seconds...');
        activeTickets.delete(interaction.channel.id);
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }

      if (customId === 'btn_complete') {
        await interaction.deferReply();

        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        if (ticketData) {
          await interaction.channel.permissionOverwrites.edit(ticketData.requesterId, { SendMessages: false });
        }

        let awardedText = '';
        if (ticketData && ticketData.helpers.length > 0) {
          const pointsToAward = getPointsForTicket(ticketData);

          for (const hId of ticketData.helpers) {
            const current = helperPoints.get(hId) || 0;
            const updated = current + pointsToAward;
            helperPoints.set(hId, updated);

            await checkAndAssignHelperRoles(interaction.guild, hId, updated);
          }

          const helperMentions = ticketData.helpers.map(id => `<@${id}>`).join(', ');
          awardedText = `\n\n🏆 **+${pointsToAward} Helper Point(s)** automatically awarded to: ${helperMentions}`;
        } else {
          awardedText = '\n\n⚠️ No helpers accepted this request, so no points were awarded.';
        }

        const embed = new EmbedBuilder()
          .setTitle('🔒 Ticket Resolved')
          .setDescription(`This request has been finished and closed!${awardedText}`)
          .setColor('#2ecc71')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        activeTickets.delete(interaction.channel.id);
        return;
      }
    }

    // 4. SLASH COMMAND EXECUTION
    if (interaction.isChatInputCommand()) {
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

        // Button 1 logic
        const b1Label = options.getString('btn1_label');
        const b1Emoji = options.getString('btn1_emoji');
        const b1Style = options.getString('btn1_style');
        const b1Max = options.getInteger('btn1_max') || 6;
        const b1Points = options.getInteger('btn1_points') || 0;

        const btn1 = new ButtonBuilder()
          .setCustomId(`tselect_${b1Label.toLowerCase().replace(/\s+/g, '_')}_${b1Max}_${b1Points}`)
          .setLabel(b1Label)
          .setStyle(parseButtonStyle(b1Style));
        if (b1Emoji) btn1.setEmoji(b1Emoji);
        row.addComponents(btn1);

        // Button 2 logic
        const b2Label = options.getString('btn2_label');
        if (b2Label) {
          const b2Emoji = options.getString('btn2_emoji');
          const b2Style = options.getString('btn2_style');
          const b2Max = options.getInteger('btn2_max') || 6;
          const b2Points = options.getInteger('btn2_points') || 0;

          const btn2 = new ButtonBuilder()
            .setCustomId(`tselect_${b2Label.toLowerCase().replace(/\s+/g, '_')}_${b2Max}_${b2Points}`)
            .setLabel(b2Label)
            .setStyle(parseButtonStyle(b2Style));
          if (b2Emoji) btn2.setEmoji(b2Emoji);
          row.addComponents(btn2);
        }

        await channel.send({ embeds: [embed], components: [row] });
        return await interaction.editReply('✅ Ticket panel posted successfully!');
      }

      if (commandName === 'helpers-leaderboard') {
        if (helperPoints.size === 0) {
          return await interaction.reply({ content: '📊 No helper points recorded yet!', ephemeral: true });
        }

        const sorted = [...helperPoints.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const leaderboardStr = sorted.map(([id, pts], index) => `**${index + 1}.** <@${id}> — **${pts}** pts`).join('\n');

        const lbEmbed = new EmbedBuilder()
          .setTitle('🏆 Top Ticket Helpers')
          .setDescription(leaderboardStr)
          .setColor('#f1c40f')
          .setTimestamp();

        return await interaction.reply({ embeds: [lbEmbed] });
      }

      if (commandName === 'points') {
        const sub = options.getSubcommand();
        const targetUser = options.getUser('user');

        if (sub === 'add') {
          const amount = options.getInteger('amount');
          const current = helperPoints.get(targetUser.id) || 0;
          const updated = current + amount;
          helperPoints.set(targetUser.id, updated);

          await checkAndAssignHelperRoles(interaction.guild, targetUser.id, updated);
          return await interaction.reply({ content: `✅ Added **${amount}** points to ${targetUser}. Total: **${updated}** pts.`, ephemeral: true });
        }

        if (sub === 'remove') {
          const amount = options.getInteger('amount');
          const current = helperPoints.get(targetUser.id) || 0;
          const updated = Math.max(0, current - amount);
          helperPoints.set(targetUser.id, updated);
          return await interaction.reply({ content: `✅ Removed **${amount}** points from ${targetUser}. Total: **${updated}** pts.`, ephemeral: true });
        }

        if (sub === 'reset') {
          if (targetUser) {
            helperPoints.delete(targetUser.id);
            return await interaction.reply({ content: `✅ Reset helper points for ${targetUser}.`, ephemeral: true });
          } else {
            helperPoints.clear();
            return await interaction.reply({ content: '✅ Reset all helper points on the leaderboard!', ephemeral: true });
          }
        }
      }

      if (commandName === 'helper-roles') {
        const sub = options.getSubcommand();

        if (sub === 'add') {
          const requiredPts = options.getInteger('points');
          const role = options.getRole('role');

          roleRewards.set(requiredPts, role.id);
          return await interaction.reply({
            content: `✅ Added auto-role reward! Reach **${requiredPts} points** to automatically earn the ${role} role.`,
            ephemeral: true
          });
        }

        if (sub === 'list') {
          if (roleRewards.size === 0) {
            return await interaction.reply({ content: '⚙️ No point-based role rewards configured yet.', ephemeral: true });
          }

          const sorted = [...roleRewards.entries()].sort((a, b) => a[0] - b[0]);
          const rewardList = sorted.map(([pts, roleId]) => `• **${pts} Points** $\\rightarrow$ <@&${roleId}>`).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('🏅 Helper Role Rewards')
            .setDescription(rewardList)
            .setColor('#3498db');

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    }
  } catch (error) {
    console.error('Interaction Error:', error);
    const errorMsg = `❌ Error processing request: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMsg }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
    }
  }
});

// --- LOGIN ---
client.login(process.env.DISCORD_TOKEN);

// --- HTTP SERVER FOR KEEP-ALIVE ---
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
