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
   MTN + AIRTEL MANUAL MOBILE MONEY
========================================= */

async function submitManualMobileDonation({
    form,
    name,
    phone,
    amount,
    button,
    message,
    endpoint,
    paymentMethod,
    paidButtonId,
    paidMessageId
}) {
    if (!name || !phone || !amount) {
        message.textContent = "Please complete all fields.";
        message.className = "payment-message error";
        return;
    }

    const numericAmount = Number(amount);

    if (!Number.isInteger(numericAmount) || numericAmount < 500) {
        message.textContent =
            "Please enter a donation amount of at least UGX 500.";
        message.className = "payment-message error";
        return;
    }

    button.disabled = true;
    button.textContent = "Creating donation...";

    message.textContent = "";
    message.className = "payment-message";

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                phone,
                amount: numericAmount
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to create donation."
            );
        }

        message.innerHTML = `
            <div class="payment-card">

                <h3>❤️ Donation Created Successfully</h3>

                <p>
                    <strong>Reference:</strong>
                    ${escapeHtml(data.reference)}
                </p>

                <p>
                    <strong>Amount:</strong>
                    UGX ${Number(data.amount).toLocaleString()}
                </p>

                <p>
                    <strong>Payment Method:</strong>
                    ${escapeHtml(data.payment_method)}
                </p>

                <p>
                    <strong>Pay To:</strong>
                    ${escapeHtml(data.payment_number)}
                </p>

                <p>
                    <strong>Account Name:</strong>
                    ${escapeHtml(data.account_name)}
                </p>

                <hr>

                <p>
                    <strong>How to complete your donation</strong>
                </p>

                <ol>
                    ${data.instructions
                        .map(step => `<li>${escapeHtml(step)}</li>`)
                        .join("")}
                </ol>

                <hr>

                <p>
                    <strong>Mobile Money Transaction ID</strong>
                </p>

                <p>
                    Enter the transaction ID from the SMS you received
                    after making the payment.
                </p>

                <input
                    type="text"
                    id="${paidButtonId}TransactionId"
                    placeholder="Enter transaction ID"
                    maxlength="100"
                    autocomplete="off"
                    style="width:100%;padding:12px;margin:8px 0;"
                >

                <button
                    id="${paidButtonId}"
                    class="btn btn-primary"
                    type="button">
                    I Have Paid — Submit Transaction ID
                </button>

                <p id="${paidMessageId}"></p>

            </div>
        `;

        const paidButton =
            document.getElementById(paidButtonId);

        const paidMessage =
            document.getElementById(paidMessageId);

        const transactionInput =
            document.getElementById(
                `${paidButtonId}TransactionId`
            );

        paidButton.addEventListener("click", async () => {

            const transactionId =
                transactionInput.value.trim();

            if (!transactionId) {
                paidMessage.textContent =
                    "Please enter your Mobile Money transaction ID.";
                paidMessage.style.color = "red";
                return;
            }

            paidButton.disabled = true;
            paidButton.textContent =
                "Submitting...";

            paidMessage.textContent = "";
            paidMessage.style.color = "";

            try {
                const submitResponse =
                    await fetch(
                        `${API_URL}/api/donations/${encodeURIComponent(data.reference)}/submit-payment`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                transaction_id: transactionId
                            })
                        }
                    );

                const submitData =
                    await submitResponse.json();

                if (
                    !submitResponse.ok ||
                    !submitData.success
                ) {
                    throw new Error(
                        submitData.message ||
                        "Unable to submit transaction ID."
                    );
                }

                paidMessage.innerHTML =
                    "✅ Payment details submitted successfully.<br>" +
                    "Your donation is now <strong>awaiting verification</strong>.<br>" +
                    "Reference: <strong>" +
                    escapeHtml(submitData.reference) +
                    "</strong>";

                paidMessage.style.color = "#087a42";

                transactionInput.disabled = true;
                paidButton.disabled = true;
                paidButton.textContent =
                    "Submitted — Awaiting Verification";

                form.reset();

            } catch (error) {

                console.error(
                    "Transaction ID submission error:",
                    error
                );

                paidMessage.textContent =
                    error.message ||
                    "Unable to submit transaction ID.";

                paidMessage.style.color = "red";

                paidButton.disabled = false;
                paidButton.textContent =
                    "I Have Paid — Submit Transaction ID";
            }
        });

    } catch (error) {

        console.error(
            `${paymentMethod} donation error:`,
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
            paymentMethod === "MTN Mobile Money"
                ? "Donate with MTN"
                : "Donate with Airtel";
    }
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

            await submitManualMobileDonation({
                form: mtnDonationForm,

                name:
                    document
                        .getElementById("donorName")
                        .value
                        .trim(),

                phone:
                    document
                        .getElementById("donorPhone")
                        .value
                        .trim(),

                amount:
                    document
                        .getElementById("donationAmount")
                        .value,

                button:
                    document
                        .getElementById("mtnDonateButton"),

                message:
                    document
                        .getElementById("mtnPaymentMessage"),

                endpoint:
                    "/api/donate/mtn",

                paymentMethod:
                    "MTN Mobile Money",

                paidButtonId:
                    "mtnPaidButton",

                paidMessageId:
                    "mtnPaidMessage"
            });
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

            await submitManualMobileDonation({
                form: airtelDonationForm,

                name:
                    document
                        .getElementById("airtelDonorName")
                        .value
                        .trim(),

                phone:
                    document
                        .getElementById("airtelDonorPhone")
                        .value
                        .trim(),

                amount:
                    document
                        .getElementById("airtelDonationAmount")
                        .value,

                button:
                    document
                        .getElementById("airtelDonateButton"),

                message:
                    document
                        .getElementById("airtelPaymentMessage"),

                endpoint:
                    "/api/donate/airtel",

                paymentMethod:
                    "Airtel Money",

                paidButtonId:
                    "airtelPaidButton",

                paidMessageId:
                    "airtelPaidMessage"
            });
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
