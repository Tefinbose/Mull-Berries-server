import dotenv from "dotenv";
import Razorpay from "razorpay";

dotenv.config({ path: ".env" });

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log("RAZORPAY KEY ID:", keyId);
console.log("RAZORPAY SECRET EXISTS:", Boolean(keySecret));

if (!keyId || !keySecret) {
  throw new Error(
    "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required"
  );
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export default razorpay;