const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const TOKEN = process.env.TOKEN; // Token sécurisé via Replit Secrets

// --- Configuration ---
const TIMEOUT_MS = 60000; // 1 minute pour spam
const SPAM_LIMIT = 3;
const TIME_WINDOW = 5000;
const NEW_ACCOUNT_MUTE_MINUTES = 10; // mute les nouveaux comptes
const LINK_WHITELIST = ['open.spotify.com', '.gif']; // liens autorisés
const MOD_ALERT_CHANNEL = 'mod-alerts'; // nom du canal pour les alertes

const userMessages = new Map();

// --- Anti-spam et suppression de liens ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const now = Date.now();

  // --- Anti-spam existant ---
  if (!userMessages.has(userId)) userMessages.set(userId, []);
  const history = userMessages.get(userId).filter(m => now - m.timestamp < TIME_WINDOW);
  history.push({ content: message.content, timestamp: now });
  userMessages.set(userId, history);

  const repeated = history.filter(m => m.content === message.content);
  if (repeated.length >= SPAM_LIMIT) {
    userMessages.set(userId, []);
    try {
      await message.member.timeout(TIMEOUT_MS, 'Spam detected');
      await message.channel.send(`${message.author} has been timed out for spam.`);
      sendModAlert(message.guild, `${message.author.tag} was timed out for spam.`);
    } catch (err) {
      console.log('Timeout error:', err);
    }
  }

  // --- Supprimer tous les liens sauf ceux autorisés ---
  if (/(https?:\/\/[^\s]+)/gi.test(message.content)) {
    const isAllowed = LINK_WHITELIST.some(link => message.content.includes(link));
    if (!isAllowed) {
      try {
        await message.delete();
        sendModAlert(message.guild, `${message.author.tag} posted a forbidden link: ${message.content}`);
      } catch (err) {
        console.log('Link delete error:', err);
      }
    }
  }
});

// --- Mute des nouveaux comptes ---
client.on('guildMemberAdd', async (member) => {
  const accountAge = Date.now() - member.user.createdTimestamp;
  if (accountAge < NEW_ACCOUNT_MUTE_MINUTES * 60 * 1000) {
    try {
      await member.timeout(NEW_ACCOUNT_MUTE_MINUTES * 60 * 1000, 'New account muted for security');
      sendModAlert(member.guild, `${member.user.tag} (new account) was muted for ${NEW_ACCOUNT_MUTE_MINUTES} minutes.`);
    } catch (err) {
      console.log('New account mute error:', err);
    }
  }
});

// --- Logs des messages supprimés ---
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;

  const logChannel = message.guild.channels.cache.find(c => c.name === 'logs-suppression');
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setAuthor({
      name: `${message.author.tag}`,
      iconURL: message.author.displayAvatarURL()
    })
    .setDescription(`**Deleted message** in ${message.channel}:\n${message.content || "*[No text]*"}`)
    .setTimestamp();

  if (message.attachments.size > 0) {
    embed.setImage(message.attachments.first().url);
  }

  logChannel.send({ embeds: [embed] });
});

// --- Fonction pour envoyer alertes aux modérateurs ---
async function sendModAlert(guild, text) {
  const modChannel = guild.channels.cache.find(c => c.name === MOD_ALERT_CHANNEL);
  if (!modChannel) return;
  modChannel.send({ content: `⚠️ MOD ALERT: ${text}` });
}

// --- Quand le bot est prêt ---
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// --- Connexion ---
client.login(TOKEN);
