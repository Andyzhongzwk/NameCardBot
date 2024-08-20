const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const mime = require('mime-types');
const api = require('./api');

const scriptStartTime = Date.now();

// WhatsApp Web Client Initialization
const client = new Client({
    qrTimeoutMs: 0,
    authTimeoutMs: 0,
    takeoverOnConflict: 60 * 60 * 1000,
    puppeteer: { headless: false },
    authStrategy: new LocalAuth({ clientId: "fdmt-wa-bot" }),
});

client.initialize();

client.on("ready", () => {
    console.log("Client is ready!");
});

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

// Main body: Listen and Respond to Messages
client.on("message", async (msg) => {
    // Check if the message is newly sent
    if (msg.timestamp * 1000 <= scriptStartTime) {
        return;
    }

    // The scenarios which will trigger the bot
    // RM 60 Practitioner Lounge = "85260523886-1595337332@g.us"
    // Bluebird Andy 5540 = "120363028296358990@g.us" for testing
    if (msg.type === "image" && msg.from === "120363028296358990@g.us") {
        try {
            msg.reply("Image received, processing...");

            // Step 1: Download the image and upload to Google Drive
            const { mimetype, data } = await msg.downloadMedia();
            const filename = `NameCard_${msg.timestamp}.${mime.extension(mimetype)}`;
            const imageUrl = await api.uploadImageToCF(data, filename);
            console.log(imageUrl);

            // Step 2: Get response from AIML Api
            const responseJSON = await api.getAIMLApiResponse(imageUrl); // Get response in the format of JSON from AIML Api
            let { name, salutation, email, source_link, whatsapp_number, org, relation, } = responseJSON;

            // Step 3: Check if the provided image is a contact card
            if (name === null && salutation === null) {
                await msg.reply("Not a contact card image.");
            }
            else {
                // Step 4: Insert the information to Appsheet Contact Table by calling Appsheet Api
                const link = await api.insertToContactTable(name, salutation, email, source_link, whatsapp_number, org, relation);

                // Step 5: Reply to the WhatsApp message with retrieved information
                name = name? name : "(Name not given)";
                salutation = salutation? salutation : "(Salutation not given)";
                email = email? email : "(Email not given)";
                source_link = source_link? source_link : "(Website not given)";
                whatsapp_number = whatsapp_number? whatsapp_number : "(Whatsapp number not given)";
                org = org? org : "(Company/ Organization name not given)";
                relation = relation? responseJSON.relation : "(Title not given)";
                const pss_status = "01 PSS to be define";
                
                const replyMsg =
`${salutation} ${name}
${email}  ${whatsapp_number}
${org}
${relation}
${source_link}

PSS Status: ${pss_status}
${link}`;
                await msg.reply(replyMsg);
                console.log(replyMsg);
            }
        } catch (error) {
            console.error("Error handling message:", error);
            await msg.reply("An unexpected error occurred while handling your message.");
        }
    }
})
