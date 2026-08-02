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
const HELPER_ROLE_ID = 'YOUR_HELPER_ROLE_ID'; // Replace with your default @Ultra Helper Role ID

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
const userRequestCounts = new Map(); // Tracks requester ticket totals
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
      : 'None';

    const maxLimit = ticketData.maxHelpers || 6;

    const oldEmbed = panelMsg.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed).setFields(
      { name: 'Requester:', value: `<@${ticketData.requesterId}>`, inline: true },
      { name: 'IGN:', value: `\`${ticketData.ign}\``, inline: true },
      { name: 'Server:', value: `\`${ticketData.server}\``, inline: true },
      { name: 'Details', value: ticketData.description },
      { name: `👥 Helpers (${ticketData.helpers.length}/${maxLimit})`, value: helpersList }
    );

    await panelMsg.edit({ embeds: [newEmbed] });
  } catch (err) {
    console.error('Failed to update ticket embed:', err);
  }
}

// Helper function to build setup commands cleanly
function createSetupCommand(name, description, buttonCount) {
  const cmd = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post panel').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(true))
    .addRoleOption(opt => opt.setName('role_mention').setDescription('Role to ping on ticket creation').setRequired(false))
    .addChannelOption(opt => opt.setName('category').setDescription('Ticket Category').setRequired(false));

  for (let i = 1; i <= buttonCount; i++) {
    const isFirst = (i === 1);
    cmd
      .addStringOption(opt => opt.setName(`btn${i}_label`).setDescription(`Button ${i} Label`).setRequired(isFirst))
      .addStringOption(opt => opt.setName(`btn${i}_emoji`).setDescription(`Button ${i} Emoji`).setRequired(false))
      .addStringOption(opt => opt.setName(`btn${i}_style`).setDescription(`Button ${i} Style`).setRequired(false))
      .addIntegerOption(opt => opt.setName(`btn${i}_max`).setDescription(`Helper Limit (1-6)`).setMinValue(1).setMaxValue(6).setRequired(false))
      .addIntegerOption(opt => opt.setName(`btn${i}_points`).setDescription(`Points to award`).setMinValue(1).setRequired(false));
  }

  return cmd;
}

// --- SLASH COMMANDS REGISTRATION ---
const setup1 = createSetupCommand('ticket-setup-1', 'Post setup panel 1 (Buttons 1 to 3)', 3);
const setup2 = createSetupCommand('ticket-setup-2', 'Post setup panel 2 (Buttons 4 and 5)', 2);
const setup3 = createSetupCommand('ticket-setup-3', 'Post setup panel 3 (Buttons 6 and 7)', 2);

const commands = [
  setup1,
  setup2,
  setup3,

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top helpers and top requesters'),

  new SlashCommandBuilder()
    .setName('points')
    .setDescription('Manage helper points')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add points to helper')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove points from helper')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset points')
        .addUserOption(opt => opt.setName('user').setDescription('User (Leave blank for ALL)').setRequired(false))
    ),

  new SlashCommandBuilder()
    .setName('helper-roles')
    .setDescription('Configure role rewards')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Set point reward role')
        .addIntegerOption(opt => opt.setName('points').setDescription('Points required').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View reward roles')
    )
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ All slash commands successfully registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// --- BOT READY ---
client.once(Events.ClientReady, async () => {
  console.log(`LoggedIn as ${client.user.tag}`);

  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'AQW Leaderboard',
      type: 5
    }]
  });

  await registerCommands();
});

// --- INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  try {
    // 1. TICKET BUTTON CLICK -> MODAL
    if (interaction.isButton() && interaction.customId.startsWith('tselect_')) {
      const parts = interaction.customId.split('_');
      const roleId = parts[parts.length - 1];
      const customPoints = parts[parts.length - 2];
      const maxHelpers = parts[parts.length - 3];
      const categoryName = parts.slice(1, -3).join(' ');

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form_${maxHelpers}_${customPoints}_${roleId}_${categoryName.replace(/\s+/g, '_')}`)
        .setTitle(`Ticket: ${categoryName}`);

      const ignInput = new TextInputBuilder()
        .setCustomId('ign')
        .setLabel('AQW IGN')
        .setPlaceholder('Enter IGN...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const serverInput = new TextInputBuilder()
        .setCustomId('server')
        .setLabel('Server')
        .setPlaceholder('Artix, Safiria, etc.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const mapInput = new TextInputBuilder()
        .setCustomId('map_name')
        .setLabel('Map Name')
        .setPlaceholder('ultraezrajal, timeinn, etc.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Details / Bosses')
        .setPlaceholder('Details on what you need help with...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(ignInput),
        new ActionRowBuilder().addComponents(serverInput),
        new ActionRowBuilder().addComponents(mapInput),
        new ActionRowBuilder().addComponents(descInput)
      );

      return await interaction.showModal(modal);
    }

    // 2. MODAL SUBMIT -> CREATE CHANNEL
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const parts = interaction.customId.replace('ticket_form_', '').split('_');
        const maxHelpers = parseInt(parts[0]) || 6;
        const customPoints = parseInt(parts[1]) || 0;
        const pingRoleId = parts[2] !== 'none' ? parts[2] : null;
        const ticketType = parts.slice(3).join(' ');

        const ign = interaction.fields.getTextInputValue('ign');
        const serverName = interaction.fields.getTextInputValue('server');
        const rawMap = interaction.fields.getTextInputValue('map_name').trim();
        const description = interaction.fields.getTextInputValue('description');

        const cleanMap = rawMap.toLowerCase().replace(/[^a-z0-9]/g, '') || 'room';
        const random4Digit = Math.floor(1000 + Math.random() * 9000);
        const room = `/join ${cleanMap}-${random4Digit}`;

        const currentReqs = userRequestCounts.get(interaction.user.id) || 0;
        userRequestCounts.set(interaction.user.id, currentReqs + 1);

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
          pingRoleId,
          helpers: []
        });

        const embed = new EmbedBuilder()
          .setTitle(`Ticket - ${ticketType}`)
          .addFields(
            { name: 'Requester:', value: `${interaction.user}`, inline: true },
            { name: 'IGN:', value: `\`${ign}\``, inline: true },
            { name: 'Server:', value: `\`${serverName}\``, inline: true },
            { name: 'Details', value: description },
            { name: `👥 Helpers (0/${maxHelpers})`, value: 'None' }
          )
          .setColor('#2b2d31')
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_location').setLabel('View Location').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
          new ButtonBuilder().setCustomId('btn_claim').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
          new ButtonBuilder().setCustomId('btn_leave').setLabel('Leave').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('btn_pinghelpers').setLabel('Ping').setStyle(ButtonStyle.Secondary).setEmoji('📢')
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('btn_complete').setLabel('Complete').setStyle(ButtonStyle.Primary)
        );

        const effectiveRoleId = pingRoleId || (HELPER_ROLE_ID !== 'YOUR_HELPER_ROLE_ID' ? HELPER_ROLE_ID : null);
        const helperRolePing = effectiveRoleId ? `<@&${effectiveRoleId}>` : '@Helper';
        
        const mainMsg = await ticketChannel.send({ 
          content: `Hey ${interaction.user}! ${helperRolePing}`, 
          embeds: [embed], 
          components: [row1, row2] 
        });
        await mainMsg.pin().catch(() => {});

        return await interaction.editReply(`✅ Ticket created: ${ticketChannel}`);
      } catch (err) {
        console.error('Failed to create ticket channel:', err);
        return await interaction.editReply(`❌ Failed to create ticket channel: ${err.message}`);
      }
    }

    // 3. TICKET ACTIONS
    if (interaction.isButton()) {
      const ticketData = activeTickets.get(interaction.channel.id);
      const customId = interaction.customId;

      if (customId === 'btn_location') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        const isRequester = interaction.user.id === ticketData.requesterId;
        const isHelper = ticketData.helpers.includes(interaction.user.id);
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        if (!isRequester && !isHelper && !isAdmin) {
          return interaction.reply({
            content: '🔒 **Access Denied:** Click **Accept** first to view the private location.',
            ephemeral: true
          });
        }

        return interaction.reply({
          content: `📍 **Private Location Details:**\n• **IGN:** \`${ticketData.ign}\`\n• **Server:** \`${ticketData.server}\`\n• **Room:** \`${ticketData.room}\``,
          ephemeral: true
        });
      }

      if (customId === 'btn_claim') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        if (ticketData.helpers.includes(interaction.user.id)) {
          return interaction.reply({ content: '⚠️ You already accepted!', ephemeral: true });
        }

        const maxAllowed = ticketData.maxHelpers || 6;
        if (ticketData.helpers.length >= maxAllowed) {
          return interaction.reply({ content: `⚠️ Helper spots are full (${maxAllowed}/${maxAllowed})!`, ephemeral: true });
        }

        ticketData.helpers.push(interaction.user.id);
        activeTickets.set(interaction.channel.id, ticketData);

        const spotsLeft = maxAllowed - ticketData.helpers.length;

        await interaction.channel.send({
          content: `✅ ${interaction.user} joined the team. (${spotsLeft} left)`
        });

        await interaction.reply({
          content: `✅ **Accepted!** Room Info:\n📍 **Server:** \`${ticketData.server}\`\n📍 **Room:** \`${ticketData.room}\``,
          ephemeral: true
        });

        return updateTicketEmbed(interaction.channel, ticketData);
      }

      if (customId === 'btn_leave') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        if (!ticketData.helpers.includes(interaction.user.id)) {
          return interaction.reply({ content: '⚠️ You are not on this ticket.', ephemeral: true });
        }

        ticketData.helpers = ticketData.helpers.filter(id => id !== interaction.user.id);
        activeTickets.set(interaction.channel.id, ticketData);

        await interaction.reply({ content: `🚪 ${interaction.user} stepped down.` });
        return updateTicketEmbed(interaction.channel, ticketData);
      }

      if (customId === 'btn_pinghelpers') {
        const effectiveRoleId = ticketData?.pingRoleId || (HELPER_ROLE_ID !== 'YOUR_HELPER_ROLE_ID' ? HELPER_ROLE_ID : null);
        const helperRolePing = effectiveRoleId ? `<@&${effectiveRoleId}>` : '@Helper';
        return interaction.reply({ content: `📢 ${helperRolePing} assistance requested!` });
      }

      if (customId === 'btn_cancel') {
        if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: '❌ Only requester or staff can cancel.', ephemeral: true });
        }

        await interaction.reply('❌ Closed. Deleting in 3s...');
        activeTickets.delete(interaction.channel.id);
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }

      if (customId === 'btn_complete') {
        if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: '❌ Only requester or staff can complete.', ephemeral: true });
        }

        await interaction.deferReply();

        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

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
          awardedText = `\n🏆 **+${pointsToAward} pts** awarded to: ${helperMentions}`;
        } else {
          awardedText = '\n⚠️ No helpers accepted.';
        }

        const embed = new EmbedBuilder()
          .setTitle('🔒 Ticket Completed')
          .setDescription(`Resolved and closed!${awardedText}`)
          .setColor('#2ecc71')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        activeTickets.delete(interaction.channel.id);
        return;
      }
    }

    // 4. COMMANDS
    if (interaction.isChatInputCommand()) {
      const { commandName, options } = interaction;

      if (['ticket-setup-1', 'ticket-setup-2', 'ticket-setup-3'].includes(commandName)) {
        await interaction.deferReply({ ephemeral: true });
        const channel = options.getChannel('channel');
        const title = options.getString('title');
        const desc = options.getString('description').replace(/\\n/g, '\n');
        const roleMention = options.getRole('role_mention');
        const category = options.getChannel('category');

        if (category) {
          const cfg = guildSettings.get(interaction.guild.id) || {};
          cfg.ticketCategory = category.id;
          guildSettings.set(interaction.guild.id, cfg);
        }

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(desc)
          .setColor('#2b2d31');

        const row = new ActionRowBuilder();
        const maxButtonsInCmd = commandName === 'ticket-setup-1' ? 3 : 2;

        for (let i = 1; i <= maxButtonsInCmd; i++) {
          const label = options.getString(`btn${i}_label`);
          if (!label) continue;

          const emoji = options.getString(`btn${i}_emoji`);
          const style = options.getString(`btn${i}_style`);
          const max = options.getInteger(`btn${i}_max`) || 6;
          const points = options.getInteger(`btn${i}_points`) || 0;
          const roleIdStr = roleMention ? roleMention.id : 'none';

          const btn = new ButtonBuilder()
            .setCustomId(`tselect_${label.toLowerCase().replace(/\s+/g, '_')}_${max}_${points}_${roleIdStr}`)
            .setLabel(label)
            .setStyle(parseButtonStyle(style));

          if (emoji) btn.setEmoji(emoji);
          row.addComponents(btn);
        }

        await channel.send({ embeds: [embed], components: [row] });
        return await interaction.editReply(`✅ Panel posted to ${channel}!`);
      }

      if (commandName === 'leaderboard') {
        const sortedHelpers = [...helperPoints.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const sortedRequesters = [...userRequestCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

        const helpersStr = sortedHelpers.length > 0
          ? sortedHelpers.map(([id, pts], i) => `**${i + 1}.** <@${id}> — \`${pts} pts\``).join('\n')
          : 'No helper data yet';

        const requestersStr = sortedRequesters.length > 0
          ? sortedRequesters.map(([id, reqs], i) => `**${i + 1}.** <@${id}> — \`${reqs} tickets\``).join('\n')
          : 'No request data yet';

        const lbEmbed = new EmbedBuilder()
          .setTitle('📊 Server Activity Leaderboard')
          .addFields(
            { name: '🏆 Top Helpers', value: helpersStr, inline: true },
            { name: '📩 Top Requesters', value: requestersStr, inline: true }
          )
          .setColor('#2b2d31')
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
          return await interaction.reply({ content: `✅ Gave **${amount}** pts to ${targetUser}. Total: **${updated}**`, ephemeral: true });
        }

        if (sub === 'remove') {
          const amount = options.getInteger('amount');
          const current = helperPoints.get(targetUser.id) || 0;
          const updated = Math.max(0, current - amount);
          helperPoints.set(targetUser.id, updated);
          return await interaction.reply({ content: `✅ Removed **${amount}** pts from ${targetUser}. Total: **${updated}**`, ephemeral: true });
        }

        if (sub === 'reset') {
          if (targetUser) {
            helperPoints.delete(targetUser.id);
            return await interaction.reply({ content: `✅ Reset points for ${targetUser}.`, ephemeral: true });
          } else {
            helperPoints.clear();
            return await interaction.reply({ content: '✅ Reset all helper points!', ephemeral: true });
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
            content: `✅ Role ${role} set for **${requiredPts} pts**.`,
            ephemeral: true
          });
        }

        if (sub === 'list') {
          if (roleRewards.size === 0) {
            return await interaction.reply({ content: '⚙️ No role rewards set.', ephemeral: true });
          }

          const sorted = [...roleRewards.entries()].sort((a, b) => a[0] - b[0]);
          const rewardList = sorted.map(([pts, roleId]) => `• **${pts} Pts** -> <@&${roleId}>`).join('\n');

          const embed = new EmbedBuilder()
            .setTitle('🏅 Role Rewards')
            .setDescription(rewardList)
            .setColor('#2b2d31');

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// --- LOGIN ---
client.login(process.env.DISCORD_TOKEN);

// --- HTTP SERVER FOR KEEP-ALIVE ---
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
