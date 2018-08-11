const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed login',
  successRedirect: '/',
  successFlash: 'You are now logged in'
});

exports.logout = (req, res) => {
  // must be a passport method
  req.logout();
  req.flash('success', 'You are now logged out!');
  res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
  // check if user is authenticated, via passport method
  if (req.isAuthenticated()) {
    next(); // go ahead, they're logged in
    return;
  }
  req.flash('error', 'Oops! You must be logged in to do that');
  res.redirect('/login');
};

exports.forgot = async (req, res) => {
  // see if a user with that email exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash('error', 'No account with that email exists');
    // req.flash('success', 'A password reset link has been emailed');
    res.redirect('/login');
    return;
  }
  // if there is a user, set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
  // put those values in the database
  await user.save();
  // send them an email with the token
  const resetUrl = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user,
    subject: 'Password reset',
    resetUrl,
    filename: 'password-reset'
  });

  req.flash('success', 'A password reset link has been emailed.');
  // redirect to login page
  res.redirect('/login');
};

exports.reset = async (req, res) => {
  // check if there's a user with this token
  // check if that token is not expired
  const user = await User.findOne({ 
    resetPasswordToken: req.params.token,
    // mongodb operator $gt = greater than
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash('error', 'Password reset token is invalid or has expired');
    return res.redirect('/login');
  }
  // otherwise, render the reset password form
  res.render('reset', { title: 'Reset your password' });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    next();
    return; 
  }
  req.flash('error', 'Passwords do not match');
  return redirect('back');
};

exports.update = async (req, res) => {
  const user = await User.findOne({ 
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  if (!user) {
    req.flash('error', 'Password reset token is invalid or has expired');
    return res.redirect('/login');
  }
  // method made available by passport.js plugin on User schema
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  // another method provided by passport.js
  await req.login(updatedUser);
  req.flash('success', 'Nice! Your password has been reset. You are now logged in');
  res.redirect('/');
};