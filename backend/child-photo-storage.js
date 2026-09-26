const crypto = require("crypto");
const path = require("path");
const supabase = require("./supabase");

const BUCKET_NAME = "child-photos";

async function uploadChildPhoto({
    registrationId,
    file
}) {
    if (!file || !file.buffer) {
        throw new Error("Missing child photo.");
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
        `${registrationId}/${fileName}`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) {
        throw new Error(
            `Unable to upload child photo: ${error.message}`
        );
    }

    return storagePath;
}

module.exports = {
    uploadChildPhoto
};
