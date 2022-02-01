const User = require("../model/user");
const { sendError, createRandomBytes } = require("../utils/helper");
const jwt = require("jsonwebtoken");
const {
  generateOTP,
  mailTransport,
  otpEmail,
  accountVerifiedEmail,
  passwordResetEmail,
  passwordResetSuccessfulEmail,
} = require("../utils/mail");
const VerificationToken = require("../model/verificationToken");
const { isValidObjectId } = require("mongoose");
const ResetToken = require("../model/resetToken");
const resetToken = require("../model/resetToken");

exports.createUser = async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.findOne({ email });

  if (user) return sendError(res, "This email already exists!", 400);

  const newUser = new User({
    name,
    email,
    password,
  });

  const OTP = generateOTP();
  const verificationToken = new VerificationToken({
    owner: newUser._id,
    token: OTP,
  });

  await verificationToken.save();
  await newUser.save();

  mailTransport().sendMail({
    from: "emailverification@resume2.io",
    to: newUser.email,
    subject: "Verify your email account for Resume2",
    html: otpEmail(OTP),
  });

  res.send(newUser);
};

exports.signin = async (req, res) => {
  const { email, password } = req.body;
  if (!email.trim() || !password.trim())
    return sendError(res, "Email/password missing!", 400);

  const user = await User.findOne({ email });
  if (!user) return sendError(res, "User not found!");

  const isMatched = await user.comparePassword(password);
  if (!isMatched) return sendError(res, "Email/password does not match!");

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({
    success: true,
    user: { name: user.name, email: user.email, id: user._id, token },
  });
};

exports.verifyEmail = async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp.trim())
    return sendError(res, "Invalid request, missing parameters!");

  if (!isValidObjectId(userId)) return sendError(res, "Invalid user id!");

  const user = await User.findById(userId);
  if (!user) return sendError(res, "User not found!");
  if (user.verified) return sendError(res, "This account is already verified!");

  const token = await VerificationToken.findOne({ owner: user._id });
  if (!token) return sendError(res, "User not found!");

  const isMatched = await token.compareToken(otp);
  if (!isMatched) return sendError(res, "Token invalid!");

  user.verified = true;

  await VerificationToken.findByIdAndDelete(token._id);
  await user.save();

  mailTransport().sendMail({
    from: "welcome@resume2.io",
    to: user.email,
    subject: "Account Verified for Resume2",
    html: accountVerifiedEmail(),
  });

  res.json({
    success: true,
    message: "Your email is verified.",
    user: { name: user.name, email: user.email, id: user._id },
  });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, "Please provide a valid email!");

  const user = await User.findOne({ email });
  if (!user) return sendError(res, "User not found, invalid request!");

  const token = await ResetToken.findOne({ owner: user._id });
  if (token)
    return sendError(
      res,
      "A token already exists, you can only generate one token per hour!"
    );

  const randomBytes = await createRandomBytes();
  const resetToken = new ResetToken({ owner: user._id, token: randomBytes });
  await resetToken.save();

  mailTransport().sendMail({
    from: "security@resume2.io",
    to: user.email,
    subject: "Password Reset for Resume2",
    html: passwordResetEmail(
      `http://localhost:3000/reset-password?token=${randomBytes}&id=${user._id}`
    ),
  });

  res.json({
    success: true,
    message: "Password reset link send through email.",
  });
};

exports.resetPassword = async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) return sendError(res, "User not found!");

  const isSamePassword = await user.comparePassword(password);
  if (isSamePassword) return sendError(res, "New password must be different!");

  if (password.trim().length < 8 || password.trim().length > 20)
    return sendError(res, "Password must be between 8 and 20 characters long");

  user.password = password.trim();
  await user.save();

  await ResetToken.findOneAndDelete({ owner: user._id });

  mailTransport().sendMail({
    from: "security@resume2.io",
    to: user.email,
    subject: "Password Reset Successfully",
    html: passwordResetSuccessfulEmail(),
  });

  res.json({ success: true, message: "Password reset successfully" });
};
