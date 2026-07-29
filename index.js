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
const GUILD_ID = '1371775026264670228'; // Your Single Server ID

// --- SUPPORT ROLES FOR EACH TICKET TYPE ---
const ULTRA_SUPPORT_ROLE = '1529499021884919858';
const FARM_SUPPORT_ROLE = '1529499059596038285';
const CONCERN_SUPPORT_ROLE = '1529498802149392614';
// ---------------------------

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

// --- HELPER: TIME PARSER ---
function parseDuration(str) {
  if (!str) return null;
  const unit = str.slice(-1);
  const value = parseInt(str.slice(0, -1));
  if (isNaN(value)) return null;
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// --- HELPER: UWU TRANSLATOR ---
function uwuify(text) {
  const faces = ['(・`ω´・)', ';;w;;', 'owo', 'UwU', '>w<', '^w^'];
  return text.replace(/(?:r|l)/g, 'w').replace(/(?:R|L)/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1').replace(/N([AEIOU])/g, 'Ny$1').replace(/ove/g, 'uv').replace(/!+/g, ' ' + faces[Math.floor(Math.random() * faces.length)] + ' ');
}

// --- SLASH COMMAND DEFINITIONS ---
const commands = [
  { name: 'ping', description: 'Check bot latency' }, 
  {
    name: 'talk',
    description: 'Make the bot say something',
    options: [
      { name: 'message', description: 'What should I say?', type: 3, required: true },
      { name: 'channel', description: 'Where? (Optional)', type: 7, required: false }
    ],
    default_member_permissions: '8'
  },
  { name: 'me', description: 'Credits & Info' },
  {
    name: 'embed',
    description: 'Create a custom embedded message',
    options: [
      { name: 'title', description: 'Title of the embed', type: 3, required: false },
      { name: 'description', description: 'Main text', type: 3, required: false },
      { name: 'color', description: 'Hex Color (e.g. #FF0000)', type: 3, required: false },
      { name: 'image', description: 'Image URL', type: 3, required: false },
      { name: 'thumbnail', description: 'Thumbnail URL', type: 3, required: false },
      { name: 'footer', description: 'Footer text', type: 3, required: false },
      { name: 'channel', description: 'Where to send it?', type: 7, required: false }
    ],
    default_member_permissions: '8'
  },
  { name: 'mute', description: 'Mute user', options: [{ name: 'user', description: 'User', type: 6, required: true }, { name: 'duration', description: 'e.g. 10s, 5m', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'unmute', description: 'Unmute user', options: [{ name: 'user', description: 'User', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'ban', description: 'Ban user', options: [{ name: 'user', description: 'User', type: 6, required: true }, { name: 'reason', description: 'Reason', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'kick', description: 'Kick user', options: [{ name: 'user', description: 'User', type: 6, required: true }, { name: 'reason', description: 'Reason', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'purge', description: 'Delete messages', options: [{ name: 'amount', description: 'Amount', type: 4, required: true }], default_member_permissions: '8' },
  { name: 'lock', description: 'Lock channel', default_member_permissions: '8' },
  { name: 'unlock', description: 'Unlock channel', default_member_permissions: '8' },
  { name: 'deafen', description: 'Deafen user', options: [{ name: 'user', description: 'User', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'undeafen', description: 'Undeafen user', options: [{ name: 'user', description: 'User', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'setprefix', description: 'Change prefix', options: [{ name: 'new_prefix', description: 'Symbol', type: 3, required: true }], default_member_permissions: '8' },
  { name: 'uwulock', description: 'Force a user to speak UwU', options: [{ name: 'user', description: 'User to lock', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'uwuunlock', description: 'Free a user from UwU', options: [{ name: 'user', description: 'User to unlock', type: 6, required: true }], default_member_permissions: '8' },
  { name: 'stick', description: 'Create a reminder', options: [{ name: 'message', description: 'Text', type: 3, required: true }], default_member_permissions: '8' },
  { name: 'unstick', description: 'Remove reminder', default_member_permissions: '8' },
  { name: 'afk', description: 'Set status to AFK', options: [{ name: 'reason', description: 'Reason', type: 3, required: false }] },
  { name: 'snipe', description: 'Show last deleted msg' },
  { name: 'help', description: 'Show commands' },
  { name: 'userinfo', description: 'Get user info', options: [{ name: 'user', description: 'User', type: 6, required: false }] },
  { name: 'avatar', description: 'Get avatar of a user', options: [{ name: 'user', description: 'Select user', type: 6, required: false }] },
  { name: 'welcome-setup', description: 'Setup welcome message', options: [{ name: 'channel', description: 'Channel', type: 7, required: true }, { name: 'message', description: 'Message', type: 3, required: false }, { name: 'type', description: 'Style', type: 3, required: false, choices: [{ name: 'Text', value: 'text' }, { name: 'Embed', value: 'embed' }] }, { name: 'image_url', description: 'Image Link (GIF/PNG) for Embed', type: 3, required: false }, { name: 'color', description: 'Hex Color (e.g. #FF0000)', type: 3, required: false }], default_member_permissions: '8' },
  { name: 'leave-setup', description: 'Setup leave message', options: [{ name: 'channel', description: 'Channel', type: 7, required: true }, { name: 'message', description: 'Message', type: 3, required: false }], default_member_permissions: '8' },
  { 
    name: 'ticketsetup', 
    description: 'Create the multi-button ticket panel', 
    options: [
      { name: 'channel', description: 'Where to post the panel', type: 7, required: true }, 
      { name: 'category', description: 'Where to open ticket channels', type: 7, channel_types: [4], required: false }
    ], 
    default_member_permissions: '8' 
  },
  { 
    name: 'verify-setup', 
    description: 'Setup the AQW Verification Panel', 
    options: [
      { name: 'channel', description: 'Where to post the verify button', type: 7, required: true },
      { name: 'log_channel', description: 'Where verification logs will go', type: 7, required: true },
      { name: 'verified_role', description: 'Role given after verification', type: 8, required: true }
    ], 
    default_member_permissions: '8' 
  },
  { name: 'autoreact-setup', description: 'Auto-react setup', options: [{ name: 'emoji', description: 'Which emoji?', type: 3, required: true }, { name: 'role', description: 'Optional: Filter by this Role', type: 8, required: false }], default_member_permissions: '8' },
  { name: 'autorole-setup', description: 'Set auto role', options: [{ name: 'role', description: 'Role to give new members', type: 8, required: true }], default_member_permissions: '8' },
  { name: 'skullboard-setup', description: 'Skullboard setup', options: [{ name: 'channel', description: 'Where to log skulls', type: 7, required: true }], default_member_permissions: '8' },
  { name: 'boost-setup', description: 'Set boost announcement', options: [{ name: 'channel', description: 'Where to announce boosts', type: 7, required: true }, { name: 'message', description: 'Custom msg (Use {user})', type: 3, required: false }], default_member_permissions: '8' },
  { 
    name: 'reactionrole', 
    description: 'Create a panel with up to 5 role buttons', 
    options: [
      { name: 'title', description: 'Embed title', type: 3, required: true },
      { name: 'description', description: 'Embed main text', type: 3, required: true },
      { name: 'role1', description: 'First role', type: 8, required: true },
      { name: 'emoji1', description: 'Emoji for button 1', type: 3, required: false },
      { name: 'role2', description: 'Second role', type: 8, required: false },
      { name: 'emoji2', description: 'Emoji for button 2', type: 3, required: false },
      { name: 'role3', description: 'Third role', type: 8, required: false },
      { name: 'emoji3', description: 'Emoji for button 3', type: 3, required: false },
      { name: 'role4', description: 'Fourth role', type: 8, required: false },
      { name: 'emoji4', description: 'Emoji for button 4', type: 3, required: false },
      { name: 'role5', description: 'Fifth role', type: 8, required: false },
      { name: 'emoji5', description: 'Emoji for button 5', type: 3, required: false }
    ], 
    default_member_permissions: '8' 
  }
];

// --- STARTUP ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('syntry send dih', { type: ActivityType.Listening });
  const rest = new REST().setToken(client.token);
  
  try {
    if (GUILD_ID === 'PASTE_YOUR_SERVER_ID_HERE') {
      console.log('⚠️ ERROR: YOU FORGOT TO PASTE YOUR SERVER ID AT THE TOP!');
    } else {
      console.log('Clearing global commands...');
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });

      console.log('Registering commands to target server...');
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
      console.log('Commands successfully refreshed and registered.');
    }
  } catch (error) { console.error('Slash error:', error); }
});

// --- TRACK DELETED MESSAGES FOR SNIPE ---
client.on('messageDelete', message => {
  if (message.author?.bot) return;
  snipes.set(message.channel.id, {
    content: message.content,
    author: message.author,
    image: message.attachments.first() ? message.attachments.first().proxyURL : null
  });
});

// --- PREFIX HANDLER (!) ---
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild || message.guild.id !== GUILD_ID) return;

  // 1. UWU LOCK
  if (uwuTargets.has(message.author.id)) {
    try {
      await message.delete();
      const uwuText = uwuify(message.content);
      const nickname = message.member ? message.member.displayName : message.author.username;
      await message.channel.send(`**${nickname}**: ${uwuText}`);
      return;
    } catch (e) {}
  }

  // 2. STICKY MESSAGE RE-POST
  if (stickyMessages.has(message.channel.id)) {
    const stickyData = stickyMessages.get(message.channel.id);
    if (stickyData.lastMsgId) message.channel.messages.delete(stickyData.lastMsgId).catch(() => {});
    const sentSticky = await message.channel.send(`**reminder**\n${stickyData.content}`);
    stickyData.lastMsgId = sentSticky.id;
    stickyMessages.set(message.channel.id, stickyData);
  }

  // 3. AFK NOTIFICATIONS
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkUsers.has(user.id)) {
        message.reply(`**${user.username}** is AFK: ${afkUsers.get(user.id).reason}`);
      }
    });
  }
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    message.reply(`Welcome back **${message.author.username}**! AFK status removed.`);
  }

  // 4. AUTO REACT
  const config = guildSettings.get(message.guild.id);
  if (config && config.autoReactRoles && message.member) {
      message.member.roles.cache.forEach(role => {
          if (config.autoReactRoles.has(role.id)) {
              const emoji = config.autoReactRoles.get(role.id);
              const emojiId = emoji.match(/<a?:.+?:(\d+)>/) ? emoji.match(/<a?:.+?:(\d+)>/)[1] : emoji;
              message.react(emojiId).catch(() => {});
          }
      });
  }

  // 5. PREFIX COMMAND PROCESSING
  const serverPrefix = config?.prefix || defaultPrefix;
  if (!message.content.startsWith(serverPrefix)) return;

  const args = message.content.slice(serverPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === 'ping') return message.reply(`Pong! ${Math.round(client.ws.ping)}ms`);
    
    if (command === 'talk') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ You need Admin permissions.");
        message.delete().catch(()=>{});
        return message.channel.send(args.join(' ') || 'What should I say?');
    }
    
    if (command === 'ban') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("❌ You need Ban Members permission.");
        const target = message.mentions.members.first();
        if(!target) return message.reply('Mention someone to ban.');
        if(!target.bannable) return message.reply('❌ Cannot ban target.');
        await target.ban(); 
        message.reply(`Banned **${target.user.tag}**`);
    }
    
    if (command === 'kick') {
        if(!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("❌ You need Kick Members permission.");
        const target = message.mentions.members.first();
        if(!target) return message.reply('Mention someone to kick.');
        if(!target.kickable) return message.reply('❌ Cannot kick target.');
        await target.kick(); 
        message.reply(`Kicked **${target.user.tag}**`);
    }

    if (command === 'help') {
        const embed = new EmbedBuilder().setTitle('Bot Command Manual').setColor(0x00AAFF).setDescription(`**Prefix:** \`${serverPrefix}\`\nUse \`/\` for Slash Commands or \`${serverPrefix}\` for text commands.`);
        message.reply({embeds:[embed]});
    }

    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder().setTitle(`User: ${member.user.tag}`).addFields({name:'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`}).setColor(0x00AAFF);
        message.reply({embeds:[embed]});
    }

    if (command === 'afk') {
        const reason = args.join(' ') || 'No reason specified';
        afkUsers.set(message.author.id, { reason, time: Date.now() });
        message.reply(`Set your AFK status: ${reason}`);
    }

    if (command === 'snipe') {
        const snipedMsg = snipes.get(message.channel.id);
        if (!snipedMsg) return message.reply('❌ Nothing to snipe!');
        const embed = new EmbedBuilder().setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() }).setDescription(snipedMsg.content || '*(Attachment)*').setColor(0xFF0000).setFooter({text:'Deleted recently'});
        if(snipedMsg.image) embed.setImage(snipedMsg.image);
        message.reply({ embeds: [embed] });
    }
  } catch (e) { console.error('Prefix Error:', e); }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  // BUTTON CLICK HANDLER
  if (interaction.isButton()) {
    // 1. REACTION ROLE BUTTON HANDLER
    if (interaction.customId.startsWith('rr_')) {
        const roleId = interaction.customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        
        if (!role) {
          return interaction.reply({ content: '❌ Target role no longer exists.', ephemeral: true });
        }

        try {
          if (interaction.member.roles.cache.has(roleId)) {
              await interaction.member.roles.remove(roleId);
              return interaction.reply({ content: `Removed role: **${role.name}**`, ephemeral: true });
          } else {
              await interaction.member.roles.add(roleId);
              return interaction.reply({ content: `Added role: **${role.name}**`, ephemeral: true });
          }
        } catch (err) {
          return interaction.reply({ content: '❌ Failed to update role. Check bot hierarchy/permissions.', ephemeral: true });
        }
    }

    // 2. AQW VERIFY BUTTON HANDLER (MODAL WITH GUILD FIELD)
    if (interaction.customId === 'start_verification') {
        const modal = new ModalBuilder().setCustomId('aqw_verify_modal').setTitle('AQW Verification');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('aqw_name')
                    .setLabel('AQW Username')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter your exact in-game character name')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('aqw_guild')
                    .setLabel('Guild Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter your AQW Guild name (or None)')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('aqw_inviter')
                    .setLabel('Who invited you? (Optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Username of person who invited you')
                    .setRequired(false)
            )
        );
        return await interaction.showModal(modal);
    }

    // 3. ADMIN APPROVE VERIFICATION BUTTON
    if (interaction.customId.startsWith('v_approve_')) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ Only staff/admins can approve verification requests.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const ign = parts[3];

        const config = guildSettings.get(interaction.guild.id) || {};
        const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

        if (targetMember) {
            if (config.verifyRoleId) {
                await targetMember.roles.add(config.verifyRoleId).catch(() => {});
            }
            await targetMember.setNickname(ign).catch(() => {});
            await interaction.editReply(`✅ Approved verification for ${targetMember.user.tag} (${ign})!`);
            
            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .setColor(0x00FF00)
                .setFooter({ text: `Approved by ${interaction.user.tag}` });

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('done_app').setLabel(`Approved by ${interaction.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true)
            );
            await interaction.message.edit({ embeds: [updatedEmbed], components: [disabledRow] });
        } else {
            interaction.editReply('❌ User is no longer in this server.');
        }
        return;
    }

    // 4. ADMIN REJECT VERIFICATION BUTTON
    if (interaction.customId.startsWith('v_reject_')) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ Only staff/admins can reject verification requests.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.customId.split('_')[2];
        const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

        if (targetMember) {
            await targetMember.setNickname(null).catch(() => {});
            await interaction.editReply(`❌ Rejected verification for ${targetMember.user.tag}.`);
            
            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .setColor(0xFF0000)
                .setFooter({ text: `Rejected by ${interaction.user.tag}` });

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('done_rej').setLabel(`Rejected by ${interaction.user.username}`).setStyle(ButtonStyle.Danger).setDisabled(true)
            );
            await interaction.message.edit({ embeds: [updatedEmbed], components: [disabledRow] });
        } else {
            interaction.editReply('❌ User is no longer in this server.');
        }
        return;
    }

    // 5. TICKET OPEN BUTTON HANDLER
    if (['ticket_ultra', 'ticket_farm', 'ticket_concern'].includes(interaction.customId)) {
        const type = interaction.customId.replace('ticket_', '');
        const chName = `${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        if (interaction.guild.channels.cache.find(c => c.name === chName)) {
            return interaction.reply({ content: `❌ You already have an open ${type} ticket!`, ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(`Open ${type.toUpperCase()} Ticket`);

        if (type === 'ultra' || type === 'farm') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_ign').setLabel('IGN').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_server').setLabel('SERVER').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_maproom').setLabel('MAP & ROOM NO.').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_desc').setLabel('DESC').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else { // Concern / Support
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }

        await interaction.showModal(modal);
    }

    // 6. TICKET CLOSE BUTTON HANDLER
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing ticket...');
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 3000);
    }
    return;
  }

  // MODAL SUBMISSIONS
  if (interaction.isModalSubmit()) {
    // A. VERIFICATION PANEL SETUP MODAL
    if (interaction.customId.startsWith('verify_modal_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const parts = interaction.customId.split('_');
        const channelId = parts[2];
        const logChannelId = parts[3];
        const roleId = parts[4];

        const title = interaction.fields.getTextInputValue('verify_title');
        const desc = interaction.fields.getTextInputValue('verify_desc');

        const channel = interaction.guild.channels.cache.get(channelId);

        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.verifyLogChannelId = logChannelId;
        cfg.verifyRoleId = roleId;
        guildSettings.set(interaction.guildId, cfg);

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(0x00FF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_verification')
                .setLabel('Verify Account')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        if (channel) {
            await channel.send({ embeds: [embed], components: [row] });
            interaction.editReply(`Verification panel successfully posted to ${channel}!`);
        } else {
            interaction.editReply('❌ Could not find target channel.');
        }
        return;
    }

    // B. AQW VERIFICATION USER SUBMISSION
    if (interaction.customId === 'aqw_verify_modal') {
        await interaction.deferReply({ ephemeral: true });

        const ign = interaction.fields.getTextInputValue('aqw_name').trim();
        const guildInput = interaction.fields.getTextInputValue('aqw_guild')?.trim() || 'None';
        const inviterInput = interaction.fields.getTextInputValue('aqw_inviter')?.trim() || '';

        const config = guildSettings.get(interaction.guild.id) || {};
        
        try {
            await interaction.member.setNickname(ign);
        } catch (e) {
            console.log("Could not change nickname.");
        }

        let inviterText = 'None';
        if (inviterInput) {
            const foundInviter = interaction.guild.members.cache.find(m => 
                m.user.username.toLowerCase() === inviterInput.toLowerCase() || 
                m.displayName.toLowerCase() === inviterInput.toLowerCase()
            );

            if (foundInviter) {
                inviterText = `${foundInviter} invited me`;
            } else {
                inviterText = `${inviterInput} invited me`;
            }
        }

        const logRoleText = config.verifyRoleId ? `<@&${config.verifyRoleId}>` : '@unknown-role';
        const charPageUrl = `https://account.aq.com/CharPage?id=${encodeURIComponent(ign)}`;

        const logEmbed = new EmbedBuilder()
            .setTitle('📋 New Verification Request')
            .setColor(0xFFA500)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User', value: `${interaction.user}`, inline: true },
                { name: 'AQW Username', value: `[${ign}](${charPageUrl})`, inline: true },
                { name: 'Guild', value: guildInput, inline: true },
                { name: 'Role To Give', value: logRoleText, inline: true },
                { name: 'Invited By', value: inviterText, inline: true }
            )
            .setTimestamp();

        const adminActionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`v_approve_${interaction.user.id}_${ign}`)
                .setLabel('Approve Verification')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`v_reject_${interaction.user.id}`)
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✖️')
        );

        if (config.verifyLogChannelId) {
            const logCh = interaction.guild.channels.cache.get(config.verifyLogChannelId);
            if (logCh) {
                await logCh.send({ embeds: [logEmbed], components: [adminActionRow] });
            }
        }

        return interaction.editReply(`✅ Verification request submitted for **${ign}**! Your nickname has been updated and sent to staff for instant role approval.`);
    }

    // C. TICKET SETUP MODAL
    if (interaction.customId.startsWith('ts_modal_')) {
        await interaction.deferReply({ ephemeral: true });
        
        const parts = interaction.customId.split('_');
        const channelId = parts[2];
        const categoryId = parts[3];

        const title = interaction.fields.getTextInputValue('panel_title');
        const desc = interaction.fields.getTextInputValue('panel_desc');

        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (categoryId !== 'none') {
            const cfg = guildSettings.get(interaction.guildId) || {};
            cfg.ticketCategory = categoryId;
            guildSettings.set(interaction.guildId, cfg);
        }

        const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2F3136);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_ultra').setLabel('Ultra Help').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
          new ButtonBuilder().setCustomId('ticket_farm').setLabel('Farm Help').setStyle(ButtonStyle.Success).setEmoji('👾'),
          new ButtonBuilder().setCustomId('ticket_concern').setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('🎟️')
        );

        if (channel) {
            await channel.send({ embeds: [embed], components: [row] });
            interaction.editReply(`Ticket panel successfully posted to ${channel}!`);
        } else {
            interaction.editReply('❌ Could not find target channel.');
        }
        return;
    }

    // D. USER TICKET CREATION MODAL
    if (interaction.customId.startsWith('modal_')) {
        await interaction.deferReply({ ephemeral: true });
        const type = interaction.customId.replace('modal_', '');
        const desc = interaction.fields.getTextInputValue('ticket_desc');
        const chName = `${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const config = guildSettings.get(interaction.guild.id) || {};
        
        try {
            let overwrites = [];

            if (type === 'ultra' || type === 'farm') {
                overwrites = [
                  { id: interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel] }
                ];
            } else if (type === 'concern') {
                overwrites = [
                  { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
                  { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
                ];

                if (CONCERN_SUPPORT_ROLE) {
                    overwrites.push({
                        id: CONCERN_SUPPORT_ROLE,
                        allow: [PermissionsBitField.Flags.ViewChannel]
                    });
                }
            }

            const ch = await interaction.guild.channels.create({
                name: chName, 
                type: ChannelType.GuildText, 
                parent: config.ticketCategory,
                permissionOverwrites: overwrites
            });

            const embed = new EmbedBuilder()
                .setTitle(`Ticket (${type.toUpperCase()})`)
                .setColor(0x0099FF);

            if (type === 'ultra' || type === 'farm') {
                const ign = interaction.fields.getTextInputValue('ticket_ign');
                const server = interaction.fields.getTextInputValue('ticket_server');
                const maproom = interaction.fields.getTextInputValue('ticket_maproom');

                embed.setDescription(
                    `**User:** ${interaction.user}\n` +
                    `**IGN:** ${ign}\n` +
                    `**SERVER:** ${server}\n` +
                    `**MAP & ROOM NO.:** ${maproom}\n` +
                    `**DESC:** ${desc}`
                );
            } else {
                const subject = interaction.fields.getTextInputValue('ticket_subject');
                embed.setTitle(`Ticket (${type.toUpperCase()}): ${subject}`);
                embed.setDescription(`**User:** ${interaction.user}\n**Desc:** ${desc}`);
            }
                
            const btn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            
            let mentions = `${interaction.user}`;
            if (type === 'ultra' && ULTRA_SUPPORT_ROLE) mentions += ` <@&${ULTRA_SUPPORT_ROLE}>`;
            if (type === 'farm' && FARM_SUPPORT_ROLE) mentions += ` <@&${FARM_SUPPORT_ROLE}>`;
            if (type === 'concern' && CONCERN_SUPPORT_ROLE) mentions += ` <@&${CONCERN_SUPPORT_ROLE}>`;

            await ch.send({ content: `${mentions}`, embeds: [embed], components: [btn] });
            interaction.editReply(`Created your ticket: ${ch}`);
        } catch(e) { 
            console.error('Ticket Creation Error:', e);
            interaction.editReply('❌ Error creating ticket channel.'); 
        }
        return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  // --- SLASH COMMAND HANDLERS ---
  try {
    const { commandName, options } = interaction;

    if (commandName === 'verify-setup') {
        const channel = options.getChannel('channel');
        const logChannel = options.getChannel('log_channel');
        const verifiedRole = options.getRole('verified_role');

        const modal = new ModalBuilder()
            .setCustomId(`verify_modal_${channel.id}_${logChannel.id}_${verifiedRole.id}`)
            .setTitle('Verification Panel Setup');

        const titleInput = new TextInputBuilder()
            .setCustomId('verify_title')
            .setLabel('Panel Title')
            .setStyle(TextInputStyle.Short)
            .setValue('AQW Account Verification')
            .setRequired(true);

        const descInput = new TextInputBuilder()
            .setCustomId('verify_desc')
            .setLabel('Description (Shift + Enter supported!)')
            .setStyle(TextInputStyle.Paragraph)
            .setValue('Click the button below to verify your AQW account and get access to the server.')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );

        return await interaction.showModal(modal);
    }

    if (commandName === 'ticketsetup') {
        const channel = options.getChannel('channel');
        const category = options.getChannel('category');

        const modal = new ModalBuilder()
            .setCustomId(`ts_modal_${channel.id}_${category ? category.id : 'none'}`)
            .setTitle('Ticket Panel Setup');

        const titleInput = new TextInputBuilder()
            .setCustomId('panel_title')
            .setLabel('Panel Title')
            .setStyle(TextInputStyle.Short)
            .setValue('Please select the specific ticket for your concern.')
            .setRequired(true);

        const descInput = new TextInputBuilder()
            .setCustomId('panel_desc')
            .setLabel('Description (Shift + Enter supported!)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );

        return await interaction.showModal(modal);
    }

    if (commandName === 'purge') {
        await interaction.deferReply({ ephemeral: true }); 
        const amt = options.getInteger('amount');
        if (amt > 100) return interaction.editReply('❌ Max 100.');
        await interaction.channel.bulkDelete(amt, true).catch(() => interaction.editReply("❌ Error deleting (messages too old?)."));
        return interaction.editReply(`Deleted ${amt} messages.`);
    }

    await interaction.deferReply({ ephemeral: false });

    if (commandName === 'ping') {
        interaction.editReply(`Pong! ${Math.round(client.ws.ping)}ms`);
    } 
    else if (commandName === 'talk') {
        await (options.getChannel('channel')||interaction.channel).send(options.getString('message'));
        interaction.editReply('Sent.');
    }
    else if (commandName === 'me') {
        interaction.editReply('This bot was made out of boredom by **Adlaw**.');
    }
    else if (commandName === 'setprefix') {
        const newPrefix = options.getString('new_prefix');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.prefix = newPrefix;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`Prefix changed to: \`${newPrefix}\``);
    }
    else if (commandName === 'embed') {
        const title = options.getString('title');
        const description = options.getString('description');
        const color = options.getString('color') || '#0099FF';
        const image = options.getString('image');
        const thumbnail = options.getString('thumbnail');
        const footer = options.getString('footer');
        const targetChannel = options.getChannel('channel') || interaction.channel;

        const embed = new EmbedBuilder().setColor(color);
        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description.replace(/\\n/g, '\n'));
        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (footer) embed.setFooter({ text: footer });

        await targetChannel.send({ embeds: [embed] });
        interaction.editReply({ content: 'Embed sent!', ephemeral: true });
    }
    else if (commandName === 'ban') {
        const user = options.getMember('user');
        if(!user.bannable) return interaction.editReply('❌ Cannot ban.');
        await user.ban({ reason: options.getString('reason') });
        interaction.editReply(`Banned **${user.user.tag}**`);
    }
    else if (commandName === 'kick') {
        const user = options.getMember('user');
        if(!user.kickable) return interaction.editReply('❌ Cannot kick.');
        await user.kick(options.getString('reason'));
        interaction.editReply(`Kicked **${user.user.tag}**`);
    }
    else if (commandName === 'userinfo') {
        const user = options.getMember('user') || interaction.member;
        const embed = new EmbedBuilder().setTitle(`User: ${user.user.tag}`).addFields({name:'Joined', value:`<t:${Math.floor(user.joinedTimestamp/1000)}:R>`}).setColor(0x00AAFF);
        interaction.editReply({embeds:[embed]});
    }
    else if (commandName === 'avatar') {
        const targetUser = options.getUser('user') || interaction.user;
        const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
        
        const embed = new EmbedBuilder()
            .setTitle(`Avatar for ${targetUser.username}`)
            .setImage(avatarUrl)
            .setColor(0x00AAFF);

        interaction.editReply({ embeds: [embed] });
    }
    else if (commandName === 'help') {
        const embed = new EmbedBuilder().setTitle('Bot Command Manual').setColor(0x00AAFF).setDescription(`**Prefix:** \`${defaultPrefix}\`\nUse \`/\` for Slash Commands or \`${defaultPrefix}\` for text commands.`)
            .addFields(
                { name: 'Admin / Mod', value: '`ban`, `kick`, `mute`, `unmute`, `lock`, `unlock`, `purge`\n`deafen`, `undeafen`, `stick`, `unstick`\n`setprefix`, `talk`, `embed`, `uwulock`' },
                { name: 'Public / Fun', value: '`ping`, `afk`, `snipe`, `userinfo`, `avatar`, `me`, `help`' },
                { name: 'Setup (Slash Only)', value: '`/ticketsetup`, `/verify-setup`, `/welcome-setup`, `/leave-setup`\n`/autorole-setup`, `/autoreact-setup`\n`/skullboard-setup`, `/reactionrole`, `/boost-setup`' }
            );
        interaction.editReply({embeds:[embed]});
    }
    else if (commandName === 'autoreact-setup') {
        const emoji = options.getString('emoji');
        const role = options.getRole('role');
        const cfg = guildSettings.get(interaction.guildId) || {};
        if (!cfg.autoReactRoles) cfg.autoReactRoles = new Map();
        cfg.autoReactRoles.set(role.id, emoji);
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`Auto-react setup for **${role.name}**`);
    }
    else if (commandName === 'autorole-setup') {
        const role = options.getRole('role');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.autoRoleId = role.id;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply(`Auto role set: **${role.name}**`);
    }
    else if (commandName === 'welcome-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.welcomeChannelId = ch.id;
        cfg.welcomeMessage = options.getString('message');
        cfg.welcomeType = options.getString('type');
        cfg.welcomeImage = options.getString('image_url');
        cfg.welcomeColor = options.getString('color');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Welcome message configured.');
    }
    else if (commandName === 'leave-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.leaveChannelId = ch.id;
        cfg.leaveMessage = options.getString('message');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Leave message configured.');
    }
    else if (commandName === 'boost-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.boostChannelId = ch.id;
        cfg.boostMessage = options.getString('message');
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Boost message configured.');
    }
    else if (commandName === 'skullboard-setup') {
        const ch = options.getChannel('channel');
        const cfg = guildSettings.get(interaction.guildId) || {};
        cfg.skullboardId = ch.id;
        guildSettings.set(interaction.guildId, cfg);
        interaction.editReply('Skullboard channel configured.');
    }
    else if (commandName === 'reactionrole') {
        const title = options.getString('title');
        const desc = options.getString('description');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(0x0099FF);

        const row = new ActionRowBuilder();

        for (let i = 1; i <= 5; i++) {
            const role = options.getRole(`role${i}`);
            const rawEmoji = options.getString(`emoji${i}`);

            if (role) {
                const btn = new ButtonBuilder()
                    .setCustomId(`rr_${role.id}`)
                    .setLabel(role.name)
                    .setStyle(ButtonStyle.Primary);

                if (rawEmoji) {
                    try {
                        const match = rawEmoji.match(/<a?:.+?:(\d+)>/);
                        if (match) {
                            btn.setEmoji(match[1]);
                        } else {
                            btn.setEmoji(rawEmoji.trim());
                        }
                    } catch (e) {
                        console.log(`Emoji issue on button ${i}, continuing without it.`);
                    }
                }

                row.addComponents(btn);
            }
        }

        await interaction.channel.send({ embeds: [embed], components: [row] });
        interaction.editReply({ content: 'Reaction role panel posted!', ephemeral: true });
    }
    else if (commandName === 'mute') {
        const user = options.getMember('user');
        const dStr = options.getString('duration');
        const role = interaction.guild.roles.cache.find(r=>r.name==='Muted');
        if(!role) return interaction.editReply('❌ "Muted" role missing.');
        await user.roles.add(role);
        interaction.editReply(`Muted **${user.user.tag}**`);
        const ms = parseDuration(dStr);
        if(ms) setTimeout(()=> user.roles.remove(role).catch(()=>{}), ms);
    }
    else if (commandName === 'unmute') {
        const user = options.getMember('user');
        const role = interaction.guild.roles.cache.find(r=>r.name==='Muted');
        await user.roles.remove(role);
        interaction.editReply('Unmuted.');
    }
    else if (commandName === 'lock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        interaction.editReply('Locked.');
    }
    else if (commandName === 'unlock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        interaction.editReply('Unlocked.');
    }
    else if (commandName === 'deafen') {
        const user = options.getMember('user');
        if(!user.voice.channel) return interaction.editReply('❌ User not in voice channel.');
        await user.voice.setDeaf(true);
        interaction.editReply(`Deafened ${user.user.tag}.`);
    }
    else if (commandName === 'undeafen') {
        const user = options.getMember('user');
        if(!user.voice.channel) return interaction.editReply('❌ User not in voice channel.');
        await user.voice.setDeaf(false);
        interaction.editReply(`Undeafened ${user.user.tag}.`);
    }
    else if (commandName === 'uwulock') {
        const target = options.getUser('user');
        uwuTargets.add(target.id);
        interaction.editReply(`**${target.username}** is now UwU locked.`);
    }
    else if (commandName === 'uwuunlock') {
        const target = options.getUser('user');
        uwuTargets.delete(target.id);
        interaction.editReply(`**${target.username}** is freed from UwU lock.`);
    }
    else if (commandName === 'stick') {
        const text = options.getString('message');
        const sent = await interaction.channel.send(`**reminder**\n${text}`);
        stickyMessages.set(interaction.channelId, { content: text, lastMsgId: sent.id });
        interaction.editReply({content: 'Message stuck!', ephemeral: true});
    }
    else if (commandName === 'unstick') {
        if (stickyMessages.has(interaction.channelId)) {
            const d = stickyMessages.get(interaction.channelId);
            interaction.channel.messages.delete(d.lastMsgId).catch(()=>{});
            stickyMessages.delete(interaction.channelId);
            interaction.editReply('Reminder removed.');
        } else {
            interaction.editReply('❌ No sticky message in this channel.');
        }
    }
    else if (commandName === 'afk') {
        const reason = options.getString('reason') || 'No reason';
        afkUsers.set(interaction.user.id, { reason, time: Date.now() });
        interaction.editReply(`AFK set: ${reason}`);
    }
    else if (commandName === 'snipe') {
        const snipedMsg = snipes.get(interaction.channelId);
        if (!snipedMsg) return interaction.editReply('❌ Nothing to snipe!');
        const embed = new EmbedBuilder().setAuthor({ name: snipedMsg.author.tag, iconURL: snipedMsg.author.displayAvatarURL() }).setDescription(snipedMsg.content || '*(Attachment)*').setColor(0xFF0000).setFooter({text:'Deleted recently'});
        if(snipedMsg.image) embed.setImage(snipedMsg.image);
        interaction.editReply({ embeds: [embed] });
    }
  } catch (err) { interaction.editReply('❌ Error: ' + err.message).catch(()=>{}); }
});

// --- CRASH PREVENTION ---
process.on('unhandledRejection', (reason, p) => console.log('Anti-Crash: ', reason));
process.on('uncaughtException', (err, origin) => console.log('Anti-Crash: ', err));

// --- LOGIN ---
console.log('Starting bot, trying to login...');
client.login(process.env.DISCORD_TOKEN);

const http = require('http');

// Simple HTTP server to keep Render happy
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
