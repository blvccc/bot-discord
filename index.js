const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const TOKEN = process.env.TOKEN;
const TIMEOUT_MS = 60000; // 1 minute
const SPAM_LIMIT = 5;
const TIME_WINDOW = 5000;

const userMessages = new Map();

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
  }

  const history = userMessages.get(userId).filter(m => now - m.timestamp < TIME_WINDOW);
  history.push({ content: message.content, timestamp: now });
  userMessages.set(userId, history);

  const repeated = history.filter(m => m.content === message.content);
  if (repeated.length >= SPAM_LIMIT) {
    userMessages.set(userId, []);
    try {
      await message.member.timeout(TIMEOUT_MS, 'Spam detected');
      await message.channel.send(`${message.author} has been timed out for spam.`);
    } catch (err) {
      console.log('Error:', err);
    }
  }
});

client.on('messageDelete', async (message) => {
  console.log('[DEBUG] Suppression détectée');
  if (!message.guild || message.author?.bot) return;

  const logChannel = message.guild.channels.cache.find(c => c.name === 'logs-suppression');
  if (!logChannel) return;

  const contenu = message.content || '[Message vide ou fichier supprimé]';
  logChannel.send(`**Message supprimé** de ${message.author.tag} dans ${message.channel} :
\`${contenu}\``);
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);

