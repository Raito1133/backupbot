const http = require('http');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  REST,
  Routes,
  Events,
  ActivityType,
  ButtonBuilder,    
  ActionRowBuilder,
  ButtonStyle,      
  ChannelType,
  ModalBuilder,     
  TextInputBuilder,  
  TextInputStyle,
  Partials
} = require('discord.js');

// --- ⚠️ CONFIGURATION ⚠️ ---
const GUILD_ID = '1371775026264670228'; // Server ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const defaultPrefix = '!';

// --- DATA STORAGE ---
const guildSettings = new Map();
const snipes = new Map();
const afkUsers = new Map();
const uwuTargets = new Set();
const stickyMessages = new Map();
const helperPoints = new Map(); // Helper points: userId -> point count

// --- UWU TRANSLATOR ---
function uwuify(text) {
  const faces = ['(・`ω´・)', ';;w;;', 'owo', 'UwU', '>w<', '^w^'];
  return text.replace(/(?:r|l)/g, 'w').replace(/(?:R|L)/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1').replace(/N([AEIOU])/g, 'Ny$1').replace(/ove/g, 'uv').replace(/!+/g, ' ' + faces[Math.floor(Math.random() * faces.length)] + ' ');
}

// --- SLASH COMMAND DEFINITIONS ---
const commands = [
  { name: 'ping', description: 'Check bot latency' },
  { name: 'me', description: 'Credits & Info' },
  { 
    name: 'setprefix', 
    description: 'Change prefix for text commands', 
    options: [{ name: 'new_prefix', description: 'Symbol', type: 3, required: true }], 
    default_member_permissions: '8' 
  },
  { 
    name: 'embed', 
    description: 'Create a custom embed using multi-line modal input',
    options: [{ name: 'channel', description: 'Channel to send embed', type: 7, required: false }],
    default_member_permissions: '8' 
  },
  { 
    name: 'ticket-setup', 
    description: 'Setup the AQW In-Game Help Ticket Panel', 
    options: [
      { name: 'channel', description: 'Target channel', type: 7, required: true },
      { name: 'category', description: 'Category for tickets', type: 7, channel_types: [4], required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'verify-setup', 
    description: 'Setup AQW Verification Panel', 
    options: [
      { name: 'channel', description: 'Where to post button', type: 7, required: true },
      { name: 'log_channel', description: 'Verification log channel', type: 7, required: true },
      { name: 'verified_role', description: 'Role assigned upon approval', type: 8, required: true }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'welcome-setup', 
    description: 'Configure embed welcome screen', 
    options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }], 
    default_member_permissions: '8' 
  },
  { 
    name: 'leave-setup', 
    description: 'Configure embed leave message', 
    options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }], 
    default_member_permissions: '8' 
  },
  { 
    name: 'boost-setup', 
    description: 'Configure embed boost message', 
    options: [{ name: 'channel', description: 'Target channel', type: 7, required: true }], 
    default_member_permissions: '8' 
  },
  { 
    name: 'reactionrole', 
    description: 'Create a button reaction-role panel', 
    options: [{ name: 'channel', description: 'Channel', type: 7, required: true }], 
    default_member_permissions: '8' 
  },
  { 
    name: 'points', 
    description: 'Manage helper points', 
    options: [
      { 
        name: 'add', 
        description: 'Add points to a helper', 
        type: 1, 
        options: [
          { name: 'user', description: 'Helper', type: 6, required: true },
          { name: 'amount', description: 'Points to add', type: 4, required: true }
        ] 
      },
      { 
        name: 'remove', 
        description: 'Remove points from a helper', 
        type: 1, 
        options: [
          { name: 'user', description: 'Helper', type: 6, required: true },
          { name: 'amount', description: 'Points to remove', type: 4, required: true }
        ] 
      },
      { 
        name: 'reset', 
        description: 'Reset all helper points or a single user', 
        type: 1, 
        options: [{ name: 'user', description: 'Optional user to reset', type: 6, required: false }] 
      }
    ], 
    default_member_permissions: '8' 
  },
  { name: 'leaderboard', description: 'Show helper points leaderboard' },
  { name: 'kick', description: 'Kick a member', options: [{ name: 'user', description: 'Target user', type: 6, required: true }, { name: 'reason', description: 'Reason', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'ban', description: 'Ban a member', options: [{ name: 'user', description: 'Target user', type: 6, required: true }, { name: 'reason', description: 'Reason', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'mute', description: 'Mute a member', options: [{ name: 'user', description: 'Target user', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'lock', description: 'Lock current channel', default_member_permissions: '8' },
  { name: 'unlock', description: 'Unlock current channel', default_member_permissions: '8' },
  { name: 'purge', description: 'Clear messages', options: [{ name: 'amount', description: 'Amount (1-100)', type: 4, required: true }], default_member_permissions: '8' },
  { name: 'stick', description: 'Stick a reminder message', options: [{ name: 'message', description: 'Content', type: 3, required: true }], default_member_permissions: '8' },
  { name: 'unstick', description: 'Remove sticky message from channel', default_member_permissions: '8' },
  { name: 'snipe', description: 'Show recently deleted message' }
];

// --- BOT STARTUP ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('AQW Help Tickets', { type: ActivityType.Watching });

  const rest = new REST().setToken(client.token);
  try {
    console.log('Refreshing application (/) commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Commands successfully registered to Guild!');
  } catch (error) {
    console.error('Error refreshing slash commands:', error);
  }
});

// --- WELCOME EMBED HANDLER ---
client.on('guildMemberAdd', async (member) => {
  const cfg = guildSettings.get(member.guild.id);
  if (!cfg || !cfg.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
  if (!channel) return;

  const title = cfg.welcomeTitle || `Welcome to ${member.guild.name}!`;
  let desc = cfg.welcomeDesc || `Hey there, {user}! We're glad to have you here.`;
  desc = desc.replace(/{user}/g, `${member}`).replace(/{server}/g, member.guild.name).replace(/{count}/g, member.guild.memberCount);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(cfg.welcomeColor || '#f1c40f')
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  if (cfg.welcomeImage && cfg.welcomeImage.startsWith('http')) embed.setImage(cfg.welcomeImage);

  await channel.send({ embeds: [embed] });
});

// --- LEAVE EMBED HANDLER ---
client.on('guildMemberRemove', async (member) => {
  const cfg = guildSettings.get(member.guild.id);
  if (!cfg || !cfg.leaveChannelId) return;

  const channel = member.guild.channels.cache.get(cfg.leaveChannelId);
  if (!channel) return;

  const title = cfg.leaveTitle || 'Member Left';
  let desc = cfg.leaveDesc || `**{user}** has left the server.`;
  desc = desc.replace(/{user}/g, `${member.user.tag}`).replace(/{server}/g, member.guild.name);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor('#e74c3c')
    .setTimestamp();

  if (cfg.leaveImage && cfg.leaveImage.startsWith('http')) embed.setImage(cfg.leaveImage);

  await channel.send({ embeds: [embed] });
});

// --- TRACK DELETED MESSAGES FOR SNIPE ---
client.on('messageDelete', (message) => {
  if (message.author?.bot) return;
  snipes.set(message.channel.id, {
    content: message.content,
    author: message.author,
    image: message.attachments.first() ? message.attachments.first().proxyURL : null
  });
});

// --- PREFIX MESSAGE HANDLER ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || message.guild.id !== GUILD_ID) return;

  // 1. UwU Lock
  if (uwuTargets.has(message.author.id)) {
    try {
      await message.delete();
      const uwuText = uwuify(message.content);
      return await message.channel.send(`**${message.member ? message.member.displayName : message.author.username}**: ${uwuText}`);
    } catch (e) {}
  }

  // 2. Sticky Message
  if (stickyMessages.has(message.channel.id)) {
    const stickyData = stickyMessages.get(message.channel.id);
    if (stickyData.lastMsgId) message.channel.messages.delete(stickyData.lastMsgId).catch(() => {});
    const sentSticky = await message.channel.send(`**Reminder**\n${stickyData.content}`);
    stickyData.lastMsgId = sentSticky.id;
    stickyMessages.set(message.channel.id, stickyData);
  }

  // 3. AFK Handler
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach((user) => {
      if (afkUsers.has(user.id)) {
        message.reply(`**${user.username}** is AFK: ${afkUsers.get(user.id).reason}`);
      }
    });
  }
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`Welcome back **${message.author.username}**! AFK status removed.`);
  }

  // 4. Prefix Command Parser
  const config = guildSettings.get(message.guild.id);
  const serverPrefix = config?.prefix || defaultPrefix;
  if (!message.content.startsWith(serverPrefix)) return;

  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') return message.reply(`Pong! ${Math.round(client.ws.ping)}ms`);
  if (command === 'snipe') {
    const snipedMsg = snipes.get(message.channel.id);
    if (!snipedMsg) return message.reply('❌ Nothing to snipe!');
    const embed = new EmbedBuilder()
      .setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() })
      .setDescription(snipedMsg.content || '*(Attachment)*')
      .setColor('#e74c3c');
    if (snipedMsg.image) embed.setImage(snipedMsg.image);
    return message.reply({ embeds: [embed] });
  }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  // A. BUTTON HANDLER
  if (interaction.isButton()) {
    // Reaction Roles
    if (interaction.customId.startsWith('rr_')) {
      const roleId = interaction.customId.split('_')[1];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: '❌ Role no longer exists.', ephemeral: true });

      if (interaction.member.roles.cache.has(roleId)) {
        await interaction.member.roles.remove(roleId);
        return interaction.reply({ content: `Removed role: **${role.name}**`, ephemeral: true });
      } else {
        await interaction.member.roles.add(roleId);
        return interaction.reply({ content: `Added role: **${role.name}**`, ephemeral: true });
      }
    }

    // Ticket Category Selection Buttons
    if (interaction.customId.startsWith('tselect_')) {
      const categoryName = interaction.customId.replace('tselect_', '').replace(/_/g, ' ');
      
      const modal = new ModalBuilder()
        .setCustomId(`modal_openticket_${categoryName}`)
        .setTitle(`Ticket: ${categoryName.toUpperCase()}`);

      const descInput = new TextInputBuilder()
        .setCustomId('ticket_user_desc')
        .setLabel('Describe what you need help with')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter in-game name, server, room number, or details...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(descInput));
      return await interaction.showModal(modal);
    }

    // Close Ticket Button
    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 Closing ticket in 3 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      return;
    }

    // Verification Submit Trigger
    if (interaction.customId === 'start_verification') {
      const modal = new ModalBuilder().setCustomId('aqw_verify_modal').setTitle('AQW Verification');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aqw_name').setLabel('AQW Username').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aqw_guild').setLabel('Guild Name').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('aqw_inviter').setLabel('Who invited you?').setStyle(TextInputStyle.Short).setRequired(false))
      );
      return await interaction.showModal(modal);
    }

    // Verification Approve/Reject
    if (interaction.customId.startsWith('v_approve_')) {
      const [, , userId, ign] = interaction.customId.split('_');
      const cfg = guildSettings.get(interaction.guild.id) || {};
      const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

      if (targetMember) {
        if (cfg.verifyRoleId) await targetMember.roles.add(cfg.verifyRoleId).catch(() => {});
        await targetMember.setNickname(ign).catch(() => {});
        const oldEmbed = interaction.message.embeds[0];
        const updated = EmbedBuilder.from(oldEmbed).setColor('#2ecc71').setFooter({ text: `Approved by ${interaction.user.tag}` });
        await interaction.update({ embeds: [updated], components: [] });
      }
      return;
    }

    if (interaction.customId.startsWith('v_reject_')) {
      const oldEmbed = interaction.message.embeds[0];
      const updated = EmbedBuilder.from(oldEmbed).setColor('#e74c3c').setFooter({ text: `Rejected by ${interaction.user.tag}` });
      await interaction.update({ embeds: [updated], components: [] });
      return;
    }
  }

  // B. MODAL SUBMISSIONS
  if (interaction.isModalSubmit()) {
    // Ticket Panel Setup Modal Handler (Named Category Buttons with Custom Colors/Emojis)
    if (interaction.customId.startsWith('ts_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const [, , channelId, categoryId] = interaction.customId.split('_');
      const title = interaction.fields.getTextInputValue('panel_title');
      const desc = interaction.fields.getTextInputValue('panel_desc');
      const image = interaction.fields.getTextInputValue('panel_image');

      const targetChannel = interaction.guild.channels.cache.get(channelId);
      if (categoryId !== 'none') {
        const cfg = guildSettings.get(interaction.guild.id) || {};
        cfg.ticketCategory = categoryId;
        guildSettings.set(interaction.guild.id, cfg);
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor('#2b2d31')
        .setFooter({ text: 'You can only have 1 open ticket at a time.' });

      if (image && image.startsWith('http')) embed.setImage(image);

      // Category buttons formatted as named buttons matching the panel
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tselect_ultra_weeklies').setLabel('Ultra Weeklies').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
        new ButtonBuilder().setCustomId('tselect_ultra_dailies').setLabel('Ultra Dailies').setStyle(ButtonStyle.Danger).setEmoji('🗡️')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tselect_void_auras').setLabel('Void Auras').setStyle(ButtonStyle.Danger).setEmoji('💀'),
        new ButtonBuilder().setCustomId('tselect_templeshrine').setLabel('Temple Shrine').setStyle(ButtonStyle.Primary).setEmoji('⛩️')
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tselect_7man_bosses').setLabel('7-Man Bosses').setStyle(ButtonStyle.Primary).setEmoji('👥'),
        new ButtonBuilder().setCustomId('tselect_general_help').setLabel('General Help').setStyle(ButtonStyle.Primary).setEmoji('🆘')
      );

      const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tselect_training').setLabel('Training').setStyle(ButtonStyle.Success).setEmoji('🎓')
      );

      await targetChannel.send({ embeds: [embed], components: [row1, row2, row3, row4] });
      return interaction.editReply('✅ Ticket panel successfully posted!');
    }

    // User Ticket Open Modal Handler
    if (interaction.customId.startsWith('modal_openticket_')) {
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.customId.replace('modal_openticket_', '');
      const userDesc = interaction.fields.getTextInputValue('ticket_user_desc');
      const cfg = guildSettings.get(interaction.guild.id) || {};

      const chName = `ticket-${category}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

      const ticketChannel = await interaction.guild.channels.create({
        name: chName,
        type: ChannelType.GuildText,
        parent: cfg.ticketCategory || null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Help Ticket: ${category.toUpperCase()}`)
        .setDescription(`**Requested By:** ${interaction.user}\n\n**Details:**\n${userDesc}`)
        .setColor('#3498db')
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
      return interaction.editReply(`Ticket channel created: ${ticketChannel}`);
    }

    // Embed Modal Submission
    if (interaction.customId.startsWith('embed_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const channelId = interaction.customId.split('_')[2];
      const targetChannel = interaction.guild.channels.cache.get(channelId) || interaction.channel;

      const title = interaction.fields.getTextInputValue('embed_title');
      const desc = interaction.fields.getTextInputValue('embed_desc');
      const image = interaction.fields.getTextInputValue('embed_image');

      const embed = new EmbedBuilder().setDescription(desc).setColor('#3498db');
      if (title) embed.setTitle(title);
      if (image && image.startsWith('http')) embed.setImage(image);

      await targetChannel.send({ embeds: [embed] });
      return interaction.editReply('✅ Embed posted!');
    }

    // Welcome Setup Modal Submission
    if (interaction.customId.startsWith('welcome_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const channelId = interaction.customId.split('_')[2];
      const cfg = guildSettings.get(interaction.guild.id) || {};

      cfg.welcomeChannelId = channelId;
      cfg.welcomeTitle = interaction.fields.getTextInputValue('welcome_title');
      cfg.welcomeDesc = interaction.fields.getTextInputValue('welcome_desc');
      cfg.welcomeImage = interaction.fields.getTextInputValue('welcome_image');

      guildSettings.set(interaction.guild.id, cfg);
      return interaction.editReply('✅ Welcome Embed configured successfully!');
    }

    // Leave Setup Modal Submission
    if (interaction.customId.startsWith('leave_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const channelId = interaction.customId.split('_')[2];
      const cfg = guildSettings.get(interaction.guild.id) || {};

      cfg.leaveChannelId = channelId;
      cfg.leaveTitle = interaction.fields.getTextInputValue('leave_title');
      cfg.leaveDesc = interaction.fields.getTextInputValue('leave_desc');
      cfg.leaveImage = interaction.fields.getTextInputValue('leave_image');

      guildSettings.set(interaction.guild.id, cfg);
      return interaction.editReply('✅ Leave Embed configured successfully!');
    }

    // Boost Setup Modal Submission
    if (interaction.customId.startsWith('boost_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const channelId = interaction.customId.split('_')[2];
      const cfg = guildSettings.get(interaction.guild.id) || {};

      cfg.boostChannelId = channelId;
      cfg.boostTitle = interaction.fields.getTextInputValue('boost_title');
      cfg.boostDesc = interaction.fields.getTextInputValue('boost_desc');
      cfg.boostImage = interaction.fields.getTextInputValue('boost_image');

      guildSettings.set(interaction.guild.id, cfg);
      return interaction.editReply('✅ Boost Embed configured successfully!');
    }

    // Verification Modal Setup
    if (interaction.customId.startsWith('verify_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const [, , chId, logId, roleId] = interaction.customId.split('_');

      const cfg = guildSettings.get(interaction.guild.id) || {};
      cfg.verifyLogChannelId = logId;
      cfg.verifyRoleId = roleId;
      guildSettings.set(interaction.guild.id, cfg);

      const embed = new EmbedBuilder()
        .setTitle(interaction.fields.getTextInputValue('verify_title'))
        .setDescription(interaction.fields.getTextInputValue('verify_desc'))
        .setColor('#2ecc71');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('start_verification').setLabel('Verify Account').setStyle(ButtonStyle.Success).setEmoji('✅')
      );

      const target = interaction.guild.channels.cache.get(chId);
      await target.send({ embeds: [embed], components: [row] });
      return interaction.editReply('✅ Verification panel posted!');
    }

    // Reaction Role Modal Handler (Editable up to 5 buttons with Custom Emojis)
    if (interaction.customId.startsWith('rr_modal_')) {
      await interaction.deferReply({ ephemeral: true });
      const channelId = interaction.customId.split('_')[2];
      const targetChannel = interaction.guild.channels.cache.get(channelId);

      const title = interaction.fields.getTextInputValue('rr_title');
      const desc = interaction.fields.getTextInputValue('rr_desc');
      const rolesInput = interaction.fields.getTextInputValue('rr_roles').split('\n');

      const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#3498db');
      const row = new ActionRowBuilder();

      let count = 0;
      for (const line of rolesInput) {
        if (count >= 5) break;
        const [roleId, label, emoji] = line.split('|').map(s => s?.trim());
        if (roleId && label) {
          const btn = new ButtonBuilder().setCustomId(`rr_${roleId}`).setLabel(label).setStyle(ButtonStyle.Primary);
          if (emoji) btn.setEmoji(emoji);
          row.addComponents(btn);
          count++;
        }
      }

      await targetChannel.send({ embeds: [embed], components: [row] });
      return interaction.editReply('✅ Reaction Role panel posted!');
    }
  }

  // C. SLASH COMMAND HANDLERS
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  // /ticket-setup
  if (commandName === 'ticket-setup') {
    const channel = options.getChannel('channel');
    const category = options.getChannel('category');

    const modal = new ModalBuilder()
      .setCustomId(`ts_modal_${channel.id}_${category ? category.id : 'none'}`)
      .setTitle('Ticket Panel Setup');

    const titleInput = new TextInputBuilder()
      .setCustomId('panel_title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setValue('💖 In-Game Help Tickets 💖')
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('panel_desc')
      .setLabel('Description (Shift + Enter supported!)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const imageInput = new TextInputBuilder()
      .setCustomId('panel_image')
      .setLabel('Image Banner URL (Optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(imageInput)
    );

    return await interaction.showModal(modal);
  }

  // /welcome-setup
  if (commandName === 'welcome-setup') {
    const channel = options.getChannel('channel');

    const modal = new ModalBuilder()
      .setCustomId(`welcome_modal_${channel.id}`)
      .setTitle('Welcome Embed Setup');

    const titleInput = new TextInputBuilder().setCustomId('welcome_title').setLabel('Welcome Title').setStyle(TextInputStyle.Short).setValue('Welcome to AQW Community Server!').setRequired(true);
    const descInput = new TextInputBuilder().setCustomId('welcome_desc').setLabel('Description (Shift + Enter supported!)').setStyle(TextInputStyle.Paragraph).setValue('Hey there, {user}! We\'re glad to have you here.\n\n🔒 **Get Verified to Unlock the Server!**').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('welcome_image').setLabel('Banner Image URL').setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  // /leave-setup
  if (commandName === 'leave-setup') {
    const channel = options.getChannel('channel');

    const modal = new ModalBuilder()
      .setCustomId(`leave_modal_${channel.id}`)
      .setTitle('Leave Embed Setup');

    const titleInput = new TextInputBuilder().setCustomId('leave_title').setLabel('Leave Title').setStyle(TextInputStyle.Short).setValue('Goodbye!').setRequired(true);
    const descInput = new TextInputBuilder().setCustomId('leave_desc').setLabel('Description (Shift + Enter supported!)').setStyle(TextInputStyle.Paragraph).setValue('**{user}** has left the server.').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('leave_image').setLabel('Banner Image URL (Optional)').setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  // /boost-setup
  if (commandName === 'boost-setup') {
    const channel = options.getChannel('channel');

    const modal = new ModalBuilder()
      .setCustomId(`boost_modal_${channel.id}`)
      .setTitle('Boost Embed Setup');

    const titleInput = new TextInputBuilder().setCustomId('boost_title').setLabel('Boost Title').setStyle(TextInputStyle.Short).setValue('Server Boosted! 🚀').setRequired(true);
    const descInput = new TextInputBuilder().setCustomId('boost_desc').setLabel('Description (Shift + Enter supported!)').setStyle(TextInputStyle.Paragraph).setValue('Thank you **{user}** for boosting the server!').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('boost_image').setLabel('Banner Image URL (Optional)').setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  // /embed
  if (commandName === 'embed') {
    const targetChannel = options.getChannel('channel') || interaction.channel;

    const modal = new ModalBuilder()
      .setCustomId(`embed_modal_${targetChannel.id}`)
      .setTitle('Create Custom Embed');

    const titleInput = new TextInputBuilder().setCustomId('embed_title').setLabel('Title (Optional)').setStyle(TextInputStyle.Short).setRequired(false);
    const descInput = new TextInputBuilder().setCustomId('embed_desc').setLabel('Description (Shift + Enter Supported)').setStyle(TextInputStyle.Paragraph).setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('embed_image').setLabel('Image URL (Optional)').setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  // /reactionrole (Supports format: RoleID | Button Label | Emoji)
  if (commandName === 'reactionrole') {
    const channel = options.getChannel('channel');

    const modal = new ModalBuilder()
      .setCustomId(`rr_modal_${channel.id}`)
      .setTitle('Reaction Role Setup');

    const titleInput = new TextInputBuilder().setCustomId('rr_title').setLabel('Panel Title').setStyle(TextInputStyle.Short).setRequired(true);
    const descInput = new TextInputBuilder().setCustomId('rr_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true);
    const rolesInput = new TextInputBuilder()
      .setCustomId('rr_roles')
      .setLabel('Roles (Format: RoleID | Label | Emoji)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('1234567890 | Member | 👤\n0987654321 | VIP | ⭐')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(rolesInput));
    return await interaction.showModal(modal);
  }

  // /verify-setup
  if (commandName === 'verify-setup') {
    const channel = options.getChannel('channel');
    const logChannel = options.getChannel('log_channel');
    const role = options.getRole('verified_role');

    const modal = new ModalBuilder()
      .setCustomId(`verify_modal_${channel.id}_${logChannel.id}_${role.id}`)
      .setTitle('Verification Setup');

    const titleInput = new TextInputBuilder().setCustomId('verify_title').setLabel('Title').setStyle(TextInputStyle.Short).setValue('AQW Verification').setRequired(true);
    const descInput = new TextInputBuilder().setCustomId('verify_desc').setLabel('Description (Shift + Enter)').setStyle(TextInputStyle.Paragraph).setValue('Click below to verify your account.').setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
    return await interaction.showModal(modal);
  }

  // Helper Points Management (`/points`)
  if (commandName === 'points') {
    await interaction.deferReply({ ephemeral: true });
    const sub = options.getSubcommand();
    const user = options.getUser('user');

    if (sub === 'add') {
      const amount = options.getInteger('amount');
      const current = helperPoints.get(user.id) || 0;
      helperPoints.set(user.id, current + amount);
      return interaction.editReply(`Added **${amount}** points to ${user}. New total: **${current + amount}** points.`);
    }

    if (sub === 'remove') {
      const amount = options.getInteger('amount');
      const current = helperPoints.get(user.id) || 0;
      const newTotal = Math.max(0, current - amount);
      helperPoints.set(user.id, newTotal);
      return interaction.editReply(`Removed **${amount}** points from ${user}. New total: **${newTotal}** points.`);
    }

    if (sub === 'reset') {
      if (user) {
        helperPoints.delete(user.id);
        return interaction.editReply(`Reset points for ${user}.`);
      } else {
        helperPoints.clear();
        return interaction.editReply('Reset helper points leaderboard for all users.');
      }
    }
  }

  // `/leaderboard`
  if (commandName === 'leaderboard') {
    await interaction.deferReply();
    if (helperPoints.size === 0) {
      return interaction.editReply('No helper points recorded yet.');
    }

    const sorted = [...helperPoints.entries()].sort((a, b) => b[1] - a[1]);
    const list = sorted.slice(0, 10).map(([id, pts], idx) => `${idx + 1}. <@${id}> — **${pts}** pts`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Helper Leaderboard')
      .setDescription(list)
      .setColor('#f1c40f')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // Moderation Slash Commands (Embed Formatted)
  if (commandName === 'kick') {
    await interaction.deferReply({ ephemeral: true });
    const member = options.getMember('user');
    if (!member.kickable) return interaction.editReply('❌ Cannot kick user.');
    await member.kick(options.getString('reason') || 'No reason provided');
    const embed = new EmbedBuilder().setTitle('User Kicked').setDescription(`Kicked **${member.user.tag}**`).setColor('#e74c3c');
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'ban') {
    await interaction.deferReply({ ephemeral: true });
    const member = options.getMember('user');
    if (!member.bannable) return interaction.editReply('❌ Cannot ban user.');
    await member.ban({ reason: options.getString('reason') || 'No reason provided' });
    const embed = new EmbedBuilder().setTitle('User Banned').setDescription(`Banned **${member.user.tag}**`).setColor('#e74c3c');
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'mute') {
    await interaction.deferReply({ ephemeral: true });
    const member = options.getMember('user');
    const role = interaction.guild.roles.cache.find(r => r.name === 'Muted');
    if (!role) return interaction.editReply('❌ "Muted" role not found.');
    await member.roles.add(role);
    const embed = new EmbedBuilder().setTitle('User Muted').setDescription(`Muted **${member.user.tag}**`).setColor('#e74c3c');
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'lock') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    const embed = new EmbedBuilder().setTitle('Channel Locked').setColor('#e74c3c');
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'unlock') {
    await interaction.deferReply({ ephemeral: true });
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    const embed = new EmbedBuilder().setTitle('Channel Unlocked').setColor('#2ecc71');
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'purge') {
    await interaction.deferReply({ ephemeral: true });
    const amount = options.getInteger('amount');
    await interaction.channel.bulkDelete(amount, true);
    return interaction.editReply(`Cleared ${amount} messages.`);
  }

  if (commandName === 'setprefix') {
    const newPrefix = options.getString('new_prefix');
    const cfg = guildSettings.get(interaction.guildId) || {};
    cfg.prefix = newPrefix;
    guildSettings.set(interaction.guildId, cfg);
    return interaction.reply({ content: `Prefix set to \`${newPrefix}\``, ephemeral: true });
  }

  if (commandName === 'ping') return interaction.reply(`Pong! ${Math.round(client.ws.ping)}ms`);
  if (commandName === 'me') return interaction.reply('Bot maintained by Adlaw.');
});

// --- CRASH PREVENTION ---
process.on('unhandledRejection', (reason) => console.log('Anti-Crash: ', reason));
process.on('uncaughtException', (err) => console.log('Anti-Crash: ', err));

// --- LOGIN ---
client.login(process.env.DISCORD_TOKEN);

// --- HTTP SERVER FOR KEEP-ALIVE ---
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
