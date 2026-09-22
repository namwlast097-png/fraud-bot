require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const conversationHistory = new Map();

// --- FREE WEB SERVER TO KEEP BOT ALIVE 24/7 ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Fraud-Bot is Alive and Running 24/7!\n');
});
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Web server keeping bot awake listening on port ${PORT}`);
});

client.once('ready', () => {
    client.user.setPresence({
        activities: [{ name: 'Battle Bricks 🧱' }],
        status: 'online',
    });
    console.log(`${client.user.tag} is online and fully stable!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!help')) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0xF4B400)
            .setTitle('🧱 Fraud-Bot: Stable AI Mode')
            .setDescription('I scan chat automatically! Talk about units, loadouts, or bosses like Chronos.')
            .setFooter({ text: 'Powered by Gemini 3.6 Flash' });

        return message.reply({ embeds: [helpEmbed] });
    }

    const triggerKeywords = [
        'loadout', 'deck', 'unit', 'battler', 'enemy', 'enemies', 
        'boss', 'stage', 'chapter', 'subchapter', 'counter', 'anti-',
        'casual', 'tumore', 'mangos', 'xp', 'bricks', 'wiki', 'strategy',
        'chronos', 'tumore', 'angel'
    ];

    const messageLower = message.content.toLowerCase();
    const isBotMentioned = message.mentions.has(client.user);
    const containsGameTopic = triggerKeywords.some(keyword => messageLower.includes(keyword));

    if (isBotMentioned || containsGameTopic) {
        const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();
        if (!userPrompt) return;

        await message.channel.sendTyping();

        const userId = message.author.id;
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, [
                { 
                    role: 'user', 
                    parts: [{ text: 'System Instruction: You are Fraud-Bot, an expert companion for the Roblox game "The Battle Bricks" (created by Tumore). You analyze user questions and recommend explicit 8-unit slot loadouts.\n\n' +
                             'CRITICAL WIKI KNOWLEDGE:\n' +
                             '- Chronos: Chronos is a massive Angel Boss character in the game. He originally appeared as the main boss in the "Across Heaven" subchapter update. To counter Chronos, players must use units with the "Anti-Angel" trait modifier to reduce incoming damage and deal extra damage.\n' +
                             '- Economy Meta: Always deploy a "Builder" or "Speed" unit early to protect your base while upgrading your Base Bank economy level to 5-7 to scale resources.\n' +
                             '- Trait Counters: Structure loadouts around Anti-Red, Anti-Black (Spartan, Rocket, Ninja), Anti-Death, Anti-Angel (crucial for Chronos), Anti-Zombie, and Anti-Devil.' }] 
                }
            ]);
        }

        const userHistory = conversationHistory.get(userId);
        userHistory.push({ role: 'user', parts: [{ text: userPrompt }] });

        try {
            // Running standard fast generation without the unstable search tools
            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: userHistory
            });

            const aiReply = response.text;
            userHistory.push({ role: 'model', parts: [{ text: aiReply }] });
            if (userHistory.length > 8) userHistory.splice(1, 2);

            await message.reply(aiReply);

        } catch (fatalError) {
            console.error("❌ Fatal AI Loop Failure:", fatalError);
            await message.reply("My memory banks are updating! Try asking your question again in a second.");
        }
    }
});

client.login(process.env.TOKEN);
