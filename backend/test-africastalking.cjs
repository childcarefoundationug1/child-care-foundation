const AfricasTalking = require("africastalking");
const dotenv = require("dotenv");

dotenv.config({
    path: __dirname + "/.env"
});

const username = process.env.AFRICASTALKING_USERNAME;
const apiKey = process.env.AFRICASTALKING_API_KEY;

if (!username || !apiKey) {
    console.error("Africa's Talking credentials are missing.");
    process.exit(1);
}

const africastalking = AfricasTalking({
    username,
    apiKey
});

const sms = africastalking.SMS;

(async () => {
    try {
        const result = await sms.fetchMessages({
            lastReceivedId: 0
        });

        console.log("Africa's Talking connection successful.");
        console.log(result);
    } catch (error) {
        console.error("Africa's Talking connection failed.");
        console.error(error.message || error);
        process.exit(1);
    }
})();
