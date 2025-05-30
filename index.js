const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

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
const SPAM_LIMIT = 3;
const TIME_WINDOW = 5000;

const userMessages = new Map();

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Delete messages containing "darby"
  if (message.content.toLowerCase().includes('darby')) {
    try {
      await message.delete();
      console.log(`Deleted message: "${message.content}"`);
      return; // Skip spam check if "darby" is detected
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  // Anti-spam system
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
      console.log('Timeout error:', err);
    }
  }
});

client.on('messageDelete', async (message) => {
  console.log('[DEBUG] Message deletion detected');

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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});


// 🔻 Add this block to make the bot leave a specific server 🔻
client.once('ready', async () => {
  const SERVER_ID = '1335803225789566998'; // Your actual server ID

  const guild = client.guilds.cache.get(SERVER_ID);
  if (!guild) {
    console.log(`Bot is not in the server with ID: ${SERVER_ID}`);
    return;
  }

  try {
    await guild.leave();
    console.log(`Bot has left the server: ${guild.name}`);
  } catch (error) {
    console.error('Error leaving the server:', error);
  }
});
// 🔺 End of leave-server logic 🔺


client.login(TOKEN);
