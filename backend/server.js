const express = require("express");
const PESAPAL_URL = process.env.PESAPAL_URL || "https://pay.pesapal.com/v3";
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
const galleryDir = path.join(uploadsDir, "gallery");

if (!fs.existsSync(galleryDir)) {
    fs.mkdirSync(galleryDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, galleryDir);
    },
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."));
        }
    }
});
const session = require("express-session");


const resend = new Resend(process.env.RESEND_API_KEY);

async function sendFoundationEmail(subject, text) {
    await resend.emails.send({
        from: "onboarding@resend.dev",
        to: process.env.EMAIL_TO,
        subject,
        text
    });
}

require("dotenv").config({
    path: __dirname + "/.env"
});

const AfricasTalking = require("africastalking");

const africasTalking = AfricasTalking({
    username: process.env.AFRICASTALKING_USERNAME,
    apiKey: process.env.AFRICASTALKING_API_KEY
});

const sms = africasTalking.SMS;

const {
    addDonation,

    findDonation,

    updateDonation,

    readDonations,

    addVolunteer,

    readVolunteers,

    updateVolunteer

} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

const FRONTEND_ORIGINS = [
    "https://child-care-foundation-ug.netlify.app",
    "https://child-care-foundation-website-production.up.railway.app",
    "https://pay.pesapal.com"
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || FRONTEND_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        console.error("CORS_REJECTED_ORIGIN:", origin);
        console.error("CORS_ALLOWED_ORIGINS:", FRONTEND_ORIGINS.join(","));
        return callback(new Error("CORS origin not allowed."));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(
    "/uploads/gallery",
    express.static(galleryDir)
);
app.use(express.static(path.join(__dirname, "..")));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 60 * 60 * 1000
    }
}));
function createAdminToken(username) {
    const secret = process.env.ADMIN_TOKEN_SECRET || process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error("ADMIN_TOKEN_SECRET or SESSION_SECRET is required.");
    }

    const payload = {
        username,
        exp: Date.now() + (60 * 60 * 1000)
    };

    const encodedPayload = Buffer
        .from(JSON.stringify(payload))
        .toString("base64url");

    const signature = crypto
        .createHmac("sha256", secret)
        .update(encodedPayload)
        .digest("base64url");

    return encodedPayload + "." + signature;
}

function verifyAdminToken(token) {
    try {
        const secret = process.env.ADMIN_TOKEN_SECRET || process.env.SESSION_SECRET;

        if (!secret || !token) {
            return null;
        }

        const parts = token.split(".");

        if (parts.length !== 2) {
            return null;
        }

        const [encodedPayload, signature] = parts;

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(encodedPayload)
            .digest("base64url");

        const provided = Buffer.from(signature);
        const expected = Buffer.from(expectedSignature);

        if (
            provided.length !== expected.length ||
            !crypto.timingSafeEqual(provided, expected)
        ) {
            return null;
        }

        const payload = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf8")
        );

        if (!payload.username || !payload.exp || Date.now() > payload.exp) {
            return null;
        }

        return payload;
    } catch (error) {
        return null;
    }
}

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization || "";

    if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const payload = verifyAdminToken(token);

        if (payload) {
            req.admin = payload;
            return next();
        }
    }

    if (req.session && req.session.adminAuthenticated === true) {
        req.admin = {
            username: req.session.adminUsername
        };
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Admin authentication required."
    });
}
/*
ADMIN LOGIN
*/

app.post("/api/admin/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });

        }

        if (username !== process.env.ADMIN_USERNAME) {

            return res.status(401).json({
                success: false,
                message: "Invalid admin credentials."
            });

        }
const validPassword =
    await require("bcryptjs").compare(
        password,
        process.env.ADMIN_PASSWORD_HASH
    );
        if (!validPassword) {

            return res.status(401).json({
                success: false,
                message: "Invalid admin credentials."
            });

        }
const adminToken = createAdminToken(username);

        return res.json({
            success: true,
            message: "Admin login successful.",
            token: adminToken
        });

    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to process admin login."
        });

    }

});


/*
HOME
*/

app.get("/", (req, res) => {

    res.json({

        success: true,

        message:
            "Child Care Foundation API is running."

    });

});

/*
CREATE UNIQUE DONATION REFERENCE
*/

function createReference() {

    const random =
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase();

    return `CCF-${Date.now()}-${random}`;

}

/*
NORMALIZE UGANDA PHONE NUMBER
*/

function normalizeUgandaPhone(phone) {

    let value =
        String(phone)
            .trim()
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    if (value.startsWith("+256")) {

        return value;

    }

    if (value.startsWith("256")) {

        return `+${value}`;

    }

    if (value.startsWith("0")) {

        return `+256${value.substring(1)}`;

    }

    return value;

}

/* 
CREATE MOBILE MONEY DONATION
*/
async function createPesapalMobileDonation(req, res, paymentMethod) {
    try {
        const { name, phone, amount } = req.body;

        if (!name || !phone || !amount) {
            return res.status(400).json({
                success: false,
                message: "Name, phone number and amount are required."
            });
        }

        const numericAmount = Number(amount);

        if (!Number.isInteger(numericAmount) || numericAmount < 500) {
            return res.status(400).json({
                success: false,
                message: "Donation amount must be at least UGX 500."
            });
        }

        const normalizedPhone = normalizeUgandaPhone(phone);
        const reference = createReference();

        addDonation({
            reference,
            donor_name: name.trim(),
            phone: normalizedPhone,
            email: "",
            amount: numericAmount,
            payment_method: paymentMethod,
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        const token = await pesapalToken();
        const notificationId = await pesapalIpn(token);

        const result = await fetch(
            `${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: reference,
                    currency: "UGX",
                    amount: numericAmount,
                    description: `Child Care Foundation ${paymentMethod} Donation`,
                    notification_id: notificationId,
                    callback_url:
                        "https://child-care-foundation-api-production.up.railway.app/api/pesapal/callback",
                    billing_address: {
                        first_name: name.trim(),
                        phone_number: normalizedPhone
                    }
                })
            }
        );

        const data = await result.json();

        if (!result.ok || !data.redirect_url) {
            console.error("Pesapal mobile checkout response:", data);

            updateDonation(reference, {
                status: "failed",
                failure_reason:
                    data.message || "Unable to create Pesapal checkout."
            });

            return res.status(502).json({
                success: false,
                message: data.error?.message || data.message || "Unable to start mobile-money payment.", pesapal_error: data.error?.code || null
            });
        }

        updateDonation(reference, {
            pesapal_order_tracking_id:
                data.order_tracking_id || null,
            pesapal_status_code:
                data.status_code ?? null,
            pesapal_payment_status:
                "PENDING"
        });

        return res.json({
            success: true,
            reference,
            status: "pending",
            payment_method: paymentMethod,
            amount: numericAmount,
            checkout_url: data.redirect_url,
            message: "Continue to Pesapal to complete your mobile-money payment."
        });

    } catch (error) {
        console.error("PESAPAL MOBILE PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to start mobile-money payment."
        });
    }
}

app.post("/api/donate/mtn", (req, res) =>
    createPesapalMobileDonation(req, res, "MTN Mobile Money")
);

app.post("/api/donate/airtel", (req, res) =>
    createPesapalMobileDonation(req, res, "Airtel Money")
);

async function pesapalToken() {
    const response = await fetch(
        `${PESAPAL_URL}/api/Auth/RequestToken`,
        {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                consumer_key:
                    process.env.PESAPAL_CONSUMER_KEY,
                consumer_secret:
                    process.env.PESAPAL_CONSUMER_SECRET
            })
        }
    );

    const data = await response.json();

    if (!data.token) {
        throw new Error(
            data.message ||
            data.error?.message ||
            "Pesapal authentication failed"
        );
    }

    return data.token;
}

async function pesapalIpn(token) {
    const ipnUrl =
        `${process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : "https://child-care-foundation-api-production.up.railway.app"}/api/pesapal/ipn`;

    if (process.env.PESAPAL_IPN_ID) {
        return process.env.PESAPAL_IPN_ID;
    }

    const response = await fetch(
        `${PESAPAL_URL}/api/URLSetup/RegisterIPN`,
        {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                url: ipnUrl,
                ipn_notification_type: "GET"
            })
        }
    );

    const data = await response.json();

    if (!data.ipn_id) {
        throw new Error(
            data.message ||
            data.error?.message ||
            "Pesapal IPN registration failed"
        );
    }

    console.log(
        "Pesapal IPN registered:",
        data.ipn_id
    );

    return data.ipn_id;
}


app.post("/api/donate/card", async (req, res) => {
    try {
        const { name, email, amount } = req.body;

        if (!name || !email || !amount) {
            return res.status(400).json({
                success: false,
                message:
                    "Name, email and amount are required."
            });
        }

        const numericAmount = Number(amount);

        if (
            !Number.isInteger(numericAmount) ||
            numericAmount < 500
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Donation amount must be at least UGX 500."
            });
        }

        const reference = createReference();

        addDonation({
            reference,
            donor_name: name.trim(),
            phone: "",
            email: email.trim(),
            amount: numericAmount,
            payment_method: "Pesapal",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        const token = await pesapalToken();
        const notificationId = await pesapalIpn(token);

        const result = await fetch(
            `${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`,
            {
                method: "POST",
                headers: {
                    "Authorization":
                        `Bearer ${token}`,
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    id: reference,
                    currency: "UGX",
                    amount: numericAmount,
                    description:
                        "Child Care Foundation Donation",
                    notification_id:
                        notificationId,
                    callback_url:
                        "https://child-care-foundation-api-production.up.railway.app/api/pesapal/callback",
                    billing_address: {
                        email_address:
                            email.trim(),
                        first_name:
                            name.trim()
                    }
                })
            }
        );

        const data = await result.json();

        if (!data.redirect_url) {
            throw new Error(
                data.message ||
                "Pesapal checkout URL missing"
            );
        }

        updateDonation(reference, {
            pesapal_order_tracking_id:
                data.order_tracking_id || null,
            pesapal_status_code:
                data.status_code ?? null,
            pesapal_payment_status:
                "PENDING"
        });

        res.json({
            success: true,
            reference,
            checkout_url:
                data.redirect_url
        });

    } catch (error) {
        console.error(
            "PESAPAL PAYMENT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to start payment."
        });
    }
});


/*
PESAPAL PAYMENT STATUS + CALLBACK + IPN
*/

async function pesapalTransactionStatus(orderTrackingId) {
    const token = await pesapalToken();

    const response = await fetch(
        `${PESAPAL_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
        {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error?.message ||
            `Pesapal status request failed with HTTP ${response.status}`
        );
    }

    return data;
}

async function processPesapalPayment(
    orderTrackingId,
    merchantReference
) {
    const donation = findDonation(merchantReference);

    if (!donation) {
        throw new Error(
            `Donation ${merchantReference} was not found.`
        );
    }

    const result =
        await pesapalTransactionStatus(
            orderTrackingId
        );

    const statusCode = Number(result.status_code);

    let newStatus = "pending";

    if (
        statusCode === 1 ||
        String(result.payment_status_description || "").toUpperCase() === "COMPLETED" ||
        String(result.status || "").toUpperCase() === "COMPLETED"
    ) {
        newStatus = "completed";
    } else if (
        statusCode === 2 ||
        String(result.payment_status_description || "").toUpperCase() === "FAILED" ||
        String(result.status || "").toUpperCase() === "FAILED"
    ) {
        newStatus = "failed";
    } else if (
        statusCode === 0 ||
        statusCode === 3 ||
        String(result.payment_status_description || "").toUpperCase() === "INVALID" ||
        String(result.payment_status_description || "").toUpperCase() === "REVERSED" ||
        String(result.status || "").toUpperCase() === "INVALID" ||
        String(result.status || "").toUpperCase() === "REVERSED"
    ) {
        newStatus = "failed";
    }

    const updated = updateDonation(
        merchantReference,
        {
            status: newStatus,
            pesapal_order_tracking_id: orderTrackingId,
            pesapal_status_code: result.status_code ?? null,
            pesapal_payment_status:
                result.payment_status_description ||
                result.status ||
                null,
            pesapal_payment_method:
                result.payment_method || null,
            pesapal_confirmation_code:
                result.confirmation_code || null,
            updated_at: new Date().toISOString()
        }
    );

    if (!updated) {
        throw new Error(
            `Unable to update donation ${merchantReference}.`
        );
    }

    console.log(
        "Pesapal payment status:",
        {
            reference: merchantReference,
            orderTrackingId,
            status: newStatus,
            statusCode: result.status_code
        }
    );

    return {
        donation: updated,
        status: newStatus,
        pesapal: result
    };
}

/*
PESAPAL CALLBACK
*/

app.get("/api/pesapal/callback", async (req, res) => {
    const {
        OrderTrackingId,
        OrderMerchantReference
    } = req.query;

    const website =
        "https://child-care-foundation-website-production.up.railway.app";

    try {
        if (!OrderTrackingId || !OrderMerchantReference) {
            return res.redirect(
                `${website}/payment-success.html?status=invalid`
            );
        }

        const result =
            await processPesapalPayment(
                OrderTrackingId,
                OrderMerchantReference
            );

        return res.redirect(
            `${website}/payment-success.html?reference=${encodeURIComponent(OrderMerchantReference)}&status=${encodeURIComponent(result.status)}`
        );

    } catch (error) {
        console.error(
            "PESAPAL CALLBACK ERROR:",
            error
        );

        return res.redirect(
            `${website}/payment-success.html?reference=${encodeURIComponent(OrderMerchantReference || "")}&status=error`
        );
    }
});

/*
PESAPAL IPN
*/

app.get("/api/pesapal/ipn", async (req, res) => {
    const {
        OrderTrackingId,
        OrderMerchantReference,
        OrderNotificationType
    } = req.query;

    console.log(
        "Pesapal IPN received:",
        {
            OrderTrackingId,
            OrderMerchantReference,
            OrderNotificationType
        }
    );

    try {
        if (!OrderTrackingId || !OrderMerchantReference) {
            return res.status(400).json({
                orderNotificationType:
                    OrderNotificationType || "IPNCHANGE",
                orderTrackingId:
                    OrderTrackingId || "",
                orderMerchantReference:
                    OrderMerchantReference || "",
                status: 500
            });
        }

        await processPesapalPayment(
            OrderTrackingId,
            OrderMerchantReference
        );

        return res.json({
            orderNotificationType:
                OrderNotificationType || "IPNCHANGE",
            orderTrackingId:
                OrderTrackingId,
            orderMerchantReference:
                OrderMerchantReference,
            status: 200
        });

    } catch (error) {
        console.error(
            "PESAPAL IPN ERROR:",
            error
        );

        return res.status(500).json({
            orderNotificationType:
                OrderNotificationType || "IPNCHANGE",
            orderTrackingId:
                OrderTrackingId || "",
            orderMerchantReference:
                OrderMerchantReference || "",
            status: 500
        });
    }
});

/*
DONOR CONFIRMS PAYMENT
*/
app.post(
    "/api/admin/donations/:reference/verify",
    requireAdmin,
    async (req, res) => {

    const donation =
        updateDonation(
            req.params.reference,
            {
                status: "completed"
            }
        );

    if (!donation) {

        return res.status(404).json({

            success: false,

            message: "Donation not found."

        });

    }

    try {

    await sms.send({
        to: [donation.phone],
        message:
            `Thank you ${donation.donor_name}. Your donation of UGX ${donation.amount.toLocaleString()} to Child Care Foundation has been verified successfully. Reference: ${donation.reference}.`
    });

    console.log(
        `Verification SMS sent to ${donation.phone}`
    );

} catch (smsError) {

    console.error(
        "Verification SMS failed:",
        smsError.message || smsError
    );

}

return res.json({

    success: true,

    message: "Donation verified successfully.",

    donation

});

});
/*
GET DONATION STATUS
*/

app.get("/api/donations/:reference", (req, res) => {

        try {

            const donation =
                findDonation(
                    req.params.reference
                );

            if (!donation) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Donation not found."

                });

            }

            return res.json({

                success: true,

                donation

            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    "Unable to retrieve donation."

            });

        }

    }
);

/*
START SERVER
*/
/*
ADMIN: GET ALL DONATIONS
*/

app.get("/api/admin/donations", requireAdmin, (req, res) => {

console.log("GET /api/admin/donations", req.session);

    try {

        const donations = readDonations();

        return res.json({
            success: true,
            count: donations.length,
            donations: donations
        });

    } catch (error) {

        console.error(
            "Admin donations error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load donations."
        });

    }

});


/*
VOLUNTEER REGISTRATION
*/

app.post("/api/volunteers", (req, res) => {

    try {

        const {
            fullName,
            phone,
            email,
            district,
            skills,
            availability,
            reason
        } = req.body;

        if (!fullName || !phone) {
            return res.status(400).json({
                success: false,
                message: "Full name and phone are required."
            });
        }

        const volunteer = addVolunteer({
            fullName,
            phone,
            email,
            district,
            skills,
            availability,
            reason
        });

        sendFoundationEmail(
            "New Volunteer Application",
            `
New volunteer application received:

Name: ${fullName}
Phone: ${phone}
Email: ${email}
District: ${district}
Skills: ${skills}
Availability: ${availability}

Reason:
${reason}
`
        ).catch(err => console.error("Volunteer email error:", err));

        return res.json({
            success: true,
            message: "Volunteer application submitted successfully.",
            volunteer
        });

    } catch (error) {

        console.error("Volunteer registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to register volunteer."
        });

    }

});
/*
ADMIN: GET ALL VOLUNTEERS
*/

app.get("/api/admin/volunteers", requireAdmin, (req, res) => {

    try {

        const volunteers = readVolunteers();

        return res.json({
            success: true,
            count: volunteers.length,
            volunteers: volunteers
        });

    } catch (error) {

        console.error(
            "Admin volunteers error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load volunteers."
        });

    }

});

app.get("/api/test-email", async (req, res) => {
    try {
        await sendFoundationEmail(
            "Child Care Foundation Email Test",
            "This is a direct production email test."
        );

        res.json({
            success: true,
            message: "Email sent"
        });
    } catch (error) {
        console.error("TEST EMAIL ERROR:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/api/contact", async (req, res) => {

    try {

        const {
            name,
            email,
            subject,
            message
        } = req.body;

        if (
            !name ||
            !email ||
            !subject ||
            !message
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (
            message.length < 20 ||
            message.length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Your message must contain between 20 and 2000 characters."
            });
        }

        const messagesFile =
            path.join(__dirname, "messages.json");

        let messages = [];

        if (fs.existsSync(messagesFile)) {
            try {
                messages =
                    JSON.parse(
                        fs.readFileSync(messagesFile, "utf8")
                    );
            } catch (fileError) {
                console.error(
                    "Messages file error:",
                    fileError
                );
                messages = [];
            }
        }

        const newMessage = {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: email.trim(),
            subject: subject.trim(),
            message: message.trim(),
            receivedAt: new Date().toISOString(),
            status: "unread"
        };

        messages.push(newMessage);

        fs.writeFileSync(
            messagesFile,
            JSON.stringify(messages, null, 2)
        );

        console.log(
            "Contact message saved:",
            newMessage.id
        );

        sendFoundationEmail(
            "New Contact Form Message",
            `
New contact message received:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
`
        )
        .then(() => console.log("CONTACT EMAIL SENT SUCCESSFULLY"))
        .catch(err => console.error("CONTACT EMAIL ERROR:", err));

        return res.status(201).json({
            success: true,
            message:
                "Thank you! Your message has been received."
        });

    } catch (error) {

        console.error(
            "Contact form error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to process your message right now."
        });

    }

});


/* ==========================================================
   ADMIN: CONTACT MESSAGES
   ========================================================== */

app.get("/api/admin/messages", requireAdmin, (req, res) => {

    try {

        const messagesFile =
            path.join(__dirname, "messages.json");

        let messages = [];

        if (fs.existsSync(messagesFile)) {
            messages =
                JSON.parse(
                    fs.readFileSync(messagesFile, "utf8")
                );
        }

        return res.json({
            success: true,
            messages
        });

    } catch (error) {

        console.error(
            "Admin messages error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load messages."
        });

    }

});


/* ==========================================================
   ADMIN: MARK CONTACT MESSAGE AS READ
   ========================================================== */

app.patch("/api/admin/messages/:id/read", requireAdmin, (req, res) => {

    try {

        const messagesFile =
            path.join(__dirname, "messages.json");

        let messages =
            JSON.parse(
                fs.readFileSync(messagesFile, "utf8")
            );

        const message =
            messages.find(
                item => item.id === req.params.id
            );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found."
            });
        }

        message.status = "read";

        fs.writeFileSync(
            messagesFile,
            JSON.stringify(messages, null, 2)
        );

        sendFoundationEmail(
            "New Contact Message",
            `
New contact message received:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
`
        ).catch(err => console.error("Contact email error:", err));

        return res.json({
            success: true,
            message: "Message marked as read."
        });

    } catch (error) {

        console.error(
            "Mark message read error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update message."
        });

    }

});


/* ==========================================================
   ADMIN: DELETE CONTACT MESSAGE
   ========================================================== */

app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {

    try {

        const messagesFile =
            path.join(__dirname, "messages.json");

        let messages =
            JSON.parse(
                fs.readFileSync(messagesFile, "utf8")
            );

        const originalLength = messages.length;

        messages =
            messages.filter(
                item => item.id !== req.params.id
            );

        if (messages.length === originalLength) {
            return res.status(404).json({
                success: false,
                message: "Message not found."
            });
        }

        fs.writeFileSync(
            messagesFile,
            JSON.stringify(messages, null, 2)
        );

        return res.json({
            success: true,
            message: "Message deleted."
        });

    } catch (error) {

        console.error(
            "Delete message error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to delete message."
        });

    }

});

app.listen(PORT, () => {

    console.log(
        `Child Care Foundation API running on port ${PORT}`
    );

});

/*
ADMIN: UPDATE VOLUNTEER STATUS
*/

app.post(
    "/api/admin/volunteers/:id/status",
    requireAdmin,
    (req, res) => {

        try {

            const { status } = req.body;

            if (
                status !== "approved" &&
                status !== "rejected" &&
                status !== "pending"
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid volunteer status."
                });

            }

            const volunteer =
                updateVolunteer(
                    req.params.id,
                    { status }
                );

            if (!volunteer) {

                return res.status(404).json({
                    success: false,
                    message: "Volunteer not found."
                });

            }

            return res.json({
                success: true,
                message:
                    "Volunteer status updated successfully.",
                volunteer
            });

        } catch (error) {

            console.error(
                "Volunteer status update error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to update volunteer status."
            });

        }

    }
);
/*
ADMIN: GALLERY IMAGE UPLOAD
*/

app.post(
    "/api/admin/gallery/upload",
    requireAdmin,
    upload.single("image"),
    (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No image was uploaded."
                });
            }

            return res.status(201).json({
                success: true,
                message: "Gallery image uploaded successfully.",
                image: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    url: `/uploads/gallery/${req.file.filename}`
                }
            });

        } catch (error) {

            console.error(
                "Gallery upload error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to upload gallery image."
            });

        }

    }
);
/*
ADMIN: DELETE GALLERY IMAGE
*/

app.delete(
    "/api/admin/gallery/:filename",
    requireAdmin,
    (req, res) => {

        try {

            const filename =
                path.basename(req.params.filename);

            if (!filename || filename !== req.params.filename) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid gallery filename."
                });
            }

            const filePath =
                path.join(galleryDir, filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: "Gallery image not found."
                });
            }

            fs.unlinkSync(filePath);

            return res.json({
                success: true,
                message: "Gallery image deleted successfully.",
                filename
            });

        } catch (error) {

            console.error(
                "Gallery delete error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to delete gallery image."
            });

        }

    }
);

/*
PUBLIC: GALLERY IMAGES
*/

app.get("/api/gallery", (req, res) => {

    try {

        const images = fs.readdirSync(galleryDir)
            .filter(file =>
                /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
            )
            .map(file => ({
                filename: file,
                url: `/uploads/gallery/${file}`
            }));

        res.json({
            success: true,
            images
        });

    } catch (error) {

        console.error("Gallery error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load gallery."
        });

    }

});
/* ==========================================================
   PUBLIC: CONTACT FORM
   ========================================================== */


