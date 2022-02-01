const { isValidObjectId } = require("mongoose");
const User = require("../model/user");
const ResetToken = require("../model/resetToken");
const { sendError } = require("../utils/helper");

exports.isResetTokenValid = async (req, res, next) => {
  const { token, id } = req.query;

  if (!token || !id)
    return sendError(res, "Invalid request to reset password!");

  if (!isValidObjectId(id)) return sendError(res, "Invalid user!");

  const user = await User.findById(id);
  if (!user) return sendError(res, "User not found!");

  const resetToken = await ResetToken.findOne({ owner: user._id });
  if (!resetToken) return sendError(res, "Token not found!");

  const isValid = await resetToken.compareToken(token);
  if (!isValid) return sendError(res, "Token is not valid!");

  req.user = user;
  next();
};
