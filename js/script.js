const API_URL = "https://child-care-foundation-api-production.up.railway.app";

const menuToggle = document.getElementById("menuToggle");
const navigation = document.getElementById("navigation");

/* =========================================
MOBILE MENU
========================================= */

if (menuToggle && navigation) {

menuToggle.addEventListener("click", () => {

    navigation.classList.toggle("show");

    menuToggle.textContent =
        navigation.classList.contains("show")
            ? "✕"
            : "☰";

});


navigation.querySelectorAll("a").forEach(link => {

    link.addEventListener("click", () => {

        navigation.classList.remove("show");

        menuToggle.textContent = "☰";

    });

});

}

/* =========================================
MTN DONATION
========================================= */

const mtnDonationForm =
document.getElementById("mtnDonationForm");

if (mtnDonationForm) {

mtnDonationForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const name =
            document.getElementById("donorName").value.trim();


        const phone =
            document.getElementById("donorPhone").value.trim();


        const amount =
            document.getElementById("donationAmount").value;


        const button =
            document.getElementById("mtnDonateButton");


        const message =
            document.getElementById("mtnPaymentMessage");


        if (!name || !phone || !amount) {

            message.textContent =
                "Please complete all fields.";

            message.className =
                "payment-message error";

            return;

        }


        button.disabled = true;

        button.textContent =
            "Processing...";


        message.textContent = "";

        message.className =
            "payment-message";


        try {

            const response = await fetch(
                `${API_URL}/api/donate/mtn`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        name: name,

                        phone: phone,

                        amount: Number(amount)

                    })

                }
            );


            const data =
                await response.json();


            if (!response.ok || !data.success) {

    throw new Error(
        data.message ||
        "Donation request failed."
    );

}

message.innerHTML = `
<div class="payment-card">

<h3>❤️ Donation Created Successfully</h3>

<p><strong>Reference:</strong> ${data.reference}</p>

<p><strong>Amount:</strong> UGX ${data.amount}</p>

<p><strong>Payment Method:</strong> ${data.payment_method}</p>

<p><strong>Pay To:</strong> ${data.payment_number}</p>

<hr>

<p><strong>Instructions</strong></p>

<ol>
${data.instructions.map(step => `<li>${step}</li>`).join("")}
</ol>

<button
    id="paidButton"
    class="btn btn-primary">
    I've Paid
</button>

<p id="paidMessage"></p>

</div>
`;

document
.getElementById("paidButton")
.addEventListener("click", () => {

    document
    .getElementById("paidMessage")
    .innerHTML =
    "✅ Thank you! Your donation has been marked as awaiting verification.";

});

        } catch (error) {

            console.error(error);


            message.textContent =
                "Unable to connect to the payment server. Please try again.";

            message.className =
                "payment-message error";

        }


        button.disabled = false;

        button.textContent =
            "Donate with MTN";

    }
);

}

/* =========================================
   AIRTEL DONATION
========================================= */

const airtelDonationForm =
    document.getElementById("airtelDonationForm");

if (airtelDonationForm) {

    airtelDonationForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const name =
                document
                    .getElementById("airtelDonorName")
                    .value
                    .trim();

            const phone =
                document
                    .getElementById("airtelDonorPhone")
                    .value
                    .trim();

            const amount =
                document
                    .getElementById("airtelDonationAmount")
                    .value;

            const button =
                document.getElementById("airtelDonateButton");

            const message =
                document.getElementById("airtelPaymentMessage");

            if (!name || !phone || !amount) {
                message.textContent =
                    "Please complete all fields.";

                message.className =
                    "payment-message error";

                return;
            }

            button.disabled = true;
            button.textContent = "Processing...";

            message.textContent = "";
            message.className = "payment-message";

            try {

                const response =
                    await fetch(`${API_URL}/api/donate/airtel`, {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            name: name,
                            phone: phone,
                            amount: Number(amount)
                        })
                    });

                const data =
                    await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        "Donation request failed."
                    );
                }

                message.innerHTML = `
                    <div class="payment-card">

                        <h3>
                            ❤️ Donation Created Successfully
                        </h3>

                        <p>
                            <strong>Reference:</strong>
                            ${data.reference}
                        </p>

                        <p>
                            <strong>Amount:</strong>
                            UGX ${data.amount}
                        </p>

                        <p>
                            <strong>Payment Method:</strong>
                            ${data.payment_method}
                        </p>

                        <p>
                            <strong>Pay To:</strong>
                            ${data.payment_number}
                        </p>

                        <p>
                            <strong>Account Name:</strong>
                            ${data.account_name}
                        </p>

                        <hr>

                        <p>
                            <strong>Instructions</strong>
                        </p>

                        <ol>
                            ${data.instructions
                                .map(step => `<li>${step}</li>`)
                                .join("")}
                        </ol>

                        <button
                            id="airtelPaidButton"
                            class="btn btn-primary">
                            I've Paid
                        </button>

                        <p id="airtelPaidMessage"></p>

                    </div>
                `;

                document
                    .getElementById("airtelPaidButton")
                    .addEventListener("click", () => {

                        document
                            .getElementById("airtelPaidMessage")
                            .innerHTML =
                            "✅ Thank you! Your donation has been marked as awaiting verification.";

                    });

                airtelDonationForm.reset();

            } catch (error) {

                console.error(
                    "Airtel donation error:",
                    error
                );

                message.textContent =
                    error.message ||
                    "Unable to connect to the donation server.";

                message.className =
                    "payment-message error";

            } finally {

                button.disabled = false;
                button.textContent =
                    "Donate with Airtel";

            }
        }
    );

}

/* =========================================
   CARD DONATION - PESAPAL
========================================= */

const cardDonationForm =
    document.getElementById("cardDonationForm");

if (cardDonationForm) {

    cardDonationForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const button =
                document.getElementById("cardDonateButton");

            const message =
                document.getElementById("cardPaymentMessage");

            const name =
                document.getElementById("cardDonorName").value.trim();

            const email =
                document.getElementById("cardDonorEmail").value.trim();

            const amount =
                Number(
                    document.getElementById("cardDonationAmount").value
                );

            if (!name || !email || !amount || amount < 500) {
                message.textContent =
                    "Please enter your name, email and a donation of at least UGX 500.";

                message.className =
                    "payment-message error";

                return;
            }

            button.disabled = true;
            button.textContent = "Opening secure payment...";

            message.textContent = "";
            message.className = "payment-message";

            try {

                const response = await fetch(
                    `${API_URL}/api/donate/card`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            name,
                            email,
                            amount
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        "Unable to start card payment."
                    );
                }

                if (!data.checkout_url) {
                    throw new Error(
                        "Payment checkout link was not returned."
                    );
                }

                window.location.href =
                    data.checkout_url;

            } catch (error) {

                console.error(
                    "Card donation error:",
                    error
                );

                message.textContent =
                    error.message ||
                    "Unable to connect to the payment server.";

                message.className =
                    "payment-message error";

                button.disabled = false;
                button.textContent =
                    "Donate with Card";
            }
        }
    );

}

/* =========================================
   CHILD CARE FOUNDATION HERO SLIDESHOW
========================================= */

(function () {

    const slides = document.querySelectorAll(".hero-slide");

    if (slides.length < 2) {
        return;
    }

    let currentSlide = 0;

    setInterval(function () {

        slides[currentSlide].classList.remove("active");

        currentSlide =
            (currentSlide + 1) % slides.length;

        slides[currentSlide].classList.add("active");

    }, 5000);

})();
