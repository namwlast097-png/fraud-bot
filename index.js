require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const conversationHistory = new Map();

client.once('ready', () => {
    client.user.setPresence({
        activities: [{ name: 'Browsing TBB Wiki 🌐' }],
        status: 'online',
    });
    console.log(`${client.user.tag} is online with robust error safety fallback active!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!help')) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0xF4B400)
            .setTitle('🧱 Fraud-Bot: Fail-Safe Mode')
            .setDescription('I scan chat automatically and use dual-layer safety to prevent frozen typing indicators.')
            .setFooter({ text: 'Powered by Gemini 3.6 Flash' });

        return message.reply({ embeds: [helpEmbed] });
    }

    const triggerKeywords = [
        'loadout', 'deck', 'unit', 'battler', 'enemy', 'enemies', 
        'boss', 'stage', 'chapter', 'subchapter', 'counter', 'anti-',
        'casual', 'tumore', 'mangos', 'xp', 'bricks', 'wiki', 'strategy'
    ];

    const messageLower = message.content.toLowerCase();
    const isBotMentioned = message.mentions.has(client.user);
    const containsGameTopic = triggerKeywords.some(keyword => messageLower.includes(keyword));

    if (isBotMentioned || containsGameTopic) {
        const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();
        if (!userPrompt) return;

        // Start typing indicator
        await message.channel.sendTyping();

        const userId = message.author.id;
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, [
                { 
                    role: 'user', 
                    parts: [{ text: 'System Instruction: You are Fraud-Bot, an expert companion for the Roblox game "The Battle Bricks". You analyze user questions and recommend explicit 8-unit slot loadouts. Economy meta: deploy a "Builder" or "Speed" unit early to protect your base while upgrading your Base Bank economy level to 5-7 to scale resources.' }] 
                }
            ]);
        }

        const userHistory = conversationHistory.get(userId);
        userHistory.push({ role: 'user', parts: [{ text: userPrompt }] });

        try {
            // LAYER 1: Attempt the live web search tool request
            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: userHistory,
                config: {
                    tools: [{ googleSearch: {} }] 
                }
            });

            const aiReply = response.text;
            userHistory.push({ role: 'model', parts: [{ text: aiReply }] });
            if (userHistory.length > 8) userHistory.splice(1, 2);

            await message.reply(aiReply);

        } catch (searchError) {
            console.warn("⚠️ Live Search grounding hit an error or timeout, applying backup brain...", searchError);
            
            try {
                // LAYER 2 FALLBACK: Run a standard fast generation without the search tool so it doesn't freeze
                const fallbackResponse = await ai.models.generateContent({
                    model: 'gemini-3.6-flash',
                    contents: userHistory
                });

                const fallbackReply = fallbackResponse.text;
                userHistory.push({ role: 'model', parts: [{ text: fallbackReply }] });
                if (userHistory.length > 8) userHistory.splice(1, 2);

                await message.reply(fallbackReply + "\n\n*(🤖 Note: Live wiki searching timed out, generated from my backup memory core!)*");

            } catch (fatalError) {
                console.error("❌ Fatal AI Loop Failure:", fatalError);
                await message.reply("My systems locked up processing that loadout request. Try simplifying your query!");
            }
        }
    }
});

client.login(process.env.TOKEN);
