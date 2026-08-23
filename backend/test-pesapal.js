require("dotenv").config();

const axios = require("axios");

async function testPesapal() {

    try {

        console.log("Connecting to Pesapal...");

        const response = await axios.post(

            process.env.PESAPAL_BASE_URL +
            "/api/Auth/RequestToken",

            {
                consumer_key:
                    process.env.PESAPAL_CONSUMER_KEY,

                consumer_secret:
                    process.env.PESAPAL_CONSUMER_SECRET
            },

            {
                headers: {
                    Accept:
                        "application/json",

                    "Content-Type":
                        "application/json"
                },

                timeout: 15000
            }

        );


        console.log(
            "Pesapal status:",
            response.data.status
        );


        console.log(
            "Pesapal message:",
            response.data.message
        );


        console.log(
            "Access token received:",
            response.data.token
                ? "YES"
                : "NO"
        );


    } catch (error) {

        console.log(
            "Pesapal connection failed."
        );


        if (error.response) {

            console.log(
                "HTTP status:",
                error.response.status
            );


            console.log(
                "Response:",
                error.response.data
            );

        } else {

            console.log(
                "Error:",
                error.message
            );

        }

    }

}


testPesapal();
