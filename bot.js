require('dotenv').config();
const { Telegraf } = require('telegraf');
const fetch = require('node-fetch'); // Versi 2
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Halo! Kirimkan file audio atau video untuk saya konversi.');
});

bot.on(['audio', 'voice', 'video', 'document'], async (ctx) => {
  const message = ctx.message;
  let fileInfo = null;
  let ext = null;

  if (message.audio) {
    fileInfo = await ctx.telegram.getFile(message.audio.file_id);
    ext = 'mp3';
  } else if (message.voice) {
    fileInfo = await ctx.telegram.getFile(message.voice.file_id);
    ext = 'ogg';
  } else if (message.document) {
    fileInfo = await ctx.telegram.getFile(message.document.file_id);
    const filename = message.document.file_name;
    ext = filename.split('.').pop().toLowerCase();
    if (!['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return ctx.reply('Hanya file audio atau video yang didukung.');
    }
  } else if (message.video) {
    fileInfo = await ctx.telegram.getFile(message.video.file_id);
    ext = 'mp4';
  }

  if (!fileInfo) {
    return ctx.reply('Kirim file audio atau video ya.');
  }

  const waitMsg = await ctx.reply('⏳');
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
  const inputPath = `${fileInfo.file_id}.${ext}`;
  const outputPath = `${fileInfo.file_id}_converted.ogg`;

  try {
    const response = await fetch(fileUrl);
    const buffer = await response.buffer();
    fs.writeFileSync(inputPath, buffer);

    let sourcePath = inputPath;

    if (ext === 'mp4') {
      const audioPath = `${fileInfo.file_id}.mp3`;
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .output(audioPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      sourcePath = audioPath;
    }

    await new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .audioChannels(2)
        .audioFrequency(48000)
        .audioCodec('libopus')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    await ctx.replyWithVoice({ source: fs.createReadStream(outputPath) });
    await ctx.deleteMessage(waitMsg.message_id);
  } catch (error) {
    console.error(error);
    ctx.reply(`Terjadi kesalahan saat konversi: ${error.message}`);
  } finally {
    [inputPath, outputPath, `${fileInfo.file_id}.mp3`].forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
});

bot.launch();
console.log('🤖 Bot berjalan...');
