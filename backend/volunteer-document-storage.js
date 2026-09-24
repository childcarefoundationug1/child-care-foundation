const crypto = require("crypto");
const path = require("path");
const supabase = require("./supabase");

const BUCKET_NAME = "volunteer-documents";

async function uploadVolunteerDocument({
    volunteerId,
    documentType,
    file
}) {
    if (!file || !file.buffer) {
        throw new Error(
            `Missing ${documentType} document.`
        );
    }

    const extension =
        path.extname(file.originalname || "").toLowerCase() ||
        ".jpg";

    const safeExtension =
        [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
            ? extension
            : ".jpg";

    const fileName =
        `${Date.now()}-${crypto.randomUUID()}${safeExtension}`;

    const storagePath =
        `${volunteerId}/${documentType}/${fileName}`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) {
        throw new Error(
            `Unable to upload ${documentType}: ${error.message}`
        );
    }

    return storagePath;
}

module.exports = {
    uploadVolunteerDocument
};
