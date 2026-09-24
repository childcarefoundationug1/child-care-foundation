const express = require("express");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const PESAPAL_URL = process.env.PESAPAL_URL || "https://pay.pesapal.com/v3";

const FLUTTERWAVE_CARD_CURRENCIES = new Set([
    "GBP",
    "CAD",
    "XAF",
    "COP",
    "EGP",
    "EUR",
    "GHS",
    "KES",
    "INR",
    "NGN",
    "RWF",
    "SLL",
    "ZAR",
    "TZS",
    "UGX",
    "USD",
    "XOF",
    "ZMW"
]);
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const supabase = require("./supabase");
const {
    uploadVolunteerDocument
} = require("./volunteer-document-storage");
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
const galleryDir = path.join(uploadsDir, "gallery");
const homeSlidesDir = path.join(uploadsDir, "home-slides");
const whatWeDoDir = path.join(uploadsDir, "what-we-do");
const impactDir = path.join(uploadsDir, "impact");
const videosDir = path.join(uploadsDir, "videos");

if (!fs.existsSync(galleryDir)) {
    fs.mkdirSync(galleryDir, { recursive: true });
}

if (!fs.existsSync(homeSlidesDir)) {
    fs.mkdirSync(homeSlidesDir, { recursive: true });
}

if (!fs.existsSync(whatWeDoDir)) {
    fs.mkdirSync(whatWeDoDir, { recursive: true });
}

if (!fs.existsSync(impactDir)) {
    fs.mkdirSync(impactDir, { recursive: true });
}

if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
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

const volunteerDocumentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 3,
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(
                new Error(
                    "Volunteer documents must be JPEG, PNG, or WebP images."
                )
            );
        }

        cb(null, true);
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

const homeSlidesStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, homeSlidesDir);
    },
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + "-" + file.originalname.replace(/\\s+/g, "-");
        cb(null, uniqueName);
    }
});

const uploadHomeSlide = multer({
    storage: homeSlidesStorage,
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

const whatWeDoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, whatWeDoDir);
    },
    filename: (req, file, cb) => {
        const category = String(req.body.category || "image")
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");

        const extension = path.extname(file.originalname).toLowerCase();

        cb(null, category + extension);
    }
});

const uploadWhatWeDo = multer({
    storage: whatWeDoStorage,
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

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, videosDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const baseName = path
            .basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9-_]+/g, "-")
            .replace(/^-+|-+$/g, "");

        const uniqueName =
            Date.now() + "-" + (baseName || "ccf-video") + extension;

        cb(null, uniqueName);
    }
});

const uploadVideo = multer({
    storage: videoStorage,
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("video/")) {
            cb(null, true);
        } else {
            cb(new Error("Only video files are allowed."));
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

    readDonations

} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

const FRONTEND_ORIGINS = [
    "https://child-care-foundation-ug.netlify.app",
    "https://child-care-foundation-org.pages.dev",
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

app.use(
    "/uploads/home-slides",
    express.static(homeSlidesDir)
);

app.use(
    "/uploads/what-we-do",
    express.static(whatWeDoDir)
);
app.use(
    "/uploads/impact",
    express.static(impactDir)
);

app.use(
    "/uploads/videos",
    express.static(videosDir)
);

/*
HOME SLIDE MANAGEMENT
*/

// Upload homepage animation image
app.post(
    "/api/admin/home-slides/upload",
    requireAdmin,
    uploadHomeSlide.single("image"),
    (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No image file uploaded."
                });
            }

            res.json({
                success: true,
                message: "Home slide uploaded successfully.",
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: "/uploads/home-slides/" + req.file.filename
            });
        } catch (error) {
            console.error("Home slide upload error:", error);

            res.status(500).json({
                success: false,
                message: "Failed to upload home slide."
            });
        }
    }
);

// List homepage animation images
app.get("/api/home-slides", (req, res) => {
    try {
        if (!fs.existsSync(homeSlidesDir)) {
            return res.json({
                success: true,
                images: []
            });
        }

        const files = fs.readdirSync(homeSlidesDir)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
            })
            .sort();

        const images = files.map(file => ({
            filename: file,
            url: "/uploads/home-slides/" + encodeURIComponent(file)
        }));

        res.json({
            success: true,
            images
        });
    } catch (error) {
        console.error("Home slide list error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load home slides."
        });
    }
});

// Delete homepage animation image
app.delete(
    "/api/admin/home-slides/:filename",
    requireAdmin,
    (req, res) => {
        try {
            const filename = path.basename(req.params.filename);

            if (!filename || filename !== req.params.filename) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid filename."
                });
            }

            const filePath = path.join(homeSlidesDir, filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: "Home slide not found."
                });
            }

            fs.unlinkSync(filePath);

            res.json({
                success: true,
                message: "Home slide deleted successfully."
            });
        } catch (error) {
            console.error("Home slide delete error:", error);

            res.status(500).json({
                success: false,
                message: "Failed to delete home slide."
            });
        }
    }
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
function createManualMobileDonation(req, res, paymentMethod) {
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

        const paymentNumber =
            paymentMethod === "MTN Mobile Money"
                ? "+256 793 449 784"
                : "+256 730 463 790";

        const accountName = "Given okongo";

        const instructions =
            paymentMethod === "MTN Mobile Money"
                ? [
                    `Give an amount you can afford to pay. Your selected donation amount is UGX ${numericAmount.toLocaleString()}.`,
                    "MTN Mobile Money — complete the payment from your phone:",
                    "1. Dial *165#.",
                    "2. Select Send Money.",
                    "3. Select Mobile User.",
                    `4. Enter the Child Care Foundation MTN number: ${paymentNumber}.`,
                    `5. Enter UGX ${numericAmount.toLocaleString()} as the amount.`,
                    "6. Enter a reason for sending, for example: Child Care Foundation donation.",
                    "7. Confirm that the recipient details and amount are correct.",
                    "8. Enter your MTN Mobile Money PIN to authorize the payment.",
                    "9. Wait for the MTN confirmation SMS and keep your transaction ID.",
                    `10. Return to this website and enter the transaction ID below.`,
                    "Your donation will remain awaiting verification until the Child Care Foundation administrator confirms receipt."
                ]
                : [
                    `Give an amount you can afford to pay. Your selected donation amount is UGX ${numericAmount.toLocaleString()}.`,
                    "Airtel Money — complete the payment from your phone:",
                    "1. Dial *185#.",
                    "2. Select Send Money.",
                    `3. Enter the Child Care Foundation Airtel Money number: ${paymentNumber}.`,
                    `4. Enter UGX ${numericAmount.toLocaleString()} as the amount.`,
                    "5. Enter your Airtel Money PIN to authorize the payment.",
                    "6. Confirm that the recipient details and amount are correct.",
                    "7. Wait for the Airtel Money confirmation SMS and keep your transaction ID.",
                    "8. Return to this website and enter the transaction ID below.",
                    "Your donation will remain awaiting verification until the Child Care Foundation administrator confirms receipt."
                ];

        addDonation({
            reference,
            donor_name: name.trim(),
            phone: normalizedPhone,
            email: "",
            amount: numericAmount,
            payment_method: paymentMethod,
            payment_number: paymentNumber,
            account_name: accountName,
            transaction_id: "",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        return res.json({
            success: true,
            reference,
            status: "pending",
            payment_method: paymentMethod,
            amount: numericAmount,
            payment_number: paymentNumber,
            account_name: accountName,
            instructions,
            message: "Donation created. Complete the Mobile Money payment, then submit your transaction ID."
        });

    } catch (error) {
        console.error("MANUAL MOBILE PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to create mobile-money donation."
        });
    }
}

app.post("/api/donate/mtn", (req, res) =>
    createManualMobileDonation(req, res, "MTN Mobile Money")
);

app.post("/api/donate/airtel", (req, res) =>
    createManualMobileDonation(req, res, "Airtel Money")
);

/*
SUBMIT MOBILE MONEY TRANSACTION ID
This does NOT verify the payment.
It only moves the donation to awaiting_verification.
*/

app.post("/api/donations/:reference/submit-payment", (req, res) => {
    try {
        const transactionId =
            String(req.body.transaction_id || "").trim();

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Mobile Money transaction ID is required."
            });
        }

        if (transactionId.length < 3 || transactionId.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid Mobile Money transaction ID."
            });
        }

        const donation = findDonation(req.params.reference);

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: "Donation reference not found."
            });
        }

        if (donation.status === "completed") {
            return res.status(400).json({
                success: false,
                message: "This donation has already been verified."
            });
        }

        if (
            donation.payment_method !== "MTN Mobile Money" &&
            donation.payment_method !== "Airtel Money"
        ) {
            return res.status(400).json({
                success: false,
                message: "Transaction ID submission is only available for MTN and Airtel Mobile Money."
            });
        }

        const updatedDonation = updateDonation(
            req.params.reference,
            {
                transaction_id: transactionId,
                status: "awaiting_verification",
                payment_submitted_at: new Date().toISOString()
            }
        );

        return res.json({
            success: true,
            reference: updatedDonation.reference,
            status: updatedDonation.status,
            transaction_id: updatedDonation.transaction_id,
            message: "Payment details submitted successfully. Your donation is now awaiting verification."
        });

    } catch (error) {
        console.error("TRANSACTION ID SUBMISSION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to submit transaction ID."
        });
    }
});

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
        const { name, email, amount, currency } = req.body;

        if (!name || !email || !amount) {
            return res.status(400).json({
                success: false,
                message: "Name, email and amount are required."
            });
        }

        const numericAmount = Number(amount);

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Donation amount must be greater than zero."
            });
        }

        const selectedCurrency =
            String(currency || "").trim().toUpperCase();

        if (!FLUTTERWAVE_CARD_CURRENCIES.has(selectedCurrency)) {
            return res.status(400).json({
                success: false,
                message:
                    "The selected currency is not supported for card payments."
            });
        }

        if (!process.env.FLW_SECRET_KEY) {
            throw new Error(
                "Flutterwave secret key is not configured."
            );
        }

        const reference = createReference();

        addDonation({
            reference,
            donor_name: name.trim(),
            phone: "",
            email: email.trim(),
            amount: numericAmount,
            currency: selectedCurrency,
            payment_method: "Flutterwave Card",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        const result = await fetch(
            "https://api.flutterwave.com/v3/payments",
            {
                method: "POST",
                headers: {
                    "Authorization":
                        `Bearer ${process.env.FLW_SECRET_KEY}`,
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    tx_ref: reference,
                    amount: numericAmount,
                    currency: selectedCurrency,
                    redirect_url:
                        "https://child-care-foundation-api-production.up.railway.app/api/flutterwave/callback",
                    payment_options:
                        "card",
                    customer: {
                        email: email.trim(),
                        name: name.trim()
                    },
                    customizations: {
                        title:
                            "Child Care Foundation",
                        description:
                            "Child Care Foundation Donation"
                    }
                })
            }
        );

        const data = await result.json();

        if (
            !result.ok ||
            data.status !== "success" ||
            !data.data?.link
        ) {
            throw new Error(
                data.message ||
                "Flutterwave checkout URL missing."
            );
        }

        updateDonation(reference, {
            flutterwave_transaction_id:
                data.data.id || null,
            flutterwave_status:
                "PENDING"
        });

        res.json({
            success: true,
            reference,
            checkout_url:
                data.data.link
        });

    } catch (error) {
        console.error(
            "FLUTTERWAVE CARD PAYMENT ERROR:",
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
    const paymentDescription =
        String(result.payment_status_description || "").toUpperCase();
    const paymentStatus =
        String(result.status || "").toUpperCase();
    const errorMessage =
        String(result.error?.message || "").toUpperCase();

    let newStatus = "pending";

    // PesaPal can return status_code 0 / INVALID while
    // the transaction is still waiting for payment.
    if (
        errorMessage.includes("PENDING PAYMENT") ||
        paymentDescription === "PENDING" ||
        paymentStatus === "PENDING"
    ) {
        newStatus = "pending";
    } else if (
        statusCode === 1 ||
        paymentDescription === "COMPLETED" ||
        paymentStatus === "COMPLETED"
    ) {
        newStatus = "completed";
    } else if (
        statusCode === 2 ||
        paymentDescription === "FAILED" ||
        paymentStatus === "FAILED"
    ) {
        newStatus = "failed";
    } else if (
        statusCode === 3 ||
        paymentDescription === "REVERSED" ||
        paymentStatus === "REVERSED"
    ) {
        newStatus = "failed";
    } else if (
        paymentDescription === "INVALID" ||
        paymentStatus === "INVALID"
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
FLUTTERWAVE CARD PAYMENT VERIFICATION
*/

app.get("/api/flutterwave/callback", async (req, res) => {
    const {
        status,
        tx_ref,
        transaction_id
    } = req.query;

    const website =
        "https://child-care-foundation-website-production.up.railway.app";

    try {
        if (!tx_ref || !transaction_id) {
            return res.redirect(
                `${website}/payment-success.html?status=invalid`
            );
        }

        if (!process.env.FLW_SECRET_KEY) {
            throw new Error(
                "Flutterwave secret key is not configured."
            );
        }

        const donation =
            findDonation(String(tx_ref));

        if (!donation) {
            throw new Error(
                `Donation ${tx_ref} was not found.`
            );
        }

        const response = await fetch(
            `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transaction_id)}/verify`,
            {
                method: "GET",
                headers: {
                    "Authorization":
                        `Bearer ${process.env.FLW_SECRET_KEY}`,
                    "Content-Type":
                        "application/json"
                }
            }
        );

        const data = await response.json();

        if (
            !response.ok ||
            data.status !== "success" ||
            !data.data
        ) {
            throw new Error(
                data.message ||
                "Flutterwave transaction verification failed."
            );
        }

        const transaction = data.data;

        const verifiedReference =
            String(transaction.tx_ref || "");

        const verifiedStatus =
            String(transaction.status || "").toLowerCase();

        const verifiedAmount =
            Number(transaction.amount);

        const donationAmount =
            Number(donation.amount);

        const amountsMatch =
            Number.isFinite(verifiedAmount) &&
            Number.isFinite(donationAmount) &&
            Math.abs(verifiedAmount - donationAmount) < 0.01;

        const verifiedCurrency =
            String(transaction.currency || "")
                .trim()
                .toUpperCase();

        const donationCurrency =
            String(donation.currency || "")
                .trim()
                .toUpperCase();

        if (verifiedReference !== String(tx_ref)) {
            throw new Error(
                "Flutterwave transaction reference mismatch."
            );
        }

        if (verifiedReference !== String(donation.reference)) {
            throw new Error(
                "Donation reference mismatch."
            );
        }

        if (!amountsMatch) {
            throw new Error(
                "Flutterwave transaction amount mismatch."
            );
        }

        if (
            !verifiedCurrency ||
            verifiedCurrency !== donationCurrency
        ) {
            throw new Error(
                "Flutterwave transaction currency mismatch."
            );
        }

        let newStatus = "pending";

        if (verifiedStatus === "successful") {
            newStatus = "completed";
        } else if (
            verifiedStatus === "failed" ||
            verifiedStatus === "cancelled"
        ) {
            newStatus = "failed";
        }

        const updated =
            updateDonation(
                String(tx_ref),
                {
                    status: newStatus,
                    flutterwave_transaction_id:
                        transaction.id || transaction_id,
                    flutterwave_status:
                        transaction.status || null,
                    flutterwave_payment_type:
                        transaction.payment_type || null,
                    flutterwave_currency:
                        verifiedCurrency,
                    flutterwave_verified_amount:
                        verifiedAmount,
                    flutterwave_verified_at:
                        new Date().toISOString()
                }
            );

        if (!updated) {
            throw new Error(
                `Unable to update donation ${tx_ref}.`
            );
        }

        console.log(
            "Flutterwave card payment verified:",
            {
                reference: tx_ref,
                transactionId: transaction.id,
                status: newStatus,
                amount: verifiedAmount,
                currency: verifiedCurrency
            }
        );

        return res.redirect(
            `${website}/payment-success.html?reference=${encodeURIComponent(tx_ref)}&status=${encodeURIComponent(newStatus)}`
        );

    } catch (error) {
        console.error(
            "FLUTTERWAVE CALLBACK ERROR:",
            error
        );

        return res.redirect(
            `${website}/payment-success.html?reference=${encodeURIComponent(tx_ref || "")}&status=error`
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
        smsError.response?.data ||
        smsError.message ||
        smsError
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

app.post(
    "/api/volunteers",
    volunteerDocumentUpload.fields([
        { name: "selfie", maxCount: 1 },
        { name: "nationalIdFront", maxCount: 1 },
        { name: "nationalIdBack", maxCount: 1 }
    ]),
    async (req, res) => {
    try {
        const {
            fullName,
            phone
        } = req.body;

        if (!fullName || !phone) {
            return res.status(400).json({
                success: false,
                message: "Full name and phone are required."
            });
        }

        const selfie = req.files?.selfie?.[0];
        const nationalIdFront =
            req.files?.nationalIdFront?.[0];
        const nationalIdBack =
            req.files?.nationalIdBack?.[0];

        if (!selfie || !nationalIdFront || !nationalIdBack) {
            return res.status(400).json({
                success: false,
                message:
                    "Volunteer selfie and both National ID images are required."
            });
        }

        const cleanName = fullName.trim();
        const cleanPhone = phone.trim();

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid full name."
            });
        }

        if (cleanPhone.length < 7 || cleanPhone.length > 30) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid phone number."
            });
        }

        const {
            generateVolunteerAccessCode
        } = require("./volunteer-code");

        const accessCode = generateVolunteerAccessCode();

        const accessCodeHash =
            await require("bcryptjs").hash(accessCode, 12);

        const { data: volunteer, error } = await supabase
            .from("volunteers")
            .insert({
                full_name: cleanName,
                phone: cleanPhone,
                access_code_hash: accessCodeHash,
                status: "approved"
            })
            .select(
                "id, volunteer_number, volunteer_id, full_name, phone, status, created_at"
            )
            .single();

        if (error) {
            console.error(
                "Supabase volunteer registration error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to register volunteer."
            });
        }

        let selfiePath;
        let nationalIdFrontPath;
        let nationalIdBackPath;

        try {
            selfiePath = await uploadVolunteerDocument({
                volunteerId: volunteer.id,
                documentType: "selfie",
                file: selfie
            });

            nationalIdFrontPath =
                await uploadVolunteerDocument({
                    volunteerId: volunteer.id,
                    documentType: "national-id-front",
                    file: nationalIdFront
                });

            nationalIdBackPath =
                await uploadVolunteerDocument({
                    volunteerId: volunteer.id,
                    documentType: "national-id-back",
                    file: nationalIdBack
                });
        } catch (uploadError) {
            console.error(
                "Volunteer document upload error:",
                uploadError
            );

            await supabase
                .from("volunteers")
                .delete()
                .eq("id", volunteer.id);

            return res.status(500).json({
                success: false,
                message:
                    "Unable to securely store volunteer documents."
            });
        }

        const {
            data: updatedVolunteer,
            error: updateError
        } = await supabase
            .from("volunteers")
            .update({
                selfie_path: selfiePath,
                national_id_front_path: nationalIdFrontPath,
                national_id_back_path: nationalIdBackPath,
                updated_at: new Date().toISOString()
            })
            .eq("id", volunteer.id)
            .select(
                "id, volunteer_number, volunteer_id, full_name, phone, status, selfie_path, national_id_front_path, national_id_back_path, created_at"
            )
            .single();

        if (updateError) {
            console.error(
                "Volunteer document path update error:",
                updateError
            );

            return res.status(500).json({
                success: false,
                message:
                    "Volunteer was created, but document records could not be completed."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Volunteer registered successfully.",
            volunteer: {
                id: updatedVolunteer.id,
                volunteerId: updatedVolunteer.volunteer_id,
                fullName: updatedVolunteer.full_name,
                phone: updatedVolunteer.phone,
                status: updatedVolunteer.status,
                createdAt: updatedVolunteer.created_at
            },
            accessCode
        });
    } catch (error) {
        console.error(
            "Volunteer registration error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to register volunteer."
        });
    }
});
/*
VOLUNTEER VERIFICATION
*/

app.post("/api/volunteer/verify", async (req, res) => {
    try {
        const code = String(req.body?.code || "")
            .trim()
            .toUpperCase();

        if (!code) {
            return res.status(400).json({
                valid: false,
                message: "Volunteer access code is required."
            });
        }

        const { data: volunteers, error } = await supabase
            .from("volunteers")
            .select(
                "id, volunteer_id, full_name, access_code_hash, status"
            )
            .in("status", ["approved"]);

        if (error) {
            console.error(
                "Supabase volunteer verification error:",
                error
            );

            return res.status(500).json({
                valid: false,
                message: "Unable to verify volunteer access code."
            });
        }

        for (const volunteer of volunteers || []) {
            const matches = await require("bcryptjs").compare(
                code,
                volunteer.access_code_hash
            );

            if (matches) {
                return res.json({
                    valid: true,
                    volunteerId: volunteer.volunteer_id,
                    volunteerName: volunteer.full_name,
                    message: "Volunteer verified successfully."
                });
            }
        }

        return res.status(401).json({
            valid: false,
            message: "Invalid or unauthorized volunteer access code."
        });
    } catch (error) {
        console.error(
            "Volunteer verification error:",
            error
        );

        return res.status(500).json({
            valid: false,
            message: "Unable to verify volunteer access code."
        });
    }
});

/*
ADMIN: GET ALL VOLUNTEERS
*/

app.get("/api/admin/volunteers", requireAdmin, async (req, res) => {

    try {

        const { data: volunteers, error } = await supabase
            .from("volunteers")
            .select(
                "id, volunteer_number, volunteer_id, full_name, phone, status, selfie_path, national_id_front_path, national_id_back_path, created_at, updated_at, approved_at"
            )
            .order("created_at", { ascending: false });

        if (error) {
            console.error(
                "Supabase admin volunteers error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load volunteers."
            });
        }

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



/*
WHATSAPP VERIFICATION REQUEST
*/
app.post("/api/whatsapp-verification-request", async (req, res) => {
    try {
        const {
            name,
            phone,
            reason
        } = req.body;

        if (!name || !phone || !reason) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (
            reason.trim().length < 10 ||
            reason.trim().length > 1000
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide a reason between 10 and 1000 characters."
            });
        }

        const requestsFile =
            path.join(
                __dirname,
                "whatsapp-verification-requests.json"
            );

        let requests = [];

        if (fs.existsSync(requestsFile)) {
            try {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            } catch (fileError) {
                console.error(
                    "WhatsApp verification requests file error:",
                    fileError
                );
                requests = [];
            }
        }

        const newRequest = {
            id: crypto.randomUUID(),
            name: name.trim(),
            phone: phone.trim(),
            reason: reason.trim(),
            requestedAt: new Date().toISOString(),
            status: "pending"
        };

        requests.push(newRequest);

        fs.writeFileSync(
            requestsFile,
            JSON.stringify(
                requests,
                null,
                2
            )
        );

        console.log(
            "WhatsApp verification request saved:",
            newRequest.id
        );

        sendFoundationEmail(
            "New WhatsApp Verification Request",
            `
New WhatsApp verification request received:

Name: ${newRequest.name}
Phone: ${newRequest.phone}
Reason:
${newRequest.reason}

Status: Pending administrator approval.
            `
        ).catch(err =>
            console.error(
                "WHATSAPP VERIFICATION EMAIL ERROR:",
                err
            )
        );

        return res.status(201).json({
            success: true,
            message:
                "Your WhatsApp request has been sent to the foundation administrator for verification.",
            requestId: newRequest.id
        });

    } catch (error) {
        console.error(
            "WhatsApp verification request error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to submit your WhatsApp verification request right now."
        });
    }
});

/*
WHATSAPP VERIFICATION STATUS
*/
app.get(
    "/api/whatsapp-verification-request/:id",
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "whatsapp-verification-requests.json"
                );

            if (!fs.existsSync(requestsFile)) {
                return res.status(404).json({
                    success: false,
                    message:
                        "WhatsApp verification request not found."
                });
            }

            const requests =
                JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );

            const request =
                requests.find(
                    item =>
                        item.id === req.params.id
                );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message:
                        "WhatsApp verification request not found."
                });
            }

            const response = {
                success: true,
                status: request.status
            };

            if (request.status === "approved") {
                response.whatsapp =
                    "https://wa.me/256730463790?text=Hello%20Child%20Care%20Foundation%2C%20I%20would%20like%20to%20ask%20about%20your%20work.";
            }

            return res.json(response);

        } catch (error) {
            console.error(
                "WhatsApp verification status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to check WhatsApp verification status."
            });
        }
    }
);

/*
ADMIN WHATSAPP VERIFICATION REQUESTS
*/
app.get(
    "/api/admin/whatsapp-verification-requests",
    requireAdmin,
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "whatsapp-verification-requests.json"
                );

            let requests = [];

            if (fs.existsSync(requestsFile)) {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            }

            return res.json({
                success: true,
                requests
            });

        } catch (error) {
            console.error(
                "WhatsApp verification requests error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load WhatsApp verification requests."
            });
        }
    }
);

app.patch(
    "/api/admin/whatsapp-verification-requests/:id/approve",
    requireAdmin,
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "whatsapp-verification-requests.json"
                );

            let requests = [];

            if (fs.existsSync(requestsFile)) {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            }

            const request =
                requests.find(
                    item =>
                        item.id === req.params.id
                );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message:
                        "WhatsApp verification request not found."
                });
            }

            request.status = "approved";
            request.reviewedAt =
                new Date().toISOString();

            fs.writeFileSync(
                requestsFile,
                JSON.stringify(
                    requests,
                    null,
                    2
                )
            );

            return res.json({
                success: true,
                message:
                    "WhatsApp verification request approved.",
                whatsapp:
                    "https://wa.me/256730463790?text=Hello%20Child%20Care%20Foundation%2C%20I%20would%20like%20to%20ask%20about%20your%20work."
            });

        } catch (error) {
            console.error(
                "Approve WhatsApp verification error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve the WhatsApp request."
            });
        }
    }
);

app.patch(
    "/api/admin/whatsapp-verification-requests/:id/reject",
    requireAdmin,
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "whatsapp-verification-requests.json"
                );

            let requests = [];

            if (fs.existsSync(requestsFile)) {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            }

            const request =
                requests.find(
                    item =>
                        item.id === req.params.id
                );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message:
                        "WhatsApp verification request not found."
                });
            }

            request.status = "rejected";
            request.reviewedAt =
                new Date().toISOString();

            fs.writeFileSync(
                requestsFile,
                JSON.stringify(
                    requests,
                    null,
                    2
                )
            );

            return res.json({
                success: true,
                message:
                    "WhatsApp verification request rejected."
            });

        } catch (error) {
            console.error(
                "Reject WhatsApp verification error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject the WhatsApp request."
            });
        }
    }
);

app.post("/api/phone-verification-request", async (req, res) => {
    try {
        const {
            name,
            phone,
            reason
        } = req.body;

        if (!name || !phone || !reason) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (reason.trim().length < 10 || reason.trim().length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Please provide a reason between 10 and 1000 characters."
            });
        }

        const requestsFile =
            path.join(__dirname, "phone-verification-requests.json");

        let requests = [];

        if (fs.existsSync(requestsFile)) {
            try {
                requests = JSON.parse(
                    fs.readFileSync(requestsFile, "utf8")
                );
            } catch (fileError) {
                console.error(
                    "Phone verification requests file error:",
                    fileError
                );
                requests = [];
            }
        }

        const newRequest = {
            id: crypto.randomUUID(),
            name: name.trim(),
            phone: phone.trim(),
            reason: reason.trim(),
            requestedAt: new Date().toISOString(),
            status: "pending"
        };

        requests.push(newRequest);

        fs.writeFileSync(
            requestsFile,
            JSON.stringify(requests, null, 2)
        );

        console.log(
            "Phone verification request saved:",
            newRequest.id
        );

        sendFoundationEmail(
            "New Phone Verification Request",
            `
New phone verification request received:

Name: ${newRequest.name}
Phone: ${newRequest.phone}
Reason:
${newRequest.reason}

Status: Pending administrator approval.
            `
        ).catch(err =>
            console.error(
                "PHONE VERIFICATION EMAIL ERROR:",
                err
            )
        );

        return res.status(201).json({
            success: true,
            message:
                "Your request has been sent to the foundation administrator for verification.",
            requestId: newRequest.id
        });

    } catch (error) {

        console.error(
            "Phone verification request error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to submit your verification request right now."
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



app.get(
    "/api/phone-verification-request/:id",
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "phone-verification-requests.json"
                );

            if (!fs.existsSync(requestsFile)) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Verification request not found."
                });
            }

            const requests =
                JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );

            const request =
                requests.find(
                    item =>
                        item.id === req.params.id
                );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Verification request not found."
                });
            }

            const response = {
                success: true,
                status: request.status
            };

            if (request.status === "approved") {
                response.phone =
                    "+256730463790";
            }

            return res.json(response);

        } catch (error) {
            console.error(
                "Phone verification status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to check verification status."
            });
        }
    }
);

app.get(
    "/api/admin/phone-verification-requests",
    requireAdmin,
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "phone-verification-requests.json"
                );

            let requests = [];

            if (fs.existsSync(requestsFile)) {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            }

            return res.json({
                success: true,
                requests
            });

        } catch (error) {

            console.error(
                "Phone verification requests error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load phone verification requests."
            });
        }
    }
);

app.patch(
    "/api/admin/phone-verification-requests/:id/approve",
    requireAdmin,
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "phone-verification-requests.json"
                );

            let requests = [];

            if (fs.existsSync(requestsFile)) {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            }

            const request =
                requests.find(
                    item =>
                        item.id === req.params.id
                );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Phone verification request not found."
                });
            }

            request.status = "approved";
            request.reviewedAt =
                new Date().toISOString();

            fs.writeFileSync(
                requestsFile,
                JSON.stringify(
                    requests,
                    null,
                    2
                )
            );

            return res.json({
                success: true,
                message:
                    "Phone verification request approved.",
                phone:
                    "+256730463790"
            });

        } catch (error) {

            console.error(
                "Approve phone verification error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve the request."
            });
        }
    }
);

app.patch(
    "/api/admin/phone-verification-requests/:id/reject",
    requireAdmin,
    (req, res) => {
        try {
            const requestsFile =
                path.join(
                    __dirname,
                    "phone-verification-requests.json"
                );

            let requests = [];

            if (fs.existsSync(requestsFile)) {
                requests = JSON.parse(
                    fs.readFileSync(
                        requestsFile,
                        "utf8"
                    )
                );
            }

            const request =
                requests.find(
                    item =>
                        item.id === req.params.id
                );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Phone verification request not found."
                });
            }

            request.status = "rejected";
            request.reviewedAt =
                new Date().toISOString();

            fs.writeFileSync(
                requestsFile,
                JSON.stringify(
                    requests,
                    null,
                    2
                )
            );

            return res.json({
                success: true,
                message:
                    "Phone verification request rejected."
            });

        } catch (error) {

            console.error(
                "Reject phone verification error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject the request."
            });
        }
    }
);

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




const { ensureVolunteerDocumentsBucket } =
    require("./storage-setup");

ensureVolunteerDocumentsBucket()
    .then(() => {
        app.listen(PORT, () => {
            console.log(
                `Child Care Foundation API running on port ${PORT}`
            );
        });
    })
    .catch(error => {
        console.error(
            "Supabase Storage initialization failed:",
            error
        );

        process.exit(1);
    });

/*
ADMIN: UPDATE VOLUNTEER STATUS
*/

app.post(
    "/api/admin/volunteers/:id/status",
    requireAdmin,
    async (req, res) => {

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

            const { data: volunteer, error } = await supabase
                .from("volunteers")
                .update({
                    status,
                    updated_at: new Date().toISOString(),
                    ...(status === "approved"
                        ? { approved_at: new Date().toISOString() }
                        : {})
                })
                .eq("id", req.params.id)
                .select(
                    "id, volunteer_number, volunteer_id, full_name, phone, status, selfie_path, national_id_front_path, national_id_back_path, created_at, updated_at, approved_at"
                )
                .single();

            if (error) {

                if (error.code === "PGRST116") {
                    return res.status(404).json({
                        success: false,
                        message: "Volunteer not found."
                    });
                }

                console.error(
                    "Supabase volunteer status update error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to update volunteer status."
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
IMPACT IMAGE UPLOAD STORAGE
*/
const impactStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, impactDir);
    },
    filename: (req, file, cb) => {
        const category = String(req.body.category || "image")
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");

        const extension = path.extname(file.originalname).toLowerCase();

        cb(null, category + extension);
    }
});

const uploadImpact = multer({
    storage: impactStorage,
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


/*
PUBLIC: IMPACT IMAGES
*/
app.get(
    "/api/impact/images",
    (req, res) => {
        try {
            const categories = [
                "education",
                "food-nutrition",
                "healthcare",
                "community-outreach",
                "child-support",
                "hope-future"
            ];

            const images = {};

            for (const category of categories) {
                const files = fs.readdirSync(impactDir)
                    .filter(file => {
                        const name = path.parse(file).name.toLowerCase();
                        return name === category;
                    });

                if (files.length > 0) {
                    const file = files
                        .map(file => ({
                            file,
                            time: fs.statSync(
                                path.join(impactDir, file)
                            ).mtimeMs
                        }))
                        .sort((a, b) => b.time - a.time)[0].file;

                    images[category] =
                        `/uploads/impact/${file}`;
                } else {
                    images[category] = null;
                }
            }

            return res.json({
                success: true,
                images
            });

        } catch (error) {
            console.error(
                "Impact images error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load Impact images."
            });
        }
    }
);


/*
PUBLIC: WHAT WE DO IMAGES
*/
app.get(
    "/api/what-we-do/images",
    (req, res) => {
        try {
            const categories = [
                "education",
                "healthcare",
                "food-nutrition",
                "basic-needs"
            ];

            const images = {};

            for (const category of categories) {
                const files = fs.readdirSync(whatWeDoDir)
                    .filter(file => {
                        const name = path.parse(file).name.toLowerCase();
                        return name === category;
                    });

                if (files.length > 0) {
                    const file = files
                        .map(file => ({
                            file,
                            time: fs.statSync(
                                path.join(whatWeDoDir, file)
                            ).mtimeMs
                        }))
                        .sort((a, b) => b.time - a.time)[0].file;

                    images[category] =
                        `/uploads/what-we-do/${file}`;
                } else {
                    images[category] = null;
                }
            }

            return res.json({
                success: true,
                images
            });

        } catch (error) {
            console.error(
                "What We Do images error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load What We Do images."
            });
        }
    }
);


/*
ADMIN: WHAT WE DO IMAGE UPLOAD
*/
app.post(
    "/api/admin/what-we-do/upload",
    requireAdmin,
    uploadWhatWeDo.single("image"),
    (req, res) => {

        try {
            const allowedCategories = [
                "education",
                "healthcare",
                "food-nutrition",
                "basic-needs"
            ];

            const category = String(req.body.category || "")
                .toLowerCase()
                .trim();

            if (!allowedCategories.includes(category)) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(400).json({
                    success: false,
                    message: "Invalid What We Do category."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No image was uploaded."
                });
            }

            // Remove older image files for this category.
            const existingFiles = fs.readdirSync(whatWeDoDir);

            for (const existingFile of existingFiles) {
                const existingName = path.parse(existingFile).name.toLowerCase();

                if (
                    existingName === category &&
                    existingFile !== req.file.filename
                ) {
                    const existingPath = path.join(
                        whatWeDoDir,
                        existingFile
                    );

                    if (fs.existsSync(existingPath)) {
                        fs.unlinkSync(existingPath);
                    }
                }
            }

            return res.status(201).json({
                success: true,
                message: "What We Do image uploaded successfully.",
                category,
                image: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    url: `/uploads/what-we-do/${req.file.filename}`
                }
            });

        } catch (error) {

            console.error(
                "What We Do upload error:",
                error
            );

            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({
                success: false,
                message: "Unable to upload What We Do image."
            });
        }
    }
);

/*
ADMIN: IMPACT IMAGE UPLOAD
*/
app.post(
    "/api/admin/impact/upload",
    requireAdmin,
    uploadImpact.single("image"),
    (req, res) => {
        try {
            const allowedCategories = [
                "education",
                "food-nutrition",
                "healthcare",
                "community-outreach",
                "child-support",
                "hope-future"
            ];

            const category = String(req.body.category || "")
                .toLowerCase()
                .trim();

            if (!allowedCategories.includes(category)) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }

                return res.status(400).json({
                    success: false,
                    message: "Invalid Impact category."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No image was uploaded."
                });
            }

            // Remove older image files for this category.
            const existingFiles = fs.readdirSync(impactDir);

            for (const existingFile of existingFiles) {
                const existingName =
                    path.parse(existingFile).name.toLowerCase();

                if (
                    existingName === category &&
                    existingFile !== req.file.filename
                ) {
                    const existingPath =
                        path.join(impactDir, existingFile);

                    if (fs.existsSync(existingPath)) {
                        fs.unlinkSync(existingPath);
                    }
                }
            }

            return res.status(201).json({
                success: true,
                message: "Impact image uploaded successfully.",
                category,
                image: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    url: `/uploads/impact/${req.file.filename}`
                }
            });

        } catch (error) {
            console.error(
                "Impact upload error:",
                error
            );

            if (
                req.file &&
                req.file.path &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({
                success: false,
                message: "Unable to upload Impact image."
            });
        }
    }
);


/*
ADMIN: VIDEO UPLOAD
*/
app.post(
    "/api/admin/videos/upload",
    requireAdmin,
    uploadVideo.single("video"),
    (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No video was uploaded."
                });
            }

            return res.status(201).json({
                success: true,
                message: "Video uploaded successfully.",
                video: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    url: `/uploads/videos/${req.file.filename}`
                }
            });
        } catch (error) {
            console.error("Video upload error:", error);

            if (
                req.file &&
                req.file.path &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({
                success: false,
                message: "Unable to upload video."
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



