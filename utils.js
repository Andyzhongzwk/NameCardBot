const axios = require('axios').default; // for downloading images
const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Hong_Kong"); // UTC+08:00

const withTimeout = (millis, promise) => {
  const timeout = new Promise((resolve, reject) =>
      setTimeout(
          () => reject(`Timed out after ${millis} ms.`),
          millis));
  return Promise.race([
      promise,
      timeout
  ]);
};

module.exports = {
  withTimeout,

  formatDate: (d) => {
    return moment(d).format("YYYY-MM-DD HH:mm:ss");
  },

  joinGroupViaLink: async (client, joiningGroupLink) => {
    return await client.acceptInvite(joiningGroupLink.split('\/').pop());
  },

  getGroupChatById: async (client, chatId, timeout = 2400) => {
    return await withTimeout(timeout * 1000, client.getChatById(chatId));
  },

  getAllGroupChats: async (client) => {
    return await withTimeout(3600 * 1000, client.getChats());
  },

  getGroupAdminIds: async (groupChat) => {
    return (await groupChat.participants).filter(p => p.isAdmin).map(p => p.id._serialized); // group admin IDs
  },

  getGroupParticipantIds: async (groupChat) => {
    return (await groupChat.participants).map(p => p.id._serialized); // group participant IDs
  },

  getGroupChat: (groupName, allGroups) => {
    if (groupName) {
      //if (groupName.includes('@g.us')) return groupName;
      let targetGroupName = groupName.trim().toLowerCase();
      for (let group of allGroups) {
        if (targetGroupName == group.id._serialized || (group.name && group.name.trim().toLowerCase() == targetGroupName)) {
          // group name or group ID match
          return group;
        }
      }
    }
    return null;
  },

  sendTextWithMentions: async (client, chat, msg) => {
    let mentions = [];
    if (chat.isGroup) {
      try {
        participants = await chat.participants;
        for (let participant of participants) {
          let number = participant.id.user;
          if (msg.includes(`@${number}`)) { // mentioned participant
            //mentions.push(await client.getContactById(participant.id._serialized))
            mentions.push(participant.id._serialized);
          }
        }
        await chat.fetchMessages(); // prevent not able to get the previously sent msg
      } catch (e) {
        console.log(e);
      }
    }
    return await chat.sendMessage(msg, { mentions }); // text with mention
  },
  
  getMsgMentions: async (client, chat, msg) => {
    let mentions = [];
    if (chat.isGroup) {
      participants = await chat.participants;
      for (let participant of participants) {
        let number = participant.id.user;
        if (msg.includes(`@${number}`)) { // mentioned participant
          //mentions.push(await client.getContactById(participant.id._serialized));
          mentions.push(participant.id._serialized);
        }
      }
      if (mentions.length > 0) await chat.fetchMessages(); // prevent not able to get the previously sent msg
    }
    return mentions;
  },

  deleteMessage: (client, messageId) => {
    // TODO
  },

  /**
   * Prepend a phone with "852"
   * @param {String} phone The phone number
   * @return {String} Phone Prepended "852"
   */
  parsePhone: (phone) => {
    phone = phone.toString().trim();
    if (phone != null && phone != "") {
      if (phone.length == 8 && /^852\d{8}$/.test(phone) == false) phone = "852" + phone;
    } else phone = "";
    return phone;
  },

  getBase64FromUrl: async (url) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  },
  sleep: (s) => {
    return new Promise((resolve) => {
      setTimeout(resolve, s * 1000);
    });
  },
  randInt: (min, max) => Math.floor(Math.random() * (max - min + 1) + min),
  printLog: (msg, hostNumber) => console.log(`[${moment().toString()}] ${hostNumber}: ${msg}`)
}