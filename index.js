const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
  ActivityType
} = require('discord.js');
const http = require('http');

// --- ⚠️ CONFIGURATION ⚠️ ---
const GUILD_ID = '1371775026264670228'; // Server ID
const ULTRA_HELPER_ROLE_ID = '1529499021884919858'; // Ultra Helper Role ID
const HELPER_ROLE_ID = '1529499059596038285'; // Standard Helper / Farming Role ID
const SUPPORT_ROLE_ID = '1529498802149392614'; // Support Role ID

const TICKET_GUIDE_URL = 'https://discord.com'; 
const STANDARD_BANNER_URL = 'https://i.pinimg.com/originals/5d/d8/0f/5dd80fe00a06651f3200aea753987f50.gif';

const AQW_SERVERS = [
  { label: 'Twilly', emoji: { id: '1534938699190763542', name: 'sadtwilly', animated: false } },
  { label: 'Twig', emoji: { id: '1534938798545305711', name: 'twighappy', animated: false } },
  { label: 'Artix', emoji: { id: '1534938821974556854', name: 'artixkek', animated: false } },
  { label: 'Gravelyn', emoji: '⚔️' },
  { label: 'Sir Ver', emoji: '⚔️' },
  { label: 'Galanoth', emoji: '⚔️' },
  { label: 'Yorumi', emoji: '⚔️' },
  { label: 'Espada', emoji: '⚔️' },
  { label: 'Sepulchure', emoji: { id: '1534938847518130247', name: 'toocloseSeppy', animated: false } },
  { label: 'Safiria', emoji: '⚔️' },
  { label: 'Swordhaven (EU)', emoji: '⚔️' },
  { label: 'Alteon', emoji: '⚔️' },
  { label: 'Yokai (SEA)', emoji: '⚔️' }
];

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
const userRequestCounts = new Map();
const guildSettings = new Map();
const roleRewards = new Map();
const tempTicketCache = new Map();
const pendingVerifications = new Map();
const userRejectionReasons = new Map();
const activeGiveaways = new Map();
const snipeCache = new Map(); // Store deleted messages for snipe command

let ticketCounter = 0;

const globalStats = {
  totalTicketsCompleted: 0,
  totalPointsGiven: 0,
  totalBossesSlain: 0
};

// --- SNIPE EVENT LISTENER ---
client.on(Events.MessageDelete, (message) => {
  if (!message.guild || message.guild.id !== GUILD_ID || message.author?.bot) return;
  snipeCache.set(message.channel.id, {
    content: message.content || '[No text content / Embed / Image]',
    author: message.author,
    image: message.attachments.first()?.proxyURL || null,
    createdAt: message.createdAt
  });
});

// --- ⚙️ ORIGINAL CUSTOM TICKET PRESETS & BANNERS ---
const TICKET_PRESETS = {
  farming: { 
    label: 'Farming Assistance', 
    max: 6, 
    points: 3, 
    pingRoleIds: [HELPER_ROLE_ID],
    bannerUrl: 'https://media.discordapp.net/attachments/1258198097293611131/1534961239598432368/6.png?ex=6a76078d&is=6a74b60d&hm=8f0ef43ee15c9a77eb4db7a93f72a13ed220524e73fa9bd105894b9e47e40208&=&format=webp&quality=lossless&width=2048&height=1024',
    accentColor: 0xFDE37C 
  },
  ultra_weeklies: { 
    label: 'Ultra Weeklies', 
    max: 3, 
    points: 3, 
    pingRoleIds: [ULTRA_HELPER_ROLE_ID],
    bannerUrl: 'https://media.discordapp.net/attachments/1258198097293611131/1534961237132050705/1.png?ex=6a76078d&is=6a74b60d&hm=c653e9de44bf6517cf997847ec6dbc9987387aed4dea2ea0823059f54f83a956&=&format=webp&quality=lossless&width=2048&height=1024',
    accentColor: 0xFCDD62 
  },
  seven_man_dailies: { 
    label: '7-Man Dailies', 
    max: 6, 
    points: 2, 
    pingRoleIds: [ULTRA_HELPER_ROLE_ID, HELPER_ROLE_ID],
    bannerUrl: 'https://media.discordapp.net/attachments/1258198097293611131/1534961238180626622/3.png?ex=6a76078d&is=6a74b60d&hm=5060584863f037151aada431ad3fba73ab18e43cf5ed3782182f5d9615b7de3d&=&format=webp&quality=lossless&width=2048&height=1024',
    accentColor: 0xFCD748 
  },
  ultra_dailies: { 
    label: 'Ultra Dailies', 
    max: 3, 
    points: 2, 
    pingRoleIds: [ULTRA_HELPER_ROLE_ID],
    bannerUrl: 'https://media.discordapp.net/attachments/1258198097293611131/1534961237597753374/2.png?ex=6a76078d&is=6a74b60d&hm=647568baa92f754e4dc7e20d48763f641a55322a976cd0d8b678093beab79343&=&format=webp&quality=lossless&width=2048&height=1024',
    accentColor: 0xFBD12D 
  },
  server_ticket: { 
    label: 'Server Ticket / Support', 
    max: 2, 
    points: 0, 
    pingRoleIds: [SUPPORT_ROLE_ID],
    bannerUrl: 'https://media.discordapp.net/attachments/1258198097293611131/1534961238772154518/4.png?ex=6a76078d&is=6a74b60d&hm=93e443b70e802d77bfe911218676839568cfa0a0361724e865be80233fdd415c&=&format=webp&quality=lossless&width=2048&height=1024',
    accentColor: 0xFBCC13 
  },
  boss_help: { 
    label: 'General Boss Help', 
    max: 6, 
    points: 2, 
    pingRoleIds: [HELPER_ROLE_ID],
    bannerUrl: STANDARD_BANNER_URL,
    accentColor: 0x856A02 
  },
  spamming: { 
    label: 'Spamming', 
    max: 6, 
    points: 1, 
    pingRoleIds: [HELPER_ROLE_ID],
    bannerUrl: 'https://media.discordapp.net/attachments/1258198097293611131/1534961239157899527/5.png?ex=6a76078d&is=6a74b60d&hm=b94b6cf605487010f0cd4f6f14a7e37603127fc8fdd6f333934947aab42f255f&=&format=webp&quality=lossless&width=2048&height=1024',
    accentColor: 0xEFBF04 
  }
};

// --- LIVE STATS UPDATER ---
async function updateLiveStatsMessage(guild) {
  try {
    const cfg = guildSettings.get(guild.id) || {};
    if (!cfg.statsChannelId || !cfg.statsMessageId) return;

    const channel = guild.channels.cache.get(cfg.statsChannelId);
    if (!channel) return;

    const msg = await channel.messages.fetch(cfg.statsMessageId).catch(() => null);
    if (!msg) return;

    const statsEmbed = new EmbedBuilder()
      .setTitle(`Ticket stats`)
      .setDescription(
        `🎫 **\`${globalStats.totalTicketsCompleted}\`** tickets completed.\n` +
        `🏅 **\`${globalStats.totalPointsGiven}\`** points given out.\n\n` +
        "A huge thank you to each and every one of you who made this possible! ❤️"
      )
      .setColor('#3498db')
      .setTimestamp();

    await msg.edit({ embeds: [statsEmbed] });
  } catch (err) {
    console.error('Failed to update live stats message:', err);
  }
}

// --- HELPER LOGGING FUNCTION ---
async function sendTicketLog(guild, title, description, color = '#3498db', fields = []) {
  try {
    const cfg = guildSettings.get(guild.id) || {};
    const logChannelId = cfg.logChannelId;
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .addFields(fields)
      .setColor(color)
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
  } catch (err) {
    console.error('Failed to send ticket log:', err);
  }
}

function isHelperInActiveTicket(userId) {
  for (const [channelId, ticket] of activeTickets.entries()) {
    if (ticket.helpers.some(h => h.id === userId)) {
      return channelId;
    }
  }
  return null;
}

function getPointsForTicket(ticketData, completedItems = null) {
  const type = (ticketData.type || '').toLowerCase();
  let items = [];
  if (Array.isArray(completedItems)) {
    items = completedItems;
  } else if (typeof completedItems === 'string') {
    items = completedItems.split(',').map(x => x.trim()).filter(x => x.length > 0);
  } else {
    const desc = ticketData.description || '';
    items = desc.split(',').map(x => x.trim()).filter(x => x.length > 0);
  }

  const itemCount = items.length > 0 ? items.length : 1;

  if (type === 'ultra_weeklies') {
    let totalPts = 0;
    for (const item of items) {
      if (item.toLowerCase().includes('speaker')) {
        totalPts += 5; 
      } else {
        totalPts += 3; 
      }
    }
    return totalPts > 0 ? totalPts : 3 * itemCount;
  }

  if (type === 'ultra_dailies' || type === 'seven_man_dailies') {
    return 2 * itemCount; 
  }

  if (ticketData.customPoints !== undefined && ticketData.customPoints >= 0) {
    return ticketData.customPoints;
  }

  if (type.includes('farm') || type.includes('farming')) {
    return 3;
  }
  if (type.includes('weekly')) {
    return 8;
  }
  if (type.includes('daily')) {
    return 5;
  }
  return 1;
}

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

function buildTicketHubPayload(options = {}) {
  const {
    imageUrl = STANDARD_BANNER_URL,
    guideTitle = "TICKET GUIDE",
    guideDesc = "Read through the ticket rules and guidelines before requesting assistance.",
    guideUrl = TICKET_GUIDE_URL,
    createTitle = "MAKE A TICKET",
    createDesc = "Select a category from the menu to open a new ticket. Our helpers will join shortly!"
  } = options;

  const containerComponent = {
    type: 17,
    accent_color: 0x8b0000,
    components: [
      {
        type: 12,
        items: [{ media: { url: imageUrl } }]
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `**${guideTitle.replace(/\\n/g, '\n')}**\n\n${guideDesc.replace(/\\n/g, '\n')}`
          }
        ],
        accessory: {
          type: 2,
          style: 5,
          url: guideUrl,
          label: 'Guide'
        }
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `**${createTitle.replace(/\\n/g, '\n')}**\n\n${createDesc.replace(/\\n/g, '\n')}`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_open_ticket_menu',
          label: 'Create'
        }
      }
    ]
  };

  return {
    components: [containerComponent],
    flags: MessageFlags.IsComponentsV2
  };
}

function buildTicketControlPayload(ticketData, userMention) {
  const maxLimit = ticketData.maxHelpers || 3;
  const categoryPreset = TICKET_PRESETS[ticketData.type] || {};
  const ticketBanner = categoryPreset.bannerUrl || STANDARD_BANNER_URL;
  const accentColor = categoryPreset.accentColor || 0x8b0000;

  const requesterTag = `<@${ticketData.requesterId}> (${ticketData.ign})`;
  const helpersFormatted = ticketData.helpers.length > 0
    ? ticketData.helpers.map(h => `• <@${h.id}>`).join('\n')
    : '• None';

  const points = getPointsForTicket(ticketData);

  const containerComponent = {
    type: 17,
    accent_color: accentColor,
    components: [
      {
        type: 12,
        items: [{ media: { url: ticketBanner } }]
      },
      {
        type: 10,
        content: `<:pointsbt:1534950425080496189> **Points:**\n-# > **${points}**`
      },
      {
        type: 10,
        content: `<:requestbt:1534950441060798594> **Requester:** ${requesterTag}`
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Selected server:\n-# > **${ticketData.server}**`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_change_server',
          label: 'Change server',
          emoji: { id: '1534950290908909749', name: 'changeserverbt', animated: false }
        }
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Monsters:\n-# > **${ticketData.description}**`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_change_bosses',
          label: 'Change Monsters',
          emoji: { id: '1534950407003050185', name: 'monstersbt', animated: false }
        }
      },
      {
        type: 10,
        content: `Details:\n-# > **${ticketData.details || 'None provided'}**`
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Need more help? **Ping helpers!**`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_pinghelpers',
          label: 'Ping helpers',
          emoji: { id: '1534950337167884368', name: 'pinghelpersbt', animated: false }
        }
      },
      {
        type: 10,
        content: `Done with the ticket?`
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            custom_id: 'btn_complete',
            label: 'Complete',
            emoji: { id: '1534950268679094397', name: 'completebt', animated: false }
          },
          {
            type: 2,
            style: 4,
            custom_id: 'btn_cancel',
            label: 'Cancel',
            emoji: { id: '1534950219517788170', name: 'cancelbt', animated: false }
          }
        ]
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `<:helpersbt:1534950382109986876> **Helpers (${ticketData.helpers.length}/${maxLimit})**\n${helpersFormatted}`
          }
        ],
        accessory: {
          type: 2,
          style: 4,
          custom_id: 'btn_kick_helper',
          label: 'Kick Helper'
        }
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Stepped down from helping? Click **Leave!**`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_leave_ticket',
          label: 'Leave'
        }
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Need the room information again? Click **Room details!**`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_location',
          label: 'Room details',
          emoji: { id: '1534950471922483382', name: 'roomdeetsbt', animated: false }
        }
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Claim this ticket to view room details.`
          }
        ],
        accessory: {
          type: 2,
          style: 3,
          custom_id: 'btn_claim',
          label: 'Claim',
          emoji: { id: '1534950248831516806', name: 'claimbt', animated: false }
        }
      }
    ]
  };

  return {
    components: [containerComponent],
    flags: MessageFlags.IsComponentsV2
  };
}

function buildSupportTicketControlPayload(ticketData, userMention) {
  const categoryPreset = TICKET_PRESETS.server_ticket;
  const ticketBanner = categoryPreset.bannerUrl || STANDARD_BANNER_URL;
  const accentColor = categoryPreset.accentColor || 0x2ecc71;

  const requesterTag = `<@${ticketData.requesterId}> (${ticketData.ign})`;

  const containerComponent = {
    type: 17,
    accent_color: accentColor,
    components: [
      {
        type: 12,
        items: [{ media: { url: ticketBanner } }]
      },
      {
        type: 10,
        content: `<:requestbt:1534950441060798594> **User:** ${requesterTag}\n\n**Subject / Concern:**\n-# > **${ticketData.subject}**`
      },
      {
        type: 10,
        content: `**Details / Report:**\n-# > **${ticketData.description}**`
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `Need staff attention? **Ping staff!**`
          }
        ],
        accessory: {
          type: 2,
          style: 2,
          custom_id: 'btn_pinghelpers',
          label: 'Ping staff',
          emoji: { id: '1534950337167884368', name: 'pinghelpersbt', animated: false }
        }
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            custom_id: 'btn_complete',
            label: 'Complete',
            emoji: { id: '1534950268679094397', name: 'completebt', animated: false }
          },
          {
            type: 2,
            style: 4,
            custom_id: 'btn_cancel',
            label: 'Cancel',
            emoji: { id: '1534950219517788170', name: 'cancelbt', animated: false }
          }
        ]
      }
    ]
  };

  return {
    components: [containerComponent],
    flags: MessageFlags.IsComponentsV2
  };
}

async function updateTicketEmbed(channel, ticketData) {
  try {
    const pinnedMessages = await channel.messages.fetchPinned();
    const panelMsg = pinnedMessages.first();
    if (!panelMsg) return;

    const payload = ticketData.type === 'server_ticket'
      ? buildSupportTicketControlPayload(ticketData, `<@${ticketData.requesterId}>`)
      : buildTicketControlPayload(ticketData, `<@${ticketData.requesterId}>`);

    await panelMsg.edit(payload);
  } catch (err) {
    console.error('Failed to update ticket embed in real-time:', err);
  }
}

// --- PARSE VARIABLES HELPER ---
function parseVariables(text, member, guild) {
  if (!text) return '';
  return text
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, guild.name)
    .replace(/{membercount}/g, guild.memberCount);
}

// --- SLASH COMMANDS REGISTRATION (Strictly ordered: required before optional) ---
const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket-hub')
    .setDescription('Post the unified ticket panel hub')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post panel').setRequired(true))
    .addStringOption(opt => opt.setName('banner_url').setDescription('Header banner image URL').setRequired(false))
    .addStringOption(opt => opt.setName('guide_title').setDescription('Custom guide section title').setRequired(false))
    .addStringOption(opt => opt.setName('guide_desc').setDescription('Custom guide section description').setRequired(false))
    .addStringOption(opt => opt.setName('guide_url').setDescription('Custom ticket guide link URL').setRequired(false))
    .addStringOption(opt => opt.setName('create_title').setDescription('Custom create ticket section title').setRequired(false))
    .addStringOption(opt => opt.setName('create_desc').setDescription('Custom create ticket section description').setRequired(false))
    .addChannelOption(opt => 
      opt.setName('category')
        .setDescription('Ticket Channel Category')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel for Ticket Logs').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setup-verification')
    .setDescription('Post a fully customizable Verification and Member Join panel')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Target channel to post verification panel').setRequired(true))
    .addRoleOption(opt => opt.setName('guest_role').setDescription('Guest Role to give upon approval').setRequired(true))
    .addRoleOption(opt => opt.setName('member_role').setDescription('Member Role to give upon approval').setRequired(true))
    .addStringOption(opt => opt.setName('panel_title').setDescription('Main Title for the Verification Panel').setRequired(true))
    .addStringOption(opt => opt.setName('guest_title').setDescription('Title for Guest Section').setRequired(true))
    .addStringOption(opt => opt.setName('guest_desc').setDescription('Description for Guest Section').setRequired(true))
    .addStringOption(opt => opt.setName('member_title').setDescription('Title for Member Section').setRequired(true))
    .addStringOption(opt => opt.setName('member_desc').setDescription('Description for Member Section').setRequired(true))
    .addStringOption(opt => opt.setName('guest_btn_name').setDescription('Custom button name for Guest').setRequired(false))
    .addStringOption(opt => opt.setName('member_btn_name').setDescription('Custom button name for Member').setRequired(false))
    .addStringOption(opt => opt.setName('banner_url').setDescription('Top banner image URL').setRequired(false))
    .addStringOption(opt => opt.setName('footer_banner_url').setDescription('Bottom banner image URL (Optional)').setRequired(false)),

  // --- /GIVEAWAY COMMAND ---
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage server giveaways')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a new V2 Giveaway')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post giveaway').setRequired(true))
        .addStringOption(opt => opt.setName('prize').setDescription('Prize of the giveaway').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Giveaway embed/card title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Giveaway description details').setRequired(true))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true))
        .addRoleOption(opt => opt.setName('role1').setDescription('Required Role 1 (Optional)').setRequired(false))
        .addRoleOption(opt => opt.setName('role2').setDescription('Required Role 2 (Optional)').setRequired(false))
        .addStringOption(opt => opt.setName('banner_url').setDescription('Banner image URL').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End an active giveaway early')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Reroll a winner for a giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    ),

  // --- /SETUP-BOOST COMMAND ---
  new SlashCommandBuilder()
    .setName('setup-boost')
    .setDescription('Configure Server Boost announcement')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Boost announcement channel').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Boost message title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Boost description (supports variables)').setRequired(true))
    .addStringOption(opt => opt.setName('banner_url').setDescription('Banner image URL').setRequired(false)),

  // --- /SETUP-WELCOME COMMAND ---
  new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Configure Server Welcome announcement')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Welcome announcement channel').setRequired(true))
    .addStringOption(opt => opt.setName('outer_message').setDescription('Message outside container').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Welcome card title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Welcome description (supports variables)').setRequired(true))
    .addStringOption(opt => opt.setName('banner_url').setDescription('Banner image URL').setRequired(false)),

  // --- /VIEWPOINTS COMMAND ---
  new SlashCommandBuilder()
    .setName('viewpoints')
    .setDescription('Check your points or another user points')
    .addUserOption(opt => opt.setName('user').setDescription('User to check points for (Optional)').setRequired(false)),

  // --- MODERATION COMMANDS ---
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout/mute a member')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute').setRequired(false)),

  new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Retrieve the last deleted message in the channel')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  new SlashCommandBuilder()
    .setName('viewprofile')
    .setDescription('View user profile details')
    .addUserOption(opt => opt.setName('user').setDescription('User to view profile of').setRequired(false)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display global ticket stats counter')
    .addStringOption(opt => opt.setName('custom_message').setDescription('Custom message below stats').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setup-stats')
    .setDescription('Post and link a live updating stats message')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post stats').setRequired(true)),

  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create a clean Components V2 panel with title, description, and banners')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Main text content').setRequired(true))
    .addStringOption(opt => opt.setName('banner_url').setDescription('Top banner image URL').setRequired(false))
    .addStringOption(opt => opt.setName('footer_banner_url').setDescription('Bottom footer banner image URL').setRequired(false)),

  new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a Components V2 reaction role panel with up to 7 buttons')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addChannelOption(opt => opt.setName('channel').setDescription('Where to post the panel').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Panel description').setRequired(true))
    .addRoleOption(opt => opt.setName('role1').setDescription('Role 1').setRequired(true))
    .addStringOption(opt => opt.setName('desc1').setDescription('Description for Role 1').setRequired(true))
    .addStringOption(opt => opt.setName('banner_url').setDescription('Banner image URL').setRequired(false))
    .addStringOption(opt => opt.setName('emoji1').setDescription('Emoji for Button 1').setRequired(false))
    .addRoleOption(opt => opt.setName('role2').setDescription('Role 2').setRequired(false))
    .addStringOption(opt => opt.setName('desc2').setDescription('Description for Role 2').setRequired(false))
    .addStringOption(opt => opt.setName('emoji2').setDescription('Emoji for Button 2').setRequired(false))
    .addRoleOption(opt => opt.setName('role3').setDescription('Role 3').setRequired(false))
    .addStringOption(opt => opt.setName('desc3').setDescription('Description for Role 3').setRequired(false))
    .addStringOption(opt => opt.setName('emoji3').setDescription('Emoji for Button 3').setRequired(false))
    .addRoleOption(opt => opt.setName('role4').setDescription('Role 4').setRequired(false))
    .addStringOption(opt => opt.setName('desc4').setDescription('Description for Role 4').setRequired(false))
    .addStringOption(opt => opt.setName('emoji4').setDescription('Emoji for Button 4').setRequired(false))
    .addRoleOption(opt => opt.setName('role5').setDescription('Role 5').setRequired(false))
    .addStringOption(opt => opt.setName('desc5').setDescription('Description for Role 5').setRequired(false))
    .addStringOption(opt => opt.setName('emoji5').setDescription('Emoji for Button 5').setRequired(false))
    .addRoleOption(opt => opt.setName('role6').setDescription('Role 6').setRequired(false))
    .addStringOption(opt => opt.setName('desc6').setDescription('Description for Role 6').setRequired(false))
    .addStringOption(opt => opt.setName('emoji6').setDescription('Emoji for Button 6').setRequired(false))
    .addRoleOption(opt => opt.setName('role7').setDescription('Role 7').setRequired(false))
    .addStringOption(opt => opt.setName('desc7').setDescription('Description for Role 7').setRequired(false))
    .addStringOption(opt => opt.setName('emoji7').setDescription('Emoji for Button 7').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setup-channels')
    .setDescription('Configure server system channels')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addChannelOption(opt => opt.setName('log_channel').setDescription('Log channel').setRequired(false))
    .addChannelOption(opt => opt.setName('welcome_channel').setDescription('Welcome channel').setRequired(false))
    .addChannelOption(opt => opt.setName('boost_channel').setDescription('Boost channel').setRequired(false))
    .addChannelOption(opt => opt.setName('verify_log_channel').setDescription('Verification Log Channel').setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top 20 helpers and top 20 requesters'),

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
    console.log('✅ Slash commands successfully registered!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// --- BOT INITIALIZATION ---
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'idle',
    activities: [{
      name: 'Im weird',
      type: 5
    }]
  });

  await registerCommands();
});

// --- WELCOME & BOOST EVENT LISTENERS ---
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;
  const cfg = guildSettings.get(member.guild.id) || {};
  if (!cfg.welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
  if (!channel) return;

  const welcomeData = cfg.welcomeData || {
    outerMessage: 'Welcome to the server, {user}!',
    title: 'New Member Joined!',
    description: 'We are thrilled to have you here, {user}! Enjoy your stay at {server}.',
    bannerUrl: STANDARD_BANNER_URL
  };

  const parsedOuter = parseVariables(welcomeData.outerMessage, member, member.guild);
  const parsedTitle = parseVariables(welcomeData.title, member, member.guild);
  const parsedDesc = parseVariables(welcomeData.description, member, member.guild);

  const container = {
    type: 17,
    accent_color: 0x3498db,
    components: [
      {
        type: 12,
        items: [{ media: { url: welcomeData.bannerUrl } }]
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `**${parsedTitle}**\n\n${parsedDesc}`
          }
        ]
      }
    ]
  };

  await channel.send({
    content: parsedOuter,
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }).catch(console.error);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (newMember.guild.id !== GUILD_ID) return;
  const wasBoosting = oldMember.premiumSince;
  const isBoosting = newMember.premiumSince;

  if (!wasBoosting && isBoosting) {
    const cfg = guildSettings.get(newMember.guild.id) || {};
    if (!cfg.boostChannelId) return;

    const channel = newMember.guild.channels.cache.get(cfg.boostChannelId);
    if (!channel) return;

    const boostData = cfg.boostData || {
      title: 'Server Boosted! 🚀',
      description: 'Thank you {user} for boosting {server}!',
      bannerUrl: STANDARD_BANNER_URL
    };

    const parsedTitle = parseVariables(boostData.title, newMember, newMember.guild);
    const parsedDesc = parseVariables(boostData.description, newMember, newMember.guild);

    const container = {
      type: 17,
      accent_color: 0xf47fff,
      components: [
        {
          type: 12,
          items: [{ media: { url: boostData.bannerUrl } }]
        },
        {
          type: 9,
          components: [
            {
              type: 10,
              content: `**${parsedTitle}**\n\n${parsedDesc}`
            }
          ]
        }
      ]
    };

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    }).catch(console.error);
  }
});

// --- INTERACTION LISTENER ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

  try {
    // --- GIVEAWAY ENTER BUTTON ---
    if (interaction.isButton() && interaction.customId.startsWith('gw_enter_')) {
      const gwId = interaction.customId.replace('gw_enter_', '');
      const giveaway = activeGiveaways.get(gwId);

      if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended or no longer exists.', ephemeral: true });
      }

      const role1 = giveaway.role1;
      const role2 = giveaway.role2;

      if (role1 || role2) {
        const hasRole1 = role1 ? interaction.member.roles.cache.has(role1) : true;
        const hasRole2 = role2 ? interaction.member.roles.cache.has(role2) : true;

        if (!hasRole1 && !hasRole2) {
          let reqNames = [];
          if (role1) reqNames.push(`<@&${role1}>`);
          if (role2) reqNames.push(`<@&${role2}>`);
          return interaction.reply({ content: `❌ You do not have the required role(s) to enter this giveaway: ${reqNames.join(' or ')}`, ephemeral: true });
        }
      }

      if (giveaway.entries.has(interaction.user.id)) {
        return interaction.reply({ content: '⚠️ You have already entered this giveaway!', ephemeral: true });
      }

      giveaway.entries.add(interaction.user.id);
      return interaction.reply({ content: '🎉 Successfully entered the giveaway! Good luck!', ephemeral: true });
    }

    // --- VERIFICATION BUTTON TRIGGERS (WITH REJECTION BLOCK CHECK) ---
    if (interaction.isButton() && interaction.customId.startsWith('btn_verify_guest_')) {
      if (userRejectionReasons.has(interaction.user.id)) {
        const reason = userRejectionReasons.get(interaction.user.id);
        return interaction.reply({ 
          content: `❌ **You have been rejected from verifying.**\n\n**Reason:** ${reason}\n\nPlease address the reason above before attempting to verify again.`, 
          ephemeral: true 
        });
      }

      const roleId = interaction.customId.replace('btn_verify_guest_', '');
      const modal = new ModalBuilder()
        .setCustomId(`modal_verify_guest_${roleId}`)
        .setTitle('Verify as Guest');

      const ignInput = new TextInputBuilder()
        .setCustomId('ign')
        .setLabel('AQW IGN')
        .setPlaceholder('Enter your exact AQW username...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const guildInput = new TextInputBuilder()
        .setCustomId('guild_name')
        .setLabel('Guild Name')
        .setPlaceholder('Enter your guild name...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const invitedInput = new TextInputBuilder()
        .setCustomId('invited_by')
        .setLabel('Who invited you? (Optional)')
        .setPlaceholder('e.g. from AEO discord link / friend name...')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(ignInput),
        new ActionRowBuilder().addComponents(guildInput),
        new ActionRowBuilder().addComponents(invitedInput)
      );

      return await interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId.startsWith('btn_verify_member_')) {
      if (userRejectionReasons.has(interaction.user.id)) {
        const reason = userRejectionReasons.get(interaction.user.id);
        return interaction.reply({ 
          content: `❌ **You have been rejected from verifying.**\n\n**Reason:** ${reason}\n\nPlease address the reason above before attempting to verify again.`, 
          ephemeral: true 
        });
      }

      const roleId = interaction.customId.replace('btn_verify_member_', '');
      const modal = new ModalBuilder()
        .setCustomId(`modal_verify_member_${roleId}`)
        .setTitle('Verify as Member');

      const ignInput = new TextInputBuilder()
        .setCustomId('ign')
        .setLabel('AQW IGN')
        .setPlaceholder('Enter your exact AQW username...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const invitedInput = new TextInputBuilder()
        .setCustomId('invited_by')
        .setLabel('Who invited you?')
        .setPlaceholder('e.g. friend name / link...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(ignInput),
        new ActionRowBuilder().addComponents(invitedInput)
      );

      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_verify_guest_')) {
      await interaction.deferReply({ ephemeral: true });

      const roleId = interaction.customId.replace('modal_verify_guest_', '');
      const ign = interaction.fields.getTextInputValue('ign').trim();
      const guildName = interaction.fields.getTextInputValue('guild_name').trim();
      const invitedBy = interaction.fields.getTextInputValue('invited_by') || 'None provided';

      const charPageUrl = `https://account.aq.com/CharPage?id=${encodeURIComponent(ign)}`;
      const cfg = guildSettings.get(interaction.guild.id) || {};
      const logChannelId = cfg.verifyLogChannelId;

      if (!logChannelId) {
        return await interaction.editReply('❌ Verification Log channel is not configured yet. Please ask an admin to run `/setup-channels verify_log_channel:#channel`.');
      }

      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        return await interaction.editReply('❌ Verification log channel not found.');
      }

      const requestId = `ver_${interaction.user.id}_${Date.now()}`;
      pendingVerifications.set(requestId, {
        userId: interaction.user.id,
        type: 'GUEST',
        ign,
        charPageUrl,
        guildName,
        invitedBy,
        roleId,
        roleName: '@Guest'
      });

      const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });

      const logContainer = {
        type: 17,
        accent_color: 0x3498db,
        components: [
          {
            type: 12,
            items: [{ media: { url: userAvatar } }]
          },
          {
            type: 10,
            content: `🛡️ **New Verification Request (GUEST)**\n\n` +
                     `**User:** <@${interaction.user.id}>\n` +
                     `**AQW Username:** [${ign}](${charPageUrl})\n` +
                     `**Verification Type:** GUEST\n` +
                     `**Guild:** ${guildName}\n` +
                     `**Role To Give:** <@&${roleId}>\n` +
                     `**Invited By:** ${invitedBy}`
          },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                custom_id: `ver_approve_${requestId}`,
                label: 'Approve',
                emoji: '✅'
              },
              {
                type: 2,
                style: 4,
                custom_id: `ver_reject_${requestId}`,
                label: 'Reject',
                emoji: '❌'
              }
            ]
          }
        ]
      };

      await logChannel.send({
        components: [logContainer],
        flags: MessageFlags.IsComponentsV2
      });

      return await interaction.editReply('✅ Your guest verification request has been submitted to the staff! Please wait for approval.');
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_verify_member_')) {
      await interaction.deferReply({ ephemeral: true });

      const roleId = interaction.customId.replace('modal_verify_member_', '');
      const ign = interaction.fields.getTextInputValue('ign').trim();
      const invitedBy = interaction.fields.getTextInputValue('invited_by').trim();

      const charPageUrl = `https://account.aq.com/CharPage?id=${encodeURIComponent(ign)}`;
      const cfg = guildSettings.get(interaction.guild.id) || {};
      const logChannelId = cfg.verifyLogChannelId;

      if (!logChannelId) {
        return await interaction.editReply('❌ Verification Log channel is not configured yet. Please ask an admin to run `/setup-channels verify_log_channel:#channel`.');
      }

      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (!logChannel) {
        return await interaction.editReply('❌ Verification log channel not found.');
      }

      const requestId = `ver_${interaction.user.id}_${Date.now()}`;
      pendingVerifications.set(requestId, {
        userId: interaction.user.id,
        type: 'MEMBER',
        ign,
        charPageUrl,
        guildName: 'Main Guild',
        invitedBy,
        roleId,
        roleName: '@Member'
      });

      const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });

      const logContainer = {
        type: 17,
        accent_color: 0x2ecc71,
        components: [
          {
            type: 12,
            items: [{ media: { url: userAvatar } }]
          },
          {
            type: 10,
            content: `🛡️ **New Verification Request (MEMBER)**\n\n` +
                     `**User:** <@${interaction.user.id}>\n` +
                     `**AQW Username:** [${ign}](${charPageUrl})\n` +
                     `**Verification Type:** MEMBER\n` +
                     `**Guild:** Main Guild\n` +
                     `**Role To Give:** <@&${roleId}>\n` +
                     `**Invited By:** ${invitedBy}`
          },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                custom_id: `ver_approve_${requestId}`,
                label: 'Approve',
                emoji: '✅'
              },
              {
                type: 2,
                style: 4,
                custom_id: `ver_reject_${requestId}`,
                label: 'Reject',
                emoji: '❌'
              }
            ]
          }
        ]
      };

      await logChannel.send({
        components: [logContainer],
        flags: MessageFlags.IsComponentsV2
      });

      return await interaction.editReply('✅ Your membership verification request has been submitted to the staff! Please wait for approval.');
    }

    if (interaction.isButton() && interaction.customId.startsWith('ver_approve_')) {
      const requestId = interaction.customId.replace('ver_approve_', '');
      const data = pendingVerifications.get(requestId);

      if (!data) {
        return interaction.reply({ content: '⚠️ This verification request is already processed or expired.', ephemeral: true });
      }

      try {
        const member = await interaction.guild.members.fetch(data.userId).catch(() => null);
        if (member) {
          await member.roles.add(data.roleId).catch(() => {});
          // Awtomatikong palitan ang server nickname ng user sa kanilang AQW IGN
          await member.setNickname(data.ign).catch(err => console.log('Failed to set nickname:', err));
        }

        userRejectionReasons.delete(data.userId);

        const approvedEmbed = new EmbedBuilder()
          .setTitle('✅ Verification Approved')
          .setDescription(`Approved by ${interaction.user}\n\n` +
                        `**User:** <@${data.userId}>\n` +
                        `**AQW Username:** [${data.ign}](${data.charPageUrl})\n` +
                        `**Verification Type:** ${data.type}\n` +
                        `**Role Given:** <@&${data.roleId}>\n` +
                        `**Nickname Updated:** \`${data.ign}\``)
          .setColor('#2ecc71')
          .setTimestamp();

        await interaction.update({ content: '✅ **Approved Successfully!**', components: [] });
        await interaction.channel.send({ embeds: [approvedEmbed] });

        if (member) {
          await member.send(`🎉 Your verification for **${interaction.guild.name}** has been **Approved**! Your nickname has been updated to **${data.ign}** and you have been given the role.`).catch(() => {});
        }

        pendingVerifications.delete(requestId);
      } catch (err) {
        console.error('Approval error:', err);
        return interaction.reply({ content: `❌ Failed to approve: ${err.message}`, ephemeral: true });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('ver_reject_')) {
      const requestId = interaction.customId.replace('ver_reject_', '');
      
      const modal = new ModalBuilder()
        .setCustomId(`modal_reject_reason_${requestId}`)
        .setTitle('Reason for Rejection');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason / Explanation')
        .setPlaceholder('Enter why this verification is rejected...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_reason_')) {
      await interaction.deferUpdate();
      const requestId = interaction.customId.replace('modal_reject_reason_', '');
      const reason = interaction.fields.getTextInputValue('reason');
      const data = pendingVerifications.get(requestId);

      if (!data) {
        return interaction.followUp({ content: '⚠️ Request data not found.', ephemeral: true });
      }

      userRejectionReasons.set(data.userId, reason);

      const rejectedEmbed = new EmbedBuilder()
        .setTitle('❌ Verification Rejected')
        .setDescription(`Rejected by ${interaction.user}\n\n` +
                      `**User:** <@${data.userId}>\n` +
                      `**AQW Username:** [${data.ign}](${data.charPageUrl})\n` +
                      `**Verification Type:** ${data.type}\n` +
                      `**Reason:** ${reason}`)
        .setColor('#e74c3c')
        .setTimestamp();

      await interaction.editReply({ content: '❌ **Request Rejected.**', components: [] });
      await interaction.channel.send({ embeds: [rejectedEmbed] });

      try {
        const member = await interaction.guild.members.fetch(data.userId).catch(() => null);
        if (member) {
          await member.send(`❌ Your verification for **${interaction.guild.name}** was **Rejected**. \n**Reason:** ${reason}`).catch(() => {});
        }
      } catch {}

      pendingVerifications.delete(requestId);
    }

    // --- REACTION ROLE TOGGLE HANDLER ---
    if (interaction.isButton() && interaction.customId.startsWith('rr_')) {
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

    if (interaction.isButton() && interaction.customId === 'btn_open_ticket_menu') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_ticket_cat')
        .setPlaceholder('Select a ticket type...')
        .addOptions(
          Object.entries(TICKET_PRESETS).map(([key, item]) => 
            new StringSelectMenuOptionBuilder()
              .setLabel(item.label)
              .setValue(key)
          )
        );

      return await interaction.reply({
        content: '🎫 **Select the ticket category you need assistance with:**',
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (interaction.isButton() && ['btn_all_helpers', 'btn_helpers_list', 'btn_support_info', 'btn_support_details'].includes(interaction.customId)) {
      return await interaction.reply({
        content: '🔒 **Status:** Showing active ticket details.',
        ephemeral: true
      });
    }

    // STEP 1: Category Selected (Dropdown Menu Restored!)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_cat') {
      const selectedKey = interaction.values[0];
      const preset = TICKET_PRESETS[selectedKey] || { label: 'Ticket', max: 6, points: 1, pingRoleIds: [HELPER_ROLE_ID] };

      if (selectedKey === 'ultra_weeklies') {
        const menu = new StringSelectMenuBuilder()
          .setCustomId('select_bosses_ultra_weeklies')
          .setPlaceholder('Select Ultra Weeklies bosses...')
          .setMinValues(1)
          .setMaxValues(6)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Champion Drakath').setValue('Champion Drakath').setEmoji({ id: '1534544989009477754', name: 'drakath' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Dage').setValue('Ultra Dage').setEmoji({ id: '1534544956713209877', name: 'dage' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Darkon').setValue('Ultra Darkon').setEmoji({ id: '1534545103350272131', name: 'darkon' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Drago').setValue('Ultra Drago').setEmoji({ id: '1534545063915290694', name: 'drago' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Gramiel').setValue('Ultra Gramiel').setEmoji({ id: '1534545007468613662', name: 'gramiel' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Speaker').setValue('Ultra Speaker').setEmoji({ id: '1534545145016352778', name: 'malgor' })
          );

        return await interaction.update({
          content: '⚔️ **Select all Ultra Weeklies bosses you need help with:**',
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      if (selectedKey === 'ultra_dailies') {
        const menu = new StringSelectMenuBuilder()
          .setCustomId('select_bosses_ultra_dailies')
          .setPlaceholder('Select Ultra Dailies bosses...')
          .setMinValues(1)
          .setMaxValues(6)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Ultra Ezrajal').setValue('Ultra Ezrajal'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Warden').setValue('Ultra Warden'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Engineer').setValue('Ultra Engineer'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Tyndarius').setValue('Ultra Tyndarius'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Kala').setValue('Ultra Kala'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Iara').setValue('Ultra Iara')
          );

        return await interaction.update({
          content: '⚔️ **Select all Ultra Dailies bosses you need help with:**',
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      if (selectedKey === 'seven_man_dailies') {
        const menu = new StringSelectMenuBuilder()
          .setCustomId('select_bosses_seven_man_dailies')
          .setPlaceholder('Select 7-Man Dailies bosses...')
          .setMinValues(1)
          .setMaxValues(4)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Kathool Depths').setValue('Kathool Depths'),
            new StringSelectMenuOptionBuilder().setLabel('Originul').setValue('Originul'),
            new StringSelectMenuOptionBuilder().setLabel('Astral Shrine').setValue('Astral Shrine'),
            new StringSelectMenuOptionBuilder().setLabel('Lavarock Shore').setValue('Lavarock Shore')
          );

        return await interaction.update({
          content: '⚔️ **Select all 7-Man Dailies bosses you need help with:**',
          components: [new ActionRowBuilder().addComponents(menu)]
        });
      }

      if (selectedKey === 'server_ticket') {
        tempTicketCache.set(interaction.user.id, { categoryKey: 'server_ticket', server: 'N/A', bosses: '' });

        const modal = new ModalBuilder()
          .setCustomId('ticket_form_final_2_0_server_ticket')
          .setTitle('Ticket: Server Ticket / Support');

        const ignInput = new TextInputBuilder()
          .setCustomId('ign')
          .setLabel('Username / IGN')
          .setPlaceholder('Enter your username...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const subjectInput = new TextInputBuilder()
          .setCustomId('subject')
          .setLabel('Subject / Concern')
          .setPlaceholder('Report, Question, etc.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const descInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Details / Report')
          .setPlaceholder('Describe your concern...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(ignInput),
          new ActionRowBuilder().addComponents(subjectInput),
          new ActionRowBuilder().addComponents(descInput)
        );

        return await interaction.showModal(modal);
      }

      const serverMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_server_form_${selectedKey}`)
        .setPlaceholder('Select your AQW server...')
        .addOptions(
          AQW_SERVERS.map(srv => 
            new StringSelectMenuOptionBuilder()
              .setLabel(srv.label)
              .setValue(srv.label)
              .setEmoji(srv.emoji)
          )
        );

      return await interaction.update({
        content: `🌐 **Select your AQW server for ${preset.label}:**`,
        components: [new ActionRowBuilder().addComponents(serverMenu)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_bosses_')) {
      const categoryKey = interaction.customId.replace('select_bosses_', '');
      const selectedBosses = interaction.values.join(', ');
      
      tempTicketCache.set(interaction.user.id, { categoryKey, bosses: selectedBosses });

      const serverMenu = new StringSelectMenuBuilder()
        .setCustomId('select_server_form_boss')
        .setPlaceholder('Select your AQW server...')
        .addOptions(
          AQW_SERVERS.map(srv => 
            new StringSelectMenuOptionBuilder()
              .setLabel(srv.label)
              .setValue(srv.label)
              .setEmoji(srv.emoji)
          )
        );

      return await interaction.update({
        content: '🌐 **Select your AQW server:**',
        components: [new ActionRowBuilder().addComponents(serverMenu)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_server_form_')) {
      const selectedServer = interaction.values[0];
      let categoryKey, bossVal = '';

      if (interaction.customId === 'select_server_form_boss') {
        const cached = tempTicketCache.get(interaction.user.id) || {};
        categoryKey = cached.categoryKey;
        bossVal = cached.bosses;
      } else {
        categoryKey = interaction.customId.replace('select_server_form_', '');
      }

      const preset = TICKET_PRESETS[categoryKey] || { max: 6, points: 1, label: 'Ticket' };
      tempTicketCache.set(interaction.user.id, { categoryKey, server: selectedServer, bosses: bossVal });

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form_final_${preset.max}_${preset.points}_${categoryKey}`)
        .setTitle(`Ticket: ${preset.label}`);

      const ignInput = new TextInputBuilder()
        .setCustomId('ign')
        .setLabel('Username / IGN')
        .setPlaceholder('Enter your username...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const mapInput = new TextInputBuilder()
        .setCustomId('map_name')
        .setLabel('Map Name / Room')
        .setPlaceholder('ultraezrajal, ultrakala, etc.')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const detailsInput = new TextInputBuilder()
        .setCustomId('details')
        .setLabel('Details')
        .setPlaceholder('Add extra details (optional)...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      const modalComps = [
        new ActionRowBuilder().addComponents(ignInput), 
        new ActionRowBuilder().addComponents(mapInput),
        new ActionRowBuilder().addComponents(detailsInput)
      ];
      
      if (!bossVal) {
        const descInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Monsters / Details')
          .setPlaceholder('List monsters...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        modalComps.push(new ActionRowBuilder().addComponents(descInput));
      }

      modal.addComponents(modalComps);

      return await interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId === 'btn_change_server') {
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
      if (interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: '❌ Only the requester can change the server.', ephemeral: true });
      }

      const serverDropdown = new StringSelectMenuBuilder()
        .setCustomId('active_change_server_menu')
        .setPlaceholder('Select new AQW server...')
        .addOptions(
          AQW_SERVERS.map(srv => 
            new StringSelectMenuOptionBuilder()
              .setLabel(srv.label)
              .setValue(srv.label)
              .setEmoji(srv.emoji)
          )
        );

      return await interaction.reply({
        content: '🌐 **Select a new server from the dropdown below:**',
        components: [new ActionRowBuilder().addComponents(serverDropdown)],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'active_change_server_menu') {
      await interaction.deferUpdate();
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return;

      const newServer = interaction.values[0];
      ticketData.server = newServer;
      activeTickets.set(interaction.channel.id, ticketData);

      await interaction.editReply({ content: `✅ Successfully updated server to **${newServer}**!`, components: [] });
      return updateTicketEmbed(interaction.channel, ticketData);
    }

    if (interaction.isButton() && interaction.customId === 'btn_change_bosses') {
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
      if (interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: '❌ Only the requester can change monster details.', ephemeral: true });
      }

      const tType = ticketData.type;
      let bossMenu;

      if (tType === 'ultra_weeklies') {
        bossMenu = new StringSelectMenuBuilder()
          .setCustomId('active_change_bosses_selected_ultra_weeklies')
          .setPlaceholder('Select Ultra Weeklies bosses...')
          .setMinValues(1)
          .setMaxValues(6)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Champion Drakath').setValue('Champion Drakath').setEmoji({ id: '1534544989009477754', name: 'drakath' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Dage').setValue('Ultra Dage').setEmoji({ id: '1534544956713209877', name: 'dage' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Darkon').setValue('Ultra Darkon').setEmoji({ id: '1534545103350272131', name: 'darkon' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Drago').setValue('Ultra Drago').setEmoji({ id: '1534545063915290694', name: 'drago' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Gramiel').setValue('Ultra Gramiel').setEmoji({ id: '1534545007468613662', name: 'gramiel' }),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Speaker').setValue('Ultra Speaker').setEmoji({ id: '1534545145016352778', name: 'malgor' })
          );
      } else if (tType === 'ultra_dailies') {
        bossMenu = new StringSelectMenuBuilder()
          .setCustomId('active_change_bosses_selected_ultra_dailies')
          .setPlaceholder('Select Ultra Dailies bosses...')
          .setMinValues(1)
          .setMaxValues(6)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Ultra Ezrajal').setValue('Ultra Ezrajal'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Warden').setValue('Ultra Warden'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Engineer').setValue('Ultra Engineer'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Tyndarius').setValue('Ultra Tyndarius'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Kala').setValue('Ultra Kala'),
            new StringSelectMenuOptionBuilder().setLabel('Ultra Iara').setValue('Ultra Iara')
          );
      } else if (tType === 'seven_man_dailies') {
        bossMenu = new StringSelectMenuBuilder()
          .setCustomId('active_change_bosses_selected_seven_man_dailies')
          .setPlaceholder('Select 7-Man Dailies bosses...')
          .setMinValues(1)
          .setMaxValues(4)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Kathool Depths').setValue('Kathool Depths'),
            new StringSelectMenuOptionBuilder().setLabel('Originul').setValue('Originul'),
            new StringSelectMenuOptionBuilder().setLabel('Astral Shrine').setValue('Astral Shrine'),
            new StringSelectMenuOptionBuilder().setLabel('Lavarock Shore').setValue('Lavarock Shore')
          );
      } else {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_bosses')
          .setTitle('Change Monsters / Details')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('new_details').setLabel('New Monsters or Details').setValue(ticketData.description).setStyle(TextInputStyle.Paragraph).setRequired(true)
          ));
        return await interaction.showModal(modal);
      }

      return await interaction.reply({
        content: `⚔️ **Select monsters/bosses for this ${TICKET_PRESETS[tType]?.label || 'Ticket'}:**`,
        components: [new ActionRowBuilder().addComponents(bossMenu)],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('active_change_bosses_selected_')) {
      await interaction.deferUpdate();
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return;

      const newBosses = interaction.values.join(', ');
      ticketData.description = newBosses;
      activeTickets.set(interaction.channel.id, ticketData);

      await interaction.editReply({ content: `✅ Successfully updated monsters to: **${newBosses}**`, components: [] });
      return updateTicketEmbed(interaction.channel, ticketData);
    }

    if (interaction.isButton() && interaction.customId === 'btn_kick_helper') {
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

      const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
      const isRequester = interaction.user.id === ticketData.requesterId;
      if (!isAdmin && !isRequester) {
        return interaction.reply({ content: '❌ Only the requester or staff can kick helpers.', ephemeral: true });
      }

      if (!ticketData.helpers || ticketData.helpers.length === 0) {
        return interaction.reply({ content: '⚠️ There are no helpers currently claimed in this ticket.', ephemeral: true });
      }

      const helperMenu = new StringSelectMenuBuilder()
        .setCustomId('active_kick_helper_menu')
        .setPlaceholder('Select helper to remove...')
        .addOptions(
          ticketData.helpers.map(h => 
            new StringSelectMenuOptionBuilder()
              .setLabel(`Helper ID: ${h.id}`)
              .setValue(h.id)
          )
        );

      return await interaction.reply({
        content: '🔨 **Select the helper you want to remove from this ticket:**',
        components: [new ActionRowBuilder().addComponents(helperMenu)],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'active_kick_helper_menu') {
      await interaction.deferUpdate();
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return;

      const helperIdToRemove = interaction.values[0];
      ticketData.helpers = ticketData.helpers.filter(h => h.id !== helperIdToRemove);
      activeTickets.set(interaction.channel.id, ticketData);

      await interaction.editReply({ content: `✅ Successfully removed <@${helperIdToRemove}> from the ticket!`, components: [] });
      await interaction.channel.send({ content: `🔴 <@${helperIdToRemove}> has been removed from this ticket by ${interaction.user}.` });
      return updateTicketEmbed(interaction.channel, ticketData);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_edit_bosses') {
      const ticketData = activeTickets.get(interaction.channel.id);
      if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

      const newDetails = interaction.fields.getTextInputValue('new_details');
      ticketData.description = newDetails;
      activeTickets.set(interaction.channel.id, ticketData);

      await interaction.reply({ content: `✅ Updated monster details!`, ephemeral: true });
      return updateTicketEmbed(interaction.channel, ticketData);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_final_')) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const parts = interaction.customId.replace('ticket_form_final_', '').split('_');
        const maxHelpers = parseInt(parts[0]) || 3;
        const customPoints = parseInt(parts[1]) || 0;
        const ticketType = parts.slice(2).join('_');

        const cached = tempTicketCache.get(interaction.user.id) || {};
        const serverName = cached.server || 'Artix';
        let description = cached.bosses || '';

        const preset = TICKET_PRESETS[ticketType] || {};
        const pingRoleIds = preset.pingRoleIds || [HELPER_ROLE_ID];

        const ign = interaction.fields.getTextInputValue('ign');
        const ticketDetails = ticketType === 'server_ticket' 
          ? interaction.fields.getTextInputValue('description') 
          : (interaction.fields.getTextInputValue('details') || 'None provided');

        if (!description) {
          try {
            description = interaction.fields.getTextInputValue('description');
          } catch {
            description = 'General Assistance';
          }
        }

        let room = 'N/A';
        let subject = 'N/A';

        if (ticketType === 'server_ticket') {
          subject = interaction.fields.getTextInputValue('subject');
        } else {
          const rawMap = interaction.fields.getTextInputValue('map_name').trim();
          const cleanMap = rawMap.toLowerCase().replace(/[^a-z0-9]/g, '') || 'room';
          room = `/join ${cleanMap}`;
        }

        const cfg = guildSettings.get(interaction.guild.id) || {};
        
        ticketCounter += 1;
        const formattedNum = String(ticketCounter).padStart(4, '0');
        const chName = `ticket-${formattedNum}`;

        let parentCategoryId = cfg.ticketCategory || null;
        if (parentCategoryId) {
          const fetchedCategory = interaction.guild.channels.cache.get(parentCategoryId);
          if (!fetchedCategory || fetchedCategory.type !== ChannelType.GuildCategory) {
            parentCategoryId = null;
          }
        }

        const isServerTicket = ticketType === 'server_ticket';
        
        let permissionOverwrites = [
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];

        if (isServerTicket) {
          permissionOverwrites.push({ id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] });
        } else {
          permissionOverwrites.push({ id: interaction.guild.roles.everyone, allow: [PermissionsBitField.Flags.ViewChannel] });
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: chName,
          type: ChannelType.GuildText,
          parent: parentCategoryId,
          permissionOverwrites
        });

        const newTicketData = {
          requesterId: interaction.user.id,
          type: ticketType,
          ign,
          server: serverName,
          room,
          subject,
          description,
          details: ticketDetails,
          maxHelpers,
          customPoints,
          pingRoleIds,
          helpers: []
        };

        activeTickets.set(ticketChannel.id, newTicketData);
        tempTicketCache.delete(interaction.user.id);

        const validRoleIds = pingRoleIds.filter(id => id && /^\d+$/.test(id));
        const helperRolePings = validRoleIds.length > 0 ? validRoleIds.map(id => `<@&${id}>`).join(' ') : '@Staff';
        
        await ticketChannel.send({ 
          content: `${helperRolePings} assistance requested!`,
          allowedMentions: validRoleIds.length > 0 ? { roles: validRoleIds } : { parse: ['users', 'roles'] }
        });

        const payload = isServerTicket 
          ? buildSupportTicketControlPayload(newTicketData, `${interaction.user}`)
          : buildTicketControlPayload(newTicketData, `${interaction.user}`);

        const mainMsg = await ticketChannel.send({ components: payload.components, flags: payload.flags });

        await mainMsg.pin().catch(() => {});

        await sendTicketLog(
          interaction.guild,
          '📩 Ticket Created',
          `**Category:** \`${ticketType}\`\n**User:** ${interaction.user} (\`${interaction.user.id}\`)\n**Channel:** ${ticketChannel}`,
          '#3498db'
        );

        return await interaction.editReply(`✅ Ticket created: ${ticketChannel}`);
      } catch (err) {
        console.error('Failed to create ticket channel:', err);
        return await interaction.editReply(`❌ Failed to create ticket channel: ${err.message}`);
      }
    }

    if (interaction.isButton()) {
      const ticketData = activeTickets.get(interaction.channel.id);
      const customId = interaction.customId;

      if (customId === 'btn_location') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        const isRequester = interaction.user.id === ticketData.requesterId;
        const isHelper = ticketData.helpers.some(h => h.id === interaction.user.id);
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        if (!isRequester && !isHelper && !isAdmin) {
          return interaction.reply({ content: '🔒 **Access Denied:** Click **Claim** first to view room details.', ephemeral: true });
        }

        const categoryPreset = TICKET_PRESETS[ticketData.type] || {};
        const accentColor = categoryPreset.accentColor || 0x3498db;

        const codesEmbed = new EmbedBuilder()
          .setTitle('📍 Room Details')
          .setColor(accentColor)
          .addFields(
            { name: '👤 IGN', value: `\`${ticketData.ign}\``, inline: true },
            { name: '🖥️ Server', value: `\`${ticketData.server}\``, inline: true },
            { name: '📜 Command', value: `\`${ticketData.room}\``, inline: false },
            { name: '📝 Details', value: `\`${ticketData.details || 'None provided'}\``, inline: false }
          )
          .setFooter({ text: 'AQW Ticket System' })
          .setTimestamp();

        return await interaction.reply({
          embeds: [codesEmbed],
          ephemeral: true
        });
      }

      if (customId === 'btn_claim') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        if (interaction.user.id === ticketData.requesterId) {
          return interaction.reply({ content: '⚠️ You are the requester of this ticket!', ephemeral: true });
        }

        if (ticketData.helpers.some(h => h.id === interaction.user.id)) {
          return interaction.reply({ content: '⚠️ You already claimed this ticket!', ephemeral: true });
        }

        const activeChannelId = isHelperInActiveTicket(interaction.user.id);
        if (activeChannelId) {
          return interaction.reply({ content: `⚠️ You are already in an active ticket (<#${activeChannelId}>)!`, ephemeral: true });
        }

        const maxAllowed = ticketData.maxHelpers || 3;
        if (ticketData.helpers.length >= maxAllowed) {
          return interaction.reply({ content: `⚠️ Helper spots are full (${maxAllowed}/${maxAllowed})!`, ephemeral: true });
        }

        ticketData.helpers.push({ id: interaction.user.id });
        activeTickets.set(interaction.channel.id, ticketData);

        const claimedCount = ticketData.helpers.length;

        await interaction.channel.send({
          content: `🟢 ${interaction.user} **claimed ticket (${claimedCount}/${maxAllowed})**`
        });

        await sendTicketLog(
          interaction.guild,
          '🤝 Ticket Claimed',
          `**Helper:** ${interaction.user} (\`${interaction.user.id}\`)\n**Ticket:** ${interaction.channel}\n**Requester:** <@${ticketData.requesterId}>`,
          '#3498db'
        );

        await interaction.reply({
          content: `✅ **Claimed!** Room Details:\n📍 **Server:** \`${ticketData.server}\`\n📍 **Command:** \`${ticketData.room}\`\n📍 **Details:** \`${ticketData.details || 'None provided'}\``,
          ephemeral: true
        });

        return updateTicketEmbed(interaction.channel, ticketData);
      }

      if (customId === 'btn_leave_ticket') {
        if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

        const isHelper = ticketData.helpers.some(h => h.id === interaction.user.id);
        if (!isHelper) {
          return interaction.reply({ content: '❌ You are not a claimed helper in this ticket.', ephemeral: true });
        }

        ticketData.helpers = ticketData.helpers.filter(h => h.id !== interaction.user.id);
        activeTickets.set(interaction.channel.id, ticketData);

        await interaction.reply({ content: '✅ You have successfully stepped down and left this ticket.', ephemeral: true });
        await interaction.channel.send({ content: `🏃‍♂️ ${interaction.user} has stepped down and left this ticket.` });
        return updateTicketEmbed(interaction.channel, ticketData);
      }

      if (customId === 'btn_pinghelpers') {
        const pingRoleIds = ticketData?.pingRoleIds || [SUPPORT_ROLE_ID];
        const validRoleIds = pingRoleIds.filter(id => id && /^\d+$/.test(id));
        const helperRolePings = validRoleIds.length > 0 ? validRoleIds.map(id => `<@&${id}>`).join(' ') : '@Staff';
        return interaction.reply({ 
          content: `🔔 ${helperRolePings} assistance requested!`,
          allowedMentions: validRoleIds.length > 0 ? { roles: validRoleIds } : { parse: ['users', 'roles'] }
        });
      }

      if (customId === 'btn_cancel') {
        if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: '❌ Only requester or staff can cancel.', ephemeral: true });
        }

        await interaction.reply('🎟️ Ticket Canceled. Deleting channel in 3 seconds...');

        await sendTicketLog(
          interaction.guild,
          '🚫 Ticket Canceled',
          `**Canceled By:** ${interaction.user} (\`${interaction.user.id}\`)\n**Channel:** \`#${interaction.channel.name}\``,
          '#e74c3c'
        );

        activeTickets.delete(interaction.channel.id);
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }

      if (customId === 'btn_complete') {
        if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: '❌ Only requester or staff can complete.', ephemeral: true });
        }

        const desc = ticketData ? ticketData.description : '';
        const items = desc ? desc.split(',').map(x => x.trim()).filter(x => x.length > 0) : [];

        if (items.length > 1) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_complete_bosses_${interaction.channel.id}`)
            .setPlaceholder('Select successfully completed monsters/bosses...')
            .setMinValues(1)
            .setMaxValues(items.length)
            .addOptions(
              items.map(item => new StringSelectMenuOptionBuilder().setLabel(item).setValue(item))
            );

          return await interaction.reply({
            content: '📋 **Check off the bosses/monsters that were successfully completed:**',
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`confirm_close_ticket_${interaction.channel.id}_all`).setLabel('Yes, Close Ticket').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('cancel_close_ticket').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.reply({
          content: '⚠️ **Are you sure you want to close this ticket?**',
          components: [confirmRow],
          ephemeral: true
        });
      }

      if (customId.startsWith('confirm_close_ticket_')) {
        if (ticketData && interaction.user.id !== ticketData.requesterId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: '❌ Only requester or staff can complete.', ephemeral: true });
        }
        await interaction.deferUpdate();
        await executeTicketCompletion(interaction, ticketData, null);
        return;
      }

      if (customId === 'cancel_close_ticket') {
        return interaction.update({ content: '❌ Ticket closure canceled.', components: [], ephemeral: true });
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_complete_bosses_')) {
      const channelId = interaction.customId.replace('select_complete_bosses_', '');
      const ticketData = activeTickets.get(channelId);
      if (!ticketData) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });

      const completedBosses = interaction.values;
      tempTicketCache.set(`${interaction.user.id}_completed`, completedBosses);

      const calculatedPts = getPointsForTicket(ticketData, completedBosses);

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`confirm_close_ticket_custom_${channelId}`).setLabel('Yes, Close Ticket').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_close_ticket').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      return await interaction.update({
        content: `You selected completed: **${completedBosses.join(', ')}**\nAdjusted Points to Award: **${calculatedPts} pts**\n\n⚠️ **Are you sure you want to close this ticket?**`,
        components: [confirmRow],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('confirm_close_ticket_custom_')) {
      const channelId = interaction.customId.replace('confirm_close_ticket_custom_', '');
      const ticketData = activeTickets.get(channelId);
      const completedBosses = tempTicketCache.get(`${interaction.user.id}_completed`) || null;

      await interaction.deferUpdate();
      await executeTicketCompletion(interaction, ticketData, completedBosses);
      tempTicketCache.delete(`${interaction.user.id}_completed`);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const { commandName, options } = interaction;

      // --- /VIEWPOINTS COMMAND ---
      if (commandName === 'viewpoints') {
        const target = options.getUser('user') || interaction.user;
        const pts = helperPoints.get(target.id) || 0;
        return await interaction.reply({ content: `🏅 **${target.tag}** currently has **${pts}** helper points.`, ephemeral: true });
      }

      // --- MODERATION COMMANDS ---
      if (commandName === 'kick') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) return await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        
        await member.kick(reason).catch(err => {
          return interaction.reply({ content: `❌ Failed to kick user: ${err.message}`, ephemeral: true });
        });

        return await interaction.reply({ content: `✅ Successfully kicked **${targetUser.tag}**. Reason: ${reason}`, ephemeral: true });
      }

      if (commandName === 'mute') {
        const targetUser = options.getUser('user');
        const durationMins = options.getInteger('duration');
        const reason = options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) return await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });

        await member.timeout(durationMins * 60 * 1000, reason).catch(err => {
          return interaction.reply({ content: `❌ Failed to mute user: ${err.message}`, ephemeral: true });
        });

        return await interaction.reply({ content: `✅ Successfully muted **${targetUser.tag}** for **${durationMins} minutes**. Reason: ${reason}`, ephemeral: true });
      }

      if (commandName === 'snipe') {
        const sniped = snipeCache.get(interaction.channel.id);
        if (!sniped) {
          return await interaction.reply({ content: '❌ There are no deleted messages to snipe in this channel.', ephemeral: true });
        }

        const snipeEmbed = new EmbedBuilder()
          .setTitle('🎯 Sniped Message')
          .setDescription(sniped.content)
          .setAuthor({ name: sniped.author.tag, iconURL: sniped.author.displayAvatarURL() })
          .setTimestamp(sniped.createdAt)
          .setColor('#e74c3c');

        if (sniped.image) snipeEmbed.setImage(sniped.image);

        return await interaction.reply({ embeds: [snipeEmbed] });
      }

      if (commandName === 'viewprofile') {
        const targetUser = options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) return await interaction.reply({ content: '❌ User not found.', ephemeral: true });

        const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r).join(', ') || 'None';
        const profileEmbed = new EmbedBuilder()
          .setTitle(`👤 Profile: ${targetUser.tag}`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
            { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: '🎂 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
            { name: `🛡️ Roles (${member.roles.cache.size - 1})`, value: roles, inline: false }
          )
          .setColor('#3498db')
          .setTimestamp();

        return await interaction.reply({ embeds: [profileEmbed], ephemeral: true });
      }

      // --- GIVEAWAY COMMAND HANDLER ---
      if (commandName === 'giveaway') {
        const sub = options.getSubcommand();

        if (sub === 'start') {
          await interaction.deferReply({ ephemeral: true });
          const channel = options.getChannel('channel');
          const prize = options.getString('prize');
          const title = options.getString('title');
          const description = options.getString('description').replace(/\\n/g, '\n');
          const durationMins = options.getInteger('duration');
          const winnersCount = options.getInteger('winners');
          const role1 = options.getRole('role1')?.id || null;
          const role2 = options.getRole('role2')?.id || null;
          const bannerUrl = options.getString('banner_url') || STANDARD_BANNER_URL;

          const endsAt = Date.now() + durationMins * 60 * 1000;
          const gwId = `gw_${Date.now()}`;

          let roleReqText = 'None (Everyone can join)';
          if (role1 && role2) roleReqText = `<@&${role1}> or <@&${role2}>`;
          else if (role1) roleReqText = `<@&${role1}>`;
          else if (role2) roleReqText = `<@&${role2}>`;

          const gwContainer = {
            type: 17,
            accent_color: 0xf1c40f,
            components: [
              {
                type: 12,
                items: [{ media: { url: bannerUrl } }]
              },
              {
                type: 9,
                components: [
                  {
                    type: 10,
                    content: `# ${title}\n\n` +
                             `🎉 **Prize:** ${prize}\n\n` +
                             `${description}\n\n` +
                             `**Winners:** ${winnersCount}\n` +
                             `Hosted by: ${interaction.user}\n` +
                             `Required Roles: ${roleReqText}\n` +
                             `Ends At: <t:${Math.floor(endsAt / 1000)}:R>`
                  }
                ],
                accessory: {
                  type: 2,
                  style: 3, // Style 3 = Green Button (Success)
                  custom_id: `gw_enter_${gwId}`,
                  label: '🎉 Enter Giveaway'
                }
              }
            ]
          };

          const gwMsg = await channel.send({
            components: [gwContainer],
            flags: MessageFlags.IsComponentsV2
          });

          activeGiveaways.set(gwId, {
            messageId: gwMsg.id,
            channelId: channel.id,
            prize,
            winnersCount,
            role1,
            role2,
            hostId: interaction.user.id,
            entries: new Set(),
            ended: false,
            endsAt
          });

          setTimeout(async () => {
            await endGiveaway(interaction.guild, gwId);
          }, durationMins * 60 * 1000);

          return await interaction.editReply(`✅ Giveaway successfully started in ${channel}! (ID: \`${gwId}\`)`);
        }

        if (sub === 'end') {
          await interaction.deferReply({ ephemeral: true });
          const messageId = options.getString('message_id');
          let foundGwId = null;

          for (const [id, data] of activeGiveaways.entries()) {
            if (data.messageId === messageId && !data.ended) {
              foundGwId = id;
              break;
            }
          }

          if (!foundGwId) {
            return await interaction.editReply('❌ Active giveaway with that Message ID not found.');
          }

          await endGiveaway(interaction.guild, foundGwId);
          return await interaction.editReply('✅ Giveaway ended successfully!');
        }

        if (sub === 'reroll') {
          await interaction.deferReply({ ephemeral: true });
          const messageId = options.getString('message_id');
          let foundGw = null;

          for (const data of activeGiveaways.values()) {
            if (data.messageId === messageId && data.ended) {
              foundGw = data;
              break;
            }
          }

          if (!foundGw) {
            return await interaction.editReply('❌ Ended giveaway with that Message ID not found.');
          }

          const entriesArr = Array.from(foundGw.entries);
          if (entriesArr.length === 0) {
            return await interaction.editReply('❌ No entries found to reroll from.');
          }

          const winnerId = entriesArr[Math.floor(Math.random() * entriesArr.length)];
          const channel = interaction.guild.channels.cache.get(foundGw.channelId);
          if (channel) {
            await channel.send(`🔄 **Reroll Winner!** Congratulations <@${winnerId}>! You won the **${foundGw.prize}**! 🎉`);
          }

          return await interaction.editReply(`✅ Successfully rerolled a new winner: <@${winnerId}>`);
        }
      }

      // --- /SETUP-BOOST COMMAND ---
      if (commandName === 'setup-boost') {
        await interaction.deferReply({ ephemeral: true });
        const channel = options.getChannel('channel');
        const title = options.getString('title');
        const description = options.getString('description').replace(/\\n/g, '\n');
        const bannerUrl = options.getString('banner_url') || STANDARD_BANNER_URL;

        const cfg = guildSettings.get(interaction.guild.id) || {};
        cfg.boostChannelId = channel.id;
        cfg.boostData = { title, description, bannerUrl };
        guildSettings.set(interaction.guild.id, cfg);

        return await interaction.editReply(`✅ Boost announcement channel set to ${channel}!`);
      }

      // --- /SETUP-WELCOME COMMAND ---
      if (commandName === 'setup-welcome') {
        await interaction.deferReply({ ephemeral: true });
        const channel = options.getChannel('channel');
        const outerMessage = options.getString('outer_message').replace(/\\n/g, '\n');
        const title = options.getString('title');
        const description = options.getString('description').replace(/\\n/g, '\n');
        const bannerUrl = options.getString('banner_url') || STANDARD_BANNER_URL;

        const cfg = guildSettings.get(interaction.guild.id) || {};
        cfg.welcomeChannelId = channel.id;
        cfg.welcomeData = { outerMessage, title, description, bannerUrl };
        guildSettings.set(interaction.guild.id, cfg);

        return await interaction.editReply(`✅ Welcome announcement channel set to ${channel}!`);
      }

      // --- SETUP VERIFICATION PANEL COMMAND ---
      if (commandName === 'setup-verification') {
        await interaction.deferReply({ ephemeral: true });

        const channel = options.getChannel('channel');
        const guestRole = options.getRole('guest_role');
        const memberRole = options.getRole('member_role');
        const panelTitle = options.getString('panel_title');
        const guestTitle = options.getString('guest_title');
        const guestDesc = options.getString('guest_desc').replace(/\\n/g, '\n');
        const memberTitle = options.getString('member_title');
        const memberDesc = options.getString('member_desc').replace(/\\n/g, '\n');

        const guestBtnName = options.getString('guest_btn_name') || 'Verify as Guest';
        const memberBtnName = options.getString('member_btn_name') || 'Verify as Member';
        const bannerUrl = options.getString('banner_url') || STANDARD_BANNER_URL;
        const footerBannerUrl = options.getString('footer_banner_url');

        if (!channel || !channel.isTextBased()) {
          return await interaction.editReply('❌ Please select a valid text channel.');
        }

        const verifyComponents = [
          {
            type: 12,
            items: [{ media: { url: bannerUrl } }]
          },
          {
            type: 10,
            content: `# ${panelTitle}`
          },
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `**${guestTitle}**\n-# > ${guestDesc}`
              }
            ],
            accessory: {
              type: 2,
              style: 2,
              custom_id: `btn_verify_guest_${guestRole.id}`,
              label: guestBtnName
            }
          },
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `**${memberTitle}**\n-# > ${memberDesc}`
              }
            ],
            accessory: {
              type: 2,
              style: 2,
              custom_id: `btn_verify_member_${memberRole.id}`,
              label: memberBtnName
            }
          }
        ];

        if (footerBannerUrl) {
          verifyComponents.push({ type: 14 });
          verifyComponents.push({
            type: 12,
            items: [{ media: { url: footerBannerUrl } }]
          });
        }

        const verifyContainer = {
          type: 17,
          accent_color: 0x8b0000,
          components: verifyComponents
        };

        try {
          await channel.send({
            components: [verifyContainer],
            flags: MessageFlags.IsComponentsV2
          });
          return await interaction.editReply(`✅ Verification panel successfully posted to ${channel}!`);
        } catch (err) {
          console.error('Error posting verification panel:', err);
          return await interaction.editReply(`❌ Failed to post panel: ${err.message}`);
        }
      }

      if (commandName === 'setup-ticket-hub') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const channel = options.getChannel('channel');
          if (!channel || !channel.isTextBased()) {
            return await interaction.editReply('❌ Please select a valid text channel to post the panel.');
          }

          const customBanner = options.getString('banner_url');
          const guideTitle = options.getString('guide_title') || undefined;
          const guideDesc = options.getString('guide_desc') || undefined;
          const guideUrl = options.getString('guide_url') || undefined;
          const createTitle = options.getString('create_title') || undefined;
          const createDesc = options.getString('create_desc') || undefined;
          const category = options.getChannel('category');
          const logChannel = options.getChannel('log_channel');

          const cfg = guildSettings.get(interaction.guild.id) || {};
          if (category) cfg.ticketCategory = category.id;
          if (logChannel) cfg.logChannelId = logChannel.id;
          guildSettings.set(interaction.guild.id, cfg);

          const payload = buildTicketHubPayload({
            imageUrl: customBanner || STANDARD_BANNER_URL,
            guideTitle,
            guideDesc,
            guideUrl,
            createTitle,
            createDesc
          });

          await channel.send({
            components: payload.components,
            flags: payload.flags
          });

          return await interaction.editReply(`✅ Ticket Hub Panel successfully posted to ${channel}!`);
        } catch (err) {
          console.error('Error posting ticket hub panel:', err);
          return await interaction.editReply(`❌ Failed to post panel: ${err.message}. Please check bot channel permissions.`);
        }
      }

      if (commandName === 'stats') {
        const customMessage = options.getString('custom_message');
        const defaultFooterMessage = "A huge thank you to each and every one of you who made this possible! ❤️";

        const statsEmbed = new EmbedBuilder()
          .setTitle(`Ticket stats`)
          .setDescription(
            `🎫 **\`${globalStats.totalTicketsCompleted}\`** tickets completed.\n` +
            `🏅 **\`${globalStats.totalPointsGiven}\`** points given out.\n\n` +
            (customMessage ? customMessage.replace(/\\n/g, '\n') : defaultFooterMessage)
          )
          .setColor('#3498db')
          .setTimestamp();

        return await interaction.reply({ embeds: [statsEmbed] });
      }

      if (commandName === 'setup-stats') {
        await interaction.deferReply({ ephemeral: true });
        const channel = options.getChannel('channel');
        
        const statsEmbed = new EmbedBuilder()
          .setTitle(`Ticket stats`)
          .setDescription(
            `🎫 **\`${globalStats.totalTicketsCompleted}\`** tickets completed.\n` +
            `🏅 **\`${globalStats.totalPointsGiven}\`** points given out.\n\n` +
            "A huge thank you to each and every one of you who made this possible! ❤️"
          )
          .setColor('#3498db')
          .setTimestamp();

        const sentMsg = await channel.send({ embeds: [statsEmbed] });

        const cfg = guildSettings.get(interaction.guild.id) || {};
        cfg.statsChannelId = channel.id;
        cfg.statsMessageId = sentMsg.id;
        guildSettings.set(interaction.guild.id, cfg);

        return await interaction.editReply(`✅ Live tracking stats message successfully set up in ${channel}!`);
      }

      if (commandName === 'embed') {
        await interaction.deferReply({ ephemeral: true });

        const channel = options.getChannel('channel');
        if (!channel || !channel.isTextBased()) {
          return await interaction.editReply('❌ Please select a valid text channel.');
        }

        const title = options.getString('title');
        const description = options.getString('description').replace(/\\n/g, '\n');
        const bannerUrl = options.getString('banner_url') || STANDARD_BANNER_URL;
        const footerBannerUrl = options.getString('footer_banner_url');

        const containerComponents = [
          {
            type: 12,
            items: [{ media: { url: bannerUrl } }]
          },
          {
            type: 10,
            content: `**${title}**\n\n${description}`
          }
        ];

        if (footerBannerUrl) {
          containerComponents.push({ type: 14 });
          containerComponents.push({
            type: 12,
            items: [{ media: { url: footerBannerUrl } }]
          });
        }

        const containerComponent = {
          type: 17,
          accent_color: 0x8b0000,
          components: containerComponents
        };

        try {
          await channel.send({
            components: [containerComponent],
            flags: MessageFlags.IsComponentsV2
          });
          return await interaction.editReply(`✅ Components V2 panel successfully posted to ${channel}!`);
        } catch (err) {
          console.error('Error posting Components V2 embed:', err);
          return await interaction.editReply(`❌ Failed to post layout message: ${err.message}`);
        }
      }

      if (commandName === 'reactionrole') {
        await interaction.deferReply({ ephemeral: true });

        const channel = options.getChannel('channel');
        if (!channel || !channel.isTextBased()) {
          return await interaction.editReply('❌ Please select a valid text channel.');
        }

        const title = options.getString('title');
        const description = options.getString('description').replace(/\\n/g, '\n');
        const bannerUrl = options.getString('banner_url') || STANDARD_BANNER_URL;

        const sections = [];
        const usedRoleIds = new Set();

        for (let i = 1; i <= 7; i++) {
          const role = options.getRole(`role${i}`);
          const desc = options.getString(`desc${i}`);
          
          if (role && desc) {
            if (usedRoleIds.has(role.id)) continue;
            usedRoleIds.add(role.id);

            const rawEmoji = options.getString(`emoji${i}`);
            let emojiObj = undefined;
            if (rawEmoji) {
              const customEmojiMatch = rawEmoji.match(/<a?:(.+?):(\d+)>/);
              if (customEmojiMatch) {
                emojiObj = { id: customEmojiMatch[2], name: customEmojiMatch[1] };
              } else {
                emojiObj = { name: rawEmoji.trim() };
              }
            }

            sections.push({
              type: 9,
              components: [
                {
                  type: 10,
                  content: `@${role.name}\n-# > ${desc}`
                }
              ],
              accessory: {
                type: 2,
                style: 2,
                custom_id: `rr_${role.id}`,
                label: role.name,
                ...(emojiObj && { emoji: emojiObj })
              }
            });
          }
        }

        if (sections.length === 0) {
          return await interaction.editReply('❌ You must provide at least one valid role and description.');
        }

        const containerComponent = {
          type: 17,
          accent_color: 0x8b0000,
          components: [
            {
              type: 12,
              items: [{ media: { url: bannerUrl } }]
            },
            {
              type: 10,
              content: `**${title}**\n\n${description}`
            },
            ...sections
          ]
        };

        try {
          await channel.send({
            components: [containerComponent],
            flags: MessageFlags.IsComponentsV2
          });
          return await interaction.editReply(`✅ Components V2 reaction role panel successfully posted to ${channel}!`);
        } catch (err) {
          console.error('Error posting reaction role panel:', err);
          return await interaction.editReply(`❌ Failed to post panel: ${err.message}`);
        }
      }

      if (commandName === 'setup-channels') {
        await interaction.deferReply({ ephemeral: true });

        const logChannel = options.getChannel('log_channel');
        const welcomeChannel = options.getChannel('welcome_channel');
        const boostChannel = options.getChannel('boost_channel');
        const verifyLogChannel = options.getChannel('verify_log_channel');

        const cfg = guildSettings.get(interaction.guild.id) || {};
        if (logChannel) cfg.logChannelId = logChannel.id;
        if (welcomeChannel) cfg.welcomeChannelId = welcomeChannel.id;
        if (boostChannel) cfg.boostChannelId = boostChannel.id;
        if (verifyLogChannel) cfg.verifyLogChannelId = verifyLogChannel.id;

        guildSettings.set(interaction.guild.id, cfg);

        const statusUpdates = [
          logChannel ? `• **Log Channel:** ${logChannel}` : null,
          welcomeChannel ? `• **Welcome Channel:** ${welcomeChannel}` : null,
          boostChannel ? `• **Boost Channel:** ${boostChannel}` : null,
          verifyLogChannel ? `• **Verify Log Channel:** ${verifyLogChannel}` : null,
        ].filter(Boolean);

        if (statusUpdates.length === 0) return await interaction.editReply('⚠️ No channels updated.');

        return await interaction.editReply(`✅ **Configured Channels:**\n${statusUpdates.join('\n')}`);
      }

      if (commandName === 'leaderboard') {
        const sortedHelpers = [...helperPoints.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
        const sortedRequesters = [...userRequestCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

        const helpersStr = sortedHelpers.length > 0 ? sortedHelpers.map(([id, pts], i) => `**${i + 1}.** <@${id}> — \`${pts} pts\``).join('\n') : 'No helper data yet';
        const requestersStr = sortedRequesters.length > 0 ? sortedRequesters.map(([id, reqs], i) => `**${i + 1}.** <@${id}> — \`${reqs} tickets\``).join('\n') : 'No request data yet';

        const lbEmbed = new EmbedBuilder().setTitle('📊 Server Activity Leaderboard (Top 20)').addFields({ name: '🏆 Top Helpers', value: helpersStr, inline: true }, { name: '📩 Top Requesters', value: requestersStr, inline: true }).setColor('#3498db').setTimestamp();

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
          return await interaction.reply({ content: `✅ Role ${role} set for **${requiredPts} pts**.`, ephemeral: true });
        }

        if (sub === 'list') {
          if (roleRewards.size === 0) return await interaction.reply({ content: '⚙️ No role rewards set.', ephemeral: true });

          const sorted = [...roleRewards.entries()].sort((a, b) => a[0] - b[0]);
          const rewardList = sorted.map(([pts, roleId]) => `• **${pts} Pts** -> <@&${roleId}>`).join('\n');

          const embed = new EmbedBuilder().setTitle('🏅 Role Rewards').setDescription(rewardList).setColor('#3498db');
          return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
});

// --- GIVEAWAY END HELPER ---
async function endGiveaway(guild, gwId) {
  const giveaway = activeGiveaways.get(gwId);
  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;
  const channel = guild.channels.cache.get(giveaway.channelId);
  if (!channel) return;

  const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  const entriesArr = Array.from(giveaway.entries);

  let winnerMentions = [];
  if (entriesArr.length > 0) {
    const shuffled = entriesArr.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, giveaway.winnersCount);
    winnerMentions = selected.map(id => `<@${id}>`);
  }

  const resultText = winnerMentions.length > 0 ? winnerMentions.join(', ') : 'No valid entries.';

  const endedContainer = {
    type: 17,
    accent_color: 0x7f8c8d,
    components: [
      {
        type: 12,
        items: [{ media: { url: STANDARD_BANNER_URL } }]
      },
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `🎉 **GIVEAWAY ENDED** 🎉\n\n` +
                     `**Prize:** ${giveaway.prize}\n` +
                     `**Winner(s):** ${resultText}\n` +
                     `Hosted by: <@${giveaway.hostId}>`
          }
        ]
      }
    ]
  };

  if (msg) {
    await msg.edit({ components: [endedContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  }

  if (winnerMentions.length > 0) {
    await channel.send(`🎊 Congratulations ${resultText}! You won the **${giveaway.prize}**! 🎉`);
  } else {
    await channel.send(`❌ Giveaway for **${giveaway.prize}** ended with no participants.`);
  }

  activeGiveaways.delete(gwId);
}

// --- HELPER FUNCTION FOR TICKET COMPLETION EXECUTION ---
async function executeTicketCompletion(interaction, ticketData, completedBosses) {
  try {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(() => {});

    if (ticketData) {
      const currentReqs = userRequestCounts.get(ticketData.requesterId) || 0;
      userRequestCounts.set(ticketData.requesterId, currentReqs + 1);
    }

    let pointsToAward = 0;
    if (ticketData && ticketData.helpers.length > 0 && ticketData.type !== 'server_ticket') {
      const checkedBosses = completedBosses || tempTicketCache.get(`${interaction.user.id}_completed`) || null;
      pointsToAward = getPointsForTicket(ticketData, checkedBosses);

      for (const hObj of ticketData.helpers) {
        const current = helperPoints.get(hObj.id) || 0;
        const updated = current + pointsToAward;
        helperPoints.set(hObj.id, updated);

        checkAndAssignHelperRoles(interaction.guild, hObj.id, updated).catch(console.error);
      }

      globalStats.totalTicketsCompleted += 1;
      globalStats.totalPointsGiven += pointsToAward;
      globalStats.totalBossesSlain += 1;

      await updateLiveStatsMessage(interaction.guild);
    }

    const helperMentionsLog = ticketData && ticketData.helpers.length > 0
      ? ticketData.helpers.map(h => `<@${h.id}>`).join(', ')
      : 'None';

    sendTicketLog(
      interaction.guild,
      '✅ Ticket Completed',
      `**Requester:** <@${ticketData.requesterId}>\n**Helpers:** ${helperMentionsLog}\n**Points Awarded:** \`${pointsToAward}\`\n**Channel:** \`#${interaction.channel.name}\``,
      '#2ecc71'
    ).catch(() => {});

    const categoryPreset = TICKET_PRESETS[ticketData?.type] || {};
    const accentColor = categoryPreset.accentColor || 0x2ecc71;

    let detailContent = '⚠️ **No helpers joined this ticket.**';
    if (ticketData && ticketData.type === 'server_ticket') {
      detailContent = '🛠️ **Support ticket handled and resolved by staff.**';
    } else if (ticketData && ticketData.helpers.length > 0) {
      const helperMentions = ticketData.helpers.map(h => `<@${h.id}>`).join(', ');
      detailContent = `🏆 **+${pointsToAward} pts** awarded to:\n> ${helperMentions}`;
    }

    const completionEmbed = new EmbedBuilder()
      .setTitle('🔒 Ticket Completed')
      .setDescription(`Resolved successfully!\n${detailContent}\n\n*Deleting channel in 5 seconds...*`)
      .setColor(accentColor)
      .setTimestamp();

    await interaction.editReply({ embeds: [completionEmbed], components: [] });

    activeTickets.delete(interaction.channel.id);
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  } catch (err) {
    console.error('Error during ticket completion execution:', err);
    await interaction.editReply({ content: '❌ Failed to complete ticket properly.', components: [] }).catch(() => {});
  }
}

// --- LOGIN ---
client.login(process.env.DISCORD_TOKEN);

// --- HTTP SERVER FOR KEEP-ALIVE ---
http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);
