const axios = require('axios').default; // may hang occasionally
const FormData = require('form-data');

const getAIMLApiResponse = async (imageUrl) => {
    const AIML_API_URL = "https://api.aimlapi.com/v1/chat/completions"; // API Endpoint
    const AIML_API_KEY = "ff12007fd3824e188670dc0fdbf8e692"; // API Key
    try {
        const response = await axios.post(
            AIML_API_URL,
            {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Extract all contact details of each person from the provided file or link. Then provide the following information accordingly.
                                      Only reply with a structured JSON object with the following fields including:
                                      name (= First name + Last name, Only capitalize the first letter of first name and last name),
                                      salutation (If not explicitly stated title of Dr. or Prof., then only choose between Mr. or Ms. according to the person's gender, no other option, must include the . after the saluatation),
                                      email,
                                      source_link (website of his/her company or organization stated in the card, put null if not explicitly stated, do not make up any links),
                                      whatsapp_number (person's mobile number, no need for the country code, only keep the Hong Kong phone number. For example, output 12345678 for the number +852 1234 5678),
                                      org (name of his/ her company or organization or institution or department the person belongs to),
                                      relation (person's position/ title)
                                      Set as null if no value is provided in any field. Ensure no details are missing.
                                      Set all the fields as null if the provided file or link is not a contact card.
                                      Example JSON object output:
                                      {
                                      "name": "Andy Zhong",
                                      "salutation": "Mr.",
                                      "email": "andy.zhong@fdmt.hk",
                                      "source_link": null,
                                      "whatsapp_number": "68489115",
                                      "org": "FDMT Limited",
                                      "relation": "Analyst"
                                      } or {
                                      "name": null,
                                      "salutation": null,
                                      "email": null,
                                      "source_link": null,
                                      "whatsapp_number": null,
                                      "org": null,
                                      "relation": null
                                      }`,
                            },
                        ],
                    },
                    {
                        role: "user",
                        content: [{ type: "image_url", image_url: { url: imageUrl } }],
                    },
                ],
                max_tokens: 512,
                stream: false,
            },
            {
                headers: {
                    Authorization: `Bearer ${AIML_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const content = response.data.choices[0].message.content.replace(/json|```/g, ""); // Clean the response content
        return JSON.parse(content); // Make sure a JSON object is returned
    } catch (error) {
        console.error("Error getting AIML API response:", error);
        throw new Error("Failed to process the image");
    }
};

const testCallPoeApi = async(companyName, website, title) => {
    const ACCESS_TOKEN = "617ba408824b9f2c2e9e1b61e2c04761";
    const BOT_API_URL = "https://ab-chatgpt-api.fdmt.hk/classify-pss";
    // const prompt =
    // `Given a person's title, company/ organization name and company/ organization website, propose a suitable profession, segment, and sector according to the following rules.
    // The profession must ONLY be one of those in the data source "fdmt-professions-chunk-X" (consider all chunks),
    // the segment must ONLY be one of those in the data source "fdmt-segments-chunk-X" (consider all chunks),
    // the sector must ONLY be one of those in the data source "fdmt-sectors-chunk-X" (consider all chunks). Also return the corresponding id according to the source file.
    // You must assign one and only one profession, segment and a sector according to the given information.
    // The proposed profession, segment and sector may not neccessarily perfectly match the given information, as long as it reasonably concluded the nature of the company/ organization.
    // The proposed profession, segment and sector should only be chosen from the mentioned data source, you should not make up any profession, segment or sector.

    // Company/ Organization name: ${companyName}
    // Website: ${website}
    // Title: ${title}

    // Example response (Only rpely in this format):
    // Profession: IT Consultant,
    // Profession id: 1,
    // Segment: Software,
    // Segment id: 34,
    // Sector: ICT,
    // Sector id: 3`;
    
    // const prompt = `
    // Task:
    // A person work in ${companyName} (website: ${website}), with a title of ${title}. Classify the person to a suitable profession, segment, and a sector.

    // Rules:
    // The profession must ONLY be one of those in the data source "fdmt-professions-chunk-X" (consider all chunks).
    // The segment must ONLY be one of those in the data source "fdmt-segments-chunk-X" (consider all chunks).
    // The sector must ONLY be one of those in the data source "fdmt-sectors-chunk-X" (consider all chunks).
    // Only choose one and only one profession, segment, and sector from the mentioned data source.
    // The chosen profession, segment and sector may not neccessarily perfectly match the given information, it is fine as long as it reasonably concluded the nature of the company/ organization.
    // Do not make up any information, only choose within the data source.

    // Example output:
    // Profession: IT Consultant,
    // Profession id: 1,
    // Segment: Software,
    // Segment id: 34,
    // Sector: ICT,
    // Sector id: 3
    // `;

    const prompt = `What is the id for profession "IT Consultant"`;
    try {
      const response = await axios.post(BOT_API_URL, {
        "version": "1.0",
        "type": "query",
        "query": [{
          "role": "user",
          "content": prompt,
          "timestamp": new Date().valueOf()
        }],
        "user_id": "u-1234abcd5678efgh",
        "conversation_id": "",
        "message_id": "",
      }, {
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
  
    //   console.log(response.data);
  
      let resultJSONStr = "";
      for (const message of response.data.split("\n")) {
        try {
          const jsonStr = message.split("data: ").pop();
          const parsed = JSON.parse((jsonStr || "").trim());
          if (parsed.text) resultJSONStr += parsed.text;
        } catch (e) {
          continue;
        }
      }
  
      console.log(resultJSONStr);
    } catch (error) {
      console.error(error);
    }
};

async function callAppSheetApi(appId, accessKey, tableName, action, selector, rows) {
    var tryCount = 0, maxTries = 5;
    while (true) {
        try {
            let payload = { "Action": action, "Properties": { "Timezone": "China Standard Time" } };
            if (selector) payload["Properties"]["Selector"] = selector;
            if (rows) payload["Rows"] = rows;
            const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;
            const response = await axios.post(url, payload, { headers: { "applicationAccessKey": accessKey } });
            return response.data;
        } catch (error) {
            console.error(error);
            if (++tryCount > maxTries) return [];
            await sleep(randInt(60, 90));
        }
    }
};

const insertToContactTable = async (name, salutation, email, source_link, whatsapp_number, org, relation) => {
    const APP_ID = "868f2e9d-f8fb-45c8-8be2-a743225f73f9"; // function callAppSheetApi and insertToContactTable
    const ACCESS_KEY = "V2-WYmEJ-keP3W-lpdFk-y5n55-KMnHK-G0B8d-qAjvb-KhyMs"; // function callAppSheetApi and insertToContactTable
    const STATUS_ID = "s3831c9ce"; // function insertToContactTable: 01 PSS to be define
    const TEMP_ENTITY_ID = "252"; // function insertToContactTable: Segment "-", under Miscellaneous sector, for temporary storing the practitioner
    try {
        const contactRow = await callAppSheetApi(APP_ID, ACCESS_KEY, "contact", "Add", null, [{
            status_id: STATUS_ID,
            name,
            salutation,
            email,
            source_link,
            whatsapp_number,
            phone_number: whatsapp_number,
        }]);
        const contactId = contactRow.Rows[0].id;

        await callAppSheetApi(APP_ID, ACCESS_KEY, "contact_relation", "Add", null, [
            {
                contact_id: contactId,
                entity_type: "segment",
                entity_id: TEMP_ENTITY_ID,
                org,
                relation,
            },
        ]);
        return `fdmt.hk/t2?view=contact_Detail&key=${contactId}`; // Return the Appsheet record link
    } catch (error) {
        console.error("Error inserting to contact table:", error);
        throw new Error("Failed to insert contact");
    }
};

const fetchCFImageUploadBatchToken = async () => {
    const API_KEY = "QH8Fw-7PYzGAbUHft2RmEVLNKYqnHO-PR4ldhjhv";
    const ACCOUNT_ID = "24af04381f468a29f6134fccdf151bd9";
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1/batch_token`
    const res = await axios.get(url, { headers: { "Authorization": `Bearer ${API_KEY}` } });
    return res.data.result.token;
}


const uploadImageToCF = async (base64Data, fileName = "") => {
    const binaryData = Buffer.from(base64Data, 'base64');
    const formData = new FormData();
    formData.append('file', binaryData, fileName);
    const response = await axios.post('https://batch.imagedelivery.net/images/v1', formData, {
        headers: {
            'Authorization': `Bearer ${await fetchCFImageUploadBatchToken()}`,
            'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        },
    });
    const result = response.data;
    const { variants } = result.result;
    return variants.find(v => v.includes("/public")) || variants[0]; // URL of the uploaded image
}

module.exports = {
    // Name card bot
    getAIMLApiResponse,
    insertToContactTable,
    uploadImageToCF,
    testCallPoeApi
}
