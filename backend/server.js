const express = require("express");
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
    path: __dirname + "/.env",
    override: true
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
    "https://child-care-foundation-website-production.up.railway.app"
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || FRONTEND_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

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
CREATE DONATION
*/

app.post("/api/donate/mtn", (req, res) => {

    try {

        const {
            name,
            phone,
            amount
        } = req.body;

        if (!name || !phone || !amount) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, phone number and amount are required."

            });

        }

        const numericAmount =
            Number(amount);

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

        const reference =
            createReference();

        const donation = {

            reference,

            donor_name:
                name.trim(),

            phone:
                normalizeUgandaPhone(phone),

            amount:
                numericAmount,

            payment_method:
                "MTN Mobile Money",

            status:
                "pending",

            created_at:
                new Date().toISOString(),

            updated_at:
                new Date().toISOString()

        };

        addDonation(donation);
        console.log(
            `Donation created: ${reference}`
        );

        return res.json({

            success: true,

            reference,

            status: "pending",

            payment_method:
                "MTN Mobile Money",

            payment_number:
                "+256793449784",

            amount:
                numericAmount,

            instructions: [

                "Send the money to the MTN Mobile Money number above.",

                "Complete the payment using your Mobile Money PIN on your phone.",

                "Return to the website and tap 'I've Paid'.",

                "The foundation will verify your payment."

            ],

            message:
                "Thank you for supporting Child Care Foundation."

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,


            message:
                "Unable to create donation."

        });

    }

});

/* 
CREATE AIRTEL DONATION
*/
app.post("/api/donate/airtel", (req, res) => {
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

        const reference = createReference();

        const donation = {
            reference,
            donor_name: name.trim(),
            phone: normalizeUgandaPhone(phone),
            amount: numericAmount,
            payment_method: "Airtel Money",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        addDonation(donation);

        return res.json({
            success: true,
            reference,
            status: "pending",
            payment_method: "Airtel Money",
            payment_number: "+256730463790",
            account_name: "Given Okongo",
            amount: numericAmount,
            instructions: [
                "Send the money to the Airtel Money number above.",
                "Complete the payment using your Airtel Money PIN.",
                "Return to the website and tap 'I've Paid'.",
                "The foundation will verify your payment."
            ],
            message: "Thank you for supporting Child Care Foundation."
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to create Airtel donation."
        });
    }
});

      
/*
CREATE CARD DONATION (FLUTTERWAVE)
*/
app.post("/api/donate/card", async (req, res) => {
    try {
        const { name, email, amount } = req.body;

        if (!name || !email || !amount) {
            return res.status(400).json({
                success: false,
                message: "Name, email and amount are required."
            });
        }

        const numericAmount = Number(amount);

        if (!Number.isInteger(numericAmount) || numericAmount < 500) {
            return res.status(400).json({
                success: false,
                message: "Donation amount must be at least UGX 500."
            });
        }

        const reference = createReference();

        addDonation({
            reference,
            donor_name: name.trim(),
            phone: "",
            email: email.trim(),
            amount: numericAmount,
            payment_method: "Card Payment",
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        const flutterwaveResponse = await fetch(
            "https://api.flutterwave.com/v3/payments",
            {
                method: "POST",
                headers: {
                    "Authorization":
                        `Bearer ${process.env.FLW_SECRET_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    tx_ref: reference,
                    amount: numericAmount,
                    currency: "UGX",
                    redirect_url:
                        "https://child-care-foundation-website-production.up.railway.app/payment-success.html",
                    customer: {
                        email: email.trim(),
                        name: name.trim()
                    },
                    customizations: {
                        title: "Child Care Foundation",
                        description: "Donation"
                    },
                    payment_options: "card"
                })
            }
        );

        const result = await flutterwaveResponse.json();

        if (!flutterwaveResponse.ok || result.status !== "success") {
            console.error(
                "Flutterwave checkout response:",
                result
            );

            updateDonation(reference, {
                status: "failed",
                failure_reason:
                    result.message ||
                    "Flutterwave checkout request failed."
            });

            return res.status(502).json({
                success: false,
                message:
                    result.message ||
                    "Unable to start card payment."
            });
        }

        res.json({
            success: true,
            reference,
            checkout_url: result.data.link
        });

    } catch (error) {
        console.error("CARD PAYMENT ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Unable to start card payment."
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


