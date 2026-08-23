require("dotenv").config();

console.log("=== FLUTTERWAVE TEST ===");
console.log("Public:", process.env.FLW_PUBLIC_KEY ? "LOADED" : "MISSING");
console.log("Secret:", process.env.FLW_SECRET_KEY ? "LOADED" : "MISSING");
console.log("Encryption:", process.env.FLW_ENCRYPTION_KEY ? "LOADED" : "MISSING");
console.log("========================");
