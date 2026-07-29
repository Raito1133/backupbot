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
const helperPoints = new Map();

// --- UWU TRANSLATOR ---
function uwuify(text) {
  const faces = ['(・`ω´・)', ';;w;;', 'owo', 'UwU', '>w<', '^w^'];
  return text.replace(/(?:r|l)/g, 'w').replace(/(?:R|L)/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1').replace(/N([AEIOU])/g, 'Ny$1').replace(/ove/g, 'uv').replace(/!+/g, ' ' + faces[Math.floor(Math.random() * faces.length)] + ' ');
}

// --- SLASH COMMAND DEFINITIONS (USING PARAMETERS/OPTIONS) ---
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
    description: 'Create a custom embed using command parameters',
    options: [
      { name: 'description', description: 'Main text/body of the embed (use \\n for new lines)', type: 3, required: true },
      { name: 'title', description: 'Title of the embed', type: 3, required: false },
      { name: 'channel', description: 'Channel to send embed (Defaults to current)', type: 7, required: false },
      { name: 'image', description: 'Image URL banner', type: 3, required: false }
    ],
    default_member_permissions: '8' 
  },
  { 
    name: 'ticket-setup', 
    description: 'Setup the AQW In-Game Help Ticket Panel', 
    options: [
      { name: 'channel', description: 'Target channel to post the panel', type: 7, required: true },
      { name: 'title', description: 'Title for the panel embed', type: 3, required: true },
      { name: 'description', description: 'Description text (use \\n for new lines)', type: 3, required: true },
      { name: 'category', description: 'Category channel where open ticket channels will be created', type: 7, channel_types: [4], required: false },
      { name: 'image', description: 'Banner Image URL', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'verify-setup', 
    description: 'Setup AQW Verification Panel', 
    options: [
      { name: 'channel', description: 'Channel to post verification panel', type: 7, required: true },
      { name: 'log_channel', description: 'Channel for verification logs', type: 7, required: true },
      { name: 'verified_role', description: 'Role assigned upon approval', type: 8, required: true },
      { name: 'title', description: 'Title of verification panel', type: 3, required: true },
      { name: 'description', description: 'Description text', type: 3, required: true }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'welcome-setup', 
    description: 'Configure welcome message', 
    options: [
      { name: 'channel', description: 'Channel to send welcome messages', type: 7, required: true },
      { name: 'title', description: 'Embed Title', type: 3, required: true },
      { name: 'description', description: 'Text description (Supports {user}, {server}, {count})', type: 3, required: true },
      { name: 'image', description: 'Banner Image URL', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'leave-setup', 
    description: 'Configure leave message', 
    options: [
      { name: 'channel', description: 'Channel to send leave messages', type: 7, required: true },
      { name: 'title', description: 'Embed Title', type: 3, required: true },
      { name: 'description', description: 'Text description (Supports {user}, {server})', type: 3, required: true },
      { name: 'image', description: 'Banner Image URL', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'boost-setup', 
    description: 'Configure boost message', 
    options: [
      { name: 'channel', description: 'Channel to send boost messages', type: 7, required: true },
      { name: 'title', description: 'Embed Title', type: 3, required: true },
      { name: 'description', description: 'Text description (Supports {user})', type: 3, required: true },
      { name: 'image', description: 'Banner Image URL', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'reactionrole', 
    description: 'Create a button reaction-role panel', 
    options: [
      { name: 'channel', description: 'Channel to post panel', type: 7, required: true },
      { name: 'title', description: 'Panel Title', type: 3, required: true },
      { name: 'description', description: 'Panel Description', type: 3, required: true },
      { name: 'role1', description: 'First Role', type: 8, required: true },
      { name: 'label1', description: 'Button Label for Role 1', type: 3, required: true },
      { name: 'emoji1', description: 'Emoji for Role 1 Button', type: 3, required: false },
      { name: 'role2', description: 'Second Role', type: 8, required: false },
      { name: 'label2', description: 'Button Label for Role 2', type: 3, required: false },
      { name: 'emoji2', description: 'Emoji for Role 2 Button', type: 3, required: false }
    ], 
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
    .setDescription(desc.replace(/\\n/g, '\n'))
    .setColor('#f1c40f')
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
    .setDescription(desc.replace(/\\n/g, '\n'))
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

    // Category Ticket Creation Buttons
    if (interaction.customId.startsWith('tselect_')) {
      const categoryName = interaction.customId.replace('tselect_', '').replace(/_/g, ' ');
      await interaction.deferReply({ ephemeral: true });

      const cfg = guildSettings.get(interaction.guild.id) || {};
      const chName = `ticket-${categoryName}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

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
        .setTitle(`🎫 Help Ticket: ${categoryName.toUpperCase()}`)
        .setDescription(`**Requested By:** ${interaction.user}\n\nPlease state your IGN, room/server details, or help request below. Staff will be with you shortly.`)
        .setColor('#3498db')
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
      return interaction.editReply(`Ticket channel created: ${ticketChannel}`);
    }

    // Close Ticket Button
    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 Closing ticket in 3 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      return;
    }
  }

  // B. SLASH COMMAND HANDLERS
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  // /ticket-setup (No Modal)
  if (commandName === 'ticket-setup') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const title = options.getString('title');
    const desc = options.getString('description').replace(/\\n/g, '\n');
    const category = options.getChannel('category');
    const image = options.getString('image');

    if (category) {
      const cfg = guildSettings.get(interaction.guild.id) || {};
      cfg.ticketCategory = category.id;
      guildSettings.set(interaction.guild.id, cfg);
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor('#2b2d31')
      .setFooter({ text: 'You can only have 1 open ticket at a time.' });

    if (image && image.startsWith('http')) embed.setImage(image);

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

    await channel.send({ embeds: [embed], components: [row1, row2, row3, row4] });
    return interaction.editReply('✅ Ticket panel successfully posted!');
  }

  // /embed (No Modal)
  if (commandName === 'embed') {
    await interaction.deferReply({ ephemeral: true });
    const targetChannel = options.getChannel('channel') || interaction.channel;
    const title = options.getString('title');
    const desc = options.getString('description').replace(/\\n/g, '\n');
    const image = options.getString('image');

    const embed = new EmbedBuilder().setDescription(desc).setColor('#3498db');
    if (title) embed.setTitle(title);
    if (image && image.startsWith('http')) embed.setImage(image);

    await targetChannel.send({ embeds: [embed] });
    return interaction.editReply('✅ Embed posted!');
  }

  // /welcome-setup (No Modal)
  if (commandName === 'welcome-setup') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const cfg = guildSettings.get(interaction.guild.id) || {};

    cfg.welcomeChannelId = channel.id;
    cfg.welcomeTitle = options.getString('title');
    cfg.welcomeDesc = options.getString('description');
    cfg.welcomeImage = options.getString('image');

    guildSettings.set(interaction.guild.id, cfg);
    return interaction.editReply('✅ Welcome Embed configured successfully!');
  }

  // /leave-setup (No Modal)
  if (commandName === 'leave-setup') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const cfg = guildSettings.get(interaction.guild.id) || {};

    cfg.leaveChannelId = channel.id;
    cfg.leaveTitle = options.getString('title');
    cfg.leaveDesc = options.getString('description');
    cfg.leaveImage = options.getString('image');

    guildSettings.set(interaction.guild.id, cfg);
    return interaction.editReply('✅ Leave Embed configured successfully!');
  }

  // /boost-setup (No Modal)
  if (commandName === 'boost-setup') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const cfg = guildSettings.get(interaction.guild.id) || {};

    cfg.boostChannelId = channel.id;
    cfg.boostTitle = options.getString('title');
    cfg.boostDesc = options.getString('description');
    cfg.boostImage = options.getString('image');

    guildSettings.set(interaction.guild.id, cfg);
    return interaction.editReply('✅ Boost Embed configured successfully!');
  }

  // /verify-setup (No Modal)
  if (commandName === 'verify-setup') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const logChannel = options.getChannel('log_channel');
    const role = options.getRole('verified_role');
    const title = options.getString('title');
    const desc = options.getString('description').replace(/\\n/g, '\n');

    const cfg = guildSettings.get(interaction.guild.id) || {};
    cfg.verifyLogChannelId = logChannel.id;
    cfg.verifyRoleId = role.id;
    guildSettings.set(interaction.guild.id, cfg);

    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#2ecc71');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('start_verification').setLabel('Verify Account').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    await channel.send({ embeds: [embed], components: [row] });
    return interaction.editReply('✅ Verification panel posted!');
  }

  // /reactionrole (No Modal)
  if (commandName === 'reactionrole') {
    await interaction.deferReply({ ephemeral: true });
    const channel = options.getChannel('channel');
    const title = options.getString('title');
    const desc = options.getString('description').replace(/\\n/g, '\n');

    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor('#3498db');
    const row = new ActionRowBuilder();

    const role1 = options.getRole('role1');
    const label1 = options.getString('label1');
    const emoji1 = options.getString('emoji1');

    const btn1 = new ButtonBuilder().setCustomId(`rr_${role1.id}`).setLabel(label1).setStyle(ButtonStyle.Primary);
    if (emoji1) btn1.setEmoji(emoji1);
    row.addComponents(btn1);

    const role2 = options.getRole('role2');
    const label2 = options.getString('label2');
    const emoji2 = options.getString('emoji2');

    if (role2 && label2) {
      const btn2 = new ButtonBuilder().setCustomId(`rr_${role2.id}`).setLabel(label2).setStyle(ButtonStyle.Primary);
      if (emoji2) btn2.setEmoji(emoji2);
      row.addComponents(btn2);
    }

    await channel.send({ embeds: [embed], components: [row] });
    return interaction.editReply('✅ Reaction Role panel posted!');
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

  // Moderation Commands
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
