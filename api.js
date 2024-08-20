const axios = require('axios').default; // may hang occasionally
const FormData = require('form-data');
require('dotenv').config();

const getAIMLApiResponse = async (imageUrl) => {
    const AIML_API_URL = process.env.AIML_API_URL;
    const AIML_API_KEY = process.env.AIML_API_KEY;
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

const callAppSheetApi = async (appId, accessKey, tableName, action, selector, rows) => {
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
            await sleep(60);
        }
    }
};

const insertToContactTable = async (name, salutation, email, source_link, whatsapp_number, org, relation) => {
    const APP_ID = process.env.APP_ID;
    const ACCESS_KEY = process.env.ACCESS_KEY;
    const STATUS_ID = process.env.STATUS_ID;
    const TEMP_ENTITY_ID = process.env.TEMP_ENTITY_ID;
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

const fetchCFImageUploadBatchToken = async (CF_API_KEY, ACCOUNT_ID) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1/batch_token`
    const res = await axios.get(url, { headers: { "Authorization": `Bearer ${CF_API_KEY}` } });
    return res.data.result.token;
}

const uploadImageToCF = async (base64Data, fileName = "") => {
    const CF_API_KEY = process.env.CF_API_KEY;
    const ACCOUNT_ID = process.env.ACCOUNT_ID;
    
    const binaryData = Buffer.from(base64Data, 'base64');
    const formData = new FormData();
    formData.append('file', binaryData, fileName);
    const response = await axios.post('https://batch.imagedelivery.net/images/v1', formData, {
        headers: {
            'Authorization': `Bearer ${await fetchCFImageUploadBatchToken(CF_API_KEY, ACCOUNT_ID)}`,
            'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        },
    });
    const result = response.data;
    const { variants } = result.result;
    return variants.find(v => v.includes("/public")) || variants[0]; // URL of the uploaded image
}

module.exports = {
    getAIMLApiResponse,
    insertToContactTable,
    uploadImageToCF,
    testCallPoeApi
}
